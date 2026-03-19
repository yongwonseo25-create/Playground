import { createClient } from 'redis';
import { getV4ServerEnv } from '@/server/v4/shared/env';

type StreamEntry = {
  id: string;
  fields: Record<string, string>;
};

export interface V4RuntimeStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  xAdd(stream: string, fields: Record<string, string>): Promise<string>;
  xRead(stream: string, afterId: string, count: number): Promise<StreamEntry[]>;
  zAdd(key: string, score: number, value: string): Promise<void>;
  zRangeByScore(key: string, maxScore: number, limit: number): Promise<string[]>;
  zRem(key: string, value: string): Promise<void>;
  close(): Promise<void>;
}

type MemoryValue = {
  value: string;
  expiresAt: number | null;
};

class MemoryRuntimeStore implements V4RuntimeStore {
  private readonly values = new Map<string, MemoryValue>();
  private readonly streams = new Map<string, StreamEntry[]>();
  private readonly zsets = new Map<string, Array<{ score: number; value: string }>>();
  private streamCounter = 0;

  private cleanupKey(key: string): void {
    const entry = this.values.get(key);
    if (!entry) {
      return;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.cleanupKey(key);
    return this.values.get(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.values.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    });
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    this.cleanupKey(key);
    if (this.values.has(key)) {
      return false;
    }

    await this.set(key, value, ttlSeconds);
    return true;
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.values.delete(key);
    }
  }

  async xAdd(stream: string, fields: Record<string, string>): Promise<string> {
    const entries = this.streams.get(stream) ?? [];
    this.streamCounter += 1;
    const id = `${Date.now()}-${this.streamCounter}`;
    entries.push({
      id,
      fields: { ...fields }
    });
    this.streams.set(stream, entries);
    return id;
  }

  async xRead(stream: string, afterId: string, count: number): Promise<StreamEntry[]> {
    const entries = this.streams.get(stream) ?? [];
    const nextEntries = entries.filter((entry) => compareStreamIds(entry.id, afterId) > 0);
    return nextEntries.slice(0, count).map((entry) => ({
      id: entry.id,
      fields: { ...entry.fields }
    }));
  }

  async zAdd(key: string, score: number, value: string): Promise<void> {
    const entries = this.zsets.get(key) ?? [];
    const filtered = entries.filter((entry) => entry.value !== value);
    filtered.push({ score, value });
    filtered.sort((left, right) => left.score - right.score);
    this.zsets.set(key, filtered);
  }

  async zRangeByScore(key: string, maxScore: number, limit: number): Promise<string[]> {
    const entries = this.zsets.get(key) ?? [];
    return entries
      .filter((entry) => entry.score <= maxScore)
      .slice(0, limit)
      .map((entry) => entry.value);
  }

  async zRem(key: string, value: string): Promise<void> {
    const entries = this.zsets.get(key) ?? [];
    this.zsets.set(
      key,
      entries.filter((entry) => entry.value !== value)
    );
  }

  async close(): Promise<void> {
    this.values.clear();
    this.streams.clear();
    this.zsets.clear();
    this.streamCounter = 0;
  }
}

type GenericRedisClient = ReturnType<typeof createClient>;

class RedisRuntimeStore implements V4RuntimeStore {
  private readonly client: GenericRedisClient;

  constructor(client: GenericRedisClient) {
    this.client = client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, { EX: ttlSeconds });
      return;
    }

    await this.client.set(key, value);
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, {
      EX: ttlSeconds,
      NX: true
    });
    return result === 'OK';
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    await this.client.del(keys);
  }

  async xAdd(stream: string, fields: Record<string, string>): Promise<string> {
    const command = ['XADD', stream, '*', ...flattenFields(fields)];
    const result = await this.client.sendCommand(command);
    return String(result);
  }

  async xRead(stream: string, afterId: string, count: number): Promise<StreamEntry[]> {
    const raw = await this.client.sendCommand([
      'XREAD',
      'COUNT',
      String(count),
      'STREAMS',
      stream,
      afterId
    ]);

    return parseXReadResult(raw);
  }

  async zAdd(key: string, score: number, value: string): Promise<void> {
    await this.client.sendCommand(['ZADD', key, String(score), value]);
  }

  async zRangeByScore(key: string, maxScore: number, limit: number): Promise<string[]> {
    const raw = await this.client.sendCommand([
      'ZRANGEBYSCORE',
      key,
      '-inf',
      String(maxScore),
      'LIMIT',
      '0',
      String(limit)
    ]);

    return Array.isArray(raw) ? raw.map((entry) => String(entry)) : [];
  }

  async zRem(key: string, value: string): Promise<void> {
    await this.client.sendCommand(['ZREM', key, value]);
  }

  async close(): Promise<void> {
    await this.client.quit().catch(async () => {
      await this.client.disconnect();
    });
  }
}

function compareStreamIds(left: string, right: string): number {
  const [leftMs = '0', leftSeq = '0'] = left.split('-');
  const [rightMs = '0', rightSeq = '0'] = right.split('-');
  const leftTime = Number.parseInt(leftMs, 10);
  const rightTime = Number.parseInt(rightMs, 10);

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return Number.parseInt(leftSeq, 10) - Number.parseInt(rightSeq, 10);
}

function flattenFields(fields: Record<string, string>): string[] {
  return Object.entries(fields).flatMap(([key, value]) => [key, value]);
}

function parseStreamFields(raw: unknown): Record<string, string> {
  if (!Array.isArray(raw)) {
    return {};
  }

  const fields: Record<string, string> = {};
  for (let index = 0; index < raw.length; index += 2) {
    const key = raw[index];
    const value = raw[index + 1];
    if (typeof key === 'string' || typeof key === 'number') {
      fields[String(key)] = value === undefined || value === null ? '' : String(value);
    }
  }

  return fields;
}

function parseXReadResult(raw: unknown): StreamEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const streamResult = raw[0];
  if (!Array.isArray(streamResult) || streamResult.length < 2 || !Array.isArray(streamResult[1])) {
    return [];
  }

  const items = streamResult[1];
  return items.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) {
      return [];
    }

    return [
      {
        id: String(entry[0]),
        fields: parseStreamFields(entry[1])
      }
    ];
  });
}

let sharedStore: V4RuntimeStore | null = null;
let sharedStorePromise: Promise<V4RuntimeStore> | null = null;

async function createRuntimeStore(): Promise<V4RuntimeStore> {
  const env = getV4ServerEnv();

  if (env.REDIS_URL.startsWith('memory://')) {
    return new MemoryRuntimeStore();
  }

  const client = createClient({
    url: env.REDIS_URL
  });

  await client.connect();
  return new RedisRuntimeStore(client);
}

export async function getV4RuntimeStore(): Promise<V4RuntimeStore> {
  if (sharedStore) {
    return sharedStore;
  }

  if (!sharedStorePromise) {
    sharedStorePromise = createRuntimeStore().then((store) => {
      sharedStore = store;
      return store;
    });
  }

  return sharedStorePromise;
}

export async function resetV4RuntimeStoreForTests(): Promise<void> {
  if (sharedStore) {
    await sharedStore.close();
  }

  sharedStore = null;
  sharedStorePromise = null;
}
