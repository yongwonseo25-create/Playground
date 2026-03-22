const DAYS_TO_MS = 24 * 60 * 60 * 1000;

export const SHORT_TERM_MEMORY_TTL_MS = 14 * DAYS_TO_MS;
export const PREFERENCE_MEMORY_TTL_MS = 90 * DAYS_TO_MS;
export const V4_MEMORY_COLLECTION_NAME = 'voxera_memory';
export const V4_MEMORY_TTL_INDEX_NAME = 'ttl_memory_expires_at';

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
          expiresAt: { bsonType: 'date' }
        }
      }
    },
    indexes: [
      {
        key: { expiresAt: 1 },
        name: V4_MEMORY_TTL_INDEX_NAME,
        expireAfterSeconds: 0
      },
      {
        key: { userId: 1, createdAt: -1 },
        name: 'memory_user_created_at'
      }
    ] satisfies MongoCollectionIndexDefinition[]
  };
}
