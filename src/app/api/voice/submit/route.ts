import { NextResponse } from 'next/server';
import { formatZodIssues } from '@/shared/contracts/common';
import {
  makeWebhookPayloadSchema,
  voiceSubmitRequestSchema,
  voiceSubmitSuccessResponseSchema
} from '@/shared/contracts/voice-submit';
import { env } from '@/shared/config/env';
import { CircuitBreaker } from '@/server/reliability/circuitBreaker';
import { WebhookClient, type WebhookPayload } from '@/server/reliability/WebhookClient';

export const runtime = 'nodejs';

function contractError(status: number, error: string, issues: ReturnType<typeof formatZodIssues> = []) {
  return NextResponse.json(
    {
      ok: false,
      error,
      issues
    },
    { status }
  );
}

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 30_000
});

let sharedWebhookClient: WebhookClient | null = null;

function getWebhookClient(): WebhookClient {
  if (!sharedWebhookClient) {
    sharedWebhookClient = new WebhookClient({
      webhookUrl: env.MAKE_WEBHOOK_URL,
      webhookSecret: env.MAKE_WEBHOOK_SECRET,
      maxRetries: 3,
      retryBaseMs: 250,
      timeoutMs: 2_500,
      circuitBreaker
    });
  }

  return sharedWebhookClient;
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return contractError(400, 'Invalid JSON body.');
  }

  const parsedBody = voiceSubmitRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return contractError(400, 'Invalid voice submit request contract.', formatZodIssues(parsedBody.error));
  }

  const parsedPayload = makeWebhookPayloadSchema.safeParse({
    ...parsedBody.data,
    stt_provider: parsedBody.data.stt_provider ?? 'whisper',
    audio_duration_sec: parsedBody.data.audio_duration_sec ?? 0,
    createdAt: new Date().toISOString()
  });

  if (!parsedPayload.success) {
    return contractError(
      500,
      'Invalid Make.com payload contract.',
      formatZodIssues(parsedPayload.error)
    );
  }

  const payload: WebhookPayload = parsedPayload.data;

  try {
    const webhookClient = getWebhookClient();

    await webhookClient.send(payload, parsedBody.data.clientRequestId);

    return NextResponse.json(
      voiceSubmitSuccessResponseSchema.parse({
        ok: true,
        acceptedForRetry: false,
        stt_provider: payload.stt_provider,
        audio_duration_sec: payload.audio_duration_sec,
        circuitState: webhookClient.circuitBreaker.snapshot().state
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown submit error.';
    const appEnv = env.NEXT_PUBLIC_APP_ENV;

    if (appEnv === 'local' || appEnv === 'development') {
      return NextResponse.json(
        voiceSubmitSuccessResponseSchema.parse({
          ok: true,
          acceptedForRetry: false,
          stt_provider: payload.stt_provider,
          audio_duration_sec: payload.audio_duration_sec,
          reason: message,
          circuitState: circuitBreaker.snapshot().state
        })
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: message,
        issues: []
      },
      { status: 500 }
    );
  }
}
