import Store, { type Options as StoreOptions } from 'electron-store';
import {
  createEncryptedStoreWithKeyRotation,
  getLegacyDerivedKeyHexes,
} from '../utils/store-encryption';
import { log, logWarn } from '../utils/logger';

export interface BeautyPublicConfig {
  baseUrl: string;
  hasToken: boolean;
  updatedAt: string;
}

export interface BeautySecretConfig {
  baseUrl: string;
  token: string;
}

export interface BeautyConfigInput {
  baseUrl?: string;
  token?: string;
}

export interface BeautyConfigStoreLike {
  getPublicConfig(): BeautyPublicConfig;
  getSecretConfig(): BeautySecretConfig;
  save(input: BeautyConfigInput): BeautyPublicConfig;
}

interface BeautyConfigRecord extends Record<string, unknown> {
  baseUrl: string;
  token: string;
  updatedAt: string;
}

const defaultBeautyConfig: BeautyConfigRecord = {
  baseUrl: 'https://beauty.eveos.one',
  token: '',
  updatedAt: '1970-01-01T00:00:00.000Z',
};

export class BeautyConfigStore implements BeautyConfigStoreLike {
  private readonly store: Store<BeautyConfigRecord>;

  constructor() {
    const storeOptions: StoreOptions<BeautyConfigRecord> & { projectName?: string } = {
      name: 'beauty-api',
      projectName: 'eveos-cowork',
      defaults: defaultBeautyConfig,
    };

    this.store = createEncryptedStoreWithKeyRotation<BeautyConfigRecord>({
      stableKey: 'eveos-beauty-api-config-stable-v1',
      legacyKeys: [
        'eveos-beauty-api-config-v1',
        ...getLegacyDerivedKeyHexes({
          moduleDirname: __dirname,
          stableSeed: 'eveos-beauty-api-config-stable-v1',
          legacySeed: 'eveos-beauty-api-config-v1',
          salt: 'eveos-beauty-api-config-salt',
        }),
      ],
      storeOptions,
      logPrefix: '[BeautyConfigStore]',
      log,
      warn: logWarn,
    });
    this.ensureDefaults();
  }

  getPublicConfig(): BeautyPublicConfig {
    const config = this.getRecord();
    return {
      baseUrl: config.baseUrl,
      hasToken: config.token.trim().length > 0,
      updatedAt: config.updatedAt,
    };
  }

  getSecretConfig(): BeautySecretConfig {
    const config = this.getRecord();
    return {
      baseUrl: config.baseUrl,
      token: config.token,
    };
  }

  save(input: BeautyConfigInput): BeautyPublicConfig {
    const current = this.getRecord();
    const next: BeautyConfigRecord = {
      ...current,
      updatedAt: new Date().toISOString(),
    };

    if (input.baseUrl !== undefined) {
      next.baseUrl = input.baseUrl.trim() || defaultBeautyConfig.baseUrl;
    }
    if (input.token !== undefined) {
      next.token = input.token.trim();
    }

    this.store.store = next;
    return this.getPublicConfig();
  }

  private ensureDefaults(): void {
    this.store.store = this.getRecord();
  }

  private getRecord(): BeautyConfigRecord {
    const raw = this.store.store as Partial<BeautyConfigRecord>;
    return {
      baseUrl:
        typeof raw.baseUrl === 'string' && raw.baseUrl.trim()
          ? raw.baseUrl
          : defaultBeautyConfig.baseUrl,
      token: typeof raw.token === 'string' ? raw.token : '',
      updatedAt:
        typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
          ? raw.updatedAt
          : defaultBeautyConfig.updatedAt,
    };
  }
}

export const beautyConfigStore = new BeautyConfigStore();
