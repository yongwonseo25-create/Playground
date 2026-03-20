import type { V4ThinkingLevel } from '@/shared/contracts/v4/common';
import { getV4ServerEnv } from '@/server/v4/shared/env';

export type V4LlmLane = 'zhi' | 'hitl';

export interface V4LlmRoute {
  lane: V4LlmLane;
  provider: 'gemini';
  model: string;
  thinkingLevel: V4ThinkingLevel;
  requestTimeoutMs: number;
}

export function getV4LlmRoute(
  lane: V4LlmLane,
  input: Record<string, string | undefined> = process.env
): V4LlmRoute {
  const env = getV4ServerEnv(input);

  if (lane === 'zhi') {
    return {
      lane,
      provider: 'gemini',
      model: env.V4_ZHI_LLM_MODEL,
      thinkingLevel: env.V4_ZHI_LLM_THINKING_LEVEL,
      requestTimeoutMs: 4_000
    };
  }

  return {
    lane,
    provider: 'gemini',
    model: env.V4_HITL_LLM_MODEL,
    thinkingLevel: env.V4_HITL_LLM_THINKING_LEVEL,
    requestTimeoutMs: 8_000
  };
}

export function isLiveGeminiEnabled(input: Record<string, string | undefined> = process.env): boolean {
  return Boolean(getV4ServerEnv(input).GEMINI_API_KEY);
}
