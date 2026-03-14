import path from 'node:path';
import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '3500');
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const fakeAudioCapturePath = path.resolve(__dirname, 'fixtures', 'fake-mic.wav');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 180_000,
  expect: {
    timeout: 20_000
  },
  use: {
    baseURL,
    headless: false,
    trace: 'off',
    video: 'off',
    viewport: null,
    channel: 'chrome',
    launchOptions: {
      slowMo: 1000,
      args: [
        '--window-size=1440,960',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${fakeAudioCapturePath}`
      ]
    }
  },
  projects: [
    {
      name: 'vip-live-chrome'
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
      NEXT_PUBLIC_WSS_URL: 'ws://127.0.0.1:8891/voice',
      MAKE_WEBHOOK_URL: 'http://127.0.0.1:8892/webhook',
      MAKE_WEBHOOK_SECRET: 'voxera-local-secret'
    }
  }
});
