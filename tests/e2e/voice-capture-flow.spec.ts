import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';

test.describe('V4 hybrid ZHI flow', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async () => {
    harness = new LiveVoiceRuntimeHarness();
    await harness.start();
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('queues the Notion chip through the ZHI dispatch route', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/capture');
    await expect(page.getByTestId('voxera-brand')).toBeVisible({ timeout: 60_000 });

    await page.getByTestId('action-chip-notion').click();
    await page
      .getByTestId('hybrid-text-input')
      .fill('오늘 운영 회의 메모를 정리해서 실행 가능한 액션으로 보내줘.');

    const dispatchResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v4/zhi/dispatch') && response.request().method() === 'POST'
    );

    await page.getByTestId('zhi-queue-button').click();

    const dispatchResponse = await dispatchResponsePromise;
    expect(dispatchResponse.status()).toBe(202);

    await expect(page.getByTestId('zhi-queued-status')).toContainText('Queued for Notion');
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);

    const webhookRequest = harness.getWebhookRequests()[0];
    expect(webhookRequest?.body).toMatchObject({
      mode: 'zhi',
      destinationKey: 'jira'
    });
    expect(webhookRequest?.headers['idempotency-key']).toBeTruthy();
  });
});
