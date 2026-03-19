import { expect, test } from '@playwright/test';
import { POST } from '../../src/app/api/v4/zhi/dispatch/route';
import { resetV4DatabaseForTests } from '../../src/server/v4/shared/database';
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
    process.env.V4_EXECUTION_CREDIT_ACCOUNT_KEY = 'zhi-test-account';
    process.env.V4_EXECUTION_CREDIT_INITIAL_BALANCE = '3';

    await resetV4DatabaseForTests();
  });

  test.afterEach(async () => {
    await resetV4DatabaseForTests();
    await mockServer.close();
  });

  test('persists the dispatch and deducts one credit only after webhook success', async () => {
    const createRequest = () =>
      new Request('http://localhost/api/v4/zhi/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientRequestId: 'zhi-dispatch-1',
          transcriptText: 'Create a Jira follow-up ticket for the onboarding checklist.',
          destinationKey: 'jira',
          sessionId: 'session-zhi-1',
          sttProvider: 'whisper',
          audioDurationSec: 4.2
        })
      });

    const response = await POST(createRequest());
    const json = (await response.json()) as {
      ok: boolean;
      status: 'executed' | 'duplicate';
      credits: { remainingCredits: number };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.status).toBe('executed');
    expect(json.credits.remainingCredits).toBe(2);
    expect(mockServer.getRequests()).toHaveLength(1);
    expect(mockServer.getRequests()[0]?.bodyJson).toMatchObject({
      mode: 'zhi',
      destinationKey: 'jira'
    });

    const duplicateResponse = await POST(createRequest());
    const duplicateJson = (await duplicateResponse.json()) as {
      status: 'executed' | 'duplicate';
      credits: { remainingCredits: number };
    };

    expect(duplicateJson.status).toBe('duplicate');
    expect(duplicateJson.credits.remainingCredits).toBe(2);
    expect(mockServer.getRequests()).toHaveLength(1);
  });
});
