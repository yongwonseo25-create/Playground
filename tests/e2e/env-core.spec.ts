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
        NEXT_PUBLIC_WEBHOOK_URL: 'https://api.example.com/webhook'
      }
    });

    expect(result.ready).toBe(false);
    expect(result.output).toContain('Insecure WebSocket (ws://) is not allowed outside local environment');
  });

  test('rejects non-http(s) webhook URL schemes', async () => {
    const result = await runNextDevOnce({
      cwd: repoRoot,
      port: 3302,
      timeoutMs: 20_000,
      env: {
        NEXT_PUBLIC_APP_ENV: 'staging',
        NEXT_PUBLIC_WSS_URL: 'wss://example.com/voice',
        NEXT_PUBLIC_WEBHOOK_URL: 'ftp://example.com/webhook'
      }
    });

    expect(result.ready).toBe(false);
    expect(result.output).toContain('NEXT_PUBLIC_WEBHOOK_URL must use https:// (or http:// for local loopback only).');
  });

  test('accepts local loopback ws/http exceptions', async () => {
    const result = await runNextDevOnce({
      cwd: repoRoot,
      port: 3303,
      timeoutMs: 30_000,
      env: {
        NEXT_PUBLIC_APP_ENV: 'local',
        NEXT_PUBLIC_WSS_URL: 'ws://127.0.0.1:8787/voice',
        NEXT_PUBLIC_WEBHOOK_URL: 'http://localhost:8788/webhook'
      }
    });

    expect(result.ready).toBe(true);
    expect(result.timedOut).toBe(false);
  });
});
