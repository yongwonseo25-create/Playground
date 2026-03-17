'use client';

import { formatZodIssues } from '@/shared/contracts/common';
import {
  type VoiceJobEnqueueResponse,
  voiceJobEnqueueResponseSchema,
  voiceJobRequestSchema
} from '@/shared/contracts/v3-voice-job';

function formatIssues(issues: ReturnType<typeof formatZodIssues>): string {
  if (issues.length === 0) {
    return '';
  }

  return issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ');
}

function resolveCaptureUserId(): number {
  if (typeof window !== 'undefined') {
    const searchParams = new URLSearchParams(window.location.search);
    const rawUserId = searchParams.get('userId');
    if (rawUserId) {
      const parsed = Number(rawUserId);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  const fallback = Number(process.env.NEXT_PUBLIC_V3_DEFAULT_USER_ID ?? '1');
  return Number.isInteger(fallback) && fallback > 0 ? fallback : 1;
}

export type SubmitVoiceProcessingInput = {
  clientRequestId: string;
  transcriptText: string;
  sessionId?: string;
  pcmFrameCount?: number;
  stt_provider?: 'whisper' | 'return-zero';
  audio_duration_sec?: number;
};

export async function submitVoiceProcessingJob(
  payload: SubmitVoiceProcessingInput
): Promise<VoiceJobEnqueueResponse> {
  const parsedPayload = voiceJobRequestSchema.safeParse({
    userId: resolveCaptureUserId(),
    clientRequestId: payload.clientRequestId,
    s3Key: `voice-uploads/${payload.sessionId ?? payload.clientRequestId}.pcm`,
    creditsRequired: 1,
    transcriptText: payload.transcriptText,
    sessionId: payload.sessionId,
    pcmFrameCount: payload.pcmFrameCount ?? 0,
    stt_provider: payload.stt_provider ?? 'whisper',
    audio_duration_sec: payload.audio_duration_sec ?? 0
  });

  if (!parsedPayload.success) {
    throw new Error(
      `Invalid voice process request contract. ${formatIssues(formatZodIssues(parsedPayload.error))}`
    );
  }

  const response = await fetch('/api/voice/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(parsedPayload.data)
  });

  const rawResponse = await response.json().catch(() => null);
  const parsedResponse = voiceJobEnqueueResponseSchema.safeParse(rawResponse);

  if (!parsedResponse.success) {
    throw new Error(
      `Voice process response contract mismatch. ${formatIssues(formatZodIssues(parsedResponse.error))}`
    );
  }

  if (!response.ok) {
    const maybeError =
      rawResponse && typeof rawResponse === 'object' && 'error' in rawResponse && typeof rawResponse.error === 'string'
        ? rawResponse.error
        : 'Voice processing enqueue failed.';
    throw new Error(maybeError);
  }

  return parsedResponse.data;
}
