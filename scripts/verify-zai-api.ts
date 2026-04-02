import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM 환경 대응
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load simple .env.local without external dependencies
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
}

async function verifyZaiApi() {
  loadEnv();
  
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    console.error('Error: ZAI_API_KEY is not set in .env.local.');
    process.exit(1);
  }

  const endpoint = 'https://api.z.ai/api/coding/paas/v4/chat/completions';
  const model = 'glm-5.1';

  // Read the prompt from notion direct logic.md (one level up from Playground-ssce-main)
  const logicFilePath = path.join(__dirname, '..', '..', 'notion direct logic.md');
  const context = fs.readFileSync(logicFilePath, 'utf-8');

  console.log('--- [MISSION: PHYSICAL CALL INITIATED] ---');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Model: ${model}`);

  try {
    const response = await axios.post(
      endpoint,
      {
        model,
        messages: [
          { role: 'system', content: 'You are a senior backend architect.' },
          { role: 'user', content: 'Hello, identify yourself and confirm you are the GLM-5.1 model.' }
        ],
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 300s timeout for absolute certainty
      }
    );

    console.log('--- [API JSON RESPONSE RAW HEADER] ---');
    console.log(JSON.stringify(response.headers, null, 2));

    console.log('--- [API JSON RESPONSE BODY] ---');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.usage) {
      console.log('--- [TOKEN RECEIPT] ---');
      console.log(`Prompt Tokens: ${response.data.usage.prompt_tokens}`);
      console.log(`Completion Tokens: ${response.data.usage.completion_tokens}`);
      console.log(`Total Tokens: ${response.data.usage.total_tokens}`);
    }

  } catch (error: any) {
    console.error('--- [PHYSICAL CALL FAILED] ---');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error Message:', error.message);
      if (error.code === 'ECONNABORTED') {
        console.error('Reason: Request timed out (30s)');
      }
    }
    process.exit(1);
  }
}

verifyZaiApi();
