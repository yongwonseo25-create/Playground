import { expect, test } from '@playwright/test';
import { POST } from '../../src/app/api/v4/zhi/dispatch/route';
import { resetV4DatabaseForTests } from '../../src/server/v4/shared/database';
import { resetV4RuntimeStoreForTests } from '../../src/server/v4/shared/runtime-store';
import { resetV4WorkerForTests } from '../../src/server/v4/shared/worker';
import { MakeWebhookMockServer } from './helpers/make-webhook-mock-server';

test.describe('V4 ZHI dispatch route', () => {
  let mockServer: MakeWebhookMockServer;

  test.beforeEach(async () => {
    mockServer = new MakeWebhookMockServer('zhi-route-secret');
    await mockServer.start();

    process.env.NEXT_PUBLIC_APP_ENV = 'local';
    process.env.NEXT_PUBLIC_WSS_URL = 'ws://127.0.0.1:8787/voice';
    process.env.MAKE_WEBHOOK_URL = mockServer.url('/webhook');
    process.env.MAKE_WEBHOOK_SECRET = 'zhi-route-secret';
    process.env.DATABASE_URL = 'pgmem://v4-zhi-route';
    process.env.REDIS_URL = 'memory://v4-zhi-route';
    process.env.V4_EXECUTION_CREDIT_ACCOUNT_KEY = 'zhi-test-account';
    process.env.V4_EXECUTION_CREDIT_INITIAL_BALANCE = '3';
    process.env.V4_EXECUTION_BUFFER_TTL_SEC = '600';
    process.env.V4_IDEMPOTENCY_TTL_SEC = '600';
    process.env.V4_REDIS_ENCRYPTION_KEY = 'zhi-route-resilience-secret';
    process.env.V4_WORKER_POLL_INTERVAL_MS = '50';

    await resetV4DatabaseForTests();
    await resetV4RuntimeStoreForTests();
    await resetV4WorkerForTests();
  });

  test.afterEach(async () => {
    await resetV4WorkerForTests();
    await resetV4RuntimeStoreForTests();
    await resetV4DatabaseForTests();
    await mockServer.close();
  });

  test('queues under 200ms, executes asynchronously, and returns cached idempotent responses', async () => {
    const idempotencyKey = crypto.randomUUID();
    const clientRequestId = crypto.randomUUID();

    const createRequest = (requestId = idempotencyKey) =>
      new Request('http://localhost/api/v4/zhi/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': requestId
        },
        body: JSON.stringify({
          clientRequestId,
          transcriptText: 'Create a Jira follow-up ticket for the onboarding checklist.',
          destinationKey: 'jira',
          sessionId: 'session-zhi-1',
          sttProvider: 'whisper',
          audioDurationSec: 4.2
        })
      });

    const startedAt = performance.now();
    const response = await POST(createRequest());
    const durationMs = performance.now() - startedAt;
    const json = (await response.json()) as {
      ok: boolean;
      status: 'queued' | 'duplicate';
      executionId: string;
      jobId: string;
      dispatchState: 'queued' | 'processing' | 'executed' | 'failed';
    };

    expect(durationMs).toBeLessThan(200);
    expect(response.status).toBe(202);
    expect(response.headers.get('x-idempotency-cache')).toBe('miss');
    expect(json.ok).toBe(true);
    expect(json.status).toBe('queued');
    expect(json.jobId).toHaveLength(36);
    expect(json.dispatchState).toBe('queued');

    await expect.poll(() => mockServer.getRequests().length).toBe(1);
    expect(mockServer.getRequests()[0]?.headers['idempotency-key']).toBeTruthy();
    expect(mockServer.getRequests()[0]?.headers['x-idempotency-key']).toBeTruthy();
    expect(mockServer.getRequests()[0]?.bodyJson).toMatchObject({
      mode: 'zhi',
      destinationKey: 'jira'
    });

    const cachedDuplicateResponse = await POST(createRequest());
    const cachedDuplicateJson = (await cachedDuplicateResponse.json()) as {
      status: 'queued' | 'duplicate';
      executionId: string;
      jobId: string;
    };

    expect(cachedDuplicateResponse.status).toBe(202);
    expect(cachedDuplicateResponse.headers.get('x-idempotency-cache')).toBe('hit');
    expect(cachedDuplicateJson.status).toBe('queued');
    expect(cachedDuplicateJson.executionId).toBe(json.executionId);
    expect(cachedDuplicateJson.jobId).toBe(json.jobId);
    expect(mockServer.getRequests()).toHaveLength(1);

    const domainDuplicateResponse = await POST(createRequest(crypto.randomUUID()));
    const domainDuplicateJson = (await domainDuplicateResponse.json()) as {
      status: 'queued' | 'duplicate';
      executionId: string;
    };

    expect(domainDuplicateResponse.status).toBe(202);
    expect(domainDuplicateJson.status).toBe('duplicate');
    expect(domainDuplicateJson.executionId).toBe(json.executionId);
    expect(mockServer.getRequests()).toHaveLength(1);
  });
});
