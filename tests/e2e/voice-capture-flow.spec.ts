import { expect, test } from '@playwright/test';

test.describe('voice capture 3-step flow', () => {
  test('cycles through step1, step2, step3, and auto-returns to step1', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/capture');
    await expect(page.getByText('VOXERA')).toBeVisible({ timeout: 60_000 });

    const micButton = page.getByTestId('voice-mic-button');
    await expect(micButton).toBeVisible({ timeout: 60_000 });
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');

    await micButton.click({ force: true });
    await expect(page.getByTestId('voice-transcript-box')).toBeVisible();
    await expect(page.getByTestId('voice-cancel-button')).toBeEnabled();
    await expect(page.getByTestId('voice-send-button')).toBeEnabled();

    await page.getByTestId('voice-cancel-button').click();
    await expect(micButton).toBeVisible();
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');

    await micButton.click({ force: true });
    await expect(micButton).toHaveAttribute('aria-label', 'Stop recording and continue');
    await micButton.click({ force: true });

    await page.getByTestId('voice-send-button').click();
    await expect(page.getByTestId('voice-send-ring')).toHaveAttribute('data-state', 'sending');
    await expect(page.getByTestId('voice-send-button')).toHaveText('전송 중...');

    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('voice-success-text')).toHaveText('전송 완료!');

    await expect(micButton).toBeVisible({ timeout: 10_000 });
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');
  });
});
