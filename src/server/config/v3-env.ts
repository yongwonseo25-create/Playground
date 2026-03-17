function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`[v3-env] Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function requiredPrefix(name: string, value: string | undefined, prefix: string): string {
  const resolved = required(name, value);
  if (!resolved.startsWith(prefix)) {
    throw new Error(`[v3-env] ${name} must start with ${prefix}.`);
  }

  return resolved;
}

function parsePositiveInt(name: string, value: string | undefined, fallback: number): number {
  if (!value || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`[v3-env] ${name} must be a positive integer.`);
  }

  return parsed;
}

function parseEnum<T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  if (!value || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim() as T;
  if (!allowed.includes(normalized)) {
    throw new Error(`[v3-env] ${name} must be one of: ${allowed.join(', ')}`);
  }

  return normalized;
}

export type V3ServerEnv = {
  DATABASE_URL: string;
  REDIS_URL: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_WEBHOOK_TOLERANCE_SEC: number;
  NEXT_PUBLIC_APP_ENV: 'local' | 'development' | 'staging' | 'production';
};

export type QueueProvider = 'local' | 'sqs';

export type V3StripeCheckoutEnv = {
  STRIPE_API_KEY: string;
  STRIPE_CHECKOUT_SUCCESS_PATH: string;
  STRIPE_CHECKOUT_CANCEL_PATH: string;
};

export type V3QueueEnv = {
  QUEUE_PROVIDER: QueueProvider;
  AWS_REGION?: string;
  SQS_QUEUE_URL?: string;
};

export type V3CacheEnv = {
  USER_CREDITS_CACHE_TTL_SEC: number;
  STT_DEDUPE_TTL_SEC: number;
};

export function getV3ServerEnv(): V3ServerEnv {
  return {
    DATABASE_URL: required('DATABASE_URL', process.env.DATABASE_URL),
    REDIS_URL: required('REDIS_URL', process.env.REDIS_URL),
    STRIPE_WEBHOOK_SECRET: required('STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET),
    STRIPE_WEBHOOK_TOLERANCE_SEC: parsePositiveInt(
      'STRIPE_WEBHOOK_TOLERANCE_SEC',
      process.env.STRIPE_WEBHOOK_TOLERANCE_SEC,
      300
    ),
    NEXT_PUBLIC_APP_ENV:
      (process.env.NEXT_PUBLIC_APP_ENV as V3ServerEnv['NEXT_PUBLIC_APP_ENV'] | undefined) ?? 'local'
  };
}

export function getV3StripeCheckoutEnv(): V3StripeCheckoutEnv {
  return {
    STRIPE_API_KEY: requiredPrefix('STRIPE_API_KEY', process.env.STRIPE_API_KEY, 'sk_test_'),
    STRIPE_CHECKOUT_SUCCESS_PATH: process.env.STRIPE_CHECKOUT_SUCCESS_PATH?.trim() || '/billing/success',
    STRIPE_CHECKOUT_CANCEL_PATH: process.env.STRIPE_CHECKOUT_CANCEL_PATH?.trim() || '/billing/cancel'
  };
}

export function getV3QueueEnv(): V3QueueEnv {
  const provider = parseEnum<QueueProvider>('QUEUE_PROVIDER', process.env.QUEUE_PROVIDER, ['local', 'sqs'], 'local');

  if (provider === 'local') {
    return {
      QUEUE_PROVIDER: provider
    };
  }

  return {
    QUEUE_PROVIDER: provider,
    AWS_REGION: required('AWS_REGION', process.env.AWS_REGION),
    SQS_QUEUE_URL: required('SQS_QUEUE_URL', process.env.SQS_QUEUE_URL)
  };
}

export function getV3CacheEnv(): V3CacheEnv {
  return {
    USER_CREDITS_CACHE_TTL_SEC: parsePositiveInt(
      'USER_CREDITS_CACHE_TTL_SEC',
      process.env.USER_CREDITS_CACHE_TTL_SEC,
      30
    ),
    STT_DEDUPE_TTL_SEC: parsePositiveInt('STT_DEDUPE_TTL_SEC', process.env.STT_DEDUPE_TTL_SEC, 900)
  };
}
