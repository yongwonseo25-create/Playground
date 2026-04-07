import { PrismaClient } from '@prisma/client';

const DEFAULT_POSTGRES_URL = 'postgresql://voxera:voxera@127.0.0.1:5432/voxera?schema=public';

const globalForSsce = globalThis as typeof globalThis & {
  __voxeraSscePrisma?: PrismaClient;
};

function resolveDatasourceUrl() {
  return process.env.DATABASE_URL?.trim() || process.env.SSCE_DATABASE_URL?.trim() || DEFAULT_POSTGRES_URL;
}

export function createSscePrismaClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: resolveDatasourceUrl()
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });
}

export function getSscePrismaClient(): PrismaClient {
  if (!globalForSsce.__voxeraSscePrisma) {
    globalForSsce.__voxeraSscePrisma = createSscePrismaClient();
  }

  return globalForSsce.__voxeraSscePrisma;
}

export async function resetSsceDatabase(prisma = getSscePrismaClient()) {
  await prisma.outboxMessage.deleteMany();
  await prisma.billingTransaction.deleteMany();
  await prisma.billingAccount.deleteMany();
  await prisma.referenceEdge.deleteMany();
  await prisma.styleEvent.deleteMany();
  await prisma.styleSignature.deleteMany();
  await prisma.artifact.deleteMany();
}
