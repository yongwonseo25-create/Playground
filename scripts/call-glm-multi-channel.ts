import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local 로드
const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const ZAI_API_KEY = env.match(/ZAI_API_KEY=(.*)/)?.[1]?.trim();

const missionPrompt = `
[MISSION: VOXERA Multi-Channel Native Delivery Control Plane Implementation]
Based on: multi-channel native logic.md

Requirements:
1. schema.prisma:
- Refactor and Replace JobQueue with 'delivery_jobs' table.
- Support Provider Enum: NOTION, SLACK, KAKAO, EMAIL.
- Fields: request_id, provider, recipient_key, idempotency_key, status(PENDING, PROCESSING, COMPLETED, FAILED_RETRYABLE, FAILED_TERMINAL, UNKNOWN), attempt_count, last_error_code.
- Link to User/Workspace as needed.

2. multi-channel.dispatcher.ts:
- Polling logic using PostgreSQL 'FOR UPDATE SKIP LOCKED'.
- Route to NotionSender, SlackSender, KakaoSender, EmailSender.
- Atomic updates.

3. retry-state-machine.ts:
- Handling 429/Throttle -> FAILED_RETRYABLE (with exponential backoff).
- 5xx -> FAILED_RETRYABLE.
- 4xx/Auth -> FAILED_TERMINAL.
- Timeout/Ambiguity -> UNKNOWN (Reconciliation Queue).

Output ONLY the raw code for these 3 files. No explanations.
`;

async function callGlm() {
  console.log('[PHYSICAL_CALL] Connecting to Z.AI GLM-5.1 for Multi-Channel Expansion...');
  try {
    const response = await axios.post(
      'https://api.z.ai/api/coding/paas/v4/chat/completions',
      {
        model: 'glm-5.1',
        messages: [{ role: 'user', content: missionPrompt }],
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${ZAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000
      }
    );

    console.log('[RECEIPT_RAW_USAGE]');
    console.log(JSON.stringify(response.data.usage, null, 2));
    
    // 파일로 저장
    fs.writeFileSync('scripts/multi-channel-output.txt', response.data.choices[0].message.content);
    console.log('[SUCCESS] Code vomited into scripts/multi-channel-output.txt');
  } catch (error: any) {
    console.error('[ERROR]', error.response?.data || error.message);
  }
}

callGlm();
