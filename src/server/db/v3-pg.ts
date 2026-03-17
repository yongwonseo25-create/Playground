import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { getV3ServerEnv } from '@/server/config/v3-env';

export type DbQueryResult<T extends QueryResultRow = QueryResultRow> = {
  rowCount: number;
  rows: T[];
};

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<DbQueryResult<T>>;
};

let sharedPool: Pool | null = null;

export function getV3Pool(): Pool {
  if (!sharedPool) {
    const env = getV3ServerEnv();
    sharedPool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      statement_timeout: 30_000
    });
  }

  return sharedPool;
}

export async function withV3Client<T>(
  work: (client: PoolClient) => Promise<T>,
  pool: Pool = getV3Pool()
): Promise<T> {
  const client = await pool.connect();

  try {
    return await work(client);
  } finally {
    client.release();
  }
}

export async function withSerializableTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
  pool: Pool = getV3Pool()
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: readonly unknown[],
  pool: Pool = getV3Pool()
): Promise<DbQueryResult<T>> {
  const result = await pool.query<T>(text, values ? [...values] : undefined);
  return {
    rowCount: result.rowCount ?? 0,
    rows: result.rows
  };
}
