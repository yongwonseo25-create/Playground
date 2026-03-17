import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';
import { installSyntheticMicrophone } from './helpers/synthetic-microphone';

const FINAL_TRANSCRIPT_PREFIX = 'Voice transcript received from the live WSS runtime.';

test.describe('voice runtime live integration', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async ({ page }) => {
    harness = new LiveVoiceRuntimeHarness();
    await harness.start();
    await installSyntheticMicrophone(page);
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('streams PCM over WSS and enqueues the V3 payload through /api/voice/process before routing the webhook', async ({
    page
  }) => {
    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    await expect(micButton).toBeVisible();

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    await page.waitForTimeout(800);
    await micButton.click({ force: true });

    await expect(page.getByTestId('voice-transcript-box')).toContainText(FINAL_TRANSCRIPT_PREFIX);
    await expect.poll(() => harness.getTotalPcmFrameCount()).toBeGreaterThan(0);

    await page.getByTestId('voice-send-button').click();

    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);

    const [startEvent, stopEvent] = harness.getWebSocketEvents();
    const webhookRequest = harness.getWebhookRequests()[0];

    expect(startEvent?.type).toBe('session.start');
    expect(stopEvent?.type).toBe('session.stop');
    expect(webhookRequest?.body.transcriptText).toContain(FINAL_TRANSCRIPT_PREFIX);
    expect(webhookRequest?.body.sessionId).toBe(startEvent?.sessionId);
    expect(webhookRequest?.body.pcmFrameCount).toBeGreaterThan(0);
    expect(webhookRequest?.body.stt_provider).toBe('whisper');
    expect(webhookRequest?.body.audio_duration_sec).toBeGreaterThan(0);
    expect(webhookRequest?.headers['x-idempotency-key']).toBeTruthy();
  });
});
