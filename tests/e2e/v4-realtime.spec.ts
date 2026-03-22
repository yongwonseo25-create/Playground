import { expect, test } from '@playwright/test';
import {
  buildMongoOutboxCollectionDefinition,
  MONGO_OUTBOX_COLLECTION_NAME,
  MONGO_OUTBOX_TTL_MS,
  MONGO_OUTBOX_TTL_SECONDS
} from '../../src/server/v4/realtime/mongo-outbox';
import { V4RealtimeSessionResumeService } from '../../src/server/v4/realtime/session-resume-service';
import { InMemoryRedisStreamResumeStore } from '../../src/server/v4/realtime/redis-streams-resume';
import { parseResumeToken } from '../../src/server/v4/realtime/resume-token';
import { InMemoryMongoOutbox } from './helpers/v4-in-memory-mongo-outbox';

test.describe('v4 realtime resilience', () => {
  test('issues resume tokens and replays only events after last_seq', () => {
    const service = new V4RealtimeSessionResumeService(
      new InMemoryRedisStreamResumeStore(),
      new InMemoryMongoOutbox()
    );

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
  });

  test('keeps Mongo outbox updates one-way only and evicts after 24 hours', () => {
    const outbox = new InMemoryMongoOutbox();
    const now = new Date('2026-03-22T00:00:00.000Z');
    const collection = buildMongoOutboxCollectionDefinition();

    expect(collection.collectionName).toBe(MONGO_OUTBOX_COLLECTION_NAME);
    expect(collection.indexes).toContainEqual({
      key: { expiresAt: 1 },
      name: 'ttl_outbox_expires_at_24h',
      expireAfterSeconds: 0
    });
    expect(MONGO_OUTBOX_TTL_SECONDS).toBe(24 * 60 * 60);

    const record = outbox.enqueue({
      id: 'outbox-3',
      aggregateId: 'voice:session-2',
      eventType: 'resume',
      payload: { seq: 9 },
      now
    });

    expect(new Date(record.expiresAt).getTime()).toBe(now.getTime() + MONGO_OUTBOX_TTL_MS);
    expect(outbox.advance('outbox-3', 'dispatched').status).toBe('dispatched');
    expect(outbox.advance('outbox-3', 'acked').status).toBe('acked');
    expect(() => outbox.advance('outbox-3', 'pending')).toThrow('Invalid outbox transition');

    expect(outbox.sweepExpired(new Date(now.getTime() + MONGO_OUTBOX_TTL_MS + 1))).toBe(1);
    expect(outbox.get('outbox-3')).toBeUndefined();
  });
});
