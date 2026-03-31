import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { CircuitBreaker, CircuitOpenError } from '../../src/server/reliability/circuitBreaker';
import { WebhookClient } from '../../src/server/reliability/WebhookClient';
import { FailureQueue, type FailureQueueItem } from '../../src/server/queue/failureQueue';
import { MakeWebhookMockServer } from './helpers/make-webhook-mock-server';
import { createHmac } from 'node:crypto';
import { test, expect } from '@playwright/test';
import type { SolapiAdapter } from '../../src/integrations/solapi/solapi-adapter';
import { createWebhookSignature } from '../../src/server/webhook/WebhookSigner';
import { CircuitBreaker, CircuitOpenError } from '../../src/server/reliability/circuitBreaker';
import { WebhookClient } from '../../src/server/reliability/WebhookClient';
import { SqsQueueService } from '../../src/server/queue/sqs-queue.service';
import {
  MessageDispatchRetryableError,
  MessageDispatchService,
  type DispatchAttemptSnapshot,
  type DispatchFailureSnapshot,
  type DispatchReservationResult,
  type MessageDispatchCommitTransaction,
  type MessageDispatchInput,
  type MessageDispatchRecord,
  type MessageDispatchStore
} from '../../src/domain/messaging/message-dispatch.service';

const WEBHOOK_SECRET = 'voxera-make-secret';

async function readQueueItems(queueFile: string): Promise<FailureQueueItem[]> {
  const raw = await readFile(queueFile, 'utf8');
  if (!raw.trim()) {
    return [];
  }

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FailureQueueItem);
}

