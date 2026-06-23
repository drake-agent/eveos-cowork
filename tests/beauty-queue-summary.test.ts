import { describe, expect, it } from 'vitest';
import { summarizeBeautyQueueSnapshot } from '../src/renderer/components/beauty/beauty-queue-summary';

describe('summarizeBeautyQueueSnapshot', () => {
  it('normalizes analyst queue arrays into operational counts and rows', () => {
    const summary = summarizeBeautyQueueSnapshot(
      {
        observed_at: '2026-06-23T14:15:00.000Z',
        max_workers: 1,
        jobs: [
          {
            run_id: 'run-1',
            status: 'running',
            market: 'KR',
            brand: 'BANILA CO',
            question: 'Clean It Zero renewal',
            updated_at: '2026-06-23T14:14:00.000Z',
          },
          {
            id: 'run-2',
            state: 'queued',
            market: 'JP',
            brand: 'BANILA CO',
            question: 'Qoo10 ranking reason',
            created_at: '2026-06-23T14:12:00.000Z',
          },
          {
            id: 'run-3',
            status: 'failed',
            error: 'timeout',
          },
        ],
      },
      '2026-06-23T14:15:30.000Z'
    );

    expect(summary.counts).toEqual({
      total: 3,
      running: 1,
      waiting: 1,
      succeeded: 0,
      failed: 1,
      unknown: 0,
    });
    expect(summary.maxWorkers).toBe(1);
    expect(summary.observedAtLabel).toBe('Jun 23, 02:15 PM');
    expect(summary.isStale).toBe(false);
    expect(summary.rows[0]).toMatchObject({
      id: 'run-1',
      status: 'running',
      label: 'Clean It Zero renewal',
      market: 'KR',
      brand: 'BANILA CO',
    });
    expect(summary.rows[1]).toMatchObject({
      id: 'run-2',
      status: 'waiting',
      label: 'Qoo10 ranking reason',
    });
  });

  it('marks stale or unavailable queue snapshots explicitly', () => {
    const summary = summarizeBeautyQueueSnapshot(
      {
        observed_at: '2026-06-23T13:00:00.000Z',
        items: [],
      },
      '2026-06-23T14:15:30.000Z'
    );

    expect(summary.counts.total).toBe(0);
    expect(summary.isStale).toBe(true);
    expect(summary.stateLabel).toBe('No active analyst jobs');
  });
});
