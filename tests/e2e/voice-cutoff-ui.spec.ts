import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';
import { installSyntheticMicrophone } from './helpers/synthetic-microphone';

test.describe('V4 ZHI cutoff automation', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async ({ page }) => {
    harness = new LiveVoiceRuntimeHarness();
    await harness.start();
    await installSyntheticMicrophone(page);
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('keeps the 15-second cutoff and still auto-executes the destination', async ({ page }, testInfo) => {
    test.setTimeout(90_000);

    await page.goto('/capture');
    await page.getByTestId('destination-slack').click();

    const micButton = page.getByTestId('voice-mic-button');
    await expect(micButton).toBeVisible({ timeout: 60_000 });

    const startedAt = Date.now();
    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    const dispatchResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v4/zhi/dispatch') && response.request().method() === 'POST'
    );

    await dispatchResponsePromise;
    const autoStopMs = Date.now() - startedAt;

    expect(autoStopMs).toBeGreaterThanOrEqual(14_000);
    expect(autoStopMs).toBeLessThan(18_500);
    await expect.poll(() => harness.getTotalPcmFrameCount()).toBeGreaterThan(0);

    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);

    const webhookRequest = harness.getWebhookRequests()[0];
    expect(webhookRequest?.body).toMatchObject({
      mode: 'zhi',
      destinationKey: 'slack'
    });

    console.log(
      `[cutoff-ui-evidence] project=${testInfo.project.name} cutoffMs=${autoStopMs} destination=${(webhookRequest?.body as { destinationKey?: string })?.destinationKey}`
    );
  });
});
