import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { redactBeautyApiSecret } from './beauty-api-client';
import type { BeautyDecisionPacket } from './beauty-packet-store';

export interface BeautyPacketExportResult {
  success: boolean;
  path?: string;
  error?: string;
}

const JSON_SECRET_KEY_PATTERN =
  /("(?:authorization|api[_-]?key|token|cookie|set-cookie)"\s*:\s*")[^"]+(")/gi;

export function formatBeautyDecisionPacketMarkdown(packet: BeautyDecisionPacket): string {
  const answer = unwrapResult(packet.answer);
  const sections = [
    `# ${packet.question}`,
    '',
    '## Metadata',
    formatMetadata(packet),
    '',
    '## Observed Facts',
    formatValue(pickAnswerField(answer, ['observed_facts', 'facts'])),
    '',
    '## Inference',
    formatValue(pickAnswerField(answer, ['inference', 'analysis'])),
    '',
    '## Citations',
    formatValue(pickAnswerField(answer, ['citations', 'evidence_cards'])),
    '',
    '## Missing Data Warnings',
    formatValue(pickAnswerField(answer, ['missing_data_warnings', 'warnings'])),
    '',
    '## Confidence',
    formatValue(pickAnswerField(answer, ['confidence'])),
    '',
    '## Next Recommended Action',
    formatValue(pickAnswerField(answer, ['next_recommended_action', 'next_action'])),
    '',
    '## Raw Answer',
    formatValue(packet.answer),
    '',
  ];

  return redactExportText(sections.join('\n'));
}

export async function exportBeautyDecisionPacket(
  packet: BeautyDecisionPacket,
  targetPath: string
): Promise<BeautyPacketExportResult> {
  if (!targetPath.trim()) {
    return { success: false, error: 'Export path is required' };
  }

  try {
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, formatBeautyDecisionPacketMarkdown(packet), 'utf8');
    return { success: true, path: targetPath };
  } catch (error) {
    return {
      success: false,
      error: redactExportText(error instanceof Error ? error.message : String(error)),
    };
  }
}

export function getBeautyPacketExportFilename(packet: BeautyDecisionPacket): string {
  const market = sanitizeMarketSegment(packet.market || 'global');
  const segments = [
    market,
    slugify(packet.brand || 'brand'),
    slugify(packet.product || 'product'),
    slugify(packet.decision_type || 'decision'),
    slugify(packet.id),
  ].filter(Boolean);

  return `${segments.join('-')}.md`;
}

function formatMetadata(packet: BeautyDecisionPacket): string {
  return [
    `- Market: ${packet.market || 'global'}`,
    packet.brand ? `- Brand: ${packet.brand}` : null,
    packet.product ? `- Product: ${packet.product}` : null,
    packet.decision_type ? `- Decision type: ${packet.decision_type}` : null,
    packet.run_id ? `- Run ID: ${packet.run_id}` : null,
    `- Packet ID: ${packet.id}`,
    `- Created at: ${packet.createdAt}`,
    `- Updated at: ${packet.updatedAt}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'Not available.';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'Not available.';
    }
    return value.map((item) => `- ${formatInlineValue(item)}`).join('\n');
  }

  return formatInlineValue(value);
}

function formatInlineValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (isFlatRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${String(item)}`)
      .join('; ');
  }
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function pickAnswerField(answer: unknown, keys: string[]): unknown {
  if (!answer || typeof answer !== 'object') {
    return null;
  }
  const record = answer as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return null;
}

function unwrapResult(answer: unknown): unknown {
  if (!answer || typeof answer !== 'object') {
    return answer;
  }
  const record = answer as Record<string, unknown>;
  return record.result && typeof record.result === 'object' ? record.result : answer;
}

function isFlatRecord(value: unknown): value is Record<string, string | number | boolean | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (item) =>
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
  );
}

function redactExportText(value: string): string {
  return redactBeautyApiSecret(value).replace(JSON_SECRET_KEY_PATTERN, '$1[REDACTED]$2');
}

function sanitizeMarketSegment(value: string): string {
  const trimmed = value.trim();
  if (/^[A-Z]{2,6}$/.test(trimmed)) {
    return trimmed;
  }
  return slugify(trimmed || 'global');
}

function slugify(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_&/]+/g, '-')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
