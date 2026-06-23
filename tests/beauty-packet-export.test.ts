import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  exportBeautyDecisionPacket,
  formatBeautyDecisionPacketMarkdown,
  getBeautyPacketExportFilename,
} from '../src/main/beauty/beauty-packet-export';
import type { BeautyDecisionPacket } from '../src/main/beauty/beauty-packet-store';

function createPacket(): BeautyDecisionPacket {
  return {
    id: 'packet-1',
    question: 'How should BANILA CO renew Clean It Zero Original?',
    market: 'KR',
    brand: 'BANILA CO',
    product: 'Clean It Zero Original',
    decision_type: 'renewal_strategy',
    run_id: 'run-123',
    createdAt: '2026-06-23T12:00:00.000Z',
    updatedAt: '2026-06-23T12:30:00.000Z',
    brief: {
      analyst_prompt: 'Separate observed facts from inference.',
    },
    answer: {
      observed_facts: ['Olive Young ranking evidence exists.'],
      inference: ['Renew around lower-friction cleansing proof and texture clarity.'],
      citations: [
        {
          source_table: 'evidence_cards',
          source_url: 'https://beauty.eveos.one/evidence/packet-1',
          artifact_path: '/Users/drake/beauty-brain/wiki/clean-it-zero.md',
        },
      ],
      missing_data_warnings: ['TikTokShop data is intentionally not included.'],
      confidence: 0.78,
      next_recommended_action: 'Run VLM PDP creative classification before final packaging.',
      raw_debug: 'Authorization: Bearer should-not-leak api_key=sk-test-secret token=hidden',
    },
  };
}

describe('Beauty decision packet export', () => {
  it('formats saved packets as evidence-first Markdown without leaking secrets', () => {
    const markdown = formatBeautyDecisionPacketMarkdown(createPacket());

    expect(markdown).toContain('# How should BANILA CO renew Clean It Zero Original?');
    expect(markdown).toContain('Market: KR');
    expect(markdown).toContain('Brand: BANILA CO');
    expect(markdown).toContain('Product: Clean It Zero Original');
    expect(markdown).toContain('Decision type: renewal_strategy');
    expect(markdown).toContain('Run ID: run-123');
    expect(markdown).toContain('## Observed Facts');
    expect(markdown).toContain('Olive Young ranking evidence exists.');
    expect(markdown).toContain('## Inference');
    expect(markdown).toContain('Renew around lower-friction cleansing proof');
    expect(markdown).toContain('## Citations');
    expect(markdown).toContain('source_table: evidence_cards');
    expect(markdown).toContain('https://beauty.eveos.one/evidence/packet-1');
    expect(markdown).toContain('## Missing Data Warnings');
    expect(markdown).toContain('TikTokShop data is intentionally not included.');
    expect(markdown).toContain('## Confidence');
    expect(markdown).toContain('0.78');
    expect(markdown).toContain('## Next Recommended Action');
    expect(markdown).toContain('Run VLM PDP creative classification');
    expect(markdown).toContain('## Raw Answer');
    expect(markdown).not.toContain('should-not-leak');
    expect(markdown).not.toContain('sk-test-secret');
    expect(markdown).not.toContain('token=hidden');
    expect(markdown).toContain('[REDACTED]');
  });

  it('writes the Markdown export to a stable local file path', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'eveos-beauty-export-'));
    const outputPath = path.join(tempDir, 'clean-it-zero.md');

    try {
      const result = await exportBeautyDecisionPacket(createPacket(), outputPath);

      expect(result).toEqual({ success: true, path: outputPath });
      expect(readFileSync(outputPath, 'utf8')).toContain('## Observed Facts');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates a filesystem-safe default filename for packet exports', () => {
    expect(getBeautyPacketExportFilename(createPacket())).toBe(
      'KR-banila-co-clean-it-zero-original-renewal-strategy-packet-1.md'
    );
  });
});
