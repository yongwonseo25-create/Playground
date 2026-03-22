import { expect, test } from '@playwright/test';
import {
  buildStructuredOutputRequest,
  extractStructuredMemories
} from '../../src/server/v4/memory/structured-output';
import {
  buildV4MemoryCollectionDefinition,
  V4_MEMORY_COLLECTION_NAME,
  PREFERENCE_MEMORY_TTL_MS,
  SHORT_TERM_MEMORY_TTL_MS
} from '../../src/server/v4/memory/memory-store';
import { InMemoryV4MemoryStore } from './helpers/v4-in-memory-memory-store';

test.describe('v4 memory pipeline', () => {
  test('forces OpenAI structured outputs with strict JSON schema', async () => {
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

    const memories = await extractStructuredMemories(
      {
        apiKey: 'openai-test-key',
        transcript: '대표님은 매주 월요일 아침 요약을 선호합니다.',
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
                  content: '대표님은 매주 월요일 아침 요약을 선호합니다.'
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

  test('applies 14-day and 90-day forgetting TTLs and supports GDPR hard delete', () => {
    const store = new InMemoryV4MemoryStore();
    const now = new Date('2026-03-22T00:00:00.000Z');
    const collection = buildV4MemoryCollectionDefinition();

    expect(collection.collectionName).toBe(V4_MEMORY_COLLECTION_NAME);
    expect(collection.indexes).toContainEqual({
      key: { expiresAt: 1 },
      name: 'ttl_memory_expires_at',
      expireAfterSeconds: 0
    });

    const shortTerm = store.upsert({
      id: 'mem-2',
      userId: 7,
      kind: 'short_term',
      content: '이번 주 회의 메모',
      now
    });
    const preference = store.upsert({
      id: 'mem-3',
      userId: 7,
      kind: 'preference',
      content: '월요일 요약 선호',
      now
    });

    expect(new Date(shortTerm.expiresAt).getTime()).toBe(now.getTime() + SHORT_TERM_MEMORY_TTL_MS);
    expect(new Date(preference.expiresAt).getTime()).toBe(now.getTime() + PREFERENCE_MEMORY_TTL_MS);
    expect(store.listByUser(7)).toHaveLength(2);

    expect(store.forgetExpired(new Date(now.getTime() + SHORT_TERM_MEMORY_TTL_MS + 1))).toBe(1);
    expect(store.listByUser(7)).toHaveLength(1);
    expect(store.deleteUser(7)).toBe(1);
    expect(store.listByUser(7)).toHaveLength(0);
  });
});
