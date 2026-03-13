import path from 'node:path';
import { expect, test } from '@playwright/test';
import { runNextDevOnce } from './helpers/next-dev';

const repoRoot = path.resolve(process.cwd());

test.describe('env-core fail-fast', () => {
  test('rejects insecure ws:// outside local', async () => {
    const result = await runNextDevOnce({
      cwd: repoRoot,
      port: 3301,
      timeoutMs: 20_000,
      env: {
        NEXT_PUBLIC_APP_ENV: 'production',
        NEXT_PUBLIC_WSS_URL: 'ws://example.com/voice',
        MAKE_WEBHOOK_URL: 'https://api.example.com/webhook',
        MAKE_WEBHOOK_SECRET: 'env-core-secret'
      }
    });

    expect(result.ready).toBe(false);
    expect(result.output).toContain('Insecure WebSocket (ws://) is not allowed outside local environment');
  });

  test('rejects non-http(s) MAKE_WEBHOOK_URL schemes', async () => {
    const result = await runNextDevOnce({
      cwd: repoRoot,
      port: 3302,
      timeoutMs: 20_000,
      env: {
        NEXT_PUBLIC_APP_ENV: 'staging',
        NEXT_PUBLIC_WSS_URL: 'wss://example.com/voice',
        MAKE_WEBHOOK_URL: 'ftp://example.com/webhook',
        MAKE_WEBHOOK_SECRET: 'env-core-secret'
      }
    });

    expect(result.ready).toBe(false);
    expect(result.output).toContain('MAKE_WEBHOOK_URL must use http:// or https://.');
  });

  test('accepts local loopback ws/http exceptions', async () => {
    const result = await runNextDevOnce({
      cwd: repoRoot,
      port: 3303,
      timeoutMs: 30_000,
      env: {
        NEXT_PUBLIC_APP_ENV: 'local',
        NEXT_PUBLIC_WSS_URL: 'ws://127.0.0.1:8787/voice',
        MAKE_WEBHOOK_URL: 'http://localhost:8788/webhook',
        MAKE_WEBHOOK_SECRET: 'env-core-secret'
      }
    });

    expect(result.ready).toBe(true);
    expect(result.timedOut).toBe(false);
  });
});
