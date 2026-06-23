import { describe, expect, it } from 'vitest';
import { BeautyPacketStore } from '../src/main/beauty/beauty-packet-store';

class MemoryStore<T extends Record<string, unknown>> {
  store: T;

  constructor(defaults: T) {
    this.store = { ...defaults };
  }
}

describe('BeautyPacketStore', () => {
  it('saves decision packets with citations and returns newest first', () => {
    const store = new BeautyPacketStore({
      backend: new MemoryStore({ packets: [] }),
      idFactory: () => 'packet-1',
      now: () => '2026-06-23T12:00:00.000Z',
    });

    const saved = store.save({
      question: 'How should BANILA CO renew Clean It Zero Original?',
      market: 'KR',
      brand: 'BANILA CO',
      product: 'Clean It Zero Original',
      decision_type: 'renewal_strategy',
      run_id: 'api-123',
      answer: {
        observed_facts: ['Olive Young ranking evidence exists.'],
        citations: [{ source_table: 'evidence_cards', source_url: 'https://example.com' }],
      },
      brief: { prompt: 'Think deeply with evidence.' },
    });

    expect(saved).toMatchObject({
      id: 'packet-1',
      question: 'How should BANILA CO renew Clean It Zero Original?',
      market: 'KR',
      brand: 'BANILA CO',
      product: 'Clean It Zero Original',
      decision_type: 'renewal_strategy',
      run_id: 'api-123',
      createdAt: '2026-06-23T12:00:00.000Z',
      updatedAt: '2026-06-23T12:00:00.000Z',
    });
    expect(JSON.stringify(saved)).toContain('source_table');
    expect(store.list()).toEqual([saved]);
  });

  it('filters packet history by market and brand without losing source evidence', () => {
    let seq = 0;
    const store = new BeautyPacketStore({
      backend: new MemoryStore({ packets: [] }),
      idFactory: () => `packet-${++seq}`,
      now: () => `2026-06-23T12:00:0${seq}.000Z`,
    });

    store.save({
      question: 'KR renewal',
      market: 'KR',
      brand: 'BANILA CO',
      answer: { citations: [{ source_table: 'kr_rankings' }] },
    });
    store.save({
      question: 'JP ranking',
      market: 'JP',
      brand: 'Other Brand',
      answer: { citations: [{ source_table: 'qoo10_rankings' }] },
    });

    expect(store.list({ market: 'KR', brand: 'banila' })).toHaveLength(1);
    expect(JSON.stringify(store.list({ market: 'KR', brand: 'banila' })[0])).toContain(
      'kr_rankings'
    );
  });
});
