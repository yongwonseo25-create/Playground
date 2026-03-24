import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';
import { installSyntheticMicrophone } from './helpers/synthetic-microphone';

test.describe('voice cutoff ui automation', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async ({ page }) => {
    harness = new LiveVoiceRuntimeHarness();
    await harness.start();
    await installSyntheticMicrophone(page);
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('keeps the recording UI stable through the 15-second cutoff and still delivers to Make.com', async ({
    page
  }, testInfo) => {
    test.setTimeout(90_000);

    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    const sendButton = page.getByTestId('voice-send-button');
    const transcriptBox = page.getByTestId('voice-transcript-box');

    await expect(micButton).toBeVisible({ timeout: 60_000 });

    const startedAt = Date.now();
    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    await expect(sendButton).toBeVisible({ timeout: 22_000 });
    const autoStopMs = Date.now() - startedAt;

    expect(autoStopMs).toBeGreaterThanOrEqual(14_000);
    expect(autoStopMs).toBeLessThan(18_500);
    await expect.poll(() => harness.getTotalPcmFrameCount()).toBeGreaterThan(0);
    await expect
      .poll(async () => {
        return ((await transcriptBox.textContent()) ?? '').trim().length;
      })
      .toBeGreaterThan(0);

    const submitResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/voice/submit') && response.request().method() === 'POST'
    );

    await sendButton.click();
    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);

    const submitResponse = await submitResponsePromise;
    const submitJson = (await submitResponse.json()) as {
      ok: boolean;
      stt_provider: 'whisper' | 'return-zero';
      audio_duration_sec: number;
    };
    const webhookRequest = harness.getWebhookRequests()[0];

    expect(submitJson).toMatchObject({
      ok: true,
      stt_provider: 'whisper'
    });
    expect(webhookRequest?.body.stt_provider).toBe('whisper');
    expect(webhookRequest?.body.audio_duration_sec).toBeGreaterThan(0);

    console.log(
      `[cutoff-ui-evidence] project=${testInfo.project.name} cutoffMs=${autoStopMs} webhook=${webhookRequest?.body.stt_provider} duration=${webhookRequest?.body.audio_duration_sec}`
    );
  });
});
