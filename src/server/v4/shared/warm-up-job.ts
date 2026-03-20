import { listV4DestinationSchemas } from '@/shared/contracts/v4/schemas';
import { buildGeminiStructuredRequestBody, prepareV4StructuredOutput } from '@/server/v4/shared/structured-output';
import { getV4LlmRoute } from '@/server/v4/shared/llm-routing';

let warmupPromise: Promise<void> | null = null;

export async function warmV4StructuredOutputSchemas(): Promise<void> {
  if (warmupPromise) {
    return warmupPromise;
  }

  warmupPromise = (async () => {
    const startedAt = Date.now();
    const warmedKeys: string[] = [];

    for (const definition of listV4DestinationSchemas()) {
      getV4LlmRoute(definition.mode);
      buildGeminiStructuredRequestBody({
        lane: definition.mode,
        destinationKey: definition.key,
        transcriptText: definition.warmupTranscript
      });
      await prepareV4StructuredOutput({
        lane: definition.mode,
        destinationKey: definition.key,
        transcriptText: definition.warmupTranscript,
        preferLiveGemini: false
      });
      warmedKeys.push(definition.key);
    }

    console.info(
      `[v4-warmup] Structured output schemas warmed: ${warmedKeys.join(', ')} in ${Date.now() - startedAt}ms`
    );
  })();

  try {
    await warmupPromise;
  } catch (error) {
    warmupPromise = null;
    throw error;
  }
}
