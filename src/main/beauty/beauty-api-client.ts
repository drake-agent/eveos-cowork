export type BeautyMarket = 'KR' | 'JP' | 'US' | 'global' | string;

export interface BeautyQuestionRequest {
  question: string;
  market?: BeautyMarket;
  brand?: string;
  product?: string;
  decision_type?: string;
}

export interface BeautyAnalystRunRequest extends BeautyQuestionRequest {
  wait?: boolean;
}

export interface BeautyApiClientOptions {
  baseUrl: string;
  tokenProvider: () => string | Promise<string>;
  fetchImpl?: typeof fetch;
}

export class BeautyApiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'BeautyApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

const AUTHORIZATION_BEARER_PATTERN = /(Authorization\s*:\s*Bearer\s+)[^\s"'<>]+/gi;
const BARE_BEARER_PATTERN = /(Bearer\s+)[^\s"'<>]+/gi;
const API_KEY_PATTERN = /((?:api[_-]?key|token|cookie)\s*=\s*)[^\s"'&<>]+/gi;

export function redactBeautyApiSecret(value: string): string {
  return value
    .replace(AUTHORIZATION_BEARER_PATTERN, '$1[REDACTED]')
    .replace(BARE_BEARER_PATTERN, '$1[REDACTED]')
    .replace(API_KEY_PATTERN, '$1[REDACTED]');
}

export class BeautyApiClient {
  private readonly baseUrl: string;
  private readonly tokenProvider: BeautyApiClientOptions['tokenProvider'];
  private readonly fetchImpl: typeof fetch;

  constructor(options: BeautyApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.tokenProvider = options.tokenProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  health(): Promise<unknown> {
    return this.request('/health', { auth: false });
  }

  tools(): Promise<unknown> {
    return this.request('/tools', { auth: true });
  }

  intentBrief(payload: BeautyQuestionRequest): Promise<unknown> {
    return this.request('/intent-brief', {
      auth: true,
      method: 'POST',
      body: payload,
    });
  }

  startAnalystRun(payload: BeautyAnalystRunRequest): Promise<unknown> {
    return this.request('/analyst-run', {
      auth: true,
      method: 'POST',
      body: payload,
    });
  }

  answerResult(runId: string): Promise<unknown> {
    return this.request(`/answer-result?run_id=${encodeURIComponent(runId)}`, { auth: true });
  }

  analystQueue(limit = 20): Promise<unknown> {
    return this.request(`/analyst-queue?limit=${encodeURIComponent(String(limit))}`, {
      auth: true,
    });
  }

  private async request(
    endpoint: string,
    options: {
      auth: boolean;
      method?: 'GET' | 'POST';
      body?: unknown;
    }
  ): Promise<unknown> {
    const headers: Record<string, string> = {};
    const method = options.method ?? 'GET';

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let token = '';
    if (options.auth) {
      token = String(await this.tokenProvider()).trim();
      if (!token) {
        throw new BeautyApiError('Beauty API token is not configured', 0, endpoint);
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const data = parseJsonOrText(text);

    if (!response.ok) {
      const bodyMessage =
        typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: unknown }).error)
          : text || response.statusText;
      const redacted = redactBeautyApiSecret(bodyMessage).replaceAll(token, '[REDACTED]');
      throw new BeautyApiError(
        `Beauty API request failed (${response.status}): ${redacted}`,
        response.status,
        endpoint
      );
    }

    return data;
  }
}

function parseJsonOrText(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
