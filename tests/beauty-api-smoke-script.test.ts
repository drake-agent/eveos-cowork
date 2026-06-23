import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

async function loadSmokeModule() {
  return await import('../scripts/smoke-beauty-api.mjs');
}

async function loadConfigModule() {
  return await import('../scripts/save-beauty-api-config.mjs');
}

describe('Beauty API real smoke script', () => {
  it('adds npm scripts for non-secret Beauty API smoke checks', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

    expect(pkg.scripts['smoke:beauty-api']).toBe('node scripts/smoke-beauty-api.mjs');
    expect(pkg.scripts['smoke:beauty-real']).toBe(
      'npm run smoke:electron && npm run smoke:beauty-api'
    );
    expect(pkg.scripts['beauty:save-token']).toBe('node scripts/save-beauty-api-config.mjs');
    expect(fs.existsSync(path.join(root, 'scripts/smoke-beauty-api.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'scripts/save-beauty-api-config.mjs'))).toBe(true);
    expect(readme).toContain('--token-stdin');
    expect(readme).toContain('Safer shell-history path');
  });

  it('checks health and authenticated tools without logging the token', async () => {
    const { runBeautyApiSmoke } = await loadSmokeModule();
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: init?.headers });
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.endsWith('/tools') && init?.headers?.Authorization === 'Bearer real-secret-token') {
        return new Response(JSON.stringify({ tools: ['health', 'answer-result'] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ error: 'Authorization: Bearer real-secret-token' }), {
        status: 401,
      });
    });
    const logs: string[] = [];

    const result = await runBeautyApiSmoke({
      env: {
        EVEOS_BEAUTY_API_BASE_URL: 'https://beauty.eveos.one',
        EVEOS_BEAUTY_API_TOKEN: 'real-secret-token',
      },
      fetchImpl,
      logger: (message: string) => logs.push(message),
      readStoreConfig: () => ({ baseUrl: 'https://wrong.example', token: 'store-secret' }),
    });

    expect(result).toMatchObject({
      ok: true,
      baseUrl: 'https://beauty.eveos.one',
      authSource: 'env',
    });
    expect(calls.map((call) => call.url)).toEqual([
      'https://beauty.eveos.one/health',
      'https://beauty.eveos.one/tools',
    ]);
    expect(calls[1].headers).toMatchObject({ Authorization: 'Bearer real-secret-token' });
    expect(logs.join('\n')).toContain('Beauty API smoke passed');
    expect(logs.join('\n')).not.toContain('real-secret-token');
    expect(logs.join('\n')).not.toContain('store-secret');
  });

  it('falls back to the encrypted app store config when env token is absent', async () => {
    const { runBeautyApiSmoke } = await loadSmokeModule();
    const fetchImpl = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      if (url.endsWith('/health')) {
        return new Response('{}', { status: 200 });
      }
      if (init?.headers?.Authorization === 'Bearer store-secret-token') {
        return new Response('{}', { status: 200 });
      }
      return new Response('missing auth', { status: 401 });
    });
    const logs: string[] = [];

    const result = await runBeautyApiSmoke({
      env: {},
      fetchImpl,
      logger: (message: string) => logs.push(message),
      readStoreConfig: () => ({
        baseUrl: 'https://beauty.eveos.one/',
        token: 'store-secret-token',
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      baseUrl: 'https://beauty.eveos.one',
      authSource: 'encrypted-store',
    });
    expect(logs.join('\n')).not.toContain('store-secret-token');
  });

  it('saves Beauty API config to the app store without logging the token', async () => {
    const { saveBeautyApiConfig } = await loadConfigModule();
    const logs: string[] = [];
    const writes: unknown[] = [];
    const fakeStore = {
      set store(value: unknown) {
        writes.push(value);
      },
    };

    const result = saveBeautyApiConfig({
      env: {
        EVEOS_BEAUTY_API_BASE_URL: 'https://beauty.eveos.one/',
        EVEOS_BEAUTY_API_TOKEN: 'save-secret-token',
      },
      createStore: () => fakeStore,
      now: () => new Date('2026-06-23T14:00:00.000Z'),
      logger: (message: string) => logs.push(message),
    });

    expect(result).toEqual({
      ok: true,
      baseUrl: 'https://beauty.eveos.one',
      hasToken: true,
      updatedAt: '2026-06-23T14:00:00.000Z',
    });
    expect(writes).toEqual([
      {
        baseUrl: 'https://beauty.eveos.one',
        token: 'save-secret-token',
        updatedAt: '2026-06-23T14:00:00.000Z',
      },
    ]);
    expect(logs.join('\n')).toContain('token=saved');
    expect(logs.join('\n')).not.toContain('save-secret-token');
  });

  it('saves Beauty API config from stdin without requiring the token in env', async () => {
    const { saveBeautyApiConfig } = await loadConfigModule();
    const logs: string[] = [];
    const writes: unknown[] = [];
    const fakeStore = {
      set store(value: unknown) {
        writes.push(value);
      },
    };

    const result = saveBeautyApiConfig({
      env: {
        EVEOS_BEAUTY_API_BASE_URL: 'https://beauty.eveos.one/',
      },
      argv: ['--token-stdin'],
      readStdin: () => 'stdin-secret-token\n',
      createStore: () => fakeStore,
      now: () => new Date('2026-06-23T14:05:00.000Z'),
      logger: (message: string) => logs.push(message),
    });

    expect(result).toEqual({
      ok: true,
      baseUrl: 'https://beauty.eveos.one',
      hasToken: true,
      updatedAt: '2026-06-23T14:05:00.000Z',
    });
    expect(writes).toEqual([
      {
        baseUrl: 'https://beauty.eveos.one',
        token: 'stdin-secret-token',
        updatedAt: '2026-06-23T14:05:00.000Z',
      },
    ]);
    expect(logs.join('\n')).toContain('token=saved');
    expect(logs.join('\n')).not.toContain('stdin-secret-token');
  });

  it('reports missing token through the config CLI without a stack trace', async () => {
    const { runBeautyApiConfigCli } = await loadConfigModule();
    const errors: string[] = [];

    const result = await runBeautyApiConfigCli({
      env: {},
      logger: () => undefined,
      errorLogger: (message: string) => errors.push(message),
      createStore: () => {
        throw new Error('store should not be created without token');
      },
    });

    expect(result).toEqual({ ok: false, exitCode: 1 });
    expect(errors.join('\n')).toContain('EVEOS_BEAUTY_API_TOKEN is required');
    expect(errors.join('\n')).not.toContain('at resolveBeautyApiConfigInput');
  });
});
