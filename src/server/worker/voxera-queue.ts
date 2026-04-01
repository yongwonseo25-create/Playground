import { Queue } from 'bullmq';

// 기본 로컬 Redis 구성 (환경변수에 따라 운영/로컬 분기)
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  // password: process.env.REDIS_PASSWORD
};

export const voxeraQueue = new Queue('VOXERA_PIPELINE', { connection });

// Queue 페이로드 스키마 정의 타입
export interface VoxeraJobPayload {
  userId: string;
  workspaceId?: string; // [Phase 5] B2B 워크스페이스 식별자
  sessionId: string;
  sttText: string;
  userStylePrompt?: string;
  audioDurationSec: number;
  t1_stt_ms: number; // 음성 -> 텍스트(STT) 수행 완료 소요시간 (큐 넣기 전 시점까지)
}

/**
 * [Phase 3] 클라이언트로부터 받은 요청을 비동기 큐에 밀어 넣습니다.
 * - HTTP Sync 흐름을 끊고, 지연 시간을 클라이언트에게서 분리합니다.
 */
export async function enqueueVoxeraPipeline(payload: VoxeraJobPayload) {
  // 빠른 즉시 처리(우선순위 부여 등) 옵션 추가 가능
  const job = await voxeraQueue.add('process-90-10-llm-and-target', payload, {
    removeOnComplete: { count: 1000 }, // 메모리 관리 (성공 로그 보존)
    removeOnFail: { count: 5000 },    // DLQ 역할 수행 (실패 로그 보존)
    attempts: 5,                      // 최대 5회 재시도
    backoff: {
      type: 'exponential',            // 지수 백오프 적용
      delay: 2000,                    // 2초부터 시작 (2, 4, 8, 16...)
    }
  });

  console.log(`[Queue] Job Enqueued: ${job.id} for Validation Session: ${payload.sessionId}`);
  return job;
}
