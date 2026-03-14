import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';
import { installSyntheticMicrophone } from './helpers/synthetic-microphone';

test.describe('voice transcript interactions', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async ({ page }) => {
    harness = new LiveVoiceRuntimeHarness();
    await harness.start();
    await installSyntheticMicrophone(page);
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('keeps the transcript box scrollable and restores the latest position', async ({ page }) => {
    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    const transcriptBox = page.getByTestId('voice-transcript-box');

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    await page.waitForTimeout(800);
    await micButton.click({ force: true });

    await expect(transcriptBox).toBeVisible();

    const scrollMetrics = await transcriptBox.evaluate((element) => {
      return {
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        overflowY: window.getComputedStyle(element).overflowY
      };
    });

    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
    expect(scrollMetrics.overflowY).toMatch(/auto|scroll/);

    await transcriptBox.evaluate((element) => {
      element.scrollTo({ top: 0, behavior: 'auto' });
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await expect(page.getByRole('button', { name: '최신으로 이동' })).toBeVisible();

    await page.getByRole('button', { name: '최신으로 이동' }).click();

    await expect
      .poll(() =>
        transcriptBox.evaluate((element) => {
          const distanceFromBottom = element.scrollHeight - element.clientHeight - element.scrollTop;
          return Math.round(distanceFromBottom);
        })
      )
      .toBeLessThanOrEqual(24);
  });

  test('locks duplicate submit before a second request can be sent', async ({ page }) => {
    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    const sendButton = page.getByTestId('voice-send-button');

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    await page.waitForTimeout(800);
    await micButton.click({ force: true });

    await expect(sendButton).toBeEnabled();

    await sendButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });

    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);
  });

  test('reuses the granted microphone stream across repeat recordings in the same session', async ({
    page
  }) => {
    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');
    await page.waitForTimeout(800);
    await micButton.click({ force: true });

    await expect(page.getByTestId('voice-transcript-box')).toBeVisible();
    await page.getByTestId('voice-cancel-button').click();
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');
    await page.waitForTimeout(800);
    await micButton.click({ force: true });

    await expect(page.getByTestId('voice-transcript-box')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const windowWithCounter = window as typeof window & {
            __voxeraGetUserMediaCallCount?: number;
          };

          return windowWithCounter.__voxeraGetUserMediaCallCount ?? 0;
        })
      )
      .toBe(1);
  });
});
