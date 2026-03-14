import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';
import { installSyntheticMicrophone } from './helpers/synthetic-microphone';

const FINAL_TRANSCRIPT_PREFIX = 'Voice transcript received from the live WSS runtime.';

test.describe('voice capture 3-step flow', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async ({ page }) => {
    harness = new LiveVoiceRuntimeHarness();
    await harness.start();
    await installSyntheticMicrophone(page);
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('cycles through step1, step2, step3, and auto-returns to step1', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/capture');
    await expect(page.getByText('VOXERA')).toBeVisible({ timeout: 60_000 });

    const micButton = page.getByTestId('voice-mic-button');
    await expect(micButton).toBeVisible({ timeout: 60_000 });
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    await page.waitForTimeout(800);
    await micButton.click({ force: true });
    await expect(page.getByTestId('voice-transcript-box')).toBeVisible();
    await expect(page.getByTestId('voice-transcript-box')).toContainText(FINAL_TRANSCRIPT_PREFIX);
    await expect(page.getByTestId('voice-cancel-button')).toBeEnabled();
    await expect(page.getByTestId('voice-send-button')).toBeEnabled();

    await page.getByTestId('voice-cancel-button').click();
    await expect(micButton).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');
    await page.waitForTimeout(800);
    await micButton.click({ force: true });

    await page.getByTestId('voice-send-button').click();
    await expect(page.getByTestId('voice-send-ring')).toHaveAttribute('data-state', 'sending');
    await expect(page.getByTestId('voice-send-button')).toHaveText('전송 중...');

    const successVisibleAt = Date.now();
    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('voice-success-text')).toHaveText('전송 완료!');
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);

    await expect(micButton).toBeVisible({ timeout: 10_000 });
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');

    const returnedToStep1Ms = Date.now() - successVisibleAt;
    expect(returnedToStep1Ms).toBeGreaterThanOrEqual(1_800);
    expect(returnedToStep1Ms).toBeLessThan(3_200);
  });
});
