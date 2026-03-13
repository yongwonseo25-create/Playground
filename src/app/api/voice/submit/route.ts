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
import { FailureQueue } from '@/server/queue/failureQueue';

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

let sharedQueue: FailureQueue | null = null;
let sharedWebhookClient: WebhookClient | null = null;

function getQueueClient(): { webhookClient: WebhookClient; queue: FailureQueue } {
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

  if (!sharedQueue) {
    sharedQueue = new FailureQueue({
      client: sharedWebhookClient,
      pollIntervalMs: 1_000
    });
    sharedQueue.startWorker();
  }

  return { webhookClient: sharedWebhookClient, queue: sharedQueue };
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
    const { webhookClient } = getQueueClient();

    await webhookClient.send(payload, parsedBody.data.clientRequestId);

    return NextResponse.json(
      voiceSubmitSuccessResponseSchema.parse({
        ok: true,
        acceptedForRetry: false,
        circuitState: webhookClient.circuitBreaker.snapshot().state
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown submit error.';

    try {
      const { queue, webhookClient } = getQueueClient();
      await queue.enqueue(parsedBody.data.clientRequestId, payload);

      return NextResponse.json(
        voiceSubmitSuccessResponseSchema.parse({
          ok: true,
          acceptedForRetry: true,
          reason: message,
          circuitState: webhookClient.circuitBreaker.snapshot().state
        })
      );
    } catch (queueError) {
      const queueMessage =
        queueError instanceof Error ? queueError.message : 'Unknown queue enqueue error.';

      return NextResponse.json(
        {
          ok: false,
          error: message,
          queueError: queueMessage,
          issues: []
        },
        { status: env.NEXT_PUBLIC_APP_ENV === 'local' || env.NEXT_PUBLIC_APP_ENV === 'development' ? 500 : 500 }
      );
    }
  }
}
