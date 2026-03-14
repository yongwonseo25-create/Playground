import http from 'node:http';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { makeWebhookPayloadSchema, type MakeWebhookPayload } from '../../../src/shared/contracts/voice-submit';
import {
  voiceClientEventSchema,
  type VoiceClientEvent
} from '../../../src/shared/contracts/voice';

type WebhookRequest = {
  body: MakeWebhookPayload;
  headers: http.IncomingHttpHeaders;
};

type LiveVoiceRuntimeHarnessOptions = {
  websocketPort?: number;
  webhookPort?: number;
  responseMode?: 'final' | 'error' | 'no-ready';
  finalTranscript?: string;
};

function rawDataByteLength(rawData: RawData): number {
  if (typeof rawData === 'string') {
    return Buffer.byteLength(rawData);
  }

  if (rawData instanceof ArrayBuffer) {
    return rawData.byteLength;
  }

  if (Array.isArray(rawData)) {
    return rawData.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  }

  return rawData.byteLength;
}

function rawDataToString(rawData: RawData): string {
  if (typeof rawData === 'string') {
    return rawData;
  }

  if (rawData instanceof ArrayBuffer) {
    return Buffer.from(rawData).toString('utf8');
  }

  if (Array.isArray(rawData)) {
    return Buffer.concat(rawData).toString('utf8');
  }

  return rawData.toString('utf8');
}

export class LiveVoiceRuntimeHarness {
  private readonly websocketPort: number;
  private readonly webhookPort: number;
  private readonly responseMode: LiveVoiceRuntimeHarnessOptions['responseMode'];
  private readonly finalTranscript: string;
  private websocketServer: WebSocketServer | null = null;
  private webhookServer: http.Server | null = null;
  private readonly websocketEvents: VoiceClientEvent[] = [];
  private readonly webhookRequests: WebhookRequest[] = [];
  private totalPcmFrameCount = 0;

  constructor(options: LiveVoiceRuntimeHarnessOptions = {}) {
    this.websocketPort = options.websocketPort ?? 8787;
    this.webhookPort = options.webhookPort ?? 8788;
    this.responseMode = options.responseMode ?? 'final';
    this.finalTranscript =
      options.finalTranscript ??
      Array.from({ length: 18 }, (_, index) => {
        if (index === 0) {
          return 'Voice transcript received from the live WSS runtime.';
        }

        return `Scroll verification line ${index}. This transcript must remain vertically scrollable on touch devices.`;
      }).join('\n');
  }

  async start(): Promise<void> {
    await this.startWebhookServer();
    await this.startWebSocketServer();
  }

  async close(): Promise<void> {
    await Promise.all([this.closeWebSocketServer(), this.closeWebhookServer()]);
  }

  getWebSocketEvents(): VoiceClientEvent[] {
    return [...this.websocketEvents];
  }

  getWebhookRequests(): WebhookRequest[] {
    return [...this.webhookRequests];
  }

  getTotalPcmFrameCount(): number {
    return this.totalPcmFrameCount;
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

      const rawBody = Buffer.concat(chunks).toString('utf8');

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawBody);
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

  private async startWebSocketServer(): Promise<void> {
    this.websocketServer = new WebSocketServer({
      port: this.websocketPort,
      host: '127.0.0.1',
      path: '/voice'
    });

    this.websocketServer.on('connection', (socket: WebSocket) => {
      let sessionId: string | null = null;
      let partialSent = false;
      let sessionPcmFrames = 0;

      socket.on('message', (data: RawData, isBinary: boolean) => {
        if (isBinary) {
          const frameCount = Math.floor(rawDataByteLength(data) / 2);
          sessionPcmFrames += frameCount;
          this.totalPcmFrameCount += frameCount;

          if (sessionId && !partialSent) {
            partialSent = true;
            socket.send(
              JSON.stringify({
                type: 'transcript.partial',
                sessionId,
                text: 'Streaming live PCM audio...',
                isFinal: false
              })
            );
          }
          return;
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(rawDataToString(data));
        } catch {
          socket.send(
            JSON.stringify({
              type: 'session.error',
              error: 'Client sent invalid JSON.'
            })
          );
          return;
        }

        const parsedEvent = voiceClientEventSchema.safeParse(parsedJson);
        if (!parsedEvent.success) {
          socket.send(
            JSON.stringify({
              type: 'session.error',
              error: 'Client sent an invalid WSS contract.'
            })
          );
          return;
        }

        this.websocketEvents.push(parsedEvent.data);

        if (parsedEvent.data.type === 'session.start') {
          sessionId = parsedEvent.data.sessionId;
          if (this.responseMode === 'no-ready') {
            return;
          }

          socket.send(
            JSON.stringify({
              type: 'session.ready',
              sessionId,
              acceptedAt: new Date().toISOString()
            })
          );
          return;
        }

        if (parsedEvent.data.type === 'session.stop') {
          const resolvedSessionId = sessionId ?? parsedEvent.data.sessionId;
          if (this.responseMode === 'error') {
            socket.send(
              JSON.stringify({
                type: 'session.error',
                sessionId: resolvedSessionId,
                error: 'Runtime transcript final was not produced.',
                retryable: false
              })
            );
            return;
          }

          socket.send(
            JSON.stringify({
              type: 'transcript.final',
              sessionId: resolvedSessionId,
              text: this.finalTranscript,
              isFinal: true,
              pcmFrameCount: sessionPcmFrames,
              stt_provider: 'whisper',
              audio_duration_sec: Math.round((sessionPcmFrames / 48_000) * 1000) / 1000
            })
          );
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.websocketServer?.once('error', reject);
      this.websocketServer?.once('listening', () => {
        this.websocketServer?.off('error', reject);
        resolve();
      });
    });
  }

  private async closeWebSocketServer(): Promise<void> {
    if (!this.websocketServer) {
      return;
    }

    const server = this.websocketServer;
    this.websocketServer = null;

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      for (const client of server.clients) {
        client.terminate();
      }
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
