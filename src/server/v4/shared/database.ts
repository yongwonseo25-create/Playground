import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { getV4ServerEnv } from '@/server/v4/shared/env';

let sharedPool: Pool | null = null;
let sharedPoolPromise: Promise<Pool> | null = null;
let migrationPromise: Promise<void> | null = null;

async function createPool(): Promise<Pool> {
  const env = getV4ServerEnv();

  if (env.DATABASE_URL.startsWith('pgmem://')) {
    const { newDb, DataType } = await import('pg-mem');
    const memoryDb = newDb({ autoCreateForeignKeyIndices: true });

    memoryDb.public.registerFunction({
      name: 'version',
      returns: DataType.text,
      implementation: () => 'pg-mem'
    });

    const { Pool: MemoryPool } = memoryDb.adapters.createPg();
    return new MemoryPool() as unknown as Pool;
  }

  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 5
  });
}

async function getMigrationSql(): Promise<string> {
  const migrationPath = path.join(
    process.cwd(),
    'src',
    'server',
    'v4',
    'shared',
    'migrations',
    '001_v4_orchestration.sql'
  );

  return readFile(migrationPath, 'utf8');
}

export async function getV4Pool(): Promise<Pool> {
  if (sharedPool) {
    return sharedPool;
  }

  if (!sharedPoolPromise) {
    sharedPoolPromise = createPool().then((pool) => {
      sharedPool = pool;
      return pool;
    });
  }

  return sharedPoolPromise;
}

export async function ensureV4Schema(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const pool = await getV4Pool();
      const sql = await getMigrationSql();
      await pool.query(sql);
    })();
  }

  return migrationPromise;
}

export async function queryV4<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<QueryResult<T>> {
  await ensureV4Schema();
  const pool = await getV4Pool();
  return pool.query<T>(text, [...values]);
}

export async function withV4Transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureV4Schema();
  const pool = await getV4Pool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function resetV4DatabaseForTests(): Promise<void> {
  if (sharedPool) {
    await sharedPool.end().catch(() => {});
  }

  sharedPool = null;
  sharedPoolPromise = null;
  migrationPromise = null;
}
