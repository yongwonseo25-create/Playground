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
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
        }
      }
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        permissions: ['microphone'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
        }
      }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] }
    }
  ],
  webServer: {
    command: `node scripts/dev-test-server.mjs`,
    cwd: '..',
    url: `${baseURL}/capture`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_APP_ENV: 'local',
      NEXT_PUBLIC_WSS_URL: process.env.NEXT_PUBLIC_WSS_URL ?? 'ws://127.0.0.1:8787/voice',
      NEXT_PUBLIC_WEBHOOK_URL: process.env.NEXT_PUBLIC_WEBHOOK_URL ?? 'http://127.0.0.1:8788/webhook',
      MAKE_WEBHOOK_URL: process.env.MAKE_WEBHOOK_URL ?? 'http://127.0.0.1:8788/webhook',
      MAKE_WEBHOOK_SECRET: process.env.MAKE_WEBHOOK_SECRET ?? 'playwright-secret',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
      INTERNAL_APP_BASE_URL: process.env.INTERNAL_APP_BASE_URL ?? baseURL,
      PLAYWRIGHT_PORT: String(port)
    }
  }
});
