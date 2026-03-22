import { neonOneShotQueryRequestSchema, neonOneShotQueryResponseSchema } from '@/shared/contracts/v4-infra';

export const NEON_HTTP_TRANSPORT_CONFIG = Object.freeze({
  mode: 'http-one-shot',
  pooling: false,
  connectionReuse: 'disabled'
});

export type NeonHttpOneShotClientOptions = {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type NeonHttpQueryInput = {
  sql: string;
  params?: readonly unknown[];
  timeoutMs?: number;
};

export type NeonHttpOneShotClientResult = {
  rowCount: number;
  rows: Record<string, unknown>[];
};

export class NeonHttpOneShotClient {
  private readonly baseUrl: string;

  private readonly apiKey: string;

  private readonly fetchImpl: typeof fetch;

  private readonly timeoutMs: number;

  constructor(options: NeonHttpOneShotClientOptions) {
    const parsedUrl = new URL(options.baseUrl);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new Error('[v4-neon] baseUrl must use http:// or https:// for one-shot transport.');
    }

    this.baseUrl = parsedUrl.toString();
    this.apiKey = options.apiKey.trim();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;

    if (!this.apiKey) {
      throw new Error('[v4-neon] apiKey is required.');
    }
  }

  async query(input: NeonHttpQueryInput): Promise<NeonHttpOneShotClientResult> {
    const parsed = neonOneShotQueryRequestSchema.parse({
      sql: input.sql,
      params: input.params ?? [],
      timeoutMs: input.timeoutMs ?? this.timeoutMs
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), parsed.timeoutMs);

    try {
      const response = await this.fetchImpl(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: parsed.sql,
          params: parsed.params
        }),
        signal: controller.signal
      });

      const rawBody = await response.text();
      if (!response.ok) {
        throw new Error(
          `[v4-neon] HTTP ${response.status} from Neon one-shot query endpoint: ${rawBody || 'empty body'}`
        );
      }

      let json: unknown;
      try {
        json = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        throw new Error('[v4-neon] Neon endpoint returned invalid JSON.');
      }

      const parsedResponse = neonOneShotQueryResponseSchema.parse(json);
      return {
        rowCount: parsedResponse.rowCount,
        rows: parsedResponse.rows
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createNeonHttpOneShotClient(options: NeonHttpOneShotClientOptions): NeonHttpOneShotClient {
  return new NeonHttpOneShotClient(options);
}

export function getNeonHttpTransportConfig() {
  return NEON_HTTP_TRANSPORT_CONFIG;
}
