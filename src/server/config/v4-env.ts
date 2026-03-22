import { V4_IDEMPOTENCY_TTL_HOURS, v4InfraModeSchema } from '@/shared/contracts/v4-infra';

export type V4InfraMode = 'local' | 'neon-http';

export type V4InfraEnv = {
  V4_INFRA_MODE: V4InfraMode;
  V4_SQS_LAMBDA_MAXIMUM_CONCURRENCY: number;
  V4_IDEMPOTENCY_TTL_HOURS: number;
  V4_NEON_HTTP_URL: string | null;
  V4_NEON_API_KEY: string | null;
  V4_NOTION_API_KEY: string | null;
  V4_NOTION_DATABASE_ID: string | null;
  V4_NOTION_VERSION: string;
};

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`[v4-env] Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function optional(name: string, value: string | undefined): string | null {
  if (!value || value.trim() === '') {
    return null;
  }

  return value.trim();
}

function positiveInteger(name: string, value: string | undefined, fallback: number): number {
  if (!value || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`[v4-env] ${name} must be a positive integer.`);
  }

  return parsed;
}

function fixedPositiveInteger(name: string, value: string | undefined, expected: number): number {
  const parsed = positiveInteger(name, value, expected);
  if (parsed !== expected) {
    throw new Error(`[v4-env] ${name} must be exactly ${expected}.`);
  }

  return expected;
}

function validateInfraMode(raw: string): V4InfraMode {
  const parsed = v4InfraModeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('[v4-env] V4_INFRA_MODE must be either local or neon-http.');
  }

  return parsed.data;
}

function validateHttpsUrl(name: string, value: string): string {
  const url = new URL(value);

  if (url.protocol !== 'https:') {
    throw new Error(`[v4-env] ${name} must use https://.`);
  }

  return url.toString();
}

export function parseV4InfraEnv(input: Record<string, string | undefined>): V4InfraEnv {
  const mode = validateInfraMode(input.V4_INFRA_MODE ?? 'local');
  const maximumConcurrency = positiveInteger(
    'V4_SQS_LAMBDA_MAXIMUM_CONCURRENCY',
    input.V4_SQS_LAMBDA_MAXIMUM_CONCURRENCY,
    4
  );
  const ttlHours = fixedPositiveInteger(
    'V4_IDEMPOTENCY_TTL_HOURS',
    input.V4_IDEMPOTENCY_TTL_HOURS,
    V4_IDEMPOTENCY_TTL_HOURS
  );

  if (mode === 'local') {
    return {
      V4_INFRA_MODE: mode,
      V4_SQS_LAMBDA_MAXIMUM_CONCURRENCY: maximumConcurrency,
      V4_IDEMPOTENCY_TTL_HOURS: ttlHours,
      V4_NEON_HTTP_URL: optional('V4_NEON_HTTP_URL', input.V4_NEON_HTTP_URL),
      V4_NEON_API_KEY: optional('V4_NEON_API_KEY', input.V4_NEON_API_KEY),
      V4_NOTION_API_KEY: optional('V4_NOTION_API_KEY', input.V4_NOTION_API_KEY),
      V4_NOTION_DATABASE_ID: optional('V4_NOTION_DATABASE_ID', input.V4_NOTION_DATABASE_ID),
      V4_NOTION_VERSION: optional('V4_NOTION_VERSION', input.V4_NOTION_VERSION) ?? '2022-06-28'
    };
  }

  const neonUrl = validateHttpsUrl('V4_NEON_HTTP_URL', required('V4_NEON_HTTP_URL', input.V4_NEON_HTTP_URL));

  return {
    V4_INFRA_MODE: mode,
    V4_SQS_LAMBDA_MAXIMUM_CONCURRENCY: maximumConcurrency,
    V4_IDEMPOTENCY_TTL_HOURS: ttlHours,
    V4_NEON_HTTP_URL: neonUrl,
    V4_NEON_API_KEY: required('V4_NEON_API_KEY', input.V4_NEON_API_KEY),
    V4_NOTION_API_KEY: required('V4_NOTION_API_KEY', input.V4_NOTION_API_KEY),
    V4_NOTION_DATABASE_ID: required('V4_NOTION_DATABASE_ID', input.V4_NOTION_DATABASE_ID),
    V4_NOTION_VERSION: optional('V4_NOTION_VERSION', input.V4_NOTION_VERSION) ?? '2022-06-28'
  };
}
