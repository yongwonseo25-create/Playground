import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../utils/encryption-service';

const globalForSsce = globalThis as typeof globalThis & {
  __voxeraSscePrisma?: PrismaClient;
};

/**
 * [Phase 6] VOXERA 고성능 14모듈 인프라 최종 전력망
 * [Auditor Fix]: Transparent OAuth Encryption 필드 처리
 */
export function getSscePrismaClient() {
  if (!globalForSsce.__voxeraSscePrisma) {
    const baseClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });

    // Auditor Fix: Prisma Extension을 통한 투명 암호화 필터
    globalForSsce.__voxeraSscePrisma = baseClient.$extends({
      result: {
        userIntegration: {
          accessTokenEncrypted: {
            needs: { accessTokenEncrypted: true },
            compute(model) {
              try {
                // Read 시 자동 복호화 (Transparent Decryption)
                return EncryptionService.decrypt(model.accessTokenEncrypted);
              } catch {
                return model.accessTokenEncrypted; // 실패 시 평문 반환 (마이그레이션 호환)
              }
            },
          },
        },
      },
      query: {
        userIntegration: {
          async create({ args, query }) {
            // Write 시 자동 암호화
            if (args.data.accessTokenEncrypted) {
              args.data.accessTokenEncrypted = EncryptionService.encrypt(args.data.accessTokenEncrypted);
            }
            return query(args);
          },
          async update({ args, query }) {
            if (args.data.accessTokenEncrypted && typeof args.data.accessTokenEncrypted === 'string') {
              args.data.accessTokenEncrypted = EncryptionService.encrypt(args.data.accessTokenEncrypted);
            }
            return query(args);
          },
        },
      },
    }) as any;
  }

  return globalForSsce.__voxeraSscePrisma!;
}

export async function resetSsceDatabase(prisma = getSscePrismaClient()) {
  await prisma.referenceEdge.deleteMany();
  await prisma.styleEvent.deleteMany();
  await prisma.styleSignature.deleteMany();
  await prisma.artifact.deleteMany();
}
