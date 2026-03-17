import { NextResponse } from 'next/server';
import { formatZodIssues } from '@/shared/contracts/common';
import { createRedisCacheStore } from '@/server/cache/v3-redis';
import { V3LocalStateStore } from '@/server/db/v3-local-state';
import { withV3Client } from '@/server/db/v3-pg';
import { isMemoryDatabaseRuntime } from '@/server/db/v3-runtime';
import { getVoiceJobQueue } from '@/server/queue/v3';
import { ensureLocalVoiceWorkerStarted } from '@/server/voice/local-dequeue-worker';
import { MockVoicePayloadStore } from '@/server/voice/mock-payload-store';
import {
  queueVoiceProcessingRequest,
  queueVoiceProcessingRequestLocal
} from '@/server/voice/voice-processing-core';
import { voiceJobEnqueueResponseSchema, voiceJobRequestSchema } from '@/shared/contracts/v3-voice-job';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsedBody = voiceJobRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid voice processing request contract.',
        issues: formatZodIssues(parsedBody.error)
      },
      { status: 400 }
    );
  }

  const payloadStore = new MockVoicePayloadStore();

  try {
    payloadStore.put({
      s3Key: parsedBody.data.s3Key,
      clientRequestId: parsedBody.data.clientRequestId,
      userId: parsedBody.data.userId,
      rawPayload: `mock-audio-payload:${parsedBody.data.clientRequestId}`,
      transcriptText: parsedBody.data.transcriptText,
      sessionId: parsedBody.data.sessionId,
      pcmFrameCount: parsedBody.data.pcmFrameCount,
      sttProvider: parsedBody.data.stt_provider,
      audioDurationSec: parsedBody.data.audio_duration_sec,
      createdAt: new Date().toISOString()
    });

    const result = isMemoryDatabaseRuntime()
      ? await queueVoiceProcessingRequestLocal(
          new V3LocalStateStore(),
          getVoiceJobQueue(),
          createRedisCacheStore(),
          parsedBody.data
        )
      : await withV3Client((client) =>
          queueVoiceProcessingRequest(client, getVoiceJobQueue(), createRedisCacheStore(), parsedBody.data)
        );

    if (result.deduplicated) {
      payloadStore.drop(parsedBody.data.s3Key);
    }

    if (!result.deduplicated && result.queueProvider === 'local') {
      ensureLocalVoiceWorkerStarted();
    }

    return NextResponse.json(
      voiceJobEnqueueResponseSchema.parse({
        ok: true,
        clientRequestId: result.clientRequestId,
        queueProvider: result.queueProvider,
        deduplicated: result.deduplicated,
        acceptedForProcessing: true,
        messageId: 'messageId' in result ? result.messageId : undefined
      })
    );
  } catch (error) {
    payloadStore.drop(parsedBody.data.s3Key);
    const message = error instanceof Error ? error.message : 'Voice processing enqueue failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
