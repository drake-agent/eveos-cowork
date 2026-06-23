#!/usr/bin/env node

import Store from 'electron-store';
import { redactBeautySmokeText } from './smoke-beauty-api.mjs';

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

export function resolveBeautyApiConfigInput({
  env = process.env,
  now = () => new Date(),
} = {}) {
  const token = env.EVEOS_BEAUTY_API_TOKEN?.trim() || '';

  if (!token) {
    throw new Error('EVEOS_BEAUTY_API_TOKEN is required to save the Beauty API token.');
  }

  return {
    baseUrl: (env.EVEOS_BEAUTY_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    token,
    updatedAt: now().toISOString(),
  };
}

export function saveBeautyApiConfig({
  env = process.env,
  createStore = () => new Store(STORE_OPTIONS),
  now = () => new Date(),
  logger = console.log,
} = {}) {
  const config = resolveBeautyApiConfigInput({ env, now });
  const store = createStore();

  store.store = config;

  logger(`[beauty-config] baseUrl=${config.baseUrl}`);
  logger('[beauty-config] token=saved');
  logger(`[beauty-config] updatedAt=${config.updatedAt}`);

  return {
    ok: true,
    baseUrl: config.baseUrl,
    hasToken: true,
    updatedAt: config.updatedAt,
  };
}

export async function runBeautyApiConfigCli({
  env = process.env,
  createStore = () => new Store(STORE_OPTIONS),
  now = () => new Date(),
  logger = console.log,
  errorLogger = console.error,
} = {}) {
  try {
    saveBeautyApiConfig({ env, createStore, now, logger });
    return { ok: true, exitCode: 0 };
  } catch (error) {
    errorLogger(
      `[beauty-config] FAILED: ${redactBeautySmokeText(
        error instanceof Error ? error.message : String(error),
        env.EVEOS_BEAUTY_API_TOKEN || ''
      )}`
    );
    return { ok: false, exitCode: 1 };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBeautyApiConfigCli().then((result) => {
    process.exitCode = result.exitCode;
  });
}
