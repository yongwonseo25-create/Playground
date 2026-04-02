import { PrismaClient } from '@prisma/client';

const globalForSsce = globalThis as typeof globalThis & {
  __voxeraSscePrisma?: PrismaClient;
};

export function getSscePrismaClient(): PrismaClient {
  if (!globalForSsce.__voxeraSscePrisma) {
    globalForSsce.__voxeraSscePrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
  }

  return globalForSsce.__voxeraSscePrisma;
}

export async function resetSsceDatabase(prisma = getSscePrismaClient()) {
  await prisma.referenceEdge.deleteMany();
  await prisma.styleEvent.deleteMany();
  await prisma.styleSignature.deleteMany();
  await prisma.artifact.deleteMany();
}
