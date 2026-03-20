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
      .fill('Draft a Gmail follow-up and keep it pending for approval.');
    await page.getByTestId('generate-structured-card-button').click();

    await expect(page.getByTestId('recording-card-field-to')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('recording-card-field-to').fill('team@example.com');

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
      destinationKey: 'gmail',
      structuredPayload: {
        to: 'team@example.com'
      }
    });
    expect(webhookRequest?.headers['idempotency-key']).toBeTruthy();
  });
});
