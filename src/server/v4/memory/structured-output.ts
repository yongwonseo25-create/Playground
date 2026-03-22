type FetchLike = typeof fetch;

export type ExtractableMemory = {
  id: string;
  kind: 'short_term' | 'preference';
  content: string;
};

const memoryJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    memories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: ['short_term', 'preference'] },
          content: { type: 'string' }
        },
        required: ['id', 'kind', 'content']
      }
    }
  },
  required: ['memories']
} as const;

export function buildStructuredOutputRequest(input: { transcript: string; userId: number }) {
  return {
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'Extract only durable user memories. Return strict JSON that matches the schema exactly.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `userId=${input.userId}\ntranscript=${input.transcript}`
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'voxera_v4_memory_extraction',
        strict: true,
        schema: memoryJsonSchema
      }
    }
  };
}

function parseStructuredOutput(payload: unknown): ExtractableMemory[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('OpenAI structured output payload is invalid.');
  }

  const maybeOutputText =
    'output_text' in payload && typeof payload.output_text === 'string'
      ? payload.output_text
      : undefined;

  if (!maybeOutputText) {
    throw new Error('OpenAI structured output payload is missing output_text.');
  }

  const parsed = JSON.parse(maybeOutputText) as { memories?: ExtractableMemory[] };
  if (!Array.isArray(parsed.memories)) {
    throw new Error('OpenAI structured output JSON is missing memories.');
  }

  return parsed.memories.map((memory) => {
    if (!memory?.id || !memory?.kind || !memory?.content) {
      throw new Error('OpenAI structured output memory item is invalid.');
    }
    if (memory.kind !== 'short_term' && memory.kind !== 'preference') {
      throw new Error(`Unsupported memory kind: ${memory.kind}`);
    }
    return memory;
  });
}

export async function extractStructuredMemories(
  input: {
    apiKey: string;
    transcript: string;
    userId: number;
  },
  fetchImpl: FetchLike = fetch
): Promise<ExtractableMemory[]> {
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(buildStructuredOutputRequest(input))
  });

  if (!response.ok) {
    throw new Error(`OpenAI structured output request failed with ${response.status}.`);
  }

  return parseStructuredOutput(await response.json());
}
