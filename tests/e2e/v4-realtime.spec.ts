import { expect, test } from '@playwright/test';
import {
  buildMongoOutboxCollectionDefinition,
  createMongoOutboxIndexes,
  MONGO_OUTBOX_COLLECTION_NAME,
  MONGO_OUTBOX_TTL_MS,
  MONGO_OUTBOX_TTL_SECONDS
} from '../../src/server/v4/realtime/mongo-outbox';
import { V4RealtimeSessionResumeService } from '../../src/server/v4/realtime/session-resume-service';
import { InMemoryRedisStreamResumeStore } from '../../src/server/v4/realtime/redis-streams-resume';
import { parseResumeToken } from '../../src/server/v4/realtime/resume-token';

test.describe('v4 realtime resilience', () => {
  test('issues resume tokens and replays only events after last_seq', () => {
    const outboxWrites: Array<Record<string, unknown>> = [];
    const service = new V4RealtimeSessionResumeService(new InMemoryRedisStreamResumeStore(), {
      enqueue(input) {
        const now = input.now ?? new Date();
        const record = {
          id: input.id,
          aggregateId: input.aggregateId,
          eventType: input.eventType,
          payload: input.payload,
          status: 'pending' as const,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + MONGO_OUTBOX_TTL_MS).toISOString()
        };
        outboxWrites.push(record);
        return record;
      }
    });

    const first = service.publish({
      streamKey: 'voice:session-1',
      connectionId: 'conn-1',
      eventType: 'transcript.partial',
      payload: { text: 'one' },
      outboxId: 'outbox-1'
    });
    service.publish({
      streamKey: 'voice:session-1',
      connectionId: 'conn-1',
      eventType: 'transcript.final',
      payload: { text: 'two' },
      outboxId: 'outbox-2'
    });

    expect(parseResumeToken(first.resumeToken)).toMatchObject({
      streamKey: 'voice:session-1',
      connectionId: 'conn-1'
    });

    const resumed = service.resume({
      resumeToken: first.resumeToken,
      lastSeq: first.event.seq
    });

    expect(resumed).toHaveLength(1);
    expect(resumed[0]).toMatchObject({
      seq: 2,
      type: 'transcript.final'
    });
    expect(outboxWrites).toHaveLength(2);
  });

  test('declares physical 24-hour TTL indexes for the Mongo outbox', async () => {
    const collection = buildMongoOutboxCollectionDefinition();
    const createIndexCalls: Array<{
      key: Record<string, 1 | -1>;
      options: { name: string; expireAfterSeconds?: number };
    }> = [];

    const indexNames = await createMongoOutboxIndexes({
      createIndex(key, options) {
        createIndexCalls.push({ key, options });
        return options.name;
      }
    });

    expect(collection.collectionName).toBe(MONGO_OUTBOX_COLLECTION_NAME);
    expect(collection.indexes).toContainEqual({
      key: { createdAt: 1 },
      name: 'ttl_outbox_created_at_24h',
      expireAfterSeconds: 86400
    });
    expect(MONGO_OUTBOX_TTL_SECONDS).toBe(24 * 60 * 60);
    expect(indexNames).toEqual(['ttl_outbox_created_at_24h', 'outbox_aggregate_created_at']);
    expect(createIndexCalls[0]).toEqual({
      key: { createdAt: 1 },
      options: { name: 'ttl_outbox_created_at_24h', expireAfterSeconds: 86400 }
    });
  });
});
