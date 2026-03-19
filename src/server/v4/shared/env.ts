import { parseServerEnv } from '@/shared/config/env-core';

export interface V4ServerEnv extends ReturnType<typeof parseServerEnv> {
  DATABASE_URL: string;
  V4_EXECUTION_CREDIT_ACCOUNT_KEY: string;
  V4_EXECUTION_CREDIT_INITIAL_BALANCE: number;
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

export function getV4ServerEnv(input: Record<string, string | undefined> = process.env): V4ServerEnv {
  const baseEnv = parseServerEnv({
    NEXT_PUBLIC_WSS_URL: input.NEXT_PUBLIC_WSS_URL,
    NEXT_PUBLIC_APP_ENV: input.NEXT_PUBLIC_APP_ENV,
    MAKE_WEBHOOK_URL: input.MAKE_WEBHOOK_URL,
    MAKE_WEBHOOK_SECRET: input.MAKE_WEBHOOK_SECRET
  });

  const databaseUrl = required('DATABASE_URL', input.DATABASE_URL);
  assertDatabaseUrl(databaseUrl);

  const isLocalLike =
    baseEnv.NEXT_PUBLIC_APP_ENV === 'local' || baseEnv.NEXT_PUBLIC_APP_ENV === 'development';

  const accountKey =
    input.V4_EXECUTION_CREDIT_ACCOUNT_KEY?.trim() ||
    (isLocalLike ? 'local-operator' : required('V4_EXECUTION_CREDIT_ACCOUNT_KEY', undefined));

  return {
    ...baseEnv,
    DATABASE_URL: databaseUrl,
    V4_EXECUTION_CREDIT_ACCOUNT_KEY: accountKey,
    V4_EXECUTION_CREDIT_INITIAL_BALANCE: parseInteger(
      'V4_EXECUTION_CREDIT_INITIAL_BALANCE',
      input.V4_EXECUTION_CREDIT_INITIAL_BALANCE,
      isLocalLike ? 25 : 0
    )
  };
}
