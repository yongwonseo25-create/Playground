import { expect, test } from '@playwright/test';
import { POST as createCard } from '../../src/app/api/v4/hitl/cards/route';
import { GET as getQueue } from '../../src/app/api/v4/hitl/queue/route';
import { POST as approveCard } from '../../src/app/api/v4/hitl/approvals/[approvalId]/route';
import { resetV4DatabaseForTests } from '../../src/server/v4/shared/database';
import { resetV4RuntimeStoreForTests } from '../../src/server/v4/shared/runtime-store';
import { resetV4WorkerForTests } from '../../src/server/v4/shared/worker';
import { MakeWebhookMockServer } from './helpers/make-webhook-mock-server';

test.describe('V4 HITL approval route', () => {
  let mockServer: MakeWebhookMockServer;

  test.beforeEach(async () => {
    mockServer = new MakeWebhookMockServer('hitl-route-secret');
    await mockServer.start();

    process.env.NEXT_PUBLIC_APP_ENV = 'local';
    process.env.NEXT_PUBLIC_WSS_URL = 'ws://127.0.0.1:8787/voice';
    process.env.MAKE_WEBHOOK_URL = mockServer.url('/webhook');
    process.env.MAKE_WEBHOOK_SECRET = 'hitl-route-secret';
    process.env.DATABASE_URL = 'pgmem://v4-hitl-route';
    process.env.REDIS_URL = 'memory://v4-hitl-route';
    process.env.V4_EXECUTION_CREDIT_ACCOUNT_KEY = 'hitl-test-account';
    process.env.V4_EXECUTION_CREDIT_INITIAL_BALANCE = '4';
    process.env.V4_EXECUTION_BUFFER_TTL_SEC = '600';
    process.env.V4_IDEMPOTENCY_TTL_SEC = '600';
    process.env.V4_REDIS_ENCRYPTION_KEY = 'hitl-route-resilience-secret';
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

  test('creates a card, queues approval execution, and caches duplicate responses', async () => {
    const createResponse = await createCard(
      new Request('http://localhost/api/v4/hitl/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          clientRequestId: crypto.randomUUID(),
          transcriptText: 'Create a CRM follow-up card for the renewal meeting.',
          destinationKey: 'crm',
          sessionId: 'session-hitl-1'
        })
      })
    );

    const createdJson = (await createResponse.json()) as {
      ok: boolean;
      approval: { approvalId: string; status: string };
    };

    expect(createResponse.status).toBe(201);
    expect(createdJson.ok).toBe(true);
    expect(createdJson.approval.status).toBe('pending');

    const queueResponse = await getQueue(
      new Request('http://localhost/api/v4/hitl/queue', {
        method: 'GET',
        headers: {
          'Idempotency-Key': crypto.randomUUID()
        }
      })
    );
    const queueJson = (await queueResponse.json()) as {
      pending: Array<{ approvalId: string }>;
    };

    expect(queueResponse.status).toBe(200);
    expect(queueJson.pending).toHaveLength(1);

    const approvalId = createdJson.approval.approvalId;
    const approvalRequestKey = crypto.randomUUID();
    const approveResponse = await approveCard(
      new Request(`http://localhost/api/v4/hitl/approvals/${approvalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': approvalRequestKey
        },
        body: JSON.stringify({
          decision: 'approve',
          actor: 'qa-operator',
          fields: [
            {
              key: 'account_name',
              label: 'Account Name',
              value: 'Acme Corp',
              kind: 'text',
              required: true
            }
          ]
        })
      }),
      {
        params: Promise.resolve({ approvalId })
      }
    );

    const approveJson = (await approveResponse.json()) as {
      status: 'approved' | 'rejected' | 'duplicate';
      approval: { status: string };
      jobId?: string;
    };

    expect(approveResponse.status).toBe(202);
    expect(approveResponse.headers.get('x-idempotency-cache')).toBe('miss');
    expect(approveJson.status).toBe('approved');
    expect(approveJson.approval.status).toBe('approved');
    expect(approveJson.jobId).toHaveLength(36);

    await expect.poll(() => mockServer.getRequests().length).toBe(1);
    expect(mockServer.getRequests()[0]?.bodyJson).toMatchObject({
      mode: 'hitl',
      destinationKey: 'crm'
    });
    expect(mockServer.getRequests()[0]?.headers['idempotency-key']).toBeTruthy();

    const duplicateResponse = await approveCard(
      new Request(`http://localhost/api/v4/hitl/approvals/${approvalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': approvalRequestKey
        },
        body: JSON.stringify({
          decision: 'approve',
          actor: 'qa-operator',
          fields: []
        })
      }),
      {
        params: Promise.resolve({ approvalId })
      }
    );

    const duplicateJson = (await duplicateResponse.json()) as {
      status: 'approved' | 'rejected' | 'duplicate';
      jobId?: string;
    };

    expect(duplicateResponse.status).toBe(202);
    expect(duplicateResponse.headers.get('x-idempotency-cache')).toBe('hit');
    expect(duplicateJson.status).toBe('approved');
    expect(duplicateJson.jobId).toBe(approveJson.jobId);
    expect(mockServer.getRequests()).toHaveLength(1);
  });
});
