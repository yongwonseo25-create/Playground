import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';

test.describe('V4 hybrid queue surface', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async () => {
    harness = new LiveVoiceRuntimeHarness();
    await harness.start();
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('hydrates the HITL queue and reopens a pending structured card from the queue list', async ({
    page
  }) => {
    await page.goto('/capture');
    await page.getByTestId('action-chip-kakao').click();
    await page
      .getByTestId('hybrid-text-input')
      .fill('카카오톡으로 고객 응답 초안을 준비해줘.');
    await page.getByTestId('generate-structured-card-button').click();

    await expect(page.getByTestId('recording-card-field-account_name')).toBeVisible({ timeout: 30_000 });
    await page.mouse.click(12, 12);

    await expect(page.getByTestId('hitl-queue-item').first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('hitl-queue-item').first().click();

    await expect(page.getByTestId('recording-card-field-account_name')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('recording-card-field-contact_summary')).toContainText('카카오톡');
    await expect.poll(() => harness.getWebhookRequests().length).toBe(0);
  });
});
