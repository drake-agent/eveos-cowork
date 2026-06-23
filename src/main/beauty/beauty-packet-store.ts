import { randomUUID } from 'crypto';
import Store, { type Options as StoreOptions } from 'electron-store';

export interface BeautyDecisionPacketInput {
  id?: string;
  question: string;
  market?: string;
  brand?: string;
  product?: string;
  decision_type?: string;
  run_id?: string;
  brief?: unknown;
  answer: unknown;
}

export interface BeautyDecisionPacket extends BeautyDecisionPacketInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface BeautyPacketListFilters {
  market?: string;
  brand?: string;
  product?: string;
  limit?: number;
}

export interface BeautyPacketStoreLike {
  save(input: BeautyDecisionPacketInput): BeautyDecisionPacket;
  list(filters?: BeautyPacketListFilters): BeautyDecisionPacket[];
  get(id: string): BeautyDecisionPacket | null;
  delete(id: string): boolean;
}

interface BeautyPacketRecord extends Record<string, unknown> {
  packets: BeautyDecisionPacket[];
}

interface StoreBackend<T extends Record<string, unknown>> {
  store: T;
}

const defaultPacketRecord: BeautyPacketRecord = {
  packets: [],
};

export class BeautyPacketStore implements BeautyPacketStoreLike {
  private readonly backend: StoreBackend<BeautyPacketRecord>;
  private readonly idFactory: () => string;
  private readonly now: () => string;

  constructor(options?: {
    backend?: StoreBackend<BeautyPacketRecord>;
    idFactory?: () => string;
    now?: () => string;
  }) {
    this.backend =
      options?.backend ??
      new Store<BeautyPacketRecord>({
        name: 'beauty-decision-packets',
        projectName: 'eveos-cowork',
        defaults: defaultPacketRecord,
      } as StoreOptions<BeautyPacketRecord> & { projectName?: string });
    this.idFactory = options?.idFactory ?? (() => `packet-${randomUUID()}`);
    this.now = options?.now ?? (() => new Date().toISOString());
    this.ensureRecord();
  }

  save(input: BeautyDecisionPacketInput): BeautyDecisionPacket {
    const current = this.getPackets();
    const now = this.now();
    const existing = input.id ? current.find((packet) => packet.id === input.id) : undefined;
    const packet: BeautyDecisionPacket = {
      ...input,
      id: input.id || this.idFactory(),
      question: input.question.trim(),
      market: normalizeOptionalString(input.market),
      brand: normalizeOptionalString(input.brand),
      product: normalizeOptionalString(input.product),
      decision_type: normalizeOptionalString(input.decision_type),
      run_id: normalizeOptionalString(input.run_id),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.setPackets([packet, ...current.filter((item) => item.id !== packet.id)]);
    return packet;
  }

  list(filters: BeautyPacketListFilters = {}): BeautyDecisionPacket[] {
    const market = normalizeForSearch(filters.market);
    const brand = normalizeForSearch(filters.brand);
    const product = normalizeForSearch(filters.product);
    const limit = Number.isFinite(filters.limit) && filters.limit ? Math.max(1, filters.limit) : 50;

    return this.getPackets()
      .filter((packet) => !market || normalizeForSearch(packet.market) === market)
      .filter((packet) => !brand || normalizeForSearch(packet.brand).includes(brand))
      .filter((packet) => !product || normalizeForSearch(packet.product).includes(product))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  get(id: string): BeautyDecisionPacket | null {
    return this.getPackets().find((packet) => packet.id === id) || null;
  }

  delete(id: string): boolean {
    const current = this.getPackets();
    const next = current.filter((packet) => packet.id !== id);
    this.setPackets(next);
    return next.length !== current.length;
  }

  private ensureRecord(): void {
    const raw = this.backend.store;
    if (!Array.isArray(raw.packets)) {
      this.backend.store = defaultPacketRecord;
    }
  }

  private getPackets(): BeautyDecisionPacket[] {
    const raw = this.backend.store;
    return Array.isArray(raw.packets) ? raw.packets : [];
  }

  private setPackets(packets: BeautyDecisionPacket[]): void {
    this.backend.store = { packets };
  }
}

let packetStore: BeautyPacketStore | null = null;

export function getBeautyPacketStore(): BeautyPacketStore {
  if (!packetStore) {
    packetStore = new BeautyPacketStore();
  }
  return packetStore;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeForSearch(value: string | undefined): string {
  return value?.trim().toLowerCase() || '';
}
