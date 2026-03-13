import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { verifyWebhookSignature } from '../../../src/server/webhook/WebhookSigner';

export type MockWebhookBehavior =
  | {
      type: 'success';
      status?: number;
      body?: string;
    }
  | {
      type: 'failure';
      status?: number;
      body?: string;
    }
  | {
      type: 'timeout';
      delayMs?: number;
    };

export type MockWebhookRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  bodyText: string;
  bodyJson: Record<string, unknown> | null;
  signatureValid: boolean;
  behaviorType: MockWebhookBehavior['type'];
  receivedAt: string;
};

function normalizeHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return value ?? '';
}

function normalizeHeaders(headers: IncomingMessage['headers']): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), normalizeHeaderValue(value)])
  );
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    request.on('error', reject);
  });
}

export class MakeWebhookMockServer {
  private readonly secret: string;
  private readonly requests: MockWebhookRequest[] = [];
  private readonly queuedBehaviors: MockWebhookBehavior[] = [];
  private readonly pendingTimeouts = new Set<NodeJS.Timeout>();
  private fallbackBehavior: MockWebhookBehavior = { type: 'success', status: 200, body: 'ok' };
  private server: Server | null = null;

  constructor(secret: string) {
    this.secret = secret;
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer(async (request, response) => {
      await this.handleRequest(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(0, '127.0.0.1', () => {
        this.server?.off('error', reject);
        resolve();
      });
    });
  }

  enqueueBehaviors(...behaviors: MockWebhookBehavior[]): void {
    this.queuedBehaviors.push(...behaviors);
  }

  setFallbackBehavior(behavior: MockWebhookBehavior): void {
    this.fallbackBehavior = behavior;
  }

  url(pathname = '/webhook'): string {
    if (!this.server) {
      throw new Error('Mock server must be started before use.');
    }

    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Mock server address is unavailable.');
    }

    return `http://127.0.0.1:${(address as AddressInfo).port}${pathname}`;
  }

  getRequests(): MockWebhookRequest[] {
    return [...this.requests];
  }

  async close(): Promise<void> {
    for (const timeout of this.pendingTimeouts) {
      clearTimeout(timeout);
    }
    this.pendingTimeouts.clear();

    if (!this.server) {
      return;
    }

    this.server.closeAllConnections?.();

    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
    });

    this.server = null;
    this.requests.length = 0;
    this.queuedBehaviors.length = 0;
  }

  private nextBehavior(): MockWebhookBehavior {
    return this.queuedBehaviors.shift() ?? this.fallbackBehavior;
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const bodyText = await readBody(request);
    const headers = normalizeHeaders(request.headers);
    const timestamp = headers['x-webhook-timestamp'] ?? '';
    const signature = headers['x-webhook-signature'] ?? '';
    const signatureValid =
      Boolean(timestamp) &&
      Boolean(signature) &&
      verifyWebhookSignature({ timestamp, body: bodyText }, this.secret, signature);

    let bodyJson: Record<string, unknown> | null = null;
    try {
      bodyJson = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      bodyJson = null;
    }

    const behavior = this.nextBehavior();
    this.requests.push({
      method: request.method ?? 'UNKNOWN',
      path: request.url ?? '/',
      headers,
      bodyText,
      bodyJson,
      signatureValid,
      behaviorType: behavior.type,
      receivedAt: new Date().toISOString()
    });

    if (!signatureValid) {
      response.writeHead(401, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: 'Invalid webhook signature' }));
      return;
    }

    if (behavior.type === 'timeout') {
      const timeout = setTimeout(() => {
        this.pendingTimeouts.delete(timeout);
        if (!response.writableEnded) {
          response.destroy();
        }
      }, behavior.delayMs ?? 1_000);

      this.pendingTimeouts.add(timeout);
      return;
    }

    const status = behavior.status ?? (behavior.type === 'success' ? 200 : 500);
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: status >= 200 && status < 300, message: behavior.body ?? 'ok' }));
  }
}
