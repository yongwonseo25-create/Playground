import type { CacheStore } from '@/server/cache/v3-redis';

type MemoryCacheState = Map<string, string>;

function getSharedMemoryCacheState(): MemoryCacheState {
  const globalState = globalThis as typeof globalThis & {
    __voxeraV3MemoryCacheState?: MemoryCacheState;
  };

  if (!globalState.__voxeraV3MemoryCacheState) {
    globalState.__voxeraV3MemoryCacheState = new Map();
  }

  return globalState.__voxeraV3MemoryCacheState;
}

export function createMemoryCacheStore(state: MemoryCacheState = getSharedMemoryCacheState()): CacheStore {
  return {
    async get(key) {
      return state.get(key) ?? null;
    },
    async set(key, value, options) {
      if (options.onlyIfAbsent && state.has(key)) {
        return false;
      }

      state.set(key, value);
      return true;
    },
    async del(key) {
      state.delete(key);
    }
  };
}

export function resetMemoryCacheStore(): void {
  getSharedMemoryCacheState().clear();
}
