const HOURS_TO_MS = 60 * 60 * 1000;
export const MONGO_OUTBOX_TTL_MS = 24 * HOURS_TO_MS;
export const MONGO_OUTBOX_TTL_SECONDS = 24 * 60 * 60;
export const MONGO_OUTBOX_COLLECTION_NAME = 'voxera_realtime_outbox';

export type MongoOutboxStatus = 'pending' | 'dispatched' | 'acked';

export type MongoOutboxRecord = {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: MongoOutboxStatus;
  createdAt: string;
  expiresAt: string;
};

export type MongoCollectionIndexDefinition = {
  key: Record<string, 1 | -1>;
  name: string;
  expireAfterSeconds?: number;
};

export function computeMongoOutboxExpiresAt(now: Date): string {
  return new Date(now.getTime() + MONGO_OUTBOX_TTL_MS).toISOString();
}

export function buildMongoOutboxCollectionDefinition() {
  return {
    collectionName: MONGO_OUTBOX_COLLECTION_NAME,
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['id', 'aggregateId', 'eventType', 'status', 'createdAt', 'expiresAt'],
        properties: {
          id: { bsonType: 'string' },
          aggregateId: { bsonType: 'string' },
          eventType: { bsonType: 'string' },
          status: { enum: ['pending', 'dispatched', 'acked'] },
          createdAt: { bsonType: 'date' },
          expiresAt: { bsonType: 'date' }
        }
      }
    },
    indexes: [
      {
        key: { expiresAt: 1 },
        name: 'ttl_outbox_expires_at_24h',
        expireAfterSeconds: 0
      },
      {
        key: { aggregateId: 1, createdAt: -1 },
        name: 'outbox_aggregate_created_at'
      }
    ] satisfies MongoCollectionIndexDefinition[]
  };
}

const ALLOWED_TRANSITIONS: Record<MongoOutboxStatus, MongoOutboxStatus[]> = {
  pending: ['dispatched', 'acked'],
  dispatched: ['acked'],
  acked: []
};

export class InMemoryMongoOutbox {
  private readonly records = new Map<string, MongoOutboxRecord>();

  enqueue(input: {
    id: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    now?: Date;
  }): MongoOutboxRecord {
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

    if (!ALLOWED_TRANSITIONS[existing.status].includes(nextStatus)) {
      throw new Error(`Invalid outbox transition ${existing.status} -> ${nextStatus}.`);
    }

    const nextRecord = {
      ...existing,
      status: nextStatus
    };
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
