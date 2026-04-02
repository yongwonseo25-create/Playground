import { PrismaClient, Provider, DeliveryStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * [VOXERA Multi-Channel Fan-out Service]
 * 1개의 AI 생성 요청이 들어오면, 이를 execution_requests에 기록하고
 * 대상 채널(notion, slack, kakao, email 등)에 맞게 delivery_jobs로 쪼개어
 * '단일 트랜잭션'으로 DB에 Insert 한다.
 */
export async function processMultiChannelFanOut(params: {
  workspaceId: string;
  userId: string;
  artifactKind: string;
  promptContent: string;
  destinations: Array<{ provider: Provider; recipientKey: string }>;
  payload: any;
}) {
  const { workspaceId, userId, artifactKind, promptContent, destinations, payload } = params;

  // 단일 트랜잭션 시작 (Zero-Loss 보장)
  return await prisma.$transaction(async (tx) => {
    // 1. Execution Request 생성
    const executionRequest = await tx.executionRequest.create({
      data: {
        workspaceId,
        userId,
        artifactKind,
        promptContent,
        metadataJson: JSON.stringify({ destinations }),
        status: 'PENDING',
      },
    });

    // 2. 각 목적지별로 Delivery Job 생성 (Fan-out)
    const deliveryJobs = await Promise.all(
      destinations.map((dest) => {
        const idempotencyKey = `vox_${executionRequest.id}_${dest.provider}_${uuidv4().slice(0, 8)}`;
        
        return tx.deliveryJob.create({
          data: {
            requestId: uuidv4(), // 추적용 고유 ID
            executionRequestId: executionRequest.id,
            provider: dest.provider,
            recipientKey: dest.recipientKey,
            idempotencyKey,
            status: DeliveryStatus.PENDING,
            payload: payload, // 전송할 실제 데이터
            workspaceId,
            userId,
          },
        });
      })
    );

    console.log(`[Fan-out Success] Request ${executionRequest.id} -> ${deliveryJobs.length} Jobs generated.`);
    
    return {
      executionRequestId: executionRequest.id,
      jobCount: deliveryJobs.length,
    };
  });
}
