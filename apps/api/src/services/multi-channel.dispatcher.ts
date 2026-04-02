import { PrismaClient, Provider, DeliveryStatus } from '@prisma/client';
import { handleDeliveryResult } from './retry-state-machine';

const prisma = new PrismaClient();

interface SenderResult {
  success: boolean;
  statusCode: number;
  errorCode?: string;
  message?: string;
}

interface Sender {
  send(idempotencyKey: string, recipientKey: string, payload: any): Promise<SenderResult>;
}

// TODO: 개별 채널 Sender 구현체 연동
class NotionSender implements Sender {
  async send(idempotencyKey: string, recipientKey: string, payload: any): Promise<SenderResult> {
    // 임시 모의 구현 (실제 Notion API 연동 로직으로 대체 예정)
    console.log(`[NotionSender] Sending to ${recipientKey}...`);
    return { success: true, statusCode: 200 };
  }
}

const senderMap: Record<Provider, Sender> = {
  [Provider.NOTION]: new NotionSender(),
  [Provider.SLACK]: { send: async () => ({ success: false, statusCode: 501, errorCode: 'NOT_IMPLEMENTED' }) },
  [Provider.KAKAO]: { send: async () => ({ success: false, statusCode: 501, errorCode: 'NOT_IMPLEMENTED' }) },
  [Provider.EMAIL]: { send: async () => ({ success: false, statusCode: 501, errorCode: 'NOT_IMPLEMENTED' }) },
};

export async function startMultiChannelDispatcher() {
  console.log('VOXERA Multi-Channel Dispatcher Active.');

  while (true) {
    try {
      const processedCount = await pollAndProcessJobs();
      if (processedCount === 0) {
        // 처리할 작업이 없으면 1초 대기 (폴링 간격 조정 가능)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Dispatcher Critical Error:', error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function pollAndProcessJobs(): Promise<number> {
  // 트랜잭션 내에서 원자적 Row 확보
  return await prisma.$transaction(async (tx) => {
    // [핵심] FOR UPDATE SKIP LOCKED: 다른 워커가 가져간 Row는 건너뛰고 상위 10개를 잠금 후 반환
    const jobs = await tx.$queryRaw<any[]>`
      UPDATE delivery_jobs
      SET status = 'PROCESSING',
          started_at = NOW(),
          attempt_count = attempt_count + 1,
          updated_at = NOW()
      WHERE id IN (
        SELECT id FROM delivery_jobs
        WHERE (status = 'PENDING' OR status = 'FAILED_RETRYABLE')
          AND (scheduled_at IS NULL OR scheduled_at <= NOW())
        ORDER BY updated_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, request_id, provider, recipient_key, idempotency_key, payload, attempt_count
    `;

    if (jobs.length === 0) return 0;

    console.log(`[Dispatcher] Picked up ${jobs.length} jobs.`);

    // 각 작업의 병렬 처리 (settled를 통해 전체 처리 보장)
    const promises = jobs.map(async (job) => {
      const sender = senderMap[job.provider as Provider];
      
      try {
        if (!sender) {
          throw new Error(`No sender implementation for provider: ${job.provider}`);
        }

        const result = await sender.send(job.idempotency_key, job.recipient_key, job.payload);
        await handleDeliveryResult(tx, job, result);
      } catch (error: any) {
        await handleDeliveryResult(tx, job, {
          success: false,
          statusCode: 500,
          errorCode: 'SENDER_RUNTIME_ERROR',
          message: error.message,
        });
      }
    });

    await Promise.allSettled(promises);
    return jobs.length;
  });
}
