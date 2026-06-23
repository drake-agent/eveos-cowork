#!/usr/bin/env node

import Store from 'electron-store';

const DEFAULT_BASE_URL = 'https://beauty.eveos.one';
const STORE_OPTIONS = {
  name: 'beauty-api',
  projectName: 'eveos-cowork',
  defaults: {
    baseUrl: DEFAULT_BASE_URL,
    token: '',
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  encryptionKey: 'eveos-beauty-api-config-stable-v1',
};

const BEARER_PATTERN = /(Bearer\s+)[^\s"'<>]+/gi;
const AUTH_HEADER_PATTERN = /(Authorization\s*:\s*Bearer\s+)[^\s"'<>]+/gi;
const TOKEN_LIKE_PATTERN = /((?:api[_-]?key|token|cookie)\s*=\s*)[^\s"'&<>]+/gi;

export function redactBeautySmokeText(value, token = '') {
  let redacted = String(value)
    .replace(AUTH_HEADER_PATTERN, '$1[REDACTED]')
    .replace(BEARER_PATTERN, '$1[REDACTED]')
    .replace(TOKEN_LIKE_PATTERN, '$1[REDACTED]');

  if (token) {
    redacted = redacted.split(token).join('[REDACTED]');
  }

  return redacted;
}

export function readEncryptedBeautyStoreConfig() {
  try {
    const store = new Store(STORE_OPTIONS);
    const raw = store.store ?? {};
    return {
      baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : '',
      token: typeof raw.token === 'string' ? raw.token : '',
    };
  } catch (error) {
    return {
      baseUrl: '',
      token: '',
      warning: `Could not read encrypted Beauty config store: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export function resolveBeautySmokeConfig({
  env = process.env,
  readStoreConfig = readEncryptedBeautyStoreConfig,
} = {}) {
  const storeConfig = readStoreConfig() ?? {};
  const envBaseUrl = env.EVEOS_BEAUTY_API_BASE_URL?.trim();
  const envToken = env.EVEOS_BEAUTY_API_TOKEN?.trim();
  const storeBaseUrl = typeof storeConfig.baseUrl === 'string' ? storeConfig.baseUrl.trim() : '';
  const storeToken = typeof storeConfig.token === 'string' ? storeConfig.token.trim() : '';
  const baseUrl = (envBaseUrl || storeBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const token = envToken || storeToken;

  return {
    baseUrl,
    token,
    authSource: envToken ? 'env' : storeToken ? 'encrypted-store' : 'missing',
    storeWarning: typeof storeConfig.warning === 'string' ? storeConfig.warning : '',
  };
}

export async function runBeautyApiSmoke({
  env = process.env,
  fetchImpl = fetch,
  logger = console.log,
  readStoreConfig = readEncryptedBeautyStoreConfig,
} = {}) {
  const config = resolveBeautySmokeConfig({ env, readStoreConfig });

  logger(`[beauty-smoke] baseUrl=${config.baseUrl}`);
  logger(`[beauty-smoke] authSource=${config.authSource}`);
  if (config.storeWarning) {
    logger(`[beauty-smoke] ${redactBeautySmokeText(config.storeWarning, config.token)}`);
  }

  if (!config.token) {
    throw new Error(
      'Beauty API token is not configured. Save it in EveOS Beauty or set EVEOS_BEAUTY_API_TOKEN for this smoke run.'
    );
  }

  await checkEndpoint({
    fetchImpl,
    url: `${config.baseUrl}/health`,
    expectedStatus: 200,
    token: config.token,
    label: 'health',
    logger,
  });
  await checkEndpoint({
    fetchImpl,
    url: `${config.baseUrl}/tools`,
    expectedStatus: 200,
    token: config.token,
    label: 'tools',
    logger,
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  logger('[beauty-smoke] Beauty API smoke passed');

  return {
    ok: true,
    baseUrl: config.baseUrl,
    authSource: config.authSource,
  };
}

async function checkEndpoint({
  fetchImpl,
  url,
  expectedStatus,
  token,
  label,
  logger,
  headers = {},
}) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers,
  });
  const body = await response.text();

  if (response.status !== expectedStatus) {
    const safeBody = redactBeautySmokeText(body || response.statusText, token);
    throw new Error(
      `${label} check failed: expected HTTP ${expectedStatus}, got HTTP ${response.status}. ${safeBody}`
    );
  }

  logger(`[beauty-smoke] ${label}=HTTP ${response.status}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBeautyApiSmoke().catch((error) => {
    const config = resolveBeautySmokeConfig();
    console.error(`[beauty-smoke] FAILED: ${redactBeautySmokeText(error.message, config.token)}`);
    process.exitCode = 1;
  });
}
