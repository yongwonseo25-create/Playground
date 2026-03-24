import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '3400');
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-pixel-5',
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command: `node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    cwd: '..',
    url: `${baseURL}/capture`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_APP_ENV: 'local',
      NEXT_PUBLIC_WSS_URL: process.env.NEXT_PUBLIC_WSS_URL ?? 'ws://127.0.0.1:8787/voice',
      MAKE_WEBHOOK_URL: process.env.MAKE_WEBHOOK_URL ?? 'http://127.0.0.1:8788/webhook',
      MAKE_WEBHOOK_SECRET: process.env.MAKE_WEBHOOK_SECRET ?? 'voxera-local-secret'
    }
  }
});
