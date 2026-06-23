import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  Archive,
  CheckCircle2,
  CircleDashed,
  Clock,
  Database,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Play,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { BeautyDecisionPacket } from '../../../shared/ipc-types';
import {
  summarizeBeautyQueueSnapshot,
  type BeautyQueueSummary,
  type BeautyQueueStatus,
} from './beauty-queue-summary';
import { summarizeBeautyEvidence, type BeautyEvidenceSummary } from './beauty-evidence-summary';

type BeautyStatus = 'idle' | 'loading' | 'ready' | 'error';

type BeautyFormState = {
  market: string;
  brand: string;
  product: string;
  decisionType: string;
  question: string;
};

type RunState = {
  runId: string;
  status: string;
};

const defaultForm: BeautyFormState = {
  market: 'KR',
  brand: 'BANILA CO',
  product: 'Clean It Zero Original',
  decisionType: 'renewal_strategy',
  question: 'How should BANILA CO renew Clean It Zero Original?',
};

export function BeautyCommandDesk() {
  const [apiBaseUrl, setApiBaseUrl] = useState('https://beauty.eveos.one');
  const [apiToken, setApiToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [healthStatus, setHealthStatus] = useState<BeautyStatus>('idle');
  const [form, setForm] = useState<BeautyFormState>(defaultForm);
  const [briefStatus, setBriefStatus] = useState<BeautyStatus>('idle');
  const [runStatus, setRunStatus] = useState<BeautyStatus>('idle');
  const [brief, setBrief] = useState<unknown>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [answer, setAnswer] = useState<unknown>(null);
  const [queue, setQueue] = useState<unknown>(null);
  const [queueStatus, setQueueStatus] = useState<BeautyStatus>('idle');
  const [packets, setPackets] = useState<BeautyDecisionPacket[]>([]);
  const [selectedPacketId, setSelectedPacketId] = useState('');
  const [exportStatus, setExportStatus] = useState<BeautyStatus>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const [error, setError] = useState('');

  const beautyApi = window.electronAPI?.beauty;
  const canUseBeautyApi = Boolean(beautyApi);
  const canBuildBrief = form.question.trim().length > 0 && canUseBeautyApi;
  const queueSummary = useMemo(() => summarizeBeautyQueueSnapshot(queue), [queue]);
  const evidenceSummary = useMemo(() => summarizeBeautyEvidence(answer), [answer]);

  const requestPayload = useMemo(
    () => ({
      question: form.question.trim(),
      market: form.market.trim(),
      brand: form.brand.trim(),
      product: form.product.trim(),
      decision_type: form.decisionType.trim(),
    }),
    [form]
  );

  const loadConfig = useCallback(async () => {
    if (!beautyApi) return;
    const config = await window.electronAPI.beauty.getConfig();
    setApiBaseUrl(config.baseUrl);
    setHasToken(config.hasToken);
  }, [beautyApi]);

  const loadPackets = useCallback(async () => {
    if (!beautyApi) return;
    const history = await window.electronAPI.beauty.listPackets({
      market: form.market,
      brand: form.brand,
      limit: 20,
    });
    setPackets(history);
  }, [beautyApi, form.brand, form.market]);

  useEffect(() => {
    loadConfig().catch((err) => {
      setError(formatError(err));
    });
  }, [loadConfig]);

  useEffect(() => {
    loadPackets().catch((err) => {
      setError(formatError(err));
    });
  }, [loadPackets]);

  const saveConfig = useCallback(async () => {
    if (!beautyApi) return;
    setError('');
    const result = await window.electronAPI.beauty.saveConfig({
      baseUrl: apiBaseUrl,
      token: apiToken || undefined,
    });
    setHasToken(result.config.hasToken);
    setApiBaseUrl(result.config.baseUrl);
    setApiToken('');
  }, [apiBaseUrl, apiToken, beautyApi]);

  const checkHealth = useCallback(async () => {
    if (!beautyApi) return;
    setError('');
    setHealthStatus('loading');
    try {
      await window.electronAPI.beauty.health();
      setHealthStatus('ready');
    } catch (err) {
      setHealthStatus('error');
      setError(formatError(err));
    }
  }, [beautyApi]);

  const buildBrief = useCallback(async () => {
    if (!beautyApi || !canBuildBrief) return;
    setError('');
    setBriefStatus('loading');
    try {
      const nextBrief = await window.electronAPI.beauty.intentBrief(requestPayload);
      setBrief(nextBrief);
      setBriefStatus('ready');
    } catch (err) {
      setBriefStatus('error');
      setError(formatError(err));
    }
  }, [beautyApi, canBuildBrief, requestPayload]);

  const runAnalyst = useCallback(async () => {
    if (!beautyApi || !canBuildBrief) return;
    setError('');
    setRunStatus('loading');
    try {
      const result = await window.electronAPI.beauty.analystRun({
        ...requestPayload,
        wait: false,
      });
      const runId = getStringField(result, 'run_id') || getStringField(result, 'id');
      const status = getStringField(result, 'status') || 'QUEUED';
      setRun(runId ? { runId, status } : { runId: '', status });
      setRunStatus('ready');
      const latestQueue = await window.electronAPI.beauty.analystQueue(20);
      setQueue(latestQueue);
      setQueueStatus('ready');
    } catch (err) {
      setRunStatus('error');
      setError(formatError(err));
    }
  }, [beautyApi, canBuildBrief, requestPayload]);

  const refreshQueue = useCallback(async () => {
    if (!beautyApi) return;
    setError('');
    setQueueStatus('loading');
    try {
      const latestQueue = await window.electronAPI.beauty.analystQueue(20);
      setQueue(latestQueue);
      setQueueStatus('ready');
    } catch (err) {
      setQueueStatus('error');
      setError(formatError(err));
    }
  }, [beautyApi]);

  const refreshAnswer = useCallback(async () => {
    if (!beautyApi || !run?.runId) return;
    setError('');
    setRunStatus('loading');
    try {
      const result = await window.electronAPI.beauty.answerResult(run.runId);
      setAnswer(result);
      const nextStatus = getStringField(result, 'status') || run.status;
      setRun({ ...run, status: nextStatus });
      setRunStatus('ready');
    } catch (err) {
      setRunStatus('error');
      setError(formatError(err));
    }
  }, [beautyApi, run]);

  const savePacket = useCallback(async () => {
    if (!beautyApi || !answer) return;
    setError('');
    try {
      const saved = await window.electronAPI.beauty.savePacket({
        question: requestPayload.question,
        market: requestPayload.market,
        brand: requestPayload.brand,
        product: requestPayload.product,
        decision_type: requestPayload.decision_type,
        run_id: run?.runId,
        brief,
        answer,
      });
      setSelectedPacketId(saved.id);
      await loadPackets();
    } catch (err) {
      setError(formatError(err));
    }
  }, [answer, beautyApi, brief, loadPackets, requestPayload, run?.runId]);

  const loadPacketIntoDesk = useCallback(
    async (packetId: string) => {
      if (!beautyApi) return;
      setError('');
      try {
        const packet = await window.electronAPI.beauty.getPacket(packetId);
        if (!packet) return;
        setSelectedPacketId(packet.id);
        setForm({
          market: packet.market || 'KR',
          brand: packet.brand || '',
          product: packet.product || '',
          decisionType: packet.decision_type || '',
          question: packet.question,
        });
        setBrief(packet.brief || null);
        setAnswer(packet.answer);
        setRun(packet.run_id ? { runId: packet.run_id, status: 'SAVED' } : null);
        setBriefStatus(packet.brief ? 'ready' : 'idle');
        setRunStatus('ready');
      } catch (err) {
        setError(formatError(err));
      }
    },
    [beautyApi]
  );

  const exportPacket = useCallback(
    async (packetId: string) => {
      if (!beautyApi) return;
      setError('');
      setExportStatus('loading');
      setExportMessage('');
      try {
        const result = await window.electronAPI.beauty.exportPacket({ id: packetId });
        if (!result.success) {
          setExportStatus('error');
          setError(result.error || 'Packet export failed');
          return;
        }
        setExportStatus('ready');
        setExportMessage(result.path ? `Exported to ${result.path}` : 'Packet exported.');
      } catch (err) {
        setExportStatus('error');
        setError(formatError(err));
      }
    },
    [beautyApi]
  );

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-border-muted pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[1.05rem] border border-accent/20 bg-accent-muted text-accent shadow-soft">
              <span className="text-[1.55rem] font-semibold leading-none tracking-[-0.08em] text-text-primary">
                B
              </span>
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold tracking-[0.08em] text-accent">
                EveOS Beauty
              </div>
              <h1 className="mt-1 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-text-primary">
                Beauty OS command desk
              </h1>
              <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-secondary">
                Build the right analyst prompt, queue a max-thinking run, and read cited evidence
                without giving the team direct Anna access.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <StatusPill label="Gateway" status={healthStatus} />
            <StatusPill label="Token" status={hasToken ? 'ready' : 'idle'} />
            <StatusPill label="Run" status={runStatus} value={run?.status} />
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-text-primary">
            {error}
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Panel title="API access" icon={<Lock className="h-4 w-4" />}>
              <label className="block text-[12px] font-medium text-text-secondary">
                API base URL
                <input
                  value={apiBaseUrl}
                  onChange={(event) => setApiBaseUrl(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <label className="mt-3 block text-[12px] font-medium text-text-secondary">
                Bearer token
                <input
                  value={apiToken}
                  onChange={(event) => setApiToken(event.target.value)}
                  type="password"
                  placeholder={
                    hasToken ? 'Token saved. Paste to replace.' : 'Paste Beauty API token'
                  }
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
                />
              </label>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  className="btn btn-primary flex-1"
                  onClick={saveConfig}
                  disabled={!canUseBeautyApi}
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
                <button
                  className="btn btn-secondary flex-1"
                  onClick={checkHealth}
                  disabled={!canUseBeautyApi}
                >
                  <Activity className="h-4 w-4" />
                  Health
                </button>
              </div>
            </Panel>

            <Panel title="Team access" icon={<ShieldCheck className="h-4 w-4" />}>
              <div className="space-y-2 text-sm leading-6 text-text-secondary">
                <p>Use Cloudflare Access for email allowlists before broad rollout.</p>
                <p>Bearer token stays in Electron main; renderer sees only hasToken.</p>
                <p>
                  OpenClaw stays behind Anna analyst queue. No direct Anna files, DB, SSH, or
                  Tailscale.
                </p>
              </div>
            </Panel>

            <Panel title="Question setup" icon={<Search className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field
                  label="Market"
                  value={form.market}
                  onChange={(market) => setForm({ ...form, market })}
                />
                <Field
                  label="Decision"
                  value={form.decisionType}
                  onChange={(decisionType) => setForm({ ...form, decisionType })}
                />
              </div>
              <Field
                label="Brand"
                value={form.brand}
                onChange={(brand) => setForm({ ...form, brand })}
              />
              <Field
                label="Product"
                value={form.product}
                onChange={(product) => setForm({ ...form, product })}
              />
              <label className="mt-3 block text-[12px] font-medium text-text-secondary">
                Question
                <textarea
                  value={form.question}
                  onChange={(event) => setForm({ ...form, question: event.target.value })}
                  rows={5}
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 text-text-primary outline-none focus:border-accent"
                />
              </label>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  className="btn btn-secondary"
                  onClick={buildBrief}
                  disabled={!canBuildBrief || briefStatus === 'loading'}
                >
                  <FileText className="h-4 w-4" />
                  Build brief
                </button>
                <button
                  className="btn btn-primary"
                  onClick={runAnalyst}
                  disabled={!canBuildBrief || runStatus === 'loading'}
                >
                  <Play className="h-4 w-4" />
                  Run analyst
                </button>
              </div>
            </Panel>
          </aside>

          <main className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <Panel
                title="Prompt brief review"
                status={briefStatus}
                icon={<FileText className="h-4 w-4" />}
              >
                <JsonBlock value={brief || emptyBriefCopy} />
              </Panel>

              <Panel
                title="Answer contract"
                status={runStatus}
                icon={<Sparkles className="h-4 w-4" />}
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  <AnswerSection
                    title="Observed facts"
                    value={pickAnswerField(answer, ['observed_facts', 'facts'])}
                  />
                  <AnswerSection
                    title="Inference"
                    value={pickAnswerField(answer, ['inference', 'analysis'])}
                  />
                  <AnswerSection
                    title="Citations"
                    value={pickAnswerField(answer, ['citations', 'evidence_cards'])}
                  />
                  <AnswerSection
                    title="Missing data warnings"
                    value={pickAnswerField(answer, ['missing_data_warnings', 'warnings'])}
                  />
                  <AnswerSection
                    title="Confidence"
                    value={pickAnswerField(answer, ['confidence'])}
                  />
                  <AnswerSection
                    title="Next recommended action"
                    value={pickAnswerField(answer, ['next_recommended_action', 'next_action'])}
                  />
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t border-border-muted pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-text-muted">
                    {run?.runId ? `Run ID ${run.runId}` : 'No analyst run queued yet.'}
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={refreshAnswer}
                    disabled={!run?.runId || runStatus === 'loading'}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh result
                  </button>
                  <button className="btn btn-primary" onClick={savePacket} disabled={!answer}>
                    <Archive className="h-4 w-4" />
                    Save packet
                  </button>
                </div>
              </Panel>

              <Panel title="Evidence packet browser" icon={<Database className="h-4 w-4" />}>
                <EvidenceSourcePanel summary={evidenceSummary} />
              </Panel>
            </div>

            <aside className="space-y-4">
              <Panel
                title="Saved reports/history"
                status={exportStatus}
                icon={<Archive className="h-4 w-4" />}
              >
                {exportMessage ? (
                  <p className="mb-3 rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-xs leading-5 text-success">
                    {exportMessage}
                  </p>
                ) : null}
                {packets.length === 0 ? (
                  <p className="text-sm leading-6 text-text-muted">
                    No saved packets for this market and brand yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {packets.map((packet) => (
                      <div
                        key={packet.id}
                        className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2 transition-colors ${
                          selectedPacketId === packet.id
                            ? 'border-accent/40 bg-accent-muted/50'
                            : 'border-border-muted bg-background/55 hover:bg-surface-hover'
                        }`}
                      >
                        <button
                          onClick={() => loadPacketIntoDesk(packet.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="line-clamp-2 text-[13px] font-medium leading-5 text-text-primary">
                            {packet.question}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-text-muted">
                            <span>{packet.market || 'global'}</span>
                            {packet.brand ? <span>{packet.brand}</span> : null}
                            {packet.product ? <span>{packet.product}</span> : null}
                            <span>{formatDate(packet.updatedAt)}</span>
                          </div>
                        </button>
                        <button
                          className="btn btn-secondary min-h-8 flex-shrink-0 px-2 text-[12px]"
                          onClick={() => exportPacket(packet.id)}
                          disabled={exportStatus === 'loading'}
                          title="Export packet"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
              <Panel
                title="Analyst queue mission control"
                status={queueStatus}
                icon={<Clock className="h-4 w-4" />}
              >
                <QueueSnapshotPanel summary={queueSummary} />
                <button
                  className="btn btn-secondary mt-3 w-full"
                  onClick={refreshQueue}
                  disabled={!canUseBeautyApi || queueStatus === 'loading'}
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh queue
                </button>
              </Panel>
              <Panel title="Raw answer" icon={<Database className="h-4 w-4" />}>
                <JsonBlock
                  value={answer || { state: 'Answer result will appear after polling.' }}
                  compact
                />
              </Panel>
            </aside>
          </main>
        </section>
      </div>
    </div>
  );
}

function Panel({
  title,
  status,
  icon,
  children,
}: {
  title: string;
  status?: BeautyStatus;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface/88 p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
          {icon ? <span className="text-accent">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </h2>
        {status && <StatusPill label={status} status={status} />}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-3 block text-[12px] font-medium text-text-secondary">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      />
    </label>
  );
}

function StatusPill({
  label,
  status,
  value,
}: {
  label: string;
  status: BeautyStatus;
  value?: string;
}) {
  const className =
    status === 'ready'
      ? 'border-success/30 bg-success/10 text-success'
      : status === 'error'
        ? 'border-error/30 bg-error/10 text-error'
        : status === 'loading'
          ? 'border-warning/30 bg-warning/10 text-warning'
          : 'border-border-muted bg-background/50 text-text-muted';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 ${className}`}>
      <StatusGlyph status={status} />
      {label}
      {value ? <span className="ml-1 font-mono tabular-nums">{value}</span> : null}
    </span>
  );
}

function StatusGlyph({ status }: { status: BeautyStatus }) {
  const className = 'mr-1.5 h-3.5 w-3.5';
  if (status === 'ready') {
    return <CheckCircle2 className={className} />;
  }
  if (status === 'error') {
    return <AlertCircle className={className} />;
  }
  if (status === 'loading') {
    return <Clock className={className} />;
  }
  return <CircleDashed className={className} />;
}

function AnswerSection({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="min-h-[150px] rounded-xl border border-border-muted bg-background/55 p-3">
      <h3 className="text-[12px] font-semibold text-text-secondary">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-text-primary">
        <FormattedValue value={value || 'Not available yet.'} />
      </div>
    </section>
  );
}

function QueueSnapshotPanel({ summary }: { summary: BeautyQueueSummary }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <QueueMetric label="Running" value={summary.counts.running} tone="running" />
        <QueueMetric label="Waiting" value={summary.counts.waiting} tone="waiting" />
        <QueueMetric label="Failed" value={summary.counts.failed} tone="failed" />
      </div>
      <div className="rounded-xl border border-border-muted bg-background/55 px-3 py-2 text-xs leading-5 text-text-secondary">
        <div className="flex items-center justify-between gap-2">
          <span>{summary.stateLabel}</span>
          <span className="font-mono tabular-nums">{summary.observedAtLabel}</span>
        </div>
        {summary.maxWorkers ? (
          <div className="mt-1 text-text-muted">Analyst lanes: {summary.maxWorkers}</div>
        ) : null}
        {summary.isStale ? (
          <div className="mt-1 text-warning">Queue snapshot is stale. Refresh before triage.</div>
        ) : null}
      </div>
      {summary.rows.length === 0 ? (
        <p className="text-sm leading-6 text-text-muted">No queued or running analyst jobs.</p>
      ) : (
        <div className="space-y-2">
          {summary.rows.slice(0, 5).map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-border-muted bg-background/55 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-text-primary">
                    {row.label}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-text-muted">
                    <span>{row.id}</span>
                    {row.market ? <span>{row.market}</span> : null}
                    {row.brand ? <span>{row.brand}</span> : null}
                    {row.product ? <span>{row.product}</span> : null}
                  </div>
                </div>
                <QueueStatusBadge status={row.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceSourcePanel({ summary }: { summary: BeautyEvidenceSummary }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <EvidenceMetric label="Rows" value={summary.counts.total} />
        <EvidenceMetric label="URLs" value={summary.counts.withSourceUrl} />
        <EvidenceMetric label="Artifacts" value={summary.counts.withArtifactPath} />
        <EvidenceMetric label="Missing" value={summary.counts.missingSource} warning />
      </div>
      {summary.rows.length === 0 ? (
        <p className="text-sm leading-6 text-text-muted">{summary.stateLabel}</p>
      ) : (
        <div className="space-y-2">
          {summary.rows.slice(0, 6).map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-border-muted bg-background/55 px-3 py-2"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-text-muted">
                    <span>{row.id}</span>
                    {row.sourceTable ? <span>source_table {row.sourceTable}</span> : null}
                    {row.layer ? <span>{row.layer}</span> : null}
                    {row.confidence ? <span>confidence {row.confidence}</span> : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-text-primary">{row.evidenceText}</p>
                  {row.artifactPath ? (
                    <div className="mt-1 truncate font-mono text-[11px] text-text-muted">
                      artifact_path {row.artifactPath}
                    </div>
                  ) : null}
                  {row.missingSourceWarning ? (
                    <div className="mt-1 text-[11px] text-warning">
                      Missing source URL or artifact path.
                    </div>
                  ) : null}
                </div>
                {isOpenableSourceUrl(row.sourceUrl) ? (
                  <button
                    className="btn btn-secondary min-h-8 flex-shrink-0 px-2 text-[12px]"
                    onClick={() => openEvidenceSourceUrl(row.sourceUrl)}
                    title="Open source URL"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Source
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isOpenableSourceUrl(sourceUrl: string | undefined): sourceUrl is string {
  return /^https?:\/\//i.test(sourceUrl || '');
}

function openEvidenceSourceUrl(sourceUrl: string | undefined): void {
  if (!isOpenableSourceUrl(sourceUrl)) {
    return;
  }
  window.electronAPI.openExternal(sourceUrl);
}

function EvidenceMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        warning && value > 0
          ? 'border-warning/20 bg-warning/10 text-warning'
          : 'border-border-muted bg-background/55 text-text-secondary'
      }`}
    >
      <div className="text-[11px] font-medium">{label}</div>
      <div className="mt-1 font-mono text-lg tabular-nums">{value}</div>
    </div>
  );
}

function QueueMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: BeautyQueueStatus;
}) {
  const className =
    tone === 'running'
      ? 'border-success/20 bg-success/10 text-success'
      : tone === 'waiting'
        ? 'border-warning/20 bg-warning/10 text-warning'
        : tone === 'failed'
          ? 'border-error/20 bg-error/10 text-error'
          : 'border-border-muted bg-background/55 text-text-secondary';

  return (
    <div className={`rounded-xl border px-3 py-2 ${className}`}>
      <div className="text-[11px] font-medium">{label}</div>
      <div className="mt-1 font-mono text-lg tabular-nums">{value}</div>
    </div>
  );
}

function QueueStatusBadge({ status }: { status: BeautyQueueStatus }) {
  const className =
    status === 'running'
      ? 'border-success/20 bg-success/10 text-success'
      : status === 'waiting'
        ? 'border-warning/20 bg-warning/10 text-warning'
        : status === 'failed'
          ? 'border-error/20 bg-error/10 text-error'
          : status === 'succeeded'
            ? 'border-accent/20 bg-accent-muted text-accent'
            : 'border-border-muted bg-background/55 text-text-muted';

  return (
    <span className={`rounded-full border px-2 py-1 text-[11px] capitalize ${className}`}>
      {status}
    </span>
  );
}

function JsonBlock({ value, compact = false }: { value: unknown; compact?: boolean }) {
  return (
    <pre
      className={`overflow-x-auto rounded-xl border border-border-muted bg-background/55 p-3 font-mono text-[12px] leading-5 text-text-secondary ${
        compact ? 'max-h-[280px]' : 'max-h-[420px]'
      }`}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function FormattedValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.map((item, index) => (
          <li key={index}>
            <FormattedValue value={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object' && value !== null) {
    return <JsonBlock value={value} compact />;
  }
  return <span>{String(value)}</span>;
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
  if (record.result && typeof record.result === 'object') {
    return pickAnswerField(record.result, keys);
  }
  return null;
}

function getStringField(value: unknown, key: string): string {
  if (!value || typeof value !== 'object') {
    return '';
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : '';
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const emptyBriefCopy = {
  state: 'Build an intent brief before queueing an analyst run.',
  expected: [
    'decision type',
    'recommended evidence layers',
    'missing data warnings',
    'analyst prompt',
  ],
};
