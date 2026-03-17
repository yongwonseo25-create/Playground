import { expect, test } from '@playwright/test';
import { getV3StripeCheckoutEnv } from '../../src/server/config/v3-env';
import { getCachedUserCredits, invalidateCachedUserCredits, setCachedUserCredits } from '../../src/server/cache/credit-cache';
import { reserveSttRequestId } from '../../src/server/cache/stt-dedupe-cache';
import type { CacheStore } from '../../src/server/cache/v3-redis';
import { createStripeCheckoutSession } from '../../src/server/payments/stripe-checkout';
import { LocalVoiceJobQueue, resetLocalVoiceJobQueue } from '../../src/server/queue/v3/local-voice-job-queue';
import { SqsVoiceJobQueue } from '../../src/server/queue/v3/sqs-voice-job-queue';
import { queueVoiceProcessingRequest } from '../../src/server/voice/voice-processing-core';
import type { Queryable } from '../../src/server/db/v3-pg';
import type { QueryResultRow } from 'pg';

function createMemoryStore(): CacheStore {
  const storage = new Map<string, string>();

  return {
    async get(key) {
      return storage.get(key) ?? null;
    },
    async set(key, value, options) {
      if (options.onlyIfAbsent && storage.has(key)) {
        return false;
      }

      storage.set(key, value);
      return true;
    },
    async del(key) {
      storage.delete(key);
    }
  };
}

