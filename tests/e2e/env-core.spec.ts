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
        MAKE_WEBHOOK_URL: 'http://localhost:8896/webhook',
        MAKE_WEBHOOK_SECRET: 'env-core-secret',
        DATABASE_URL: 'pgmem://env-core-local',
        REDIS_URL: 'memory://env-core-local',
        V4_EXECUTION_CREDIT_ACCOUNT_KEY: 'env-core-account',
        V4_EXECUTION_CREDIT_INITIAL_BALANCE: '4',
        V4_EXECUTION_BUFFER_TTL_SEC: '600',
        V4_IDEMPOTENCY_TTL_SEC: '600',
        V4_REDIS_ENCRYPTION_KEY: '12345678901234567890123456789012',
        V4_WORKER_POLL_INTERVAL_MS: '50',
        V4_ZHI_LLM_MODEL: 'gemini-3.1-flash-lite-preview',
        V4_ZHI_LLM_THINKING_LEVEL: 'minimal',
        V4_HITL_LLM_MODEL: 'gemini-3.1-pro-preview',
        V4_HITL_LLM_THINKING_LEVEL: 'low'
      }
    });

    expect(result.ready).toBe(true);
    expect(result.timedOut).toBe(false);
  });
});
