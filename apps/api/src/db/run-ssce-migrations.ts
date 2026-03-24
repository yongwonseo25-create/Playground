import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS __ssce_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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

  await prisma.$executeRawUnsafe(MIGRATION_TABLE_SQL);

  const appliedRows = (await prisma.$queryRawUnsafe('SELECT name FROM __ssce_migrations ORDER BY name ASC')) as Array<{
    name: string;
  }>;
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

      await tx.$executeRawUnsafe('INSERT INTO __ssce_migrations (name) VALUES (?)', file);
    });
  }

  await prisma.$disconnect();
}

void applyMigrations().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
