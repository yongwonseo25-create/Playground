import { expect, test } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';
import { installSyntheticMicrophone } from './helpers/synthetic-microphone';

test.describe('V4 ZHI runtime live integration', () => {
  let harness: LiveVoiceRuntimeHarness;

  test.beforeEach(async ({ page }) => {
    harness = new LiveVoiceRuntimeHarness();
    await harness.start();
    await installSyntheticMicrophone(page);
  });

  test.afterEach(async () => {
    await harness.close();
  });

  test('streams PCM over WSS and dispatches the V4 ZHI payload', async ({ page }) => {
    await page.goto('/capture');
    await page.getByTestId('destination-jira').click();

    const micButton = page.getByTestId('voice-mic-button');
    await expect(micButton).toBeVisible();

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    const dispatchResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/v4/zhi/dispatch') && response.request().method() === 'POST'
    );

    await page.waitForTimeout(800);
    await micButton.click({ force: true });

    const dispatchResponse = await dispatchResponsePromise;
    const dispatchJson = (await dispatchResponse.json()) as {
      ok: boolean;
      status: 'queued' | 'duplicate';
      destination: { key: string };
      jobId: string;
      dispatchState: 'queued' | 'processing' | 'executed' | 'failed';
    };

    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => harness.getWebhookRequests().length).toBe(1);

    const [startEvent, stopEvent] = harness.getWebSocketEvents();
    const webhookRequest = harness.getWebhookRequests()[0];

    expect(startEvent?.type).toBe('session.start');
    expect(stopEvent?.type).toBe('session.stop');
    expect(dispatchResponse.status()).toBe(202);
    expect(dispatchJson.ok).toBe(true);
    expect(dispatchJson.status).toBe('queued');
    expect(dispatchJson.destination.key).toBe('jira');
    expect(dispatchJson.jobId).toHaveLength(36);
    expect(dispatchJson.dispatchState).toBe('queued');
    expect(webhookRequest?.body).toMatchObject({
      mode: 'zhi',
      destinationKey: 'jira',
      transcriptText: 'Voxera runtime transcript confirmed.'
    });
    expect(webhookRequest?.headers['idempotency-key']).toBeTruthy();
  });
});
