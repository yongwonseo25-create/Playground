import http from 'node:http';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { makeWebhookPayloadSchema, type MakeWebhookPayload } from '../../../src/shared/contracts/voice-submit';

type WebhookRequest = {
  body: MakeWebhookPayload;
  headers: http.IncomingHttpHeaders;
};

export class LiveSttRoutingStack {
  private readonly webhookPort: number;
  private readonly appBaseUrl: string;
  private webhookServer: http.Server | null = null;
  private readonly webhookRequests: WebhookRequest[] = [];
  private readonly logs: string[] = [];
  private wssProcess: ChildProcessWithoutNullStreams | null = null;

  constructor(options: { webhookPort?: number; appBaseUrl?: string } = {}) {
    this.webhookPort = options.webhookPort ?? 8896;
    this.appBaseUrl = options.appBaseUrl ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3400';
  }

  async start(): Promise<void> {
    await this.startWebhookServer();
    await this.startWssServer();
  }

  async close(): Promise<void> {
    await Promise.all([this.closeWssServer(), this.closeWebhookServer()]);
  }

  getWebhookRequests(): WebhookRequest[] {
    return [...this.webhookRequests];
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  private async startWebhookServer(): Promise<void> {
    this.webhookServer = http.createServer(async (request, response) => {
      if (request.method !== 'POST' || request.url !== '/webhook') {
        response.statusCode = 404;
        response.end('Not Found');
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        response.statusCode = 400;
        response.end('Invalid JSON');
        return;
      }

      const parsedPayload = makeWebhookPayloadSchema.safeParse(parsedJson);
      if (!parsedPayload.success) {
        response.statusCode = 400;
        response.end('Invalid webhook payload');
        return;
      }

      this.webhookRequests.push({
        body: parsedPayload.data,
        headers: request.headers
      });

      response.statusCode = 200;
      response.end('ok');
    });

    await new Promise<void>((resolve, reject) => {
      this.webhookServer?.once('error', reject);
      this.webhookServer?.listen(this.webhookPort, '127.0.0.1', () => {
        this.webhookServer?.off('error', reject);
        resolve();
      });
    });
  }

  private async startWssServer(): Promise<void> {
    const entryFile = path.resolve(process.cwd(), 'tests/e2e/helpers/mock-stt-wss-server.mjs');

    this.wssProcess = spawn(process.execPath, [entryFile], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_ENV: 'local',
        NEXT_PUBLIC_WSS_URL: 'ws://127.0.0.1:8787/voice-session',
        INTERNAL_APP_BASE_URL: this.appBaseUrl,
        OPENAI_API_KEY: 'openai-test-key',
        RETURN_ZERO_CLIENT_ID: 'return-zero-client-id',
        RETURN_ZERO_CLIENT_SECRET: 'return-zero-client-secret'
      },
      stdio: 'pipe'
    });

    this.wssProcess.stdout.on('data', (chunk: Buffer) => {
      this.logs.push(chunk.toString('utf8'));
    });

    this.wssProcess.stderr.on('data', (chunk: Buffer) => {
      this.logs.push(chunk.toString('utf8'));
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out while waiting for the mock WSS STT server to boot.'));
      }, 15_000);

      const checkReady = () => {
        if (this.logs.some((entry) => entry.includes('[voice-wss] listening'))) {
          clearTimeout(timeout);
          cleanup();
          resolve();
        }
      };

      const handleExit = () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Mock WSS STT server exited before becoming ready.'));
      };

      const cleanup = () => {
        this.wssProcess?.off('exit', handleExit);
        this.wssProcess?.stdout.off('data', checkReady);
        this.wssProcess?.stderr.off('data', checkReady);
      };

      this.wssProcess?.on('exit', handleExit);
      this.wssProcess?.stdout.on('data', checkReady);
      this.wssProcess?.stderr.on('data', checkReady);
      checkReady();
    });
  }

  private async closeWssServer(): Promise<void> {
    if (!this.wssProcess) {
      return;
    }

    const child = this.wssProcess;
    this.wssProcess = null;

    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.kill();
    });
  }

  private async closeWebhookServer(): Promise<void> {
    if (!this.webhookServer) {
      return;
    }

    const server = this.webhookServer;
    this.webhookServer = null;

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}