test.describe('backend reliability', () => {
  let mockServer: MakeWebhookMockServer | null = null;
  const tempDirs = new Set<string>();

  test.afterEach(async () => {
    if (mockServer) {
      await mockServer.close();
      mockServer = null;
    }

    for (const tempDir of tempDirs) {
      await rm(tempDir, { recursive: true, force: true });
    }
    tempDirs.clear();
  });

  test('signature-validating Make.com mock proves 3-step exponential backoff before 200 OK', async () => {
    mockServer = new MakeWebhookMockServer(WEBHOOK_SECRET);
    await mockServer.start();
    mockServer.enqueueBehaviors(
      { type: 'failure', status: 500, body: 'first fail' },
      { type: 'failure', status: 500, body: 'second fail' },
      { type: 'failure', status: 500, body: 'third fail' },
      { type: 'success', status: 200, body: 'ok' }
    );

    const delays: number[] = [];
    const client = new WebhookClient({
      webhookUrl: mockServer.url(),
      webhookSecret: WEBHOOK_SECRET,
      maxRetries: 3,
      retryBaseMs: 250,
      sleep: async (ms) => {
        delays.push(ms);
      }
    });

    const payload = {
      clientRequestId: 'req-backoff',
      transcriptText: '대표님 오늘 할 일 정리해줘',
      notionDatabaseId: 'notion-db-backoff',
      notionParentPageId: 'notion-page-backoff',
      sessionId: 'session-backoff',
      pcmFrameCount: 24_000
    };

    const result = await client.send(payload, payload.clientRequestId);
    const requests = mockServer.getRequests();

    expect(result).toEqual({
      ok: true,
      deduplicated: false,
      attempts: 4
    });
    expect(delays).toEqual([250, 500, 1000]);
    expect(requests).toHaveLength(4);
    expect(requests.every((request) => request.signatureValid)).toBe(true);
    expect(requests.every((request) => request.headers['x-idempotency-key'] === payload.clientRequestId)).toBe(
      true
    );
    expect(requests.at(-1)?.bodyJson).toMatchObject(payload);
  });

  test('duplicate idempotency key is blocked before a second request reaches Make.com mock', async () => {
    mockServer = new MakeWebhookMockServer(WEBHOOK_SECRET);
    await mockServer.start();

    const client = new WebhookClient({
      webhookUrl: mockServer.url(),
      webhookSecret: WEBHOOK_SECRET
    });

    const first = await client.send({ transcriptText: 'hello' }, 'dup-key');
    const second = await client.send({ transcriptText: 'hello' }, 'dup-key');

    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(mockServer.getRequests()).toHaveLength(1);
    expect(mockServer.getRequests()[0]?.signatureValid).toBe(true);
  });

  test('timeouting Make.com mock opens the circuit breaker after five failed submissions', async () => {
    mockServer = new MakeWebhookMockServer(WEBHOOK_SECRET);
    await mockServer.start();
    mockServer.setFallbackBehavior({ type: 'timeout', delayMs: 200 });

    const breaker = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 60_000 });
    const client = new WebhookClient({
      webhookUrl: mockServer.url(),
      webhookSecret: WEBHOOK_SECRET,
      timeoutMs: 50,
      maxRetries: 0,
      circuitBreaker: breaker
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(client.send({ transcriptText: `timeout-${attempt}` }, `timeout-${attempt}`)).rejects.toThrow();
    }

    expect(breaker.snapshot().state).toBe('OPEN');
    await expect(client.send({ transcriptText: 'blocked' }, 'timeout-blocked')).rejects.toThrow(
      CircuitOpenError
    );
    expect(mockServer.getRequests()).toHaveLength(5);
    expect(mockServer.getRequests().every((request) => request.signatureValid)).toBe(true);
  });

  test('failureQueue persists, backs off, and flushes after Make.com mock recovery', async () => {
    mockServer = new MakeWebhookMockServer(WEBHOOK_SECRET);
    await mockServer.start();
    mockServer.enqueueBehaviors(
      { type: 'failure', status: 500, body: 'send fail 1' },
      { type: 'failure', status: 500, body: 'queue fail 1' },
      { type: 'success', status: 200, body: 'queue recovered' }
    );

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'voxera-queue-mock-'));
    tempDirs.add(tempDir);
    const queueFile = path.join(tempDir, 'failure-queue.jsonl');

    const client = new WebhookClient({
      webhookUrl: mockServer.url(),
      webhookSecret: WEBHOOK_SECRET,
      maxRetries: 0
    });

    const payload = {
      clientRequestId: 'queue-replay-key',
      transcriptText: '실패 큐에 적재 후 재시도',
      notionDatabaseId: 'notion-db-queue'
    };

    await expect(client.send(payload, payload.clientRequestId)).rejects.toThrow(
      'Webhook responded with 500'
    );

    let now = 1_000;
    const queueA = new FailureQueue({
      client,
      filePath: queueFile,
      now: () => now,
      maxBackoffMs: 10_000
    });

    const inserted = await queueA.enqueue(payload.clientRequestId, payload);
    expect(inserted).toBe(true);
    expect(await queueA.size()).toBe(1);

    now = 2_000;
    const queueB = new FailureQueue({
      client,
      filePath: queueFile,
      now: () => now,
      maxBackoffMs: 10_000
    });
    await queueB.processDue();

    let queuedItems = await readQueueItems(queueFile);
    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0]).toMatchObject({
      idempotencyKey: payload.clientRequestId,
      attempts: 1
    });
    expect(queuedItems[0]?.nextAttemptAt).toBe(4_000);
    expect(queuedItems[0]?.lastError).toContain('Webhook responded with 500');

    now = 3_500;
    const queueC = new FailureQueue({
      client,
      filePath: queueFile,
      now: () => now,
      maxBackoffMs: 10_000
    });
    await queueC.processDue();
    expect(mockServer.getRequests()).toHaveLength(2);

    now = 4_500;
    const queueD = new FailureQueue({
      client,
      filePath: queueFile,
      now: () => now,
      maxBackoffMs: 10_000
    });
    await queueD.processDue();

    queuedItems = await readQueueItems(queueFile);
    expect(queuedItems).toHaveLength(0);
    expect(mockServer.getRequests()).toHaveLength(3);
    expect(mockServer.getRequests().every((request) => request.signatureValid)).toBe(true);
    expect(mockServer.getRequests().at(-1)?.bodyJson).toMatchObject(payload);
  });
});

