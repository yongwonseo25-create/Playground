import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS __ssce_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

function splitSqlStatements(sql: string) {
  return sql
    .split(/;\s*\r?\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.SSCE_DATABASE_URL?.trim() ||
    null
  );
}

function isLoopbackDatabaseUrl(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

async function applyMigrations() {
  const databaseUrl = resolveDatabaseUrl();

  if (!databaseUrl) {
    process.stdout.write(
      '[ssce-migrate] DATABASE_URL not set; skipped PostgreSQL 16+ migration replay.\n'
    );
    return;
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });
  const currentFilePath = fileURLToPath(import.meta.url);
  const migrationDir = path.join(path.dirname(currentFilePath), 'migrations');

  try {
    await prisma.$executeRawUnsafe(MIGRATION_TABLE_SQL);

    const appliedRows = (await prisma.$queryRawUnsafe(
      'SELECT name FROM __ssce_migrations ORDER BY name ASC'
    )) as Array<{ name: string }>;
    const applied = new Set(appliedRows.map((row) => row.name));
    const files = (await readdir(migrationDir)).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await readFile(path.join(migrationDir, file), 'utf8');
      const statements = splitSqlStatements(sql);

      await prisma.$transaction(async (tx) => {
        for (const statement of statements) {
          await tx.$executeRawUnsafe(statement);
        }

        await tx.$executeRawUnsafe(
          `INSERT INTO __ssce_migrations (name) VALUES ('${escapeSqlLiteral(file)}')`
        );
      });
    }
  } catch (error) {
    if (isLoopbackDatabaseUrl(databaseUrl) && process.env.NODE_ENV !== 'production') {
      process.stdout.write(
        `[ssce-migrate] PostgreSQL not reachable at ${databaseUrl}; skipped migration replay in local dev/test mode.\n`
      );
      return;
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void applyMigrations().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
