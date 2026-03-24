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
  FIRESTORE_DATABASE_ID: z.string().trim().min(1).default('(default)'),
  FIREBASE_PROJECT_ID: z.string().trim().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().trim().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().trim().min(1).optional()
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

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
