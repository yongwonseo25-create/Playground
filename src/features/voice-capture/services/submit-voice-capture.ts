'use client';

import { formatZodIssues } from '@/shared/contracts/common';
import {
  type VoiceSubmitRequest,
  type VoiceSubmitSuccessResponse,
  voiceSubmitRequestSchema,
  voiceSubmitResponseSchema
} from '@/shared/contracts/voice-submit';

function formatIssues(issues: ReturnType<typeof formatZodIssues>): string {
  if (issues.length === 0) {
    return '';
  }

  return issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ');
}

export async function submitVoiceCapture(
  payload: VoiceSubmitRequest
): Promise<VoiceSubmitSuccessResponse> {
  const parsedPayload = voiceSubmitRequestSchema.safeParse(payload);
  if (!parsedPayload.success) {
    throw new Error(
      `Invalid voice submit request contract. ${formatIssues(formatZodIssues(parsedPayload.error))}`
    );
  }

  const response = await fetch('/api/voice/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(parsedPayload.data)
  });

  const rawResponse = await response.json().catch(() => null);
  const parsedResponse = voiceSubmitResponseSchema.safeParse(rawResponse);

  if (!parsedResponse.success) {
    throw new Error(
      `Voice submit response contract mismatch. ${formatIssues(formatZodIssues(parsedResponse.error))}`
    );
  }

  if (!parsedResponse.data.ok) {
    const suffix = formatIssues(parsedResponse.data.issues);
    throw new Error(suffix ? `${parsedResponse.data.error} (${suffix})` : parsedResponse.data.error);
  }

  if (!response.ok) {
    throw new Error(parsedResponse.data.reason ?? 'Voice submit request failed.');
  }

  return parsedResponse.data;
}
