import type { CacheStore } from '@/server/cache/v3-redis';
import { createRedisCacheStore } from '@/server/cache/v3-redis';
import { getV3CacheEnv } from '@/server/config/v3-env';

const USER_CREDITS_KEY_PREFIX = 'v3:credits:';

function buildCreditsKey(userId: number): string {
  return `${USER_CREDITS_KEY_PREFIX}${userId}`;
}

export async function getCachedUserCredits(
  userId: number,
  store: CacheStore = createRedisCacheStore()
): Promise<number | null> {
  const raw = await store.get(buildCreditsKey(userId));
  if (raw === null) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function setCachedUserCredits(
  userId: number,
  credits: number,
  store: CacheStore = createRedisCacheStore()
): Promise<void> {
  const env = getV3CacheEnv();
  await store.set(buildCreditsKey(userId), String(credits), {
    ttlSeconds: env.USER_CREDITS_CACHE_TTL_SEC
  });
}

export async function invalidateCachedUserCredits(
  userId: number,
  store: CacheStore = createRedisCacheStore()
): Promise<void> {
  await store.del(buildCreditsKey(userId));
}
