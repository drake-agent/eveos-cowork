import { describe, expect, it } from 'vitest';
import { summarizeBeautyEvidence } from '../src/renderer/components/beauty/beauty-evidence-summary';

describe('summarizeBeautyEvidence', () => {
  it('normalizes evidence cards and citations into source-attributed rows', () => {
    const summary = summarizeBeautyEvidence({
      result: {
        evidence_cards: [
          {
            evidence_card_id: 'card-1',
            source_table: 'evidence_cards',
            source_url: 'https://beauty.eveos.one/evidence/card-1',
            artifact_path: '/Users/drake/beauty-brain/wiki/clean-it-zero.md',
            evidence_text: 'Olive Young rank evidence supports the cleansing balm claim.',
            confidence: 0.82,
            layer: 'ranking',
            observed_at: '2026-06-23T14:30:00.000Z',
          },
          {
            id: 'card-2',
            source_table: 'review_voc',
            evidence_text: 'Texture complaints appear in VOC.',
            confidence: 'medium',
          },
        ],
      },
    });

    expect(summary.counts).toEqual({
      total: 2,
      withSourceUrl: 1,
      withArtifactPath: 1,
      missingSource: 1,
    });
    expect(summary.rows[0]).toMatchObject({
      id: 'card-1',
      sourceTable: 'evidence_cards',
      sourceUrl: 'https://beauty.eveos.one/evidence/card-1',
      artifactPath: '/Users/drake/beauty-brain/wiki/clean-it-zero.md',
      evidenceText: 'Olive Young rank evidence supports the cleansing balm claim.',
      confidence: '0.82',
      layer: 'ranking',
      observedAt: '2026-06-23T14:30:00.000Z',
      missingSourceWarning: false,
    });
    expect(summary.rows[1]).toMatchObject({
      id: 'card-2',
      sourceTable: 'review_voc',
      evidenceText: 'Texture complaints appear in VOC.',
      confidence: 'medium',
      missingSourceWarning: true,
    });
  });

  it('handles string citations without dropping missing-source warnings', () => {
    const summary = summarizeBeautyEvidence({
      citations: ['Observed from existing Beauty OS answer but no source pointer was returned.'],
    });

    expect(summary.counts.total).toBe(1);
    expect(summary.counts.missingSource).toBe(1);
    expect(summary.rows[0]).toMatchObject({
      id: 'evidence-1',
      evidenceText: 'Observed from existing Beauty OS answer but no source pointer was returned.',
      missingSourceWarning: true,
    });
  });
});
