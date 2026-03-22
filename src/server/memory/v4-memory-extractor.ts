import { z } from 'zod';
import { getV4MemoryEnv } from '@/server/config/v4-memory-env';
import {
  memoryCandidateSchema,
  memoryExtractionModelResponseSchema,
  memoryKindSchema,
  memoryRetentionClassSchema,
  type MemoryCandidate,
  type MemoryExtractionModelResponse
} from '@/shared/contracts/v4-memory';

type ExtractInput = {
  sourceText: string;
  sourceType: 'transcript' | 'note' | 'chat';
  sourceId?: string;
};

type ExtractDeps = {
  fetchImpl?: typeof fetch;
};

const openAiModelOutputSchema = z.object({
  summary: z.string().min(1),
  items: z.array(memoryCandidateSchema)
});

function memoryTtlDays(retentionClass: 'short_term' | 'preference'): number {
  const env = getV4MemoryEnv();
  return retentionClass === 'preference' ? env.MEMORY_PREFERENCE_TTL_DAYS : env.MEMORY_SHORT_TERM_TTL_DAYS;
}

function validateRetentionConsistency(candidate: MemoryCandidate): void {
  const expectedTtl = memoryTtlDays(candidate.retentionClass);
  if (candidate.ttlDays !== expectedTtl) {
    throw new Error(
      `Memory candidate ttlDays ${candidate.ttlDays} does not match retentionClass ${candidate.retentionClass}.`
    );
  }
}

function sentenceSegments(sourceText: string): string[] {
  return sourceText
    .split(/[\n.!?]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function createFallbackCandidate(
  kind: 'fact' | 'preference' | 'task' | 'profile',
  content: string
): MemoryCandidate {
  const retentionClass = kind === 'preference' ? 'preference' : 'short_term';
  const ttlDays = memoryTtlDays(retentionClass);

  return memoryCandidateSchema.parse({
    content,
    kind,
    retentionClass,
    ttlDays,
    confidence: kind === 'preference' ? 0.95 : 0.82
  });
}

function extractLocally(input: ExtractInput): MemoryExtractionModelResponse {
  const segments = sentenceSegments(input.sourceText);
  const items: MemoryCandidate[] = [];

  for (const segment of segments) {
    const normalized = segment.replace(/\s+/g, ' ').trim();
    const preferenceMatch =
      normalized.match(/\b(?:i|we)\s+(?:prefer|like|love|want|favor)\s+(.+)/i) ??
      normalized.match(/\bmy preference is\s+(.+)/i);
    const taskMatch =
      normalized.match(/\b(?:remember to|need to|should|must|please)\s+(.+)/i) ??
      normalized.match(/\b(?:i\s+)?need(?: to)?\s+(.+)/i) ??
      normalized.match(/\bfollow up on\s+(.+)/i);
    const profileMatch =
      normalized.match(/\bmy name is\s+(.+)/i) ??
      normalized.match(/\bi work at\s+(.+)/i) ??
      normalized.match(/\bi live in\s+(.+)/i);

    if (preferenceMatch?.[1]) {
      items.push(createFallbackCandidate('preference', `Preference: ${preferenceMatch[1].trim()}`));
      continue;
    }

    if (taskMatch?.[1]) {
      items.push(createFallbackCandidate('task', `Task: ${taskMatch[1].trim()}`));
      continue;
    }

    if (profileMatch?.[1]) {
      items.push(createFallbackCandidate('profile', `Profile: ${profileMatch[1].trim()}`));
      continue;
    }
  }

  if (items.length === 0) {
    const summary = segments[0] ?? input.sourceText.trim();
    items.push(createFallbackCandidate('fact', summary));
  }

  for (const item of items) {
    validateRetentionConsistency(item);
  }

  return memoryExtractionModelResponseSchema.parse({
    summary: segments[0] ?? input.sourceText.trim(),
    items
  });
}

function buildOpenAiSchema() {
  return {
    name: 'voxera_memory_extraction',
    description: 'Extract durable memories from user text for Voxera V4.',
    strict: true,
    type: 'json_schema' as const,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'items'],
      properties: {
        summary: {
          type: 'string',
          minLength: 1,
          maxLength: 2000
        },
        items: {
          type: 'array',
          maxItems: 20,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['content', 'kind', 'retentionClass', 'ttlDays', 'confidence'],
            properties: {
              content: {
                type: 'string',
                minLength: 1,
                maxLength: 1000
              },
              kind: {
                type: 'string',
                enum: ['fact', 'preference', 'task', 'profile']
              },
              retentionClass: {
                type: 'string',
                enum: ['short_term', 'preference']
              },
              ttlDays: {
                type: 'integer',
                enum: [14, 90]
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1
              }
            }
          }
        }
      }
    }
  };
}

function extractOutputText(rawResponse: Record<string, unknown>): string {
  const outputText = rawResponse.output_text;
  if (typeof outputText === 'string' && outputText.trim().length > 0) {
    return outputText;
  }

  const output = rawResponse.output;
  if (!Array.isArray(output)) {
    throw new Error('OpenAI response did not contain structured output text.');
  }

  const parts: string[] = [];
  for (const entry of output) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const content = (entry as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (!block || typeof block !== 'object') {
        continue;
      }

      const type = (block as { type?: unknown }).type;
      const text = (block as { text?: unknown }).text;
      if (type === 'output_text' && typeof text === 'string') {
        parts.push(text);
      }
    }
  }

  const combined = parts.join('\n').trim();
  if (!combined) {
    throw new Error('OpenAI response did not contain output text.');
  }

  return combined;
}

async function extractWithOpenAI(input: ExtractInput, fetchImpl: typeof fetch): Promise<MemoryExtractionModelResponse> {
  const env = getV4MemoryEnv();
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.OPENAI_MEMORY_MODEL,
      instructions:
        'Extract durable user memories from the provided text. Return only structured JSON that matches the schema. No markdown, no code fences, no prose.',
      input: input.sourceText,
      temperature: 0,
      text: {
        format: buildOpenAiSchema()
      }
    })
  });

  const rawJson = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const message =
      rawJson &&
      typeof rawJson === 'object' &&
      'error' in rawJson &&
      rawJson.error &&
      typeof rawJson.error === 'object' &&
      'message' in rawJson.error &&
      typeof rawJson.error.message === 'string'
        ? rawJson.error.message
        : `OpenAI memory extraction failed with ${response.status}.`;
    throw new Error(message);
  }

  if (!rawJson) {
    throw new Error('OpenAI memory extraction returned an empty response.');
  }

  const outputText = extractOutputText(rawJson);
  const parsedJson = JSON.parse(outputText);
  const parsed = openAiModelOutputSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new Error('OpenAI structured output did not match the Voxera memory contract.');
  }

  for (const item of parsed.data.items) {
    validateRetentionConsistency(item);
  }

  return memoryExtractionModelResponseSchema.parse(parsed.data);
}

export async function extractMemoryCandidates(
  input: ExtractInput,
  deps: ExtractDeps = {}
): Promise<{ provider: 'local' | 'openai'; extraction: MemoryExtractionModelResponse }> {
  const env = getV4MemoryEnv();
  if (env.MEMORY_PROVIDER === 'local') {
    return {
      provider: 'local',
      extraction: extractLocally(input)
    };
  }

  return {
    provider: 'openai',
    extraction: await extractWithOpenAI(input, deps.fetchImpl ?? fetch)
  };
}
