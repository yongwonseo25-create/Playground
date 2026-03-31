import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as typeof globalThis & {
  __voxeraPrisma?: PrismaClient;
};

export function getPrismaClient() {
  if (!globalForPrisma.__voxeraPrisma) {
    globalForPrisma.__voxeraPrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
    });
  }

  return globalForPrisma.__voxeraPrisma;
}