test('MessageDispatchService enqueues zero-retention retry jobs for retryable Kakao failures', async () => {
  const capturedJobs: unknown[] = [];
  const retryPendingFailures: DispatchFailureSnapshot[] = [];
  const primaryAttempts: DispatchAttemptSnapshot[] = [];
  const reservationRecord: MessageDispatchRecord = {
    dispatchId: 'dispatch-123',
    idempotencyKey: 'idem-123',
    status: 'reserved',
    finalChannel: null
  };

  const store = createMessageDispatchStore({
    reserve: async () => {
      const result: DispatchReservationResult = {
        kind: 'reserved',
        record: reservationRecord
      };
      return result;
    },
    recordPrimaryAttempt: async (_dispatchId, attempt) => {
      primaryAttempts.push(attempt);
    },
    markRetryPending: async (_dispatchId, failure) => {
      retryPendingFailures.push(failure);
    }
  });

  const adapter = {
    createGroup: async () => ({ groupId: 'group-1' }),
    addMessages: async () => {
      const error = new Error('transport unavailable');
      Reflect.set(error, 'status', 503);
      throw error;
    }
  } as unknown as SolapiAdapter;

  const service = new MessageDispatchService(adapter, store, {
    billingLogWriter: {
      commitDelivered: async () => {
        throw new Error('should not commit billing on retry path');
      }
    },
    retryQueue: {
      enqueue: async (job) => {
        capturedJobs.push(job);
        return {
          messageId: 'retry-msg-1'
        };
      }
    }
  });

  const input: MessageDispatchInput = {
    idempotencyKey: 'idem-123',
    billingContext: {
      user_id: 'user-1',
      session_id: 'session-abc',
      audio_duration: 15,
      billed_transcription_unit: 1,
      billed_execution_unit: 1
    },
    primary: {
      type: 'BMS_FREE',
      to: '01012345678',
      from: '0299998888',
      pfId: 'pf-1',
      text: 'primary-body-that-must-never-enter-sqs'
    },
    fallback: {
      preferredChannel: 'LMS',
      text: 'fallback-body-that-must-never-enter-sqs',
      subject: 'fallback-subject'
    },
    metadata: {
      unsafeText: 'caller-metadata-that-must-not-enter-sqs'
    }
  };

  await expect(service.dispatch(input)).rejects.toBeInstanceOf(MessageDispatchRetryableError);

  expect(primaryAttempts).toHaveLength(1);
  expect(retryPendingFailures).toHaveLength(1);
  expect(capturedJobs).toHaveLength(1);

  const serializedJob = JSON.stringify(capturedJobs[0]);
  expect(serializedJob).toContain('"sessionId":"session-abc"');
  expect(serializedJob).toContain('"dispatchId":"dispatch-123"');
  expect(serializedJob).not.toContain('primary-body-that-must-never-enter-sqs');
  expect(serializedJob).not.toContain('fallback-body-that-must-never-enter-sqs');
  expect(serializedJob).not.toContain('caller-metadata-that-must-not-enter-sqs');
  expect(serializedJob).not.toContain('transcriptText');
});

function createMessageDispatchStore(
  overrides: Partial<MessageDispatchStore<undefined>>
): MessageDispatchStore<undefined> {
  return {
    reserve: overrides.reserve ?? (async () => createReservationResult()),
    recordPrimaryAttempt: overrides.recordPrimaryAttempt ?? (async () => undefined),
    recordFallbackAttempt: overrides.recordFallbackAttempt ?? (async () => undefined),
    markRetryPending: overrides.markRetryPending ?? (async () => undefined),
    markFailed: overrides.markFailed ?? (async () => undefined),
    markCommitReconcileRequired: overrides.markCommitReconcileRequired ?? (async () => undefined),
    withCommitTransaction:
      overrides.withCommitTransaction ??
      (async (callback) =>
        callback({
          billingTx: undefined,
          markDelivered: async () => 'transitioned'
        } satisfies MessageDispatchCommitTransaction<undefined>))
  };
}

function createReservationResult(): DispatchReservationResult {
  return {
    kind: 'reserved',
    record: {
      dispatchId: 'dispatch-default',
      idempotencyKey: 'idem-default',
      status: 'reserved',
      finalChannel: null
    }
  };
}
