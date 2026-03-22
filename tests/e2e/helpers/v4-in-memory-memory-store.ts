import {
  computeV4MemoryExpiresAt,
  type V4MemoryKind,
  type V4MemoryRecord
} from '@/server/v4/memory/memory-store';

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
    const record: V4MemoryRecord = {
      id: input.id,
      userId: input.userId,
      kind: input.kind,
      content: input.content,
      createdAt: now.toISOString(),
      expiresAt: computeV4MemoryExpiresAt(input.kind, now)
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
