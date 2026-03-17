import type { CacheStore } from '@/server/cache/v3-redis';
import { createRedisCacheStore } from '@/server/cache/v3-redis';
import { getV3CacheEnv } from '@/server/config/v3-env';

const STT_DEDUPE_KEY_PREFIX = 'v3:stt:dedupe:';

function buildDedupeKey(clientRequestId: string): string {
  return `${STT_DEDUPE_KEY_PREFIX}${clientRequestId}`;
}

export async function reserveSttRequestId(
  clientRequestId: string,
  store: CacheStore = createRedisCacheStore()
): Promise<boolean> {
  const env = getV3CacheEnv();
  return store.set(buildDedupeKey(clientRequestId), 'processing', {
    ttlSeconds: env.STT_DEDUPE_TTL_SEC,
    onlyIfAbsent: true
  });
}
