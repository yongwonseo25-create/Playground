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

export class InMemoryV4MemoryStore {
  private readonly records = new Map<string, V4MemoryRecord>();

  upsert(input: {
    id: string;
    userId: number;
    kind: V4MemoryKind;
    content: string;
    now?: Date;
  }): V4MemoryRecord {
    const now = input.now ?? new Date();
    const ttlMs = input.kind === 'short_term' ? SHORT_TERM_MEMORY_TTL_MS : PREFERENCE_MEMORY_TTL_MS;
    const record: V4MemoryRecord = {
      id: input.id,
      userId: input.userId,
      kind: input.kind,
      content: input.content,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString()
    };
    this.records.set(record.id, record);
    return record;
  }

  listByUser(userId: number): V4MemoryRecord[] {
    return [...this.records.values()].filter((record) => record.userId === userId);
  }

  forgetExpired(now: Date = new Date()): number {
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

  deleteUser(userId: number): number {
    let removed = 0;
    for (const [id, record] of this.records.entries()) {
      if (record.userId === userId) {
        this.records.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}

let sharedMemoryStore: InMemoryV4MemoryStore | null = null;

export function getSharedV4MemoryStore(): InMemoryV4MemoryStore {
  if (!sharedMemoryStore) {
    sharedMemoryStore = new InMemoryV4MemoryStore();
  }
  return sharedMemoryStore;
}

export function resetSharedV4MemoryStore(): void {
  sharedMemoryStore = null;
}
