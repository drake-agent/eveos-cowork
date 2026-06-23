import { describe, expect, it, vi } from 'vitest';
import { registerBeautyIpcHandlers } from '../src/main/beauty/beauty-ipc';
import type { BeautyConfigStoreLike } from '../src/main/beauty/beauty-config-store';
import type { BeautyPacketStoreLike } from '../src/main/beauty/beauty-packet-store';

class FakeIpcMain {
  readonly handlers = new Map<string, (...args: unknown[]) => unknown>();

  handle(channel: string, listener: (...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`Missing handler: ${channel}`);
    }
    return Promise.resolve(handler({}, ...args));
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

function createPacketStore(): BeautyPacketStoreLike {
  const packets: unknown[] = [];
  return {
    save: (input) => {
      const packet = {
        id: 'packet-1',
        createdAt: '2026-06-23T00:00:00.000Z',
        updatedAt: '2026-06-23T00:00:00.000Z',
        ...input,
      };
      packets.unshift(packet);
      return packet;
    },
    list: () => packets,
    get: (id) => packets.find((packet) => (packet as { id: string }).id === id) || null,
    delete: (id) => {
      const index = packets.findIndex((packet) => (packet as { id: string }).id === id);
      if (index >= 0) {
        packets.splice(index, 1);
        return true;
      }
      return false;
    },
  };
}

describe('registerBeautyIpcHandlers', () => {
  it('registers Beauty API channels and never returns the bearer token from config save', async () => {
    const ipc = new FakeIpcMain();
    registerBeautyIpcHandlers(ipc, {
      configStore: createConfigStore(),
      packetStore: createPacketStore(),
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
      packetStore: createPacketStore(),
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

  it('exposes packet history channels through the main-process boundary', async () => {
    const ipc = new FakeIpcMain();
    registerBeautyIpcHandlers(ipc, {
      configStore: createConfigStore(),
      packetStore: createPacketStore(),
      createClient: () => ({
        health: vi.fn(),
        tools: vi.fn(),
        intentBrief: vi.fn(),
        startAnalystRun: vi.fn(),
        answerResult: vi.fn(),
        analystQueue: vi.fn(),
      }),
    });

    const saved = await ipc.invoke('beauty.savePacket', {
      question: 'What should BANILA CO make next?',
      market: 'KR',
      brand: 'BANILA CO',
      answer: { citations: [{ source_table: 'evidence_cards' }] },
    });

    expect(JSON.stringify(saved)).toContain('evidence_cards');
    await expect(ipc.invoke('beauty.listPackets', { market: 'KR' })).resolves.toEqual([saved]);
    await expect(ipc.invoke('beauty.getPacket', 'packet-1')).resolves.toEqual(saved);
    await expect(ipc.invoke('beauty.deletePacket', 'packet-1')).resolves.toEqual({
      success: true,
    });
  });
});
