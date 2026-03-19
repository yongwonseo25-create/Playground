import { parseServerEnv } from '@/shared/config/env-core';

export interface V4ServerEnv extends ReturnType<typeof parseServerEnv> {
  DATABASE_URL: string;
  REDIS_URL: string;
  V4_EXECUTION_CREDIT_ACCOUNT_KEY: string;
  V4_EXECUTION_CREDIT_INITIAL_BALANCE: number;
  V4_EXECUTION_BUFFER_TTL_SEC: number;
  V4_IDEMPOTENCY_TTL_SEC: number;
  V4_REDIS_ENCRYPTION_KEY: string;
  V4_WORKER_POLL_INTERVAL_MS: number;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`[env] Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function parseInteger(name: string, value: string | undefined, fallback: number): number {
  if (!value || value.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`[env] ${name} must be a non-negative integer.`);
  }

  return parsed;
}

function assertDatabaseUrl(databaseUrl: string): void {
  if (
    databaseUrl.startsWith('postgres://') ||
    databaseUrl.startsWith('postgresql://') ||
    databaseUrl.startsWith('pgmem://')
  ) {
    return;
  }

  throw new Error(
    '[env] DATABASE_URL must use postgres://, postgresql://, or pgmem:// for local V4 testing.'
  );
}

function assertRedisUrl(redisUrl: string): void {
  if (
    redisUrl.startsWith('redis://') ||
    redisUrl.startsWith('rediss://') ||
    redisUrl.startsWith('memory://')
  ) {
    return;
  }

  throw new Error('[env] REDIS_URL must use redis://, rediss://, or memory:// for local V4 testing.');
}

function parseBoundedInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = parseInteger(name, value, fallback);
  if (parsed < min || parsed > max) {
    throw new Error(`[env] ${name} must be between ${min} and ${max}.`);
  }

  return parsed;
}

export function getV4ServerEnv(input: Record<string, string | undefined> = process.env): V4ServerEnv {
  const baseEnv = parseServerEnv({
    NEXT_PUBLIC_WSS_URL: input.NEXT_PUBLIC_WSS_URL,
    NEXT_PUBLIC_APP_ENV: input.NEXT_PUBLIC_APP_ENV,
    MAKE_WEBHOOK_URL: input.MAKE_WEBHOOK_URL,
    MAKE_WEBHOOK_SECRET: input.MAKE_WEBHOOK_SECRET
  });

  const databaseUrl = required('DATABASE_URL', input.DATABASE_URL);
  assertDatabaseUrl(databaseUrl);

  const redisUrl = input.REDIS_URL?.trim() || 'memory://voxera-v4';
  assertRedisUrl(redisUrl);

  const isLocalLike =
    baseEnv.NEXT_PUBLIC_APP_ENV === 'local' || baseEnv.NEXT_PUBLIC_APP_ENV === 'development';

  const accountKey =
    input.V4_EXECUTION_CREDIT_ACCOUNT_KEY?.trim() ||
    (isLocalLike ? 'local-operator' : required('V4_EXECUTION_CREDIT_ACCOUNT_KEY', undefined));

  return {
    ...baseEnv,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    V4_EXECUTION_CREDIT_ACCOUNT_KEY: accountKey,
    V4_EXECUTION_CREDIT_INITIAL_BALANCE: parseInteger(
      'V4_EXECUTION_CREDIT_INITIAL_BALANCE',
      input.V4_EXECUTION_CREDIT_INITIAL_BALANCE,
      isLocalLike ? 25 : 0
    ),
    V4_EXECUTION_BUFFER_TTL_SEC: parseBoundedInteger(
      'V4_EXECUTION_BUFFER_TTL_SEC',
      input.V4_EXECUTION_BUFFER_TTL_SEC,
      600,
      300,
      600
    ),
    V4_IDEMPOTENCY_TTL_SEC: parseBoundedInteger(
      'V4_IDEMPOTENCY_TTL_SEC',
      input.V4_IDEMPOTENCY_TTL_SEC,
      600,
      300,
      600
    ),
    V4_REDIS_ENCRYPTION_KEY:
      input.V4_REDIS_ENCRYPTION_KEY?.trim() ||
      (isLocalLike ? 'voxera-local-v4-resilience' : required('V4_REDIS_ENCRYPTION_KEY', undefined)),
    V4_WORKER_POLL_INTERVAL_MS: parseBoundedInteger(
      'V4_WORKER_POLL_INTERVAL_MS',
      input.V4_WORKER_POLL_INTERVAL_MS,
      250,
      50,
      10_000
    )
  };
}
