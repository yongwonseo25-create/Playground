import { expect, test } from '@playwright/test';
import { getV4LlmRoute } from '../../src/server/v4/shared/llm-routing';
import { buildGeminiStructuredRequestBody } from '../../src/server/v4/shared/structured-output';

function createLocalEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_APP_ENV: 'local',
    NEXT_PUBLIC_WSS_URL: 'ws://127.0.0.1:8787/voice',
    MAKE_WEBHOOK_URL: 'http://127.0.0.1:8896/webhook',
    MAKE_WEBHOOK_SECRET: 'voxera-test-secret',
    DATABASE_URL: 'pgmem://v4-llm-routing',
    REDIS_URL: 'memory://v4-llm-routing',
    V4_EXECUTION_CREDIT_ACCOUNT_KEY: 'llm-routing-account',
    V4_EXECUTION_CREDIT_INITIAL_BALANCE: '5',
    V4_EXECUTION_BUFFER_TTL_SEC: '600',
    V4_IDEMPOTENCY_TTL_SEC: '600',
    V4_REDIS_ENCRYPTION_KEY: 'llm-routing-secret',
    V4_WORKER_POLL_INTERVAL_MS: '50',
    V4_ZHI_LLM_MODEL: 'gemini-3.1-flash-lite-preview',
    V4_ZHI_LLM_THINKING_LEVEL: 'minimal',
    V4_HITL_LLM_MODEL: 'gemini-3.1-pro-preview',
    V4_HITL_LLM_THINKING_LEVEL: 'medium',
    ...overrides
  };
}

test.describe('V4 LLM routing', () => {
  test('reads the lane-specific Gemini model names from env', () => {
    const env = createLocalEnv();

    expect(getV4LlmRoute('zhi', env)).toMatchObject({
      lane: 'zhi',
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite-preview',
      thinkingLevel: 'minimal'
    });

    expect(getV4LlmRoute('hitl', env)).toMatchObject({
      lane: 'hitl',
      provider: 'gemini',
      model: 'gemini-3.1-pro-preview',
      thinkingLevel: 'medium'
    });

    expect(
      buildGeminiStructuredRequestBody({
        lane: 'zhi',
        destinationKey: 'notion',
        transcriptText: 'Warm the ZHI route.',
        env
      })
    ).toMatchObject({
      model: 'gemini-3.1-flash-lite-preview',
      body: {
        generationConfig: {
          thinkingConfig: {
            thinkingLevel: 'minimal'
          }
        }
      }
    });

    expect(
      buildGeminiStructuredRequestBody({
        lane: 'hitl',
        destinationKey: 'gmail',
        transcriptText: 'Warm the HITL route.',
        env
      })
    ).toMatchObject({
      model: 'gemini-3.1-pro-preview',
      body: {
        generationConfig: {
          thinkingConfig: {
            thinkingLevel: 'medium'
          }
        }
      }
    });
  });

  test('rejects out-of-band thinking levels per lane', () => {
    expect(() =>
      getV4LlmRoute('zhi', createLocalEnv({ V4_ZHI_LLM_THINKING_LEVEL: 'medium' }))
    ).toThrow('V4_ZHI_LLM_THINKING_LEVEL');

    expect(() =>
      getV4LlmRoute('hitl', createLocalEnv({ V4_HITL_LLM_THINKING_LEVEL: 'minimal' }))
    ).toThrow('V4_HITL_LLM_THINKING_LEVEL');
  });
});
