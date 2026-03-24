import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';
import { installSyntheticMicrophone } from './helpers/synthetic-microphone';

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

  test('streams PCM over WSS and submits the Zod-validated payload to /api/voice/submit', async ({
    page
  }) => {
    await page.goto('/capture?notionDatabaseId=notion-db-live&notionParentPageId=notion-page-live');

    const micButton = page.getByTestId('voice-mic-button');
    await expect(micButton).toBeVisible();

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    await page.waitForTimeout(800);
    await micButton.click({ force: true });

    await expect(page.getByTestId('voice-transcript-box')).toContainText(
      '대표님, WSS 런타임 정상 연결 확인 완료.'
    );

    await expect.poll(() => harness.getTotalPcmFrameCount()).toBeGreaterThan(0);

    await page.getByTestId('voice-send-button').click();

    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);

    const [startEvent, stopEvent] = harness.getWebSocketEvents();
    const webhookRequest = harness.getWebhookRequests()[0];

    expect(startEvent?.type).toBe('session.start');
    expect(stopEvent?.type).toBe('session.stop');
    expect(webhookRequest?.body.transcriptText).toBe('대표님, WSS 런타임 정상 연결 확인 완료.');
    expect(webhookRequest?.body.sessionId).toBe(startEvent?.sessionId);
    expect(webhookRequest?.body.pcmFrameCount).toBeGreaterThan(0);
    expect(webhookRequest?.body.stt_provider).toBe('whisper');
    expect(webhookRequest?.body.audio_duration_sec).toBeGreaterThan(0);
    expect(webhookRequest?.body.notionDatabaseId).toBe('notion-db-live');
    expect(webhookRequest?.body.notionParentPageId).toBe('notion-page-live');
    expect(webhookRequest?.headers['x-idempotency-key']).toBeTruthy();
  });
});
