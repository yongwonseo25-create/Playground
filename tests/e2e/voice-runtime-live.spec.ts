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
      .fill('Prepare a KakaoTalk outreach note and keep it queued for approval.');
    await page.getByTestId('generate-structured-card-button').click();

    await expect(page.getByTestId('recording-card-field-recipient_label')).toBeVisible({ timeout: 30_000 });
    await page.mouse.click(12, 12);

    await expect(page.getByTestId('hitl-queue-item').first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('hitl-queue-item').first().click();

    await expect(page.getByTestId('recording-card-field-recipient_label')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('recording-card-field-message_text')).toContainText('KakaoTalk');
    await expect.poll(() => harness.getWebhookRequests().length).toBe(0);
  });
});
