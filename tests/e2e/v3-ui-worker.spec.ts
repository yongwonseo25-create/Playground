import { expect, test } from '@playwright/test';
import { getStripeTestPublishableKey, startStripeCheckout } from '../../src/features/billing/services/billing-client';
import { createMemoryStore } from './helpers/v3-memory-store';
import { V3LocalStateStore, resetV3LocalState } from '../../src/server/db/v3-local-state';
import { LocalVoiceJobQueue, resetLocalVoiceJobQueue } from '../../src/server/queue/v3/local-voice-job-queue';
import { queueVoiceProcessingRequestLocal } from '../../src/server/voice/voice-processing-core';
import { LocalVoiceDequeueWorker, resetLocalVoiceWorker } from '../../src/server/voice/local-dequeue-worker';
import { MockVoicePayloadStore, resetMockVoicePayloadStore } from '../../src/server/voice/mock-payload-store';

test.describe('v3 checkout ui + local worker', () => {
  test.beforeEach(() => {
    resetLocalVoiceJobQueue();
    resetLocalVoiceWorker();
    resetMockVoicePayloadStore();
    resetV3LocalState();
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_voxera_checkout';
    process.env.QUEUE_PROVIDER = 'local';
    process.env.STT_DEDUPE_TTL_SEC = '900';
    process.env.DATABASE_URL = 'memory://local';
    process.env.REDIS_URL = 'memory://local';
    process.env.DESTINATION_WEBHOOK_URL = 'http://127.0.0.1:8788/webhook';
  });

  test('rejects non-test Stripe publishable keys on the client', async () => {
    expect(() => getStripeTestPublishableKey('pk_live_forbidden')).toThrow(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_.'
    );
  });

  test('starts Stripe checkout via /api/payment/checkout and redirects with sessionId', async () => {
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const redirectCalls: string[] = [];

    const result = await startStripeCheckout({
      userId: 7,
      creditsDelta: 50,
      publishableKey: 'pk_test_voxera_checkout',
      requestIdFactory: () => '44444444-4444-4444-8444-444444444444',
      fetchImpl: async (input, init) => {
        fetchCalls.push({ input, init });
        return new Response(
          JSON.stringify({
            ok: true,
            sessionId: 'cs_test_v3',
            checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_v3',
            requestId: '44444444-4444-4444-8444-444444444444'
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        );
      },
      stripeLoader: async () =>
        ({
          redirectToCheckout: async ({ sessionId }: { sessionId: string }) => {
            redirectCalls.push(sessionId);
            return {};
          }
        }) as never
    });

    expect(result.sessionId).toBe('cs_test_v3');
    expect(fetchCalls).toHaveLength(1);
    expect(String(fetchCalls[0]?.input)).toBe('/api/payment/checkout');
    expect(fetchCalls[0]?.init?.method).toBe('POST');
    expect(fetchCalls[0]?.init?.body).toContain('"creditsDelta":50');
    expect(redirectCalls).toEqual(['cs_test_v3']);
  });

  test('local dequeue worker processes mock STT jobs and drops staged payloads immediately', async () => {
    const stagedPayloadStore = new MockVoicePayloadStore();
    const cacheStore = createMemoryStore();
    const localState = new V3LocalStateStore();
    const queue = new LocalVoiceJobQueue();
    const routedPayloads: Array<Record<string, unknown>> = [];

    localState.setUserCredits(7, 12);

    stagedPayloadStore.put({
      s3Key: 'voice-uploads/mock-session.wav',
      clientRequestId: '55555555-5555-4555-8555-555555555555',
      userId: 7,
      rawPayload: 'mock-audio-frame-data',
      transcriptText: '대표님 테스트 음성입니다.',
      sessionId: 'session-local-worker',
      pcmFrameCount: 48000,
      sttProvider: 'whisper',
      audioDurationSec: 3,
      createdAt: '2026-03-17T00:00:00.000Z'
    });

    const enqueueResult = await queueVoiceProcessingRequestLocal(localState, queue, cacheStore, {
      userId: 7,
      clientRequestId: '55555555-5555-4555-8555-555555555555',
      s3Key: 'voice-uploads/mock-session.wav',
      creditsRequired: 2
    });

    expect(enqueueResult).toMatchObject({
      ok: true,
      deduplicated: false,
      queueProvider: 'local'
    });
    expect(stagedPayloadStore.size()).toBe(1);

    const worker = new LocalVoiceDequeueWorker({
      queue,
      payloadStore: stagedPayloadStore,
      localState,
      processor: async (payload) => {
        return {
          provider: 'mock-stt',
          transcriptText: payload.transcriptText ?? `[mock-stt] ${payload.clientRequestId}`
        };
      },
      destinationSender: async (payload) => {
        routedPayloads.push(payload);
      },
      pollIntervalMs: 10
    });

    await expect(worker.runOnce()).resolves.toBe(1);
    expect(routedPayloads).toHaveLength(1);
    expect(routedPayloads[0]).toMatchObject({
      clientRequestId: '55555555-5555-4555-8555-555555555555',
      transcriptText: '대표님 테스트 음성입니다.',
      sessionId: 'session-local-worker',
      pcmFrameCount: 48000,
      stt_provider: 'whisper',
      audio_duration_sec: 3
    });
    expect(stagedPayloadStore.size()).toBe(0);
    expect(await queue.size()).toBe(0);
    expect(localState.getUserCredits(7)).toBe(10);
    expect(localState.getVoiceLog('55555555-5555-4555-8555-555555555555')?.status).toBe('completed');
  });
});
