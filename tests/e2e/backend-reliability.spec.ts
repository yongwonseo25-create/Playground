import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { test, expect } from '@playwright/test';
import { createWebhookSignature } from '../../src/server/webhook/WebhookSigner';
import { CircuitBreaker, CircuitOpenError } from '../../src/server/reliability/circuitBreaker';
import { WebhookClient } from '../../src/server/reliability/WebhookClient';
import { FailureQueue } from '../../src/server/queue/failureQueue';

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

test('failureQueue survives restart and flushes queued item', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'voxera-queue-test-'));
  const queueFile = path.join(tempDir, 'failure-queue.jsonl');
  let calls = 0;

  const client = new WebhookClient({
    webhookUrl: 'https://example.com/hook',
    webhookSecret: 'secret',
    transport: async () => {
      calls += 1;
      return { ok: true, status: 200 };
    }
  });

  const queueA = new FailureQueue({
    client,
    filePath: queueFile,
    now: () => 1_000
  });
  await queueA.enqueue('restart-key', { transcriptText: 'persist-me' });
  expect(await queueA.size()).toBe(1);

  const queueB = new FailureQueue({
    client,
    filePath: queueFile,
    now: () => 2_000
  });
  await queueB.processDue();
  expect(calls).toBe(1);
  expect(await queueB.size()).toBe(0);

  await rm(tempDir, { recursive: true, force: true });
});
