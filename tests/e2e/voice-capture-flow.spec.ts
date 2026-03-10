import { expect, test } from '@playwright/test';

test.describe('voice capture 3-step flow', () => {
  test('cycles through step1, step2, step3, and auto-returns to step1', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/capture');
    await expect(page.getByText('VOXERA')).toBeVisible({ timeout: 60_000 });

    await expect(page.getByTestId('voice-mic-button')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Touch once to begin recording.')).toBeVisible();

    await page.getByTestId('voice-mic-button').click({ force: true });
    await expect(page.getByText('Touch once more to move to confirmation.')).toBeVisible();

    await page.getByTestId('voice-mic-button').click({ force: true });
    await expect(page.getByTestId('voice-transcript-box')).toBeVisible();
    await expect(page.getByTestId('voice-cancel-button')).toBeEnabled();
    await expect(page.getByTestId('voice-send-button')).toBeEnabled();

    await page.getByTestId('voice-cancel-button').click();
    await expect(page.getByTestId('voice-mic-button')).toBeVisible();
    await expect(page.getByText('Touch once to begin recording.')).toBeVisible();

    await page.getByTestId('voice-mic-button').click({ force: true });
    await expect(page.getByText('Touch once more to move to confirmation.')).toBeVisible();
    await page.getByTestId('voice-mic-button').click({ force: true });

    await page.getByTestId('voice-send-button').click();
    await expect(page.getByTestId('voice-send-ring')).toHaveAttribute('data-state', 'sending');
    await expect(page.getByTestId('voice-send-button')).toHaveText('Sending...');

    await expect(page.getByTestId('voice-success-container')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('voice-success-text')).toHaveText('전송 완료!');

    await expect(page.getByTestId('voice-mic-button')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Touch once to begin recording.')).toBeVisible();
  });
});
