import { PrismaClient, DeliveryStatus } from '@prisma/client';

const MAX_RETRY_ATTEMPTS = 5;

interface PolledJob {
  id: string;
  attemptCount: number;
}

interface SenderResult {
  success: boolean;
  statusCode: number;
  errorCode?: string;
  message?: string;
}

/**
 * 전송 결과에 따라 DeliveryJob의 상태를 업데이트하는 상태 머신
 */
export async function handleDeliveryResult(
  prisma: any, // tx or prisma client
  job: PolledJob,
  result: SenderResult
): Promise<void> {
  if (result.success) {
    await prisma.deliveryJob.update({
      where: { id: job.id },
      data: {
        status: DeliveryStatus.COMPLETED,
        lastErrorCode: null,
        completedAt: new Date(),
      },
    });
    return;
  }

  let nextStatus: DeliveryStatus = DeliveryStatus.FAILED_TERMINAL;
  let scheduledAt: Date | null = null;
  const errorCode = result.errorCode || `HTTP_${result.statusCode}`;

  // State Machine Transitions
  // 429 (Rate Limit) 또는 5xx (Server Error)인 경우에만 재시도
  if (result.statusCode === 429 || result.statusCode >= 500) {
    if (job.attemptCount >= MAX_RETRY_ATTEMPTS) {
      nextStatus = DeliveryStatus.FAILED_TERMINAL;
    } else {
      nextStatus = DeliveryStatus.FAILED_RETRYABLE;
      
      // 지수 백오프 계산: 2^attempt * 1000ms + random jitter
      const baseDelay = Math.pow(2, job.attemptCount) * 1000;
      const jitter = Math.floor(Math.random() * 500);
      scheduledAt = new Date(Date.now() + baseDelay + jitter);
    }
  } else if (result.statusCode >= 400 && result.statusCode < 500) {
    // 4xx Client / Auth Error -> FAILED_TERMINAL (재시도 의미 없음)
    nextStatus = DeliveryStatus.FAILED_TERMINAL;
  } else {
    // 타임아웃, 네트워크 단절 등 모호한 상태 -> UNKNOWN (관리자 개입 필요)
    nextStatus = DeliveryStatus.UNKNOWN;
  }

  await prisma.deliveryJob.update({
    where: { id: job.id },
    data: {
      status: nextStatus,
      lastErrorCode: errorCode,
      scheduledAt: scheduledAt,
    },
  });
}
