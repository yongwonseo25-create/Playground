import type { CacheStore } from '../../../src/server/cache/v3-redis';

export function createMemoryStore(): CacheStore {
  const storage = new Map<string, string>();

  return {
    async get(key) {
      return storage.get(key) ?? null;
    },
    async set(key, value, options) {
      if (options.onlyIfAbsent && storage.has(key)) {
        return false;
      }

      storage.set(key, value);
      return true;
    },
    async del(key) {
      storage.delete(key);
    }
  };
}
