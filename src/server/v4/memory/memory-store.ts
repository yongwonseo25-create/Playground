const DAYS_TO_MS = 24 * 60 * 60 * 1000;

export const SHORT_TERM_MEMORY_TTL_MS = 14 * DAYS_TO_MS;
export const PREFERENCE_MEMORY_TTL_MS = 90 * DAYS_TO_MS;
export const SHORT_TERM_MEMORY_TTL_SECONDS = 14 * 24 * 60 * 60;
export const PREFERENCE_MEMORY_TTL_SECONDS = 90 * 24 * 60 * 60;
export const V4_MEMORY_COLLECTION_NAME = 'voxera_memory';

export type V4MemoryKind = 'short_term' | 'preference';

export type V4MemoryRecord = {
  id: string;
  userId: number;
  kind: V4MemoryKind;
  content: string;
  createdAt: string;
  expiresAt: string;
};

export type MongoCollectionIndexDefinition = {
  key: Record<string, 1 | -1>;
  name: string;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
};

export type MongoIndexableCollection = {
  createIndex: (
    key: Record<string, 1 | -1>,
    options: {
      name: string;
      expireAfterSeconds?: number;
      partialFilterExpression?: Record<string, unknown>;
    }
  ) => Promise<string> | string;
};

export function computeV4MemoryExpiresAt(kind: V4MemoryKind, now: Date): string {
  const ttlMs = kind === 'short_term' ? SHORT_TERM_MEMORY_TTL_MS : PREFERENCE_MEMORY_TTL_MS;
  return new Date(now.getTime() + ttlMs).toISOString();
}

export function buildV4MemoryCollectionDefinition() {
  return {
    collectionName: V4_MEMORY_COLLECTION_NAME,
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['id', 'userId', 'kind', 'createdAt', 'expiresAt'],
        properties: {
          id: { bsonType: 'string' },
          userId: { bsonType: 'int' },
          kind: { enum: ['short_term', 'preference'] },
          createdAt: { bsonType: 'date' },
          expiresAt: { bsonType: 'date' },
          shortTermCreatedAt: { bsonType: ['date', 'null'] },
          preferenceCreatedAt: { bsonType: ['date', 'null'] }
        }
      }
    },
    indexes: [
      {
        key: { shortTermCreatedAt: 1 },
        name: 'ttl_memory_short_term_created_at_14d',
        expireAfterSeconds: SHORT_TERM_MEMORY_TTL_SECONDS,
        partialFilterExpression: { kind: 'short_term' }
      },
      {
        key: { preferenceCreatedAt: 1 },
        name: 'ttl_memory_preference_created_at_90d',
        expireAfterSeconds: PREFERENCE_MEMORY_TTL_SECONDS,
        partialFilterExpression: { kind: 'preference' }
      },
      {
        key: { userId: 1, createdAt: -1 },
        name: 'memory_user_created_at'
      }
    ] satisfies MongoCollectionIndexDefinition[]
  };
}

export async function createV4MemoryIndexes(collection: MongoIndexableCollection): Promise<string[]> {
  return await Promise.all([
    collection.createIndex(
      { shortTermCreatedAt: 1 },
      {
        name: 'ttl_memory_short_term_created_at_14d',
        expireAfterSeconds: SHORT_TERM_MEMORY_TTL_SECONDS,
        partialFilterExpression: { kind: 'short_term' }
      }
    ),
    collection.createIndex(
      { preferenceCreatedAt: 1 },
      {
        name: 'ttl_memory_preference_created_at_90d',
        expireAfterSeconds: PREFERENCE_MEMORY_TTL_SECONDS,
        partialFilterExpression: { kind: 'preference' }
      }
    ),
    collection.createIndex({ userId: 1, createdAt: -1 }, { name: 'memory_user_created_at' })
  ]);
}
