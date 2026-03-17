import { createClient } from 'redis';
import { createMemoryCacheStore } from '@/server/cache/memory-cache-store';
import { getV3ServerEnv } from '@/server/config/v3-env';
import { isMemoryRedisRuntime } from '@/server/db/v3-runtime';

export type CacheStore = {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options: {
      ttlSeconds: number;
      onlyIfAbsent?: boolean;
    }
  ): Promise<boolean>;
  del(key: string): Promise<void>;
};

type RedisClient = ReturnType<typeof createClient>;

let sharedRedisClient: RedisClient | null = null;
let sharedConnectPromise: Promise<RedisClient> | null = null;

export async function getRedisClient(): Promise<RedisClient> {
  if (sharedRedisClient?.isOpen) {
    return sharedRedisClient;
  }

  if (!sharedConnectPromise) {
    const env = getV3ServerEnv();
    const client = createClient({
      url: env.REDIS_URL
    });

    sharedConnectPromise = client.connect().then(() => {
      sharedRedisClient = client;
      return client;
    });
  }

  return sharedConnectPromise;
}

export function createRedisCacheStore(clientFactory: () => Promise<RedisClient> = getRedisClient): CacheStore {
  if (isMemoryRedisRuntime(process.env.REDIS_URL)) {
    return createMemoryCacheStore();
  }

  return {
    async get(key) {
      const client = await clientFactory();
      return client.get(key);
    },
    async set(key, value, options) {
      const client = await clientFactory();
      const result = await client.set(key, value, {
        EX: options.ttlSeconds,
        NX: options.onlyIfAbsent ? true : undefined
      });
      return result === 'OK';
    },
    async del(key) {
      const client = await clientFactory();
      await client.del(key);
    }
  };
}
