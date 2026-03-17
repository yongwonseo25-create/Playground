export function isMemoryDatabaseRuntime(databaseUrl: string | undefined = process.env.DATABASE_URL): boolean {
  return typeof databaseUrl === 'string' && databaseUrl.startsWith('memory://');
}

export function isMemoryRedisRuntime(redisUrl: string | undefined = process.env.REDIS_URL): boolean {
  return typeof redisUrl === 'string' && redisUrl.startsWith('memory://');
}
