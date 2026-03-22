import { V4_IDEMPOTENCY_TTL_HOURS } from '@/shared/contracts/v4-infra';
import { createNeonHttpOneShotClient, type NeonHttpOneShotClient } from '@/server/v4/neon-http';

export type IdempotencyReservation = {
  reserved: boolean;
  expiresAt: string;
  deletedExpired: number;
};

export type IdempotencyDeletionResult = {
  deletedCount: number;
};

export type IdempotencyKeyInput = {
  idempotencyKey: string;
  scope: string;
  ttlHours: number;
  now?: Date;
};

export interface IdempotencyStore {
  reserve(input: IdempotencyKeyInput): Promise<IdempotencyReservation>;
  deleteExpired(now?: Date): Promise<IdempotencyDeletionResult>;
}

type StoredIdempotencyRecord = {
  expiresAt: string;
};

function requireFixedTtlHours(ttlHours: number): void {
  if (!Number.isInteger(ttlHours) || ttlHours !== V4_IDEMPOTENCY_TTL_HOURS) {
    throw new Error(`[v4-idempotency] ttlHours must be exactly ${V4_IDEMPOTENCY_TTL_HOURS}.`);
  }
}

function toIsoString(now: Date): string {
  return now.toISOString();
}

function addHours(now: Date, ttlHours: number): Date {
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
}

function recordKey(scope: string, idempotencyKey: string): string {
  return `${scope}::${idempotencyKey}`;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, StoredIdempotencyRecord>();

  async reserve(input: IdempotencyKeyInput): Promise<IdempotencyReservation> {
    const now = input.now ?? new Date();
    const deletedExpired = await this.deleteExpired(now);
    requireFixedTtlHours(input.ttlHours);

    const key = recordKey(input.scope, input.idempotencyKey);
    const existing = this.records.get(key);
    const expiresAt = addHours(now, input.ttlHours).toISOString();

    if (existing) {
      return {
        reserved: false,
        expiresAt: existing.expiresAt,
        deletedExpired: deletedExpired.deletedCount
      };
    }

    this.records.set(key, { expiresAt });

    return {
      reserved: true,
      expiresAt,
      deletedExpired: deletedExpired.deletedCount
    };
  }

  async deleteExpired(now: Date = new Date()): Promise<IdempotencyDeletionResult> {
    let deletedCount = 0;
    for (const [key, record] of this.records.entries()) {
      if (new Date(record.expiresAt).getTime() <= now.getTime()) {
        this.records.delete(key);
        deletedCount += 1;
      }
    }

    return { deletedCount };
  }
}

export class NeonIdempotencyStore implements IdempotencyStore {
  constructor(private readonly neonClient: NeonHttpOneShotClient) {}

  async reserve(input: IdempotencyKeyInput): Promise<IdempotencyReservation> {
    const now = input.now ?? new Date();
    const deletedExpired = await this.deleteExpired(now);
    requireFixedTtlHours(input.ttlHours);

    const expiresAt = addHours(now, input.ttlHours);
    const result = await this.neonClient.query({
      sql: `
        INSERT INTO v4_idempotency_keys (idempotency_key, scope, created_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (idempotency_key, scope) DO NOTHING
        RETURNING expires_at
      `,
      params: [input.idempotencyKey, input.scope, now.toISOString()]
    });

    if (result.rowCount === 0) {
      const existing = await this.neonClient.query({
        sql: `
          SELECT expires_at
          FROM v4_idempotency_keys
          WHERE idempotency_key = $1
            AND scope = $2
          LIMIT 1
        `,
        params: [input.idempotencyKey, input.scope]
      });

      return {
        reserved: false,
        expiresAt: typeof existing.rows[0]?.expires_at === 'string' ? existing.rows[0].expires_at : expiresAt.toISOString(),
        deletedExpired: deletedExpired.deletedCount
      };
    }

    return {
      reserved: true,
      expiresAt: typeof result.rows[0]?.expires_at === 'string' ? result.rows[0].expires_at : expiresAt.toISOString(),
      deletedExpired: deletedExpired.deletedCount
    };
  }

  async deleteExpired(now: Date = new Date()): Promise<IdempotencyDeletionResult> {
    const result = await this.neonClient.query({
      sql: `
        DELETE FROM v4_idempotency_keys
        WHERE expires_at <= $1
        RETURNING id
      `,
      params: [now.toISOString()]
    });

    return { deletedCount: result.rowCount };
  }
}

export function createMemoryIdempotencyStore(): MemoryIdempotencyStore {
  return new MemoryIdempotencyStore();
}

export function createNeonIdempotencyStore(baseUrl: string, apiKey: string): NeonIdempotencyStore {
  return new NeonIdempotencyStore(createNeonHttpOneShotClient({ baseUrl, apiKey }));
}
