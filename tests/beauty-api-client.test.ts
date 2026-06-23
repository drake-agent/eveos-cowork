import { describe, expect, it, vi } from 'vitest';
import {
  BeautyApiClient,
  BeautyApiError,
  redactBeautyApiSecret,
} from '../src/main/beauty/beauty-api-client';

describe('BeautyApiClient', () => {
  it('calls health without an authorization header', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new BeautyApiClient({
      baseUrl: 'https://beauty.eveos.one',
      tokenProvider: () => 'secret-token',
      fetchImpl,
    });

    await expect(client.health()).resolves.toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://beauty.eveos.one/health',
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      })
    );
  });

  it('attaches bearer auth for protected requests in the main-process client', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ run_id: 'api-123', status: 'QUEUED' }), { status: 200 })
    );
    const client = new BeautyApiClient({
      baseUrl: 'https://beauty.eveos.one/',
      tokenProvider: () => 'secret-token',
      fetchImpl,
    });

    await expect(
      client.startAnalystRun({
        question: 'How should BANILA CO renew Clean It Zero Original?',
        market: 'KR',
        brand: 'BANILA CO',
        product: 'Clean It Zero Original',
        decision_type: 'renewal_strategy',
        wait: false,
      })
    ).resolves.toEqual({ run_id: 'api-123', status: 'QUEUED' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://beauty.eveos.one/analyst-run',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('redacts bearer tokens from error messages', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'bad Authorization: Bearer secret-token' }), {
          status: 401,
          statusText: 'Unauthorized',
        })
    );
    const client = new BeautyApiClient({
      baseUrl: 'https://beauty.eveos.one',
      tokenProvider: () => 'secret-token',
      fetchImpl,
    });

    await expect(client.tools()).rejects.toThrow(BeautyApiError);
    await expect(client.tools()).rejects.not.toThrow('secret-token');
  });

  it('redacts token-like strings from arbitrary diagnostics', () => {
    expect(redactBeautyApiSecret('Authorization: Bearer abc.def-123_secret')).toBe(
      'Authorization: Bearer [REDACTED]'
    );
    expect(redactBeautyApiSecret('api_key=sk-test-1234567890abcdef')).toBe('api_key=[REDACTED]');
  });
});
