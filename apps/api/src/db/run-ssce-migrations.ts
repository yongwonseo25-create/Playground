import fs from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS __ssce_migrations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

function splitSqlStatements(sql: string) {
  return sql
    .split(/;\s*\r?\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function applyMigrations() {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });
  const currentFilePath = fileURLToPath(import.meta.url);
  const migrationDir = path.join(path.dirname(currentFilePath), 'migrations');

  // PostgreSQL 전용으로 로직 수정 (AUTOINCREMENT -> SERIAL)
  await prisma.$executeRawUnsafe(MIGRATION_TABLE_SQL);

  const appliedRows = (await prisma.$queryRawUnsafe('SELECT name FROM __ssce_migrations ORDER BY name ASC')) as Array<{
    name: string;
  }>;
  const applied = new Set(appliedRows.map((row) => row.name));
  
  if (!fs.existsSync(migrationDir)) {
    console.log('[MIGRATE] No migrations directory found. Skipping...');
    await prisma.$disconnect();
    return;
  }

  const files = (await readdir(migrationDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    console.log(`[MIGRATE] Applying migration: ${file}`);
    const sql = await readFile(path.join(migrationDir, file), 'utf8');
    const statements = splitSqlStatements(sql);

    await prisma.$transaction(async (tx) => {
      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement);
      }

      // SQLite (?) -> PostgreSQL ($1)
      await tx.$executeRawUnsafe('INSERT INTO __ssce_migrations (name) VALUES ($1)', file);
    });
  }

  await prisma.$disconnect();
}

void applyMigrations().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
