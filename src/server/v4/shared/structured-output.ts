import type { V4DestinationKey } from '@/shared/contracts/v4/common';
import {
  buildFallbackStructuredPayload,
  getV4DestinationSchema,
  type V4StructuredPayload,
  validateDestinationStructuredPayload
} from '@/shared/contracts/v4/schemas';
import { getV4ServerEnv } from '@/server/v4/shared/env';
import { getV4LlmRoute, type V4LlmLane, type V4LlmRoute } from '@/server/v4/shared/llm-routing';

interface PrepareStructuredOutputInput {
  lane: V4LlmLane;
  destinationKey: V4DestinationKey;
  transcriptText: string;
  preferLiveGemini?: boolean;
}

export interface PreparedStructuredOutput {
  payload: V4StructuredPayload;
  route: V4LlmRoute;
  source: 'gemini' | 'deterministic-fallback';
}

function buildPrompt(destinationKey: V4DestinationKey, transcriptText: string): string {
  const definition = getV4DestinationSchema(destinationKey);

  return [
    `You are the VOXERA structured output mapper for ${definition.label}.`,
    definition.instruction,
    'Return JSON only. Do not wrap the JSON in markdown.',
    `Destination: ${definition.label}`,
    `Lane: ${definition.mode.toUpperCase()}`,
    `Transcript:\n${transcriptText.trim() || definition.warmupTranscript}`
  ].join('\n\n');
}

export function buildGeminiStructuredRequestBody(input: {
  lane: V4LlmLane;
  destinationKey: V4DestinationKey;
  transcriptText: string;
  env?: Record<string, string | undefined>;
}): { model: string; body: Record<string, unknown> } {
  const route = getV4LlmRoute(input.lane, input.env);
  const definition = getV4DestinationSchema(input.destinationKey);

  return {
    model: route.model,
    body: {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildPrompt(input.destinationKey, input.transcriptText)
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: definition.jsonSchema,
        thinkingConfig: {
          thinkingLevel: route.thinkingLevel
        }
      }
    }
  };
}

function extractGeminiJsonPayload(rawResponse: unknown): unknown {
  if (!rawResponse || typeof rawResponse !== 'object') {
    throw new Error('Gemini returned an invalid response envelope.');
  }

  const candidates = 'candidates' in rawResponse ? rawResponse.candidates : undefined;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('Gemini returned no candidates.');
  }

  const candidate = candidates[0];
  if (!candidate || typeof candidate !== 'object' || !('content' in candidate)) {
    throw new Error('Gemini candidate payload is malformed.');
  }

  const content = candidate.content;
  if (!content || typeof content !== 'object' || !('parts' in content) || !Array.isArray(content.parts)) {
    throw new Error('Gemini content payload is malformed.');
  }

  const text = content.parts
    .map((part: unknown) =>
      part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' ? part.text : ''
    )
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini returned an empty structured output payload.');
  }

  return JSON.parse(text);
}

async function requestLiveGeminiStructuredOutput(input: {
  lane: V4LlmLane;
  destinationKey: V4DestinationKey;
  transcriptText: string;
}): Promise<PreparedStructuredOutput> {
  const env = getV4ServerEnv();
  const route = getV4LlmRoute(input.lane);
  const request = buildGeminiStructuredRequestBody(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), route.requestTimeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request.body),
        signal: controller.signal
      }
    );

    const rawJson = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        rawJson && typeof rawJson === 'object' && 'error' in rawJson
          ? JSON.stringify(rawJson.error)
          : `Gemini request failed with status ${response.status}.`;
      throw new Error(message);
    }

    return {
      payload: validateDestinationStructuredPayload(
        input.destinationKey,
        extractGeminiJsonPayload(rawJson)
      ),
      route,
      source: 'gemini'
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function prepareV4StructuredOutput(
  input: PrepareStructuredOutputInput
): Promise<PreparedStructuredOutput> {
  const definition = getV4DestinationSchema(input.destinationKey);
  if (definition.mode !== input.lane) {
    throw new Error(
      `Destination "${input.destinationKey}" is not configured for the ${input.lane.toUpperCase()} lane.`
    );
  }

  const route = getV4LlmRoute(input.lane);
  const env = getV4ServerEnv();
  const liveGeminiAllowed = input.preferLiveGemini !== false && Boolean(env.GEMINI_API_KEY);

  if (liveGeminiAllowed) {
    try {
      return await requestLiveGeminiStructuredOutput(input);
    } catch (error) {
      if (env.NEXT_PUBLIC_APP_ENV !== 'local' && env.NEXT_PUBLIC_APP_ENV !== 'development') {
        throw error;
      }

      console.warn(
        `[v4-llm] Live Gemini structured output failed for ${input.destinationKey}. Falling back locally: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  return {
    payload: validateDestinationStructuredPayload(
      input.destinationKey,
      buildFallbackStructuredPayload(input.destinationKey, input.transcriptText)
    ),
    route,
    source: 'deterministic-fallback'
  };
}
