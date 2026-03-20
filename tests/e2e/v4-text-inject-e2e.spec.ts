import { expect, test } from '@playwright/test';
import { POST } from '../../src/app/api/v4/e2e/text-inject/route';
import {
  findExecutionCreditTransactionByReferenceId,
  getExecutionCreditAccountSnapshot
} from '../../src/server/v4/shared/execution-credits';
import { resetV4DatabaseForTests } from '../../src/server/v4/shared/database';
import { resetV4RuntimeStoreForTests } from '../../src/server/v4/shared/runtime-store';
import { resetV4WorkerForTests } from '../../src/server/v4/shared/worker';
import { MakeWebhookMockServer } from './helpers/make-webhook-mock-server';

function createTextInjectRequest(input: {
  idempotencyKey: string;
  transcriptText: string;
  destinationKey?: 'notion' | 'google_docs' | 'gmail' | 'kakaotalk';
  mode?: 'zhi' | 'hitl';
}) {
  return new Request('http://localhost/api/v4/e2e/text-inject', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey
    },
    body: JSON.stringify({
      mode: input.mode ?? 'zhi',
      destinationKey: input.destinationKey ?? 'notion',
      transcriptText: input.transcriptText
    })
  });
}

test.describe('V4 text injection E2E', () => {
  let mockServer: MakeWebhookMockServer;

  test.beforeEach(async () => {
    mockServer = new MakeWebhookMockServer('text-inject-secret');
    await mockServer.start();

    process.env.NEXT_PUBLIC_APP_ENV = 'local';
    process.env.NEXT_PUBLIC_WSS_URL = 'ws://127.0.0.1:8787/voice';
    process.env.MAKE_WEBHOOK_URL = mockServer.url('/webhook');
    process.env.MAKE_WEBHOOK_SECRET = 'text-inject-secret';
    process.env.DATABASE_URL = 'pgmem://v4-text-inject';
    process.env.REDIS_URL = 'memory://v4-text-inject';
    process.env.V4_EXECUTION_CREDIT_ACCOUNT_KEY = 'text-inject-account';
    process.env.V4_EXECUTION_CREDIT_INITIAL_BALANCE = '4';
    process.env.V4_EXECUTION_BUFFER_TTL_SEC = '600';
    process.env.V4_IDEMPOTENCY_TTL_SEC = '600';
    process.env.V4_REDIS_ENCRYPTION_KEY = 'text-inject-resilience-secret';
    process.env.V4_WORKER_POLL_INTERVAL_MS = '50';
    process.env.V4_ZHI_LLM_MODEL = 'gemini-3.1-flash-lite-preview';
    process.env.V4_ZHI_LLM_THINKING_LEVEL = 'minimal';
    process.env.V4_HITL_LLM_MODEL = 'gemini-3.1-pro-preview';
    process.env.V4_HITL_LLM_THINKING_LEVEL = 'low';

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

  test('guarantees exactly-once webhook delivery for duplicate idempotency keys', async () => {
    const idempotencyKey = crypto.randomUUID();

    const firstResponse = await POST(
      createTextInjectRequest({
        idempotencyKey,
        transcriptText: 'Send the daily operations recap to Notion.'
      })
    );
    const firstJson = (await firstResponse.json()) as {
      mode: 'zhi';
      result: {
        executionId: string;
        idempotencyKey: string;
      };
    };

    expect(firstResponse.status).toBe(202);
    expect(firstResponse.headers.get('x-idempotency-cache')).toBe('miss');

    await expect.poll(() => mockServer.getRequests().length).toBe(1);
    const firstWebhook = mockServer.getRequests()[0];
    expect(firstWebhook?.headers['x-idempotency-key']).toBe(firstJson.result.idempotencyKey);

    const duplicateResponse = await POST(
      createTextInjectRequest({
        idempotencyKey,
        transcriptText: 'Send the daily operations recap to Notion.'
      })
    );
    const duplicateJson = (await duplicateResponse.json()) as typeof firstJson;

    expect(duplicateResponse.status).toBe(202);
    expect(duplicateResponse.headers.get('x-idempotency-cache')).toBe('hit');
    expect(duplicateJson.result.executionId).toBe(firstJson.result.executionId);
    expect(duplicateJson.result.idempotencyKey).toBe(firstJson.result.idempotencyKey);
    expect(mockServer.getRequests()).toHaveLength(1);

    await expect
      .poll(async () => await findExecutionCreditTransactionByReferenceId(firstJson.result.executionId))
      .toMatchObject({
        transactionId: firstJson.result.idempotencyKey,
        status: 'completed'
      });

    await expect
      .poll(async () => await getExecutionCreditAccountSnapshot('text-inject-account'))
      .toMatchObject({
        balance: 3
      });
  });

  test('refunds the reserved credit when Make.com returns a terminal failure', async () => {
    mockServer.setFallbackBehavior({
      type: 'failure',
      status: 500,
      body: 'make-down'
    });

    const response = await POST(
      createTextInjectRequest({
        idempotencyKey: crypto.randomUUID(),
        transcriptText: 'Send the outage notice to Notion.'
      })
    );
    const json = (await response.json()) as {
      mode: 'zhi';
      result: {
        executionId: string;
        idempotencyKey: string;
      };
    };

    expect(response.status).toBe(202);

    await expect.poll(() => mockServer.getRequests().length).toBe(3);
    for (const request of mockServer.getRequests()) {
      expect(request.headers['x-idempotency-key']).toBe(json.result.idempotencyKey);
    }

    await expect
      .poll(async () => await findExecutionCreditTransactionByReferenceId(json.result.executionId))
      .toMatchObject({
        transactionId: json.result.idempotencyKey,
        status: 'refunded'
      });

    await expect
      .poll(async () => await getExecutionCreditAccountSnapshot('text-inject-account'))
      .toMatchObject({
        balance: 4
      });
  });
});
