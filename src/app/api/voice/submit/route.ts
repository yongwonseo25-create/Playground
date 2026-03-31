import { NextResponse } from 'next/server';
import { CircuitBreaker } from '@/server/reliability/circuitBreaker';
import { WebhookClient, type WebhookPayload } from '@/server/reliability/WebhookClient';

export const runtime = 'nodejs';

type VoiceSubmitBody = {
  clientRequestId: string;
  transcriptText: string;
  spreadsheetId?: string;
  slackChannelId?: string;
  sessionId?: string;
  pcmFrameCount?: number;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 30_000
});

let sharedWebhookClient: WebhookClient | null = null;

function getWebhookClient(): WebhookClient {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL || process.env.NEXT_PUBLIC_WEBHOOK_URL;
  const webhookSecret = process.env.MAKE_WEBHOOK_SECRET;

  if (!webhookUrl) {
    throw new Error('Missing MAKE_WEBHOOK_URL environment variable.');
  }

  if (!webhookSecret) {
    throw new Error('Missing MAKE_WEBHOOK_SECRET environment variable.');
  }

  if (!sharedWebhookClient) {
    sharedWebhookClient = new WebhookClient({
      webhookUrl,
      webhookSecret,
      maxRetries: 3,
      retryBaseMs: 250,
      timeoutMs: 2_500,
      circuitBreaker
    });
  }

  return sharedWebhookClient;
}

export async function POST(request: Request) {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? 'local';

  let body: VoiceSubmitBody;
  try {
    body = (await request.json()) as VoiceSubmitBody;
  } catch {
    return badRequest('Invalid JSON body.');
  }

  if (!body.clientRequestId || !body.transcriptText) {
    return badRequest('clientRequestId and transcriptText are required.');
  }

  const payload: WebhookPayload = {
    clientRequestId: body.clientRequestId,
    transcriptText: body.transcriptText,
    spreadsheetId: body.spreadsheetId ?? '',
    slackChannelId: body.slackChannelId ?? '',
    sessionId: body.sessionId ?? '',
    pcmFrameCount: body.pcmFrameCount ?? 0,
    createdAt: new Date().toISOString()
  };

  try {
    const webhookClient = getWebhookClient();

    await webhookClient.send(payload, body.clientRequestId);

    return NextResponse.json({
      ok: true,
      acceptedForRetry: false,
      circuitState: webhookClient.circuitBreaker.snapshot().state
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown submit error.';

    if (appEnv === 'local' || appEnv === 'development') {
      return NextResponse.json({
        ok: true,
        mocked: true,
        acceptedForRetry: false,
        reason: message
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}
