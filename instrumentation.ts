import { warmV4StructuredOutputSchemas } from '@/server/v4/shared/warm-up-job';

export async function register(): Promise<void> {
  await warmV4StructuredOutputSchemas().catch((error) => {
    console.error(
      `[v4-warmup] Failed to warm structured output schemas: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  });
}
