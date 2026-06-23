export type BeautyQueueStatus = 'running' | 'waiting' | 'succeeded' | 'failed' | 'unknown';

export interface BeautyQueueRow {
  id: string;
  status: BeautyQueueStatus;
  label: string;
  market?: string;
  brand?: string;
  product?: string;
  updatedAt?: string;
}

export interface BeautyQueueSummary {
  counts: Record<BeautyQueueStatus | 'total', number>;
  rows: BeautyQueueRow[];
  maxWorkers?: number;
  observedAt?: string;
  observedAtLabel: string;
  isStale: boolean;
  stateLabel: string;
}

const STALE_AFTER_MS = 30 * 60 * 1000;

export function summarizeBeautyQueueSnapshot(
  snapshot: unknown,
  nowIso = new Date().toISOString()
): BeautyQueueSummary {
  const rows = extractQueueItems(snapshot).map(normalizeQueueRow);
  const counts = {
    total: rows.length,
    running: rows.filter((row) => row.status === 'running').length,
    waiting: rows.filter((row) => row.status === 'waiting').length,
    succeeded: rows.filter((row) => row.status === 'succeeded').length,
    failed: rows.filter((row) => row.status === 'failed').length,
    unknown: rows.filter((row) => row.status === 'unknown').length,
  };
  const observedAt =
    getStringField(snapshot, 'observed_at') || getStringField(snapshot, 'observedAt');
  const observedAtMs = observedAt ? Date.parse(observedAt) : Number.NaN;
  const nowMs = Date.parse(nowIso);
  const isStale =
    Number.isFinite(observedAtMs) &&
    Number.isFinite(nowMs) &&
    nowMs - observedAtMs > STALE_AFTER_MS;

  return {
    counts,
    rows,
    maxWorkers: getNumberField(snapshot, 'max_workers') ?? getNumberField(snapshot, 'maxWorkers'),
    observedAt,
    observedAtLabel: formatQueueTimestamp(observedAt),
    isStale,
    stateLabel:
      counts.total === 0 ? 'No active analyst jobs' : `${counts.total} analyst jobs visible`,
  };
}

function extractQueueItems(snapshot: unknown): unknown[] {
  if (Array.isArray(snapshot)) {
    return snapshot;
  }
  if (!snapshot || typeof snapshot !== 'object') {
    return [];
  }
  const record = snapshot as Record<string, unknown>;
  for (const key of ['jobs', 'items', 'runs', 'queue', 'tasks']) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }
  return [];
}

function normalizeQueueRow(item: unknown, index: number): BeautyQueueRow {
  if (!item || typeof item !== 'object') {
    return {
      id: `queue-item-${index + 1}`,
      status: 'unknown',
      label: String(item || 'Unknown analyst job'),
    };
  }
  const record = item as Record<string, unknown>;
  const id =
    getStringField(record, 'run_id') ||
    getStringField(record, 'runId') ||
    getStringField(record, 'id') ||
    `queue-item-${index + 1}`;
  const label =
    getStringField(record, 'question') ||
    getStringField(record, 'title') ||
    getStringField(record, 'prompt') ||
    id;

  return {
    id,
    status: normalizeStatus(getStringField(record, 'status') || getStringField(record, 'state')),
    label,
    market: getStringField(record, 'market') || undefined,
    brand: getStringField(record, 'brand') || undefined,
    product: getStringField(record, 'product') || undefined,
    updatedAt:
      getStringField(record, 'updated_at') ||
      getStringField(record, 'updatedAt') ||
      getStringField(record, 'created_at') ||
      getStringField(record, 'createdAt') ||
      undefined,
  };
}

function normalizeStatus(value: string): BeautyQueueStatus {
  const status = value.trim().toLowerCase();
  if (['running', 'active', 'in_progress', 'processing', 'started'].includes(status)) {
    return 'running';
  }
  if (['queued', 'queue', 'waiting', 'pending', 'scheduled'].includes(status)) {
    return 'waiting';
  }
  if (['succeeded', 'success', 'completed', 'done', 'finished'].includes(status)) {
    return 'succeeded';
  }
  if (
    ['failed', 'error', 'errored', 'timeout', 'timed_out', 'cancelled', 'canceled'].includes(status)
  ) {
    return 'failed';
  }
  return 'unknown';
}

function getStringField(value: unknown, key: string): string {
  if (!value || typeof value !== 'object') {
    return '';
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : '';
}

function getNumberField(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : undefined;
}

function formatQueueTimestamp(value: string | undefined): string {
  if (!value) {
    return 'Not polled yet';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
