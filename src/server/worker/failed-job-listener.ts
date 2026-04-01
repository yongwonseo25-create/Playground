import { QueueEvents } from 'bullmq';

// Connection details (same as queue)
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  // password: process.env.REDIS_PASSWORD
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const queueEvents = new QueueEvents('VOXERA_PIPELINE', { connection });

console.log('[Worker Listener] VOXERA DLQ / Failed Event Listener 가동 시작...');

/**
 * [Phase 4] Safe Execution Dead-Letter Queue (DLQ) 감지기
 * Job이 설정된 모든 재시도(Attempts)를 소진하고 완전히 실패(failed) 상태로 전락했을 때 처리.
 * 
 * Saga 보상 트랜잭션(환불) 로직을 호출합니다.
 */
queueEvents.on('failed', async ({ jobId, failedReason, prev }) => {
  // prev 조건 등 분석을 넣어서 정말 최종 실패인지 검증하는 로직이 들어갈 수 있습니다.
  // 이 데모/설계에서는 'failed' 이벤트를 최종 실패로 간주합니다.
  
  // Note: QueueEvents는 job.data에 직접 접근할 수 없으므로, 원래 Queue 인스턴스에서 Job을 조회해야 합니다.
  // 여기에서는 Job ID 기반으로 환불 처리 API를 찔러 복구하는 큰 틀을 잡습니다.
  
  console.error(`[DLQ Alert] Job <${jobId}> 최종 실패 격리됨 (Refund Saga Triggered). 이유: ${failedReason}`);

  try {
    // 실제라면 voxeraQueue.getJob(jobId) 로 데이터를 뽑아옵니다.
    // 여기서는 REST API로 실패된 jobId를 전송하여 환불을 진행한다고 가정 (id 체계가 sessionId를 포함하거나 연동된 경우)
    
    // 단순 시뮬레이션을 위한 더미 데이터 페치 (실제로는 Job Data에서 sessionId/userId 추출)
    const simulatedUserId = 'uuid-user-placeholder';
    const simulatedSessionId = `session_from_job_${jobId}`; 
    const simulatedAudioDurationSec = 15;

    const refundResponse = await fetch(`${BASE_URL}/api/v1/billing/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: simulatedUserId,
        sessionId: simulatedSessionId,
        audioDurationSec: simulatedAudioDurationSec
      })
    });

    const refundData = await refundResponse.json();

    if (!refundResponse.ok || !refundData.success) {
      throw new Error(`Refund 통신 실패: ${refundData.error || refundData.reason}`);
    }

    console.log(`[DLQ Recovery] Job <${jobId}> 의 잔액 예약(PENDING)이 안전하게 환불/롤백 처리되었습니다.`, refundData);

  } catch (error) {
     console.error(`[DLQ FATAL ERROR] 환불 API(Rollback) 호출조차 실패했습니다. 개발자 개입 필요! Job ID: ${jobId}`, error);
  }
});

// 안전한 종료 옵션
/*
process.on('SIGINT', async () => {
    await queueEvents.close();
    console.log('[Worker Listener] 안전하게 리스너 연결 종료됨.');
});
*/
