import { Worker, Job } from 'bullmq';
import { VoxeraJobPayload } from './voxera-queue';
import { claudeCoworkService } from '../ai/claude-cowork-service';
import { contextStorageService } from '../ai/context-storage-service';
import { notionClient } from '../integrations/notion-client';
import { slackClient } from '../integrations/slack-client';

// Connection details (same as queue, pointing to Redis instance)
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  // password: process.env.REDIS_PASSWORD
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function detectIntent(text: string): 'NOTION' | 'SLACK' | undefined {
  const t = text.toLowerCase();
  if (t.includes('노션') || t.includes('notion') || t.includes('페이지')) return 'NOTION';
  if (t.includes('슬랙') || t.includes('slack') || t.includes('채널') || t.includes('팀장님')) return 'SLACK';
  return undefined;
}

/**
 * [Phase 3] Async Worker Processor 
 * - Dequeue -> Claude 90/10 파이프라인(t2) 측정
 * - -> 타겟 API(Mock Notion/Slack) 전송(t3) 측정
 * - -> 정산(Settlement API) 처리 후 크레딧 완전 차감
 */
console.log('[Worker] VOXERA 비동기 데몬(SQS/BullMQ) 대기 시작...');

export const voxeraProcessor = new Worker<VoxeraJobPayload>(
  'VOXERA_PIPELINE',
  async (job: Job<VoxeraJobPayload>) => {
    const { userId, workspaceId, sessionId, sttText, userStylePrompt, audioDurationSec, t1_stt_ms } = job.data;
    
    console.log(`[Worker] Job <${job.id}> 수신: ${sessionId}`);

    try {
      // 1. 인텐트 분석
      const intent = detectIntent(sttText);

      // 2. 초개인화 Context Assembly
      const rawContext = await contextStorageService.getIntentBasedContext(userId, intent);
      const personalizedContext = contextStorageService.formatContextForPrompt(rawContext);

      // 3. Claude 90/10 파이프라인
      const { resultText, t2_llm_ms } = await claudeCoworkService.process90_10Pipeline(
        sttText, 
        userStylePrompt, 
        personalizedContext
      );

      // 4. Target Delivery (t3)
      const t3_start = performance.now();
      if (intent === 'SLACK') {
         await slackClient.sendMessage(userId, 'C1234567', resultText);
      } else {
         await notionClient.sendContentToPage(userId, 'db_82abcd', resultText);
      }
      const t3_target_ms = Math.round(performance.now() - t3_start);

      // 5. 정산 API 호출 - 성공 보장 로직 (Settlement Integrity)
      // 내부 API 호출 시 에러가 발생하면 Job 자체가 Fail되어야 함 (누수 방지)
      const settleResponse = await fetch(`${BASE_URL}/api/v1/billing/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          workspaceId,
          sessionId,
          audioDurationSec,
          metrics: { t1: t1_stt_ms, t2: t2_llm_ms, t3: t3_target_ms }
        })
      });

      if (!settleResponse.ok) {
        throw new Error(`SETTLEMENT_FAILED: ${settleResponse.statusText}`);
      }

      return { finalOutput: resultText };

    } catch (error: any) {
      console.error(`[Worker Critical Failure] Job ${job.id}:`, error.message);
      throw error; // BullMQ 지수 백오프 재시도 유도
    }
  },
  { 
    connection,
    concurrency: 10,        // 동시 처리 제한 (리소스 보호)
    lockDuration: 60000,    // 1분간 잠금 (AI 작업 시간 고려)
    stalledInterval: 30000  // 좀비 작업 체크 주기
  }
);

// Graceful Shutdown Logic
/*
process.on('SIGINT', async () => {
   await voxeraProcessor.close();
   console.log('[Worker] 안전하게 큐 연결 종료됨.');
});
*/
