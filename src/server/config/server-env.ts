import { z } from 'zod';
import { DEFAULT_OUTPUT_COST_CREDITS } from '@/server/billing/generate-output-contract';

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['local', 'development', 'staging', 'production']).default('local'),
  GENERATE_OUTPUT_COST_CREDITS: z.coerce
    .number()
    .int()
    .positive()
    .max(10_000)
    .default(DEFAULT_OUTPUT_COST_CREDITS),
  GENERATE_OUTPUT_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(20_000),
  GOOGLE_AI_STUDIO_API_KEY_SECRET: z.string().trim().min(1),
  GOOGLE_AI_STUDIO_MODEL: z.string().trim().min(1).default('gemini-2.5-pro'),
  GOOGLE_AI_STUDIO_API_BASE_URL: z
    .string()
    .trim()
    .url()
    .default('https://generativelanguage.googleapis.com/v1beta'),
  NOTION_CLIENT_ID: z.string().trim().min(1).optional(),
  NOTION_CLIENT_SECRET: z.string().trim().min(1).optional(),
  NOTION_REDIRECT_URI: z.string().trim().url().optional(),
  NOTION_OAUTH_TOKEN_URL: z
    .string()
    .trim()
    .url()
    .default('https://api.notion.com/v1/oauth/token'),
  NOTION_API_BASE_URL: z.string().trim().url().default('https://api.notion.com/v1'),
  NOTION_API_VERSION: z.string().trim().min(1).default('2022-06-28'),
  NOTION_DATABASE_ID: z.string().trim().min(1).optional(),
  FIRESTORE_DATABASE_ID: z.string().trim().min(1).default('(default)'),
  FIREBASE_PROJECT_ID: z.string().trim().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().trim().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().trim().min(1).optional(),
  AWS_REGION: z.string().trim().min(1).optional(),
  AWS_SQS_ENDPOINT: z.string().trim().url().optional(),
  KAKAO_RETRY_SQS_QUEUE_URL: z.string().trim().url().optional()
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const claude9010EnvSchema = z.object({
  CLAUDE_90_10_STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  CLAUDE_90_10_STORAGE_BASE_DIR: z.string().trim().min(1).default('./storage/skills'),
  CLAUDE_90_10_AUTOSTART_WORKER: z.string().trim().default('false'),
  CLAUDE_90_10_S3_BUCKET: z.string().trim().optional(),
  CLAUDE_90_10_S3_PREFIX: z.string().trim().optional(),
  CLAUDE_90_10_S3_ENDPOINT: z.string().trim().optional(),
  AWS_ACCESS_KEY_ID: z.string().trim().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().trim().optional(),
  AWS_REGION: z.string().trim().optional(),
  GEMINI_API_KEY: z.string().trim().min(1),
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-2.5-pro'),
  GEMINI_ROUTER_MODEL: z.string().trim().optional(),
  REDIS_URL: z.string().trim().min(1)
});

export type Claude9010Env = Omit<
  z.infer<typeof claude9010EnvSchema>,
  'CLAUDE_90_10_AUTOSTART_WORKER'
> & {
  CLAUDE_90_10_AUTOSTART_WORKER: boolean;
};

function parseBooleanEnv(name: string, value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off', ''].includes(normalized)) {
    return false;
  }

  throw new Error(`[server-env] ${name}: Expected a boolean-compatible string, received "${value}".`);
}

export function getServerEnv(input: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `[server-env] ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ')}`
    );
  }

  return {
    ...parsed.data,
    FIREBASE_PRIVATE_KEY: parsed.data.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  };
}

export function getClaude9010Env(
  input: Record<string, string | undefined> = process.env
): Claude9010Env {
  const parsed = claude9010EnvSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `[server-env] ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ')}`
    );
  }

  return {
    ...parsed.data,
    CLAUDE_90_10_AUTOSTART_WORKER: parseBooleanEnv(
      'CLAUDE_90_10_AUTOSTART_WORKER',
      parsed.data.CLAUDE_90_10_AUTOSTART_WORKER
    )
  };
}
