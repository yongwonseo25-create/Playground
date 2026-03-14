import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';
import { installSyntheticMicrophone } from './helpers/synthetic-microphone';

test.describe('voice ui live demo', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async ({ page }) => {
    harness = new LiveVoiceRuntimeHarness({
      websocketPort: 8891,
      webhookPort: 8892
    });
    await harness.start();
    await installSyntheticMicrophone(page);
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('visually demonstrates recording, transcript transition, send, and success', async ({
    page
  }) => {
    test.setTimeout(300_000);

    await page.goto('/capture');
    await expect(page.getByText('VOXERA')).toBeVisible({ timeout: 60_000 });

    const micButton = page.getByTestId('voice-mic-button');
    await expect(micButton).toBeVisible({ timeout: 60_000 });

    console.log('[vip-demo] stage=idle');
    await page.waitForTimeout(2000);

    await micButton.click({ force: true });
    console.log('[vip-demo] stage=recording');
    await page.waitForTimeout(3000);

    await micButton.click({ force: true });
    console.log('[vip-demo] stage=transition-to-transcript');

    const transcriptBox = page.getByTestId('voice-transcript-box');
    await expect(transcriptBox).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2500);

    const sendButton = page.getByTestId('voice-send-button');
    await expect(sendButton).toBeEnabled({ timeout: 30_000 });
    await sendButton.click({ force: true });
    console.log('[vip-demo] stage=uploading');

    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('voice-success-text')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);

    console.log('[vip-demo] stage=success');
    await page.waitForTimeout(3000);
  });
});
