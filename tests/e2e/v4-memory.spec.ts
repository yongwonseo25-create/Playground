import { expect, test } from '@playwright/test';
import {
  buildStructuredOutputRequest,
  extractStructuredMemories
} from '../../src/server/v4/memory/structured-output';
import {
  buildV4MemoryCollectionDefinition,
  createV4MemoryIndexes,
  computeV4MemoryExpiresAt,
  PREFERENCE_MEMORY_TTL_SECONDS,
  SHORT_TERM_MEMORY_TTL_MS,
  SHORT_TERM_MEMORY_TTL_SECONDS,
  V4_MEMORY_COLLECTION_NAME
} from '../../src/server/v4/memory/memory-store';

test.describe('v4 memory pipeline', () => {
  test('forces OpenAI structured outputs with strict JSON schema', async () => {
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

    const memories = await extractStructuredMemories(
      {
        apiKey: 'openai-test-key',
        transcript: '??쒕떂? 留ㅼ＜ ?붿슂???꾩묠 ?붿빟???좏샇?⑸땲??',
        userId: 7
      },
      async (input, init) => {
        fetchCalls.push({ input, init });
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              memories: [
                {
                  id: 'mem-1',
                  kind: 'preference',
                  content: '??쒕떂? 留ㅼ＜ ?붿슂???꾩묠 ?붿빟???좏샇?⑸땲??'
                }
              ]
            })
          }),
          { status: 200 }
        );
      }
    );

    expect(memories).toHaveLength(1);
    expect(memories[0]).toMatchObject({
      kind: 'preference'
    });

    const requestBody = JSON.parse(String(fetchCalls[0]?.init?.body)) as ReturnType<typeof buildStructuredOutputRequest>;
    expect(requestBody.text.format.type).toBe('json_schema');
    expect(requestBody.text.format.strict).toBe(true);
    expect(requestBody.text.format.name).toBe('voxera_v4_memory_extraction');
  });

  test('declares physical 14-day and 90-day TTL indexes for memory retention', async () => {
    const now = new Date('2026-03-22T00:00:00.000Z');
    const collection = buildV4MemoryCollectionDefinition();
    const createIndexCalls: Array<{
      key: Record<string, 1 | -1>;
      options: {
        name: string;
        expireAfterSeconds?: number;
        partialFilterExpression?: Record<string, unknown>;
      };
    }> = [];

    const indexNames = await createV4MemoryIndexes({
      createIndex(key, options) {
        createIndexCalls.push({ key, options });
        return options.name;
      }
    });

    expect(collection.collectionName).toBe(V4_MEMORY_COLLECTION_NAME);
    expect(collection.indexes).toContainEqual({
      key: { shortTermCreatedAt: 1 },
      name: 'ttl_memory_short_term_created_at_14d',
      expireAfterSeconds: SHORT_TERM_MEMORY_TTL_SECONDS,
      partialFilterExpression: { kind: 'short_term' }
    });
    expect(collection.indexes).toContainEqual({
      key: { preferenceCreatedAt: 1 },
      name: 'ttl_memory_preference_created_at_90d',
      expireAfterSeconds: PREFERENCE_MEMORY_TTL_SECONDS,
      partialFilterExpression: { kind: 'preference' }
    });
    expect(indexNames).toEqual([
      'ttl_memory_short_term_created_at_14d',
      'ttl_memory_preference_created_at_90d',
      'memory_user_created_at'
    ]);
    expect(createIndexCalls[0]).toEqual({
      key: { shortTermCreatedAt: 1 },
      options: {
        name: 'ttl_memory_short_term_created_at_14d',
        expireAfterSeconds: SHORT_TERM_MEMORY_TTL_SECONDS,
        partialFilterExpression: { kind: 'short_term' }
      }
    });
    expect(createIndexCalls[1]).toEqual({
      key: { preferenceCreatedAt: 1 },
      options: {
        name: 'ttl_memory_preference_created_at_90d',
        expireAfterSeconds: PREFERENCE_MEMORY_TTL_SECONDS,
        partialFilterExpression: { kind: 'preference' }
      }
    });
    expect(Date.parse(computeV4MemoryExpiresAt('short_term', now))).toBe(
      now.getTime() + SHORT_TERM_MEMORY_TTL_MS
    );
    expect(Date.parse(computeV4MemoryExpiresAt('preference', now))).toBe(
      now.getTime() + PREFERENCE_MEMORY_TTL_SECONDS * 1000
    );
  });
});
