export const FIXED_SHORT_TERM_MEMORY_TTL_DAYS = 14 as const;
export const FIXED_PREFERENCE_MEMORY_TTL_DAYS = 90 as const;

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`[v4-memory-env] Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function parsePositiveInt(name: string, value: string | undefined, fallback: number): number {
  if (!value || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`[v4-memory-env] ${name} must be a positive integer.`);
  }

  return parsed;
}

function parseFixedTtlDays(name: string, value: string | undefined, expected: number): number {
  const parsed = parsePositiveInt(name, value, expected);
  if (parsed !== expected) {
    throw new Error(`[v4-memory-env] ${name} must be exactly ${expected}.`);
  }

  return expected;
}

function parseProvider(value: string | undefined): 'local' | 'openai' {
  const normalized = (value?.trim() || 'local') as 'local' | 'openai';
  if (normalized !== 'local' && normalized !== 'openai') {
    throw new Error('[v4-memory-env] MEMORY_PROVIDER must be either local or openai.');
  }

  return normalized;
}

export type V4MemoryEnv = {
  MEMORY_PROVIDER: 'local' | 'openai';
  OPENAI_API_KEY?: string;
  OPENAI_MEMORY_MODEL: string;
  MEMORY_SHORT_TERM_TTL_DAYS: number;
  MEMORY_PREFERENCE_TTL_DAYS: number;
};

export function getV4MemoryEnv(): V4MemoryEnv {
  const provider = parseProvider(process.env.MEMORY_PROVIDER);

  if (provider === 'openai') {
    return {
      MEMORY_PROVIDER: provider,
      OPENAI_API_KEY: required('OPENAI_API_KEY', process.env.OPENAI_API_KEY),
      OPENAI_MEMORY_MODEL: process.env.OPENAI_MEMORY_MODEL?.trim() || 'gpt-4.1-mini',
      MEMORY_SHORT_TERM_TTL_DAYS: parseFixedTtlDays(
        'MEMORY_SHORT_TERM_TTL_DAYS',
        process.env.MEMORY_SHORT_TERM_TTL_DAYS,
        FIXED_SHORT_TERM_MEMORY_TTL_DAYS
      ),
      MEMORY_PREFERENCE_TTL_DAYS: parseFixedTtlDays(
        'MEMORY_PREFERENCE_TTL_DAYS',
        process.env.MEMORY_PREFERENCE_TTL_DAYS,
        FIXED_PREFERENCE_MEMORY_TTL_DAYS
      )
    };
  }

  return {
    MEMORY_PROVIDER: provider,
    OPENAI_MEMORY_MODEL: process.env.OPENAI_MEMORY_MODEL?.trim() || 'gpt-4.1-mini',
    MEMORY_SHORT_TERM_TTL_DAYS: parseFixedTtlDays(
      'MEMORY_SHORT_TERM_TTL_DAYS',
      process.env.MEMORY_SHORT_TERM_TTL_DAYS,
      FIXED_SHORT_TERM_MEMORY_TTL_DAYS
    ),
    MEMORY_PREFERENCE_TTL_DAYS: parseFixedTtlDays(
      'MEMORY_PREFERENCE_TTL_DAYS',
      process.env.MEMORY_PREFERENCE_TTL_DAYS,
      FIXED_PREFERENCE_MEMORY_TTL_DAYS
    )
  };
}
