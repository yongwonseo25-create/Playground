import { expect, test } from '@playwright/test';

test.describe('mobile feedback ui safety', () => {
  test('mobile error alert keeps bounded container + balanced text classes', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome' && testInfo.project.name !== 'mobile-safari',
      'This assertion targets mobile projects.'
    );

    await page.addInitScript(() => {
      const mediaDevicesStub = {
        getUserMedia: () => Promise.reject(new Error('forced-mobile-permission-denied'))
      };
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: mediaDevicesStub
      });
    });

    await page.goto('/capture');
    await expect(page.getByTestId('voice-mic-button')).toBeVisible();
    await page.getByTestId('voice-mic-button').click({ force: true });

    const alert = page.getByTestId('voice-error-alert');
    await expect(alert).toBeVisible({ timeout: 10_000 });
    await expect(alert).toHaveClass(/max-w-md/);
    await expect(alert).toHaveClass(/break-keep/);
    await expect(alert).toHaveClass(/text-balance/);
  });
});
