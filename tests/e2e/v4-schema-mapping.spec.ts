import { expect, test } from '@playwright/test';
import {
  buildStructuredFieldsForDestination,
  buildStructuredPayloadFromFields,
  validateDestinationStructuredPayload
} from '../../src/shared/contracts/v4/schemas';
import { prepareV4StructuredOutput } from '../../src/server/v4/shared/structured-output';

const LOCAL_ENV: Record<string, string> = {
  NEXT_PUBLIC_APP_ENV: 'local',
  NEXT_PUBLIC_WSS_URL: 'ws://127.0.0.1:8787/voice',
  MAKE_WEBHOOK_URL: 'http://127.0.0.1:8896/webhook',
  MAKE_WEBHOOK_SECRET: 'schema-test-secret',
  DATABASE_URL: 'pgmem://v4-schema-mapping',
  REDIS_URL: 'memory://v4-schema-mapping',
  V4_EXECUTION_CREDIT_ACCOUNT_KEY: 'schema-account',
  V4_EXECUTION_CREDIT_INITIAL_BALANCE: '6',
  V4_EXECUTION_BUFFER_TTL_SEC: '600',
  V4_IDEMPOTENCY_TTL_SEC: '600',
  V4_REDIS_ENCRYPTION_KEY: 'schema-resilience-secret',
  V4_WORKER_POLL_INTERVAL_MS: '50',
  V4_ZHI_LLM_MODEL: 'gemini-3.1-flash-lite-preview',
  V4_ZHI_LLM_THINKING_LEVEL: 'low',
  V4_HITL_LLM_MODEL: 'gemini-3.1-pro-preview',
  V4_HITL_LLM_THINKING_LEVEL: 'low'
};

test.describe('V4 destination schema mapping', () => {
  test.beforeEach(() => {
    Object.assign(process.env, LOCAL_ENV);
  });

  test('validates all four destination schemas against dummy text', async () => {
    const cases = [
      {
        lane: 'zhi' as const,
        destinationKey: 'notion' as const,
        transcriptText: 'Summarize the ops review and queue a clean Notion execution page.'
      },
      {
        lane: 'zhi' as const,
        destinationKey: 'google_docs' as const,
        transcriptText: 'Turn the customer interview notes into a Google Docs draft.'
      },
      {
        lane: 'hitl' as const,
        destinationKey: 'gmail' as const,
        transcriptText: 'Draft a Gmail follow-up and ask the buyer to confirm the timeline.'
      },
      {
        lane: 'hitl' as const,
        destinationKey: 'kakaotalk' as const,
        transcriptText: 'Prepare a KakaoTalk outreach message and request a quick reply.'
      }
    ];

    for (const entry of cases) {
      const result = await prepareV4StructuredOutput({
        lane: entry.lane,
        destinationKey: entry.destinationKey,
        transcriptText: entry.transcriptText,
        preferLiveGemini: false
      });

      expect(validateDestinationStructuredPayload(entry.destinationKey, result.payload)).toEqual(result.payload);
      expect(Object.keys(result.payload).length).toBeGreaterThanOrEqual(5);

      if (entry.lane === 'hitl') {
        const fields = buildStructuredFieldsForDestination(entry.destinationKey, result.payload);
        expect(fields.length).toBe(Object.keys(result.payload).length);
        expect(buildStructuredPayloadFromFields(entry.destinationKey, fields)).toEqual(result.payload);
      }
    }
  });
});
