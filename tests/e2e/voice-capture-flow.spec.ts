import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';
import { installSyntheticMicrophone } from './helpers/synthetic-microphone';

test.describe('V4 ZHI capture flow', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async ({ page }) => {
    harness = new LiveVoiceRuntimeHarness();
    await harness.start();
    await installSyntheticMicrophone(page);
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('selects Slack and queues resilient execution immediately after recording stops', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/capture');
    await expect(page.getByText('VOXERA')).toBeVisible({ timeout: 60_000 });

    await page.getByTestId('destination-slack').click();

    const micButton = page.getByTestId('voice-mic-button');
    await expect(micButton).toBeVisible({ timeout: 60_000 });
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    await page.waitForTimeout(800);
    await micButton.click({ force: true });

    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('voice-success-text')).toContainText('Queued for Slack');
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);

    const webhookRequest = harness.getWebhookRequests()[0];
    expect(webhookRequest?.body).toMatchObject({
      mode: 'zhi',
      destinationKey: 'slack'
    });
    expect(webhookRequest?.headers['idempotency-key']).toBeTruthy();

    await expect(micButton).toBeVisible({ timeout: 10_000 });
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');
  });
});
