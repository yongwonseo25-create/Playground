import type { MemoryRecord } from '@/shared/contracts/v4-memory';
import {
  FIXED_PREFERENCE_MEMORY_TTL_DAYS,
  FIXED_SHORT_TERM_MEMORY_TTL_DAYS
} from '@/server/config/v4-memory-env';

export const V4_MEMORY_COLLECTION_NAME = 'voxera_memory';
export const V4_MEMORY_TTL_INDEX_NAME = 'ttl_memory_expires_at';

export type MongoCollectionIndexDefinition = {
  key: Record<string, 1 | -1>;
  name: string;
  expireAfterSeconds?: number;
};

export function computeV4MemoryExpiresAt(retentionClass: 'short_term' | 'preference', createdAt: Date): string {
  const ttlDays =
    retentionClass === 'preference' ? FIXED_PREFERENCE_MEMORY_TTL_DAYS : FIXED_SHORT_TERM_MEMORY_TTL_DAYS;
  return new Date(createdAt.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}

export function buildV4MemoryCollectionDefinition() {
  return {
    collectionName: V4_MEMORY_COLLECTION_NAME,
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['memoryId', 'userId', 'retentionClass', 'createdAt', 'expiresAt'],
        properties: {
          memoryId: { bsonType: 'string' },
          userId: { bsonType: 'int' },
          retentionClass: { enum: ['short_term', 'preference'] },
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
        key: { userId: 1, retentionClass: 1, createdAt: -1 },
        name: 'memory_user_retention_created_at'
      }
    ] satisfies MongoCollectionIndexDefinition[]
  };
}

type V4MemoryState = {
  records: Map<string, MemoryRecord>;
  userIndex: Map<number, Set<string>>;
};

function getSharedState(): V4MemoryState {
  const globalState = globalThis as typeof globalThis & {
    __voxeraV4MemoryState?: V4MemoryState;
  };

  if (!globalState.__voxeraV4MemoryState) {
    globalState.__voxeraV4MemoryState = {
      records: new Map(),
      userIndex: new Map()
    };
  }

  return globalState.__voxeraV4MemoryState;
}

function ensureUserIndex(state: V4MemoryState, userId: number): Set<string> {
  const existing = state.userIndex.get(userId);
  if (existing) {
    return existing;
  }

  const created = new Set<string>();
  state.userIndex.set(userId, created);
  return created;
}

export class V4MemoryStore {
  constructor(private readonly state: V4MemoryState = getSharedState()) {}

  purgeExpired(now = Date.now()): number {
    let purgedCount = 0;

    for (const [memoryId, record] of this.state.records.entries()) {
      if (Date.parse(record.expiresAt) <= now) {
        this.state.records.delete(memoryId);
        const userIds = this.state.userIndex.get(record.userId);
        userIds?.delete(memoryId);
        if (userIds && userIds.size === 0) {
          this.state.userIndex.delete(record.userId);
        }
        purgedCount += 1;
      }
    }

    return purgedCount;
  }

  upsert(records: MemoryRecord[]): MemoryRecord[] {
    const saved: MemoryRecord[] = [];

    for (const record of records) {
      this.state.records.set(record.memoryId, record);
      ensureUserIndex(this.state, record.userId).add(record.memoryId);
      saved.push(record);
    }

    return saved;
  }

  listByUser(userId: number, now = Date.now()): MemoryRecord[] {
    this.purgeExpired(now);
    const ids = this.state.userIndex.get(userId);
    if (!ids) {
      return [];
    }

    return [...ids]
      .map((memoryId) => this.state.records.get(memoryId))
      .filter((record): record is MemoryRecord => Boolean(record))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  deleteByUser(userId: number, memoryIds?: string[]): number {
    const ids = this.state.userIndex.get(userId);
    if (!ids || ids.size === 0) {
      return 0;
    }

    const targets = memoryIds && memoryIds.length > 0 ? new Set(memoryIds) : ids;
    let deletedCount = 0;

    for (const memoryId of targets) {
      const record = this.state.records.get(memoryId);
      if (!record || record.userId !== userId) {
        continue;
      }

      this.state.records.delete(memoryId);
      ids.delete(memoryId);
      deletedCount += 1;
    }

    if (ids.size === 0) {
      this.state.userIndex.delete(userId);
    }

    return deletedCount;
  }

  size(): number {
    return this.state.records.size;
  }

  reset(): void {
    this.state.records.clear();
    this.state.userIndex.clear();
  }
}

export function resetV4MemoryStore(): void {
  new V4MemoryStore().reset();
}
