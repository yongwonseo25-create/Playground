import { randomUUID } from 'node:crypto';
import { getV4MemoryEnv } from '@/server/config/v4-memory-env';
import { computeV4MemoryExpiresAt, V4MemoryStore } from '@/server/memory/v4-memory-store';
import { extractMemoryCandidates } from '@/server/memory/v4-memory-extractor';
import {
  memoryDeleteResponseSchema,
  memoryExtractionResponseSchema,
  memoryListResponseSchema,
  type MemoryDeleteRequest,
  type MemoryExtractionRequest,
  type MemoryListResponse
} from '@/shared/contracts/v4-memory';
import { formatZodIssues } from '@/shared/contracts/common';

function resolveCreatedAt(input: MemoryExtractionRequest): Date {
  if (input.observedAt) {
    const parsed = new Date(input.observedAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('observedAt must be a valid ISO datetime.');
    }
    return parsed;
  }

  return new Date();
}

function buildMemoryRecords(input: MemoryExtractionRequest) {
  return async (fetchImpl?: typeof fetch) => {
    const env = getV4MemoryEnv();
    const createdAt = resolveCreatedAt(input);
    const extraction = await extractMemoryCandidates(
      {
        sourceText: input.sourceText,
        sourceType: input.sourceType,
        sourceId: input.sourceId
      },
      { fetchImpl }
    );

    const store = new V4MemoryStore();
    const purgedExpiredCount = store.purgeExpired(createdAt.getTime());

    const records = extraction.extraction.items.map((item) => ({
      memoryId: randomUUID(),
      userId: input.userId,
      content: item.content,
      kind: item.kind,
      retentionClass: item.retentionClass,
      ttlDays: item.ttlDays,
      confidence: item.confidence,
      sourceText: input.sourceText,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      createdAt: createdAt.toISOString(),
      expiresAt: computeV4MemoryExpiresAt(item.retentionClass, createdAt)
    }));

    const savedItems = store.upsert(records);

    return memoryExtractionResponseSchema.parse({
      ok: true,
      provider: extraction.provider,
      summary: extraction.extraction.summary,
      purgedExpiredCount,
      items: savedItems
    });
  };
}

export async function extractAndStoreMemories(
  input: MemoryExtractionRequest,
  fetchImpl?: typeof fetch
) {
  return buildMemoryRecords(input)(fetchImpl);
}

export async function listMemories(input: { userId: number; now?: Date }) {
  const store = new V4MemoryStore();
  const purgedExpiredCount = store.purgeExpired(input.now?.getTime() ?? Date.now());
  return memoryListResponseSchema.parse({
    ok: true,
    provider: getV4MemoryEnv().MEMORY_PROVIDER,
    purgedExpiredCount,
    items: store.listByUser(input.userId, input.now?.getTime() ?? Date.now())
  });
}

export async function deleteMemories(input: MemoryDeleteRequest) {
  const store = new V4MemoryStore();
  const deletedCount = store.deleteByUser(input.userId, input.memoryIds);
  return memoryDeleteResponseSchema.parse({
    ok: true,
    deletedCount
  });
}
