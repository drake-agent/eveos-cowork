import { describe, expect, it, vi } from 'vitest';
import { registerBeautyIpcHandlers } from '../src/main/beauty/beauty-ipc';
import type { BeautyConfigStoreLike } from '../src/main/beauty/beauty-config-store';

class FakeIpcMain {
  readonly handlers = new Map<string, (...args: unknown[]) => unknown>();

  handle(channel: string, listener: (...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  invoke(channel: string, ...args: unknown[]): unknown {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`Missing handler: ${channel}`);
    }
    return handler({}, ...args);
  }
}

function createConfigStore(): BeautyConfigStoreLike {
  let baseUrl = 'https://beauty.eveos.one';
  let token = '';
  return {
    getPublicConfig: () => ({
      baseUrl,
      hasToken: token.length > 0,
      updatedAt: '2026-06-23T00:00:00.000Z',
    }),
    getSecretConfig: () => ({ baseUrl, token }),
    save: (input) => {
      if (input.baseUrl !== undefined) {
        baseUrl = input.baseUrl;
      }
      if (input.token !== undefined) {
        token = input.token;
      }
      return {
        baseUrl,
        hasToken: token.length > 0,
        updatedAt: '2026-06-23T00:00:00.000Z',
      };
    },
  };
}

describe('registerBeautyIpcHandlers', () => {
  it('registers Beauty API channels and never returns the bearer token from config save', async () => {
    const ipc = new FakeIpcMain();
    registerBeautyIpcHandlers(ipc, {
      configStore: createConfigStore(),
      createClient: () => ({
        health: vi.fn(),
        tools: vi.fn(),
        intentBrief: vi.fn(),
        startAnalystRun: vi.fn(),
        answerResult: vi.fn(),
        analystQueue: vi.fn(),
      }),
    });

    const saved = await ipc.invoke('beauty.saveConfig', {
      baseUrl: 'https://beauty.eveos.one/',
      token: 'secret-token',
    });

    expect(saved).toEqual({
      success: true,
      config: {
        baseUrl: 'https://beauty.eveos.one/',
        hasToken: true,
        updatedAt: '2026-06-23T00:00:00.000Z',
      },
    });
    expect(JSON.stringify(saved)).not.toContain('secret-token');
  });

  it('routes protected analyst requests through the injected main-process client', async () => {
    const ipc = new FakeIpcMain();
    const startAnalystRun = vi.fn(async () => ({ run_id: 'api-123', status: 'QUEUED' }));
    registerBeautyIpcHandlers(ipc, {
      configStore: createConfigStore(),
      createClient: () => ({
        health: vi.fn(),
        tools: vi.fn(),
        intentBrief: vi.fn(),
        startAnalystRun,
        answerResult: vi.fn(),
        analystQueue: vi.fn(),
      }),
    });

    const payload = {
      question: 'What should BANILA CO make next?',
      market: 'KR',
      brand: 'BANILA CO',
      wait: false,
    };

    await expect(ipc.invoke('beauty.analystRun', payload)).resolves.toEqual({
      run_id: 'api-123',
      status: 'QUEUED',
    });
    expect(startAnalystRun).toHaveBeenCalledWith(payload);
  });
});
