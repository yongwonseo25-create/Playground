import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '3400');
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const fakeAudioCapturePath = path.resolve(__dirname, 'fixtures', 'fake-mic.wav');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${fakeAudioCapturePath}`
      ]
    }
  },
  projects: [
    {
      name: 'desktop-chromium',
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
      NEXT_PUBLIC_WSS_URL: 'ws://127.0.0.1:8787/voice-session',
      MAKE_WEBHOOK_URL: process.env.MAKE_WEBHOOK_URL ?? 'http://127.0.0.1:8896/webhook',
      MAKE_WEBHOOK_SECRET: process.env.MAKE_WEBHOOK_SECRET ?? 'voxera-local-secret',
      DATABASE_URL: process.env.DATABASE_URL ?? 'pgmem://voxera-zhi-routing',
      REDIS_URL: process.env.REDIS_URL ?? 'memory://voxera-zhi-routing',
      V4_EXECUTION_CREDIT_ACCOUNT_KEY:
        process.env.V4_EXECUTION_CREDIT_ACCOUNT_KEY ?? 'zhi-routing-account',
      V4_EXECUTION_CREDIT_INITIAL_BALANCE:
        process.env.V4_EXECUTION_CREDIT_INITIAL_BALANCE ?? '50',
      V4_EXECUTION_BUFFER_TTL_SEC: process.env.V4_EXECUTION_BUFFER_TTL_SEC ?? '600',
      V4_IDEMPOTENCY_TTL_SEC: process.env.V4_IDEMPOTENCY_TTL_SEC ?? '600',
      V4_REDIS_ENCRYPTION_KEY:
        process.env.V4_REDIS_ENCRYPTION_KEY ?? 'voxera-local-v4-resilience',
      V4_WORKER_POLL_INTERVAL_MS: process.env.V4_WORKER_POLL_INTERVAL_MS ?? '150',
      GEMINI_API_KEY: '',
      V4_ZHI_LLM_MODEL: process.env.V4_ZHI_LLM_MODEL ?? 'gemini-3.1-flash-lite-preview',
      V4_ZHI_LLM_THINKING_LEVEL: process.env.V4_ZHI_LLM_THINKING_LEVEL ?? 'minimal',
      V4_HITL_LLM_MODEL: process.env.V4_HITL_LLM_MODEL ?? 'gemini-3.1-pro-preview',
      V4_HITL_LLM_THINKING_LEVEL: process.env.V4_HITL_LLM_THINKING_LEVEL ?? 'low'
    }
  }
});
