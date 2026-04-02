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

const prompt = `
[MISSION: VOXERA Backend Phase 2 Implementation]
Context: notion direct logic.md (Markdown-first, 2 RPS Queue)
Task: Output raw TypeScript code for the following 2 files.

1. notion-markdown.service.ts:
- Convert JSON { title, intent, body } to a pure Markdown string.
- Keep it lightweight.

2. notion-write.worker.ts:
- Poll 'JobQueue' table (Prisma).
- Throttling: Max 2 RPS (requests per second) globally.
- Error Handling: 429/50x retry with Exponential Backoff.
- Atomic updates: PENDING -> PROCESSING -> COMPLETED/FAILED.

Constraint: Output only the code. No explanations.
`;

async function callGlm() {
  console.log('[PHYSICAL_CALL] Connecting to Z.AI GLM-5.1...');
  try {
    const response = await axios.post(
      'https://api.z.ai/api/coding/paas/v4/chat/completions',
      {
        model: 'glm-5.1',
        messages: [{ role: 'user', content: prompt }],
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
    
    console.log('[RAW_CODE_OUTPUT]');
    console.log(response.data.choices[0].message.content);
    
    // 파일로 저장
    fs.writeFileSync('scripts/glm-output.txt', response.data.choices[0].message.content);
  } catch (error: any) {
    console.error('[ERROR]', error.response?.data || error.message);
  }
}

callGlm();
