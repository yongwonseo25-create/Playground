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

test('HMAC signature matches SHA256 expectation', async () => {
  const secret = 'top-secret';
  const timestamp = '2026-03-13T10:00:00.000Z';
  const body = JSON.stringify({ hello: 'voxera', value: 1 });
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

  const actual = createWebhookSignature({ timestamp, body }, secret);
  expect(actual).toBe(expected);
});

test('Webhook client performs 3-step exponential backoff before success', async () => {
  const delays: number[] = [];
  let calls = 0;

  const client = new WebhookClient({
    webhookUrl: 'https://example.com/hook',
    webhookSecret: 'secret',
    maxRetries: 3,
    retryBaseMs: 250,
    sleep: async (ms) => {
      delays.push(ms);
    },
    transport: async () => {
      calls += 1;
      if (calls <= 3) {
        return { ok: false, status: 500, bodyText: 'fail' };
      }
      return { ok: true, status: 200 };
    }
  });

  const result = await client.send({ transcriptText: 'hello' }, 'req-1');
  expect(result.ok).toBe(true);
  expect(result.deduplicated).toBe(false);
  expect(result.attempts).toBe(4);
  expect(calls).toBe(4);
  expect(delays).toEqual([250, 500, 1000]);
});

test('Circuit breaker opens after 5 consecutive failures', async () => {
  let transportCalls = 0;
  const breaker = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 60_000 });

  const client = new WebhookClient({
    webhookUrl: 'https://example.com/hook',
    webhookSecret: 'secret',
    maxRetries: 0,
    circuitBreaker: breaker,
    transport: async () => {
      transportCalls += 1;
      return { ok: false, status: 500, bodyText: 'fail' };
    }
  });

  for (let i = 0; i < 5; i += 1) {
    await expect(client.send({ n: i }, `req-${i}`)).rejects.toThrow();
  }

  expect(breaker.snapshot().state).toBe('OPEN');
  await expect(client.send({ n: 999 }, 'req-open')).rejects.toThrow(CircuitOpenError);
  expect(transportCalls).toBe(5);
});

test('Idempotency key blocks duplicate webhook send', async () => {
  let transportCalls = 0;
  const client = new WebhookClient({
    webhookUrl: 'https://example.com/hook',
    webhookSecret: 'secret',
    transport: async () => {
      transportCalls += 1;
      return { ok: true, status: 200 };
    }
  });

  const first = await client.send({ transcriptText: 'hello' }, 'same-key');
  const second = await client.send({ transcriptText: 'hello' }, 'same-key');

  expect(first.ok).toBe(true);
  expect(first.deduplicated).toBe(false);
  expect(second.ok).toBe(true);
  expect(second.deduplicated).toBe(true);
  expect(transportCalls).toBe(1);
});

test('SqsQueueService sends a standard SQS message with bounded delay and attributes', async () => {
  const sent: Array<{
    QueueUrl?: string;
    MessageBody?: string;
    DelaySeconds?: number;
    MessageAttributes?: Record<string, { DataType?: string; StringValue?: string }>;
  }> = [];

  const queue = new SqsQueueService({
    queueUrl: 'https://sqs.ap-northeast-2.amazonaws.com/123456789012/voxera-standard',
    region: 'ap-northeast-2',
    client: {
      send: async (command) => {
        sent.push(command.input as unknown as (typeof sent)[number]);
        return {
          MessageId: 'msg-1',
          MD5OfMessageBody: 'md5-1'
        };
      }
    }
  });

  const result = await queue.enqueue(
    {
      kind: 'message-dispatch-retry',
      sessionId: 'session-1',
      dispatchId: 'dispatch-1'
    },
    {
      delaySeconds: 30,
      messageAttributes: {
        jobType: 'message-dispatch-retry',
        sessionId: 'session-1'
      }
    }
  );

  expect(result.messageId).toBe('msg-1');
  expect(sent).toHaveLength(1);
  expect(sent[0]?.QueueUrl).toContain('voxera-standard');
  expect(sent[0]?.DelaySeconds).toBe(30);
  expect(sent[0]?.MessageAttributes?.jobType?.StringValue).toBe('message-dispatch-retry');
  expect(sent[0]?.MessageBody).toContain('"sessionId":"session-1"');
  expect(sent[0]?.MessageBody).not.toContain('transcriptText');
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
