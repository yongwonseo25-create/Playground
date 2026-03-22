import {
  assertMongoOutboxTransition,
  computeMongoOutboxExpiresAt,
  type MongoOutboxRecord,
  type MongoOutboxStatus,
  type RealtimeOutboxEnqueueInput,
  type RealtimeOutboxStore
} from '@/server/v4/realtime/mongo-outbox';

export class InMemoryMongoOutbox implements RealtimeOutboxStore {
  private readonly records = new Map<string, MongoOutboxRecord>();

  enqueue(input: RealtimeOutboxEnqueueInput): MongoOutboxRecord {
    const now = input.now ?? new Date();
    const record: MongoOutboxRecord = {
      id: input.id,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: computeMongoOutboxExpiresAt(now)
    };

    this.records.set(record.id, record);
    return record;
  }

  advance(id: string, nextStatus: MongoOutboxStatus): MongoOutboxRecord {
    const existing = this.records.get(id);
    if (!existing) {
      throw new Error(`Mongo outbox record ${id} does not exist.`);
    }

    assertMongoOutboxTransition(existing.status, nextStatus);
    const nextRecord = { ...existing, status: nextStatus };
    this.records.set(id, nextRecord);
    return nextRecord;
  }

  get(id: string): MongoOutboxRecord | undefined {
    return this.records.get(id);
  }

  sweepExpired(now: Date = new Date()): number {
    let removed = 0;
    const nowMs = now.getTime();

    for (const [id, record] of this.records.entries()) {
      if (new Date(record.expiresAt).getTime() <= nowMs) {
        this.records.delete(id);
        removed += 1;
      }
    }

    return removed;
  }
}
