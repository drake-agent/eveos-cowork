export interface BeautyEvidenceRow {
  id: string;
  sourceTable?: string;
  sourceUrl?: string;
  artifactPath?: string;
  evidenceText: string;
  confidence?: string;
  layer?: string;
  observedAt?: string;
  missingSourceWarning: boolean;
}

export interface BeautyEvidenceSummary {
  rows: BeautyEvidenceRow[];
  counts: {
    total: number;
    withSourceUrl: number;
    withArtifactPath: number;
    missingSource: number;
  };
  stateLabel: string;
}

export function summarizeBeautyEvidence(answer: unknown): BeautyEvidenceSummary {
  const rows = extractEvidenceItems(answer).map(normalizeEvidenceRow);
  const counts = {
    total: rows.length,
    withSourceUrl: rows.filter((row) => Boolean(row.sourceUrl)).length,
    withArtifactPath: rows.filter((row) => Boolean(row.artifactPath)).length,
    missingSource: rows.filter((row) => row.missingSourceWarning).length,
  };

  return {
    rows,
    counts,
    stateLabel:
      rows.length === 0
        ? 'No evidence cards or citations returned yet.'
        : `${rows.length} evidence rows returned`,
  };
}

function extractEvidenceItems(answer: unknown): unknown[] {
  const sources = [unwrapResult(answer), answer];
  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue;
    }
    const record = source as Record<string, unknown>;
    for (const key of [
      'evidence_cards',
      'evidenceCards',
      'citations',
      'sources',
      'source_cards',
      'sourceCards',
    ]) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }
  return [];
}

function normalizeEvidenceRow(item: unknown, index: number): BeautyEvidenceRow {
  if (typeof item === 'string') {
    return {
      id: `evidence-${index + 1}`,
      evidenceText: item,
      missingSourceWarning: true,
    };
  }

  if (!item || typeof item !== 'object') {
    return {
      id: `evidence-${index + 1}`,
      evidenceText: String(item || 'Evidence row unavailable.'),
      missingSourceWarning: true,
    };
  }

  const record = item as Record<string, unknown>;
  const sourceUrl = getStringField(record, ['source_url', 'sourceUrl', 'url']);
  const artifactPath = getStringField(record, ['artifact_path', 'artifactPath', 'path']);
  const evidenceText =
    getStringField(record, [
      'evidence_text',
      'evidenceText',
      'text',
      'quote',
      'summary',
      'title',
    ]) || 'Evidence text unavailable.';

  return {
    id:
      getStringField(record, [
        'evidence_card_id',
        'evidenceCardId',
        'card_id',
        'source_id',
        'id',
      ]) || `evidence-${index + 1}`,
    sourceTable: getStringField(record, ['source_table', 'sourceTable', 'table']) || undefined,
    sourceUrl: sourceUrl || undefined,
    artifactPath: artifactPath || undefined,
    evidenceText,
    confidence: getDisplayField(record, ['confidence', 'score']) || undefined,
    layer: getStringField(record, ['layer', 'source_layer', 'sourceLayer']) || undefined,
    observedAt:
      getStringField(record, ['observed_at', 'observedAt', 'created_at', 'createdAt']) || undefined,
    missingSourceWarning: !sourceUrl && !artifactPath,
  };
}

function unwrapResult(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }
  const record = value as Record<string, unknown>;
  return record.result && typeof record.result === 'object' ? record.result : value;
}

function getStringField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function getDisplayField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
}
