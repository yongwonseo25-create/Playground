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

export type MongoIndexableCollection = {
  createIndex: (
    key: Record<string, 1 | -1>,
    options: { name: string; expireAfterSeconds?: number }
  ) => Promise<string> | string;
};

export type RealtimeOutboxEnqueueInput = {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  now?: Date;
};

export interface RealtimeOutboxStore {
  enqueue(input: RealtimeOutboxEnqueueInput): MongoOutboxRecord;
}

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
        key: { createdAt: 1 },
        name: 'ttl_outbox_created_at_24h',
        expireAfterSeconds: MONGO_OUTBOX_TTL_SECONDS
      },
      {
        key: { aggregateId: 1, createdAt: -1 },
        name: 'outbox_aggregate_created_at'
      }
    ] satisfies MongoCollectionIndexDefinition[]
  };
}

export async function createMongoOutboxIndexes(collection: MongoIndexableCollection): Promise<string[]> {
  return await Promise.all([
    collection.createIndex(
      { createdAt: 1 },
      { name: 'ttl_outbox_created_at_24h', expireAfterSeconds: MONGO_OUTBOX_TTL_SECONDS }
    ),
    collection.createIndex({ aggregateId: 1, createdAt: -1 }, { name: 'outbox_aggregate_created_at' })
  ]);
}

const ALLOWED_TRANSITIONS: Record<MongoOutboxStatus, MongoOutboxStatus[]> = {
  pending: ['dispatched', 'acked'],
  dispatched: ['acked'],
  acked: []
};

export function assertMongoOutboxTransition(
  currentStatus: MongoOutboxStatus,
  nextStatus: MongoOutboxStatus
): void {
  if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new Error(`Invalid outbox transition ${currentStatus} -> ${nextStatus}.`);
  }
}
