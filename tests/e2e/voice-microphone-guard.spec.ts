import { expect, test, type Page } from '@playwright/test';
import { LiveVoiceRuntimeHarness } from './helpers/live-voice-runtime';
import { installSyntheticMicrophone } from './helpers/synthetic-microphone';

const ENTRY_MESSAGES = {
  noMic: '마이크 장치를 찾을 수 없습니다. 마이크를 연결해 주세요.',
  browserBlocked: '브라우저에서 마이크 권한이 차단되었습니다. 주소창 권한 설정에서 허용해 주세요.',
  osBlocked: '운영체제에서 마이크 접근이 차단되었습니다. 시스템 설정을 확인해 주세요.',
  micBusy: '다른 앱이 마이크를 사용 중입니다. 사용 중인 앱을 종료해 주세요.',
  unsupported:
    '이 브라우저는 실시간 음성 캡처를 지원하지 않습니다. 최신 브라우저를 사용해 주세요.',
  serverDelay: '서버 연결이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'
} as const;

async function mockGetUserMediaDomException(page: Page, name: string, message: string) {
  await page.addInitScript(
    (payload: { exceptionName: string; exceptionMessage: string }) => {
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices) {
        return;
      }

      Object.defineProperty(mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async () => {
          throw new DOMException(payload.exceptionMessage, payload.exceptionName);
        }
      });
    },
    { exceptionName: name, exceptionMessage: message }
  );
}

test.describe('voice microphone guard rails', () => {
  let harness: LiveVoiceRuntimeHarness | null = null;

  test.afterEach(async () => {
    if (harness) {
      await harness.close();
      harness = null;
    }
  });

  test('keeps the user on step 1 and shows a Korean message when no microphone is available', async ({
    page
  }) => {
    await mockGetUserMediaDomException(page, 'NotFoundError', 'No microphone available.');
    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    await micButton.click({ force: true });

    await expect(page.getByText(ENTRY_MESSAGES.noMic, { exact: true })).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');
    await expect(page.getByTestId('voice-transcript-box')).toHaveCount(0);
  });

  test('shows a browser permission blocked message on step 1', async ({ page }) => {
    await mockGetUserMediaDomException(page, 'NotAllowedError', 'Permission dismissed.');
    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    await micButton.click({ force: true });

    await expect(page.getByText(ENTRY_MESSAGES.browserBlocked, { exact: true })).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');
  });

  test('shows an OS permission blocked message on step 1', async ({ page }) => {
    await mockGetUserMediaDomException(
      page,
      'NotAllowedError',
      'Permission denied by system while using the audio device.'
    );
    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    await micButton.click({ force: true });

    await expect(page.getByText(ENTRY_MESSAGES.osBlocked, { exact: true })).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');
  });

  test('shows a microphone busy message on step 1', async ({ page }) => {
    await mockGetUserMediaDomException(page, 'NotReadableError', 'Device is busy.');
    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    await micButton.click({ force: true });

    await expect(page.getByText(ENTRY_MESSAGES.micBusy, { exact: true })).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');
  });

  test('shows a browser unsupported message on step 1', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'AudioContext', {
        configurable: true,
        value: undefined
      });
    });
    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    await micButton.click({ force: true });

    await expect(page.getByText(ENTRY_MESSAGES.unsupported, { exact: true })).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');
  });

  test('disables send when the runtime never produces a final transcript', async ({ page }) => {
    harness = new LiveVoiceRuntimeHarness({ responseMode: 'error' });
    await harness.start();
    await installSyntheticMicrophone(page);

    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    await page.waitForTimeout(800);
    await micButton.click({ force: true });

    const sendButton = page.getByTestId('voice-send-button');
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled();
    await expect(page.getByText('Runtime transcript final was not produced.')).toBeVisible();
    await expect.poll(() => harness?.getWebhookRequests().length ?? -1).toBe(0);
  });

  test('returns to step 1 with a Korean toast when session.ready never arrives', async ({ page }) => {
    harness = new LiveVoiceRuntimeHarness({ responseMode: 'no-ready' });
    await harness.start();
    await installSyntheticMicrophone(page);

    await page.goto('/capture');

    const micButton = page.getByTestId('voice-mic-button');
    await micButton.click({ force: true });

    await expect(page.getByText(ENTRY_MESSAGES.serverDelay, { exact: true })).toBeVisible({
      timeout: 10_000
    });
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');
    await expect(page.getByTestId('voice-transcript-box')).toHaveCount(0);
    await expect(page.getByTestId('voice-send-button')).toHaveCount(0);
    await expect.poll(() => harness?.getTotalPcmFrameCount() ?? -1).toBe(0);
  });
});
