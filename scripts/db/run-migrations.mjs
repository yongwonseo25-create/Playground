import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const localEnvPath = path.join(repoRoot, '.env.local');

if (typeof process.loadEnvFile === 'function' && existsSync(localEnvPath)) {
  process.loadEnvFile(localEnvPath);
}

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.V3_POSTGRES_USER ?? 'voxera';
  const password = process.env.V3_POSTGRES_PASSWORD ?? 'voxera';
  const database = process.env.V3_POSTGRES_DB ?? 'voxera';
  return `postgresql://${user}:${password}@localhost:5432/${database}`;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function main() {
  const databaseUrl = buildDatabaseUrl();
  const migrationsDir = path.join(repoRoot, 'db', 'migrations');
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  if (filenames.length === 0) {
    console.log('[db:migrate] No SQL migrations found.');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await ensureMigrationTable(client);

    const { rows } = await client.query('SELECT filename FROM schema_migrations ORDER BY filename ASC');
    const applied = new Set(rows.map((row) => row.filename));

    for (const filename of filenames) {
      if (applied.has(filename)) {
        console.log(`[db:migrate] Skipping ${filename} (already applied).`);
        continue;
      }

      const sql = readFileSync(path.join(migrationsDir, filename), 'utf8').trim();
      if (!sql) {
        console.log(`[db:migrate] Skipping ${filename} (empty file).`);
        continue;
      }

      console.log(`[db:migrate] Applying ${filename}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('[db:migrate] Completed successfully.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[db:migrate] Failed: ${message}`);
  process.exitCode = 1;
});
