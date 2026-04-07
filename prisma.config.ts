import { defineConfig } from 'prisma/config';

const localFallbackDatabaseUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localFallbackDatabaseUrl
  }
});
