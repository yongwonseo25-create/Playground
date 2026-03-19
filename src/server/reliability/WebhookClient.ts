import { CircuitBreaker } from '@/server/reliability/circuitBreaker';
import { createWebhookSignature } from '@/server/webhook/WebhookSigner';

export type WebhookPayload = Record<string, unknown>;

export type TransportRequest = {
  url: string;
  body: string;
  headers: Record<string, string>;
  timeoutMs: number;
};

export type TransportResponse = {
  ok: boolean;
  status: number;
  bodyText?: string;
};

type TransportFn = (request: TransportRequest) => Promise<TransportResponse>;
type SleepFn = (ms: number) => Promise<void>;

export type WebhookClientOptions = {
  webhookUrl: string;
  webhookSecret: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  circuitBreaker?: CircuitBreaker;
  transport?: TransportFn;
  sleep?: SleepFn;
};

export type SendResult = {
  ok: boolean;
  deduplicated: boolean;
  attempts: number;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createFetchTransport(): TransportFn {
  return async ({ url, body, headers, timeoutMs }: TransportRequest): Promise<TransportResponse> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      });

      const bodyText = await response.text().catch(() => '');
      return {
        ok: response.ok,
        status: response.status,
        bodyText
      };
    } finally {
      clearTimeout(timeout);
    }
  };
}

export class WebhookClient {
  readonly circuitBreaker: CircuitBreaker;
  private readonly webhookUrl: string;
  private readonly webhookSecret: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly transport: TransportFn;
  private readonly sleep: SleepFn;
  private readonly sentIdempotencyKeys = new Set<string>();
  private readonly inFlightIdempotencyKeys = new Set<string>();

  constructor(options: WebhookClientOptions) {
    this.webhookUrl = options.webhookUrl;
    this.webhookSecret = options.webhookSecret;
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseMs = options.retryBaseMs ?? 250;
    this.circuitBreaker = options.circuitBreaker ?? new CircuitBreaker();
    this.transport = options.transport ?? createFetchTransport();
    this.sleep = options.sleep ?? defaultSleep;
  }

  async send(payload: WebhookPayload, idempotencyKey: string): Promise<SendResult> {
    if (this.sentIdempotencyKeys.has(idempotencyKey) || this.inFlightIdempotencyKeys.has(idempotencyKey)) {
      return {
        ok: true,
        deduplicated: true,
        attempts: 0
      };
    }

    this.inFlightIdempotencyKeys.add(idempotencyKey);

    try {
      let attempts = 0;
      let lastError: Error | null = null;

      for (let retry = 0; retry <= this.maxRetries; retry += 1) {
        this.circuitBreaker.assertCanRequest();
        attempts += 1;
        const timestamp = new Date().toISOString();
        const body = JSON.stringify(payload);
        const signature = createWebhookSignature({ timestamp, body }, this.webhookSecret);

        try {
          const response = await this.transport({
            url: this.webhookUrl,
            body,
            timeoutMs: this.timeoutMs,
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
              'X-Webhook-Timestamp': timestamp,
              'X-Webhook-Signature': signature,
              'X-Idempotency-Key': idempotencyKey
            }
          });

          if (!response.ok) {
            throw new Error(`Webhook responded with ${response.status}: ${response.bodyText ?? ''}`);
          }

          this.circuitBreaker.recordSuccess();
          this.sentIdempotencyKeys.add(idempotencyKey);
          return {
            ok: true,
            deduplicated: false,
            attempts
          };
        } catch (error) {
          const typedError = error instanceof Error ? error : new Error('Unknown webhook error');
          lastError = typedError;
          this.circuitBreaker.recordFailure();

          if (retry >= this.maxRetries) {
            throw typedError;
          }

          const delayMs = this.retryBaseMs * 2 ** retry;
          await this.sleep(delayMs);
        }
      }

      throw lastError ?? new Error('Webhook send failed.');
    } finally {
      this.inFlightIdempotencyKeys.delete(idempotencyKey);
    }
  }
}