test.describe('v3 checkout queue cache', () => {
  test.beforeEach(() => {
    resetLocalVoiceJobQueue();
    process.env.QUEUE_PROVIDER = 'local';
    process.env.USER_CREDITS_CACHE_TTL_SEC = '30';
    process.env.STT_DEDUPE_TTL_SEC = '900';
    process.env.STRIPE_API_KEY = 'sk_test_v3_checkout';
    process.env.STRIPE_CHECKOUT_SUCCESS_PATH = '/billing/success';
    process.env.STRIPE_CHECKOUT_CANCEL_PATH = '/billing/cancel';
  });

  test('rejects live Stripe secret keys for checkout env', async () => {
    process.env.STRIPE_API_KEY = 'sk_live_forbidden';

    expect(() => getV3StripeCheckoutEnv()).toThrow('STRIPE_API_KEY must start with sk_test_.');
  });

  test('creates a Stripe test-mode checkout session payload with metadata', async () => {
    const createCalls: Array<Record<string, unknown>> = [];
    const mockStripe = {
      checkout: {
        sessions: {
          create: async (input: Record<string, unknown>) => {
            createCalls.push(input);
            return {
              id: 'cs_test_123',
              url: 'https://checkout.stripe.com/pay/cs_test_123'
            };
          }
        }
      }
    };

    const session = await createStripeCheckoutSession(
      {
        userId: 17,
        requestId: '11111111-1111-4111-8111-111111111111',
        creditsDelta: 25,
        origin: 'https://voxera.example.com'
      },
      mockStripe
    );

    expect(session).toEqual({
      sessionId: 'cs_test_123',
      checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
      requestId: '11111111-1111-4111-8111-111111111111'
    });
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({
      mode: 'payment',
      success_url: 'https://voxera.example.com/billing/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://voxera.example.com/billing/cancel',
      metadata: {
        userId: '17',
        requestId: '11111111-1111-4111-8111-111111111111',
        creditsDelta: '25'
      }
    });
  });

  test('credits cache and STT dedupe cache use TTL-backed keys', async () => {
    const store = createMemoryStore();

    await setCachedUserCredits(17, 240, store);
    expect(await getCachedUserCredits(17, store)).toBe(240);

    await invalidateCachedUserCredits(17, store);
    expect(await getCachedUserCredits(17, store)).toBeNull();

    expect(await reserveSttRequestId('11111111-1111-4111-8111-111111111111', store)).toBe(true);
    expect(await reserveSttRequestId('11111111-1111-4111-8111-111111111111', store)).toBe(false);
  });

  test('local voice queue and voice processing core deduplicate by clientRequestId', async () => {
    const executedQueries: string[] = [];
    const runner: Queryable = {
      async query<T extends QueryResultRow = QueryResultRow>(text: string) {
        const normalized = text.replace(/\s+/g, ' ').trim();
        executedQueries.push(normalized);

        if (normalized.startsWith('INSERT INTO voice_processing_log')) {
          return {
            rowCount: 1,
            rows: [{ id: 1 } as unknown as T]
          };
        }

        if (normalized.startsWith('UPDATE voice_processing_log')) {
          return {
            rowCount: 1,
            rows: [] as T[]
          };
        }

        return {
          rowCount: 0,
          rows: [] as T[]
        };
      }
    };

    const queue = new LocalVoiceJobQueue();
    const store = createMemoryStore();

    const first = await queueVoiceProcessingRequest(runner, queue, store, {
      userId: 17,
      clientRequestId: '22222222-2222-4222-8222-222222222222',
      s3Key: 'voice-uploads/session-17/file.wav',
      creditsRequired: 3
    });

    expect(first).toMatchObject({
      ok: true,
      deduplicated: false,
      queueProvider: 'local'
    });

    const received = await queue.receive(1);
    expect(received).toHaveLength(1);
    expect(received[0]?.payload).toMatchObject({
      userId: 17,
      clientRequestId: '22222222-2222-4222-8222-222222222222',
      s3Key: 'voice-uploads/session-17/file.wav',
      creditsRequired: 3
    });

    await queue.ack([received[0]!.receiptId]);
    expect(executedQueries.some((queryText) => queryText.includes('INSERT INTO voice_processing_log'))).toBe(true);

    const second = await queueVoiceProcessingRequest(runner, queue, store, {
      userId: 17,
      clientRequestId: '22222222-2222-4222-8222-222222222222',
      s3Key: 'voice-uploads/session-17/file.wav',
      creditsRequired: 3
    });

    expect(second).toMatchObject({
      ok: true,
      deduplicated: true,
      queueProvider: 'local'
    });
    expect(await queue.size()).toBe(0);
  });

  test('SQS queue scaffold serializes payloads without touching real AWS', async () => {
    process.env.QUEUE_PROVIDER = 'sqs';
    process.env.AWS_REGION = 'us-east-1';
    process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/000000000000/voxera-voice-queue';

    const sendInputs: unknown[] = [];

    class SendMessageCommand {
      constructor(readonly input: unknown) {}
    }

    class ReceiveMessageCommand {
      constructor(readonly input: unknown) {}
    }

    class DeleteMessageCommand {
      constructor(readonly input: unknown) {}
    }

    class GetQueueAttributesCommand {
      constructor(readonly input: unknown) {}
    }

    class SQSClient {
      async send(command: unknown) {
        sendInputs.push(command);

        if (command instanceof SendMessageCommand) {
          return { MessageId: 'msg-1' };
        }

        if (command instanceof ReceiveMessageCommand) {
          return {
            Messages: [
              {
                MessageId: 'msg-1',
                ReceiptHandle: 'receipt-1',
                Body: JSON.stringify({
                  userId: 17,
                  clientRequestId: '33333333-3333-4333-8333-333333333333',
                  s3Key: 'voice-uploads/session-17/file.wav',
                  creditsRequired: 5,
                  requestedAt: '2026-03-17T00:00:00.000Z'
                })
              }
            ]
          };
        }

        if (command instanceof DeleteMessageCommand) {
          return {};
        }

        if (command instanceof GetQueueAttributesCommand) {
          return {
            Attributes: {
              ApproximateNumberOfMessages: '7'
            }
          };
        }

        throw new Error('Unknown SQS command.');
      }
    }

    const queue = new SqsVoiceJobQueue(async () => ({
      SQSClient,
      SendMessageCommand,
      ReceiveMessageCommand,
      DeleteMessageCommand,
      GetQueueAttributesCommand
    }));

    const enqueueResult = await queue.enqueue({
      userId: 17,
      clientRequestId: '33333333-3333-4333-8333-333333333333',
      s3Key: 'voice-uploads/session-17/file.wav',
      creditsRequired: 5,
      requestedAt: '2026-03-17T00:00:00.000Z'
    });

    expect(enqueueResult).toEqual({
      provider: 'sqs',
      messageId: 'msg-1'
    });

    const jobs = await queue.receive(1);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.payload.clientRequestId).toBe('33333333-3333-4333-8333-333333333333');

    await queue.ack(['receipt-1']);
    await expect(queue.size()).resolves.toBe(7);
    expect(sendInputs.length).toBe(4);
  });
});
