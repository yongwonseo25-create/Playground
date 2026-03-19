import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';

test.describe('V4 hybrid HITL flow', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async () => {
    harness = new LiveVoiceRuntimeHarness();
    await harness.start();
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('opens the Gmail structured card and approves execution through HITL', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/capture');
    await page.getByTestId('action-chip-gmail').click();
    await page
      .getByTestId('hybrid-text-input')
      .fill('오늘 미팅 후속 조치 내용을 이메일 초안으로 정리해줘.');
    await page.getByTestId('generate-structured-card-button').click();

    await expect(page.getByTestId('recording-card-field-account_name')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('recording-card-field-account_name').fill('Acme Corp');

    const approvalResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v4/hitl/approvals/') && response.request().method() === 'POST'
    );

    await page.getByTestId('approve-execute-button').click();

    const approvalResponse = await approvalResponsePromise;
    expect(approvalResponse.status()).toBe(202);

    await expect(page.getByTestId('hitl-approved-status')).toContainText('Approve & Execute queued');
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);

    const webhookRequest = harness.getWebhookRequests()[0];
    expect(webhookRequest?.body).toMatchObject({
      mode: 'hitl',
      destinationKey: 'crm'
    });
    expect(webhookRequest?.headers['idempotency-key']).toBeTruthy();
  });
});
