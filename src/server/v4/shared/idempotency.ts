import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getV4ServerEnv } from '@/server/v4/shared/env';
import { getV4RuntimeStore } from '@/server/v4/shared/runtime-store';

const uuidSchema = z.string().uuid();

type IdempotencyCacheRecord = {
  status: number;
  body: unknown;
};

export type IdempotentJsonResult = {
  status: number;
  body: unknown;
  cacheTtlSeconds?: number;
};

function buildResponse(result: IdempotencyCacheRecord, idempotencyKey: string, cacheHit: boolean): NextResponse {
  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      'Cache-Control': 'no-store',
      'Idempotency-Key': idempotencyKey,
      'X-Idempotency-Cache': cacheHit ? 'hit' : 'miss'
    }
  });
}

function resultKey(scope: string, idempotencyKey: string): string {
  return `v4:idempotency:result:${scope}:${idempotencyKey}`;
}

function lockKey(scope: string, idempotencyKey: string): string {
  return `v4:idempotency:lock:${scope}:${idempotencyKey}`;
}

async function readCachedResult(scope: string, idempotencyKey: string): Promise<IdempotencyCacheRecord | null> {
  const store = await getV4RuntimeStore();
  const raw = await store.get(resultKey(scope, idempotencyKey));
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as IdempotencyCacheRecord;
}

export async function handleV4IdempotentJsonRequest(
  request: Request,
  scope: string,
  handler: (context: { idempotencyKey: string }) => Promise<IdempotentJsonResult>
): Promise<NextResponse> {
  const rawIdempotencyKey =
    request.headers.get('Idempotency-Key') ?? request.headers.get('X-Idempotency-Key');

  const parsedKey = uuidSchema.safeParse(rawIdempotencyKey);
  if (!parsedKey.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Idempotency-Key header is required and must be a UUID.',
        issues: []
      },
      { status: 400 }
    );
  }

  const idempotencyKey = parsedKey.data;
  const cachedResult = await readCachedResult(scope, idempotencyKey);
  if (cachedResult) {
    return buildResponse(cachedResult, idempotencyKey, true);
  }

  const env = getV4ServerEnv();
  const store = await getV4RuntimeStore();
  const acquiredLock = await store.setNx(
    lockKey(scope, idempotencyKey),
    JSON.stringify({
      startedAt: new Date().toISOString()
    }),
    Math.max(30, Math.min(env.V4_IDEMPOTENCY_TTL_SEC, 120))
  );

  if (!acquiredLock) {
    const concurrentCachedResult = await readCachedResult(scope, idempotencyKey);
    if (concurrentCachedResult) {
      return buildResponse(concurrentCachedResult, idempotencyKey, true);
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'A request with the same Idempotency-Key is already processing.',
        issues: []
      },
      {
        status: 409,
        headers: {
          'Idempotency-Key': idempotencyKey,
          'X-Idempotency-Cache': 'pending'
        }
      }
    );
  }

  try {
    const result = await handler({ idempotencyKey });
    const cacheRecord: IdempotencyCacheRecord = {
      status: result.status,
      body: result.body
    };

    await store.set(
      resultKey(scope, idempotencyKey),
      JSON.stringify(cacheRecord),
      result.cacheTtlSeconds ?? env.V4_IDEMPOTENCY_TTL_SEC
    );

    return buildResponse(cacheRecord, idempotencyKey, false);
  } finally {
    await store.del(lockKey(scope, idempotencyKey));
  }
}
