import type { Queryable } from '@/server/db/v3-pg';
import type { VoiceJobQueue } from '@/server/queue/v3/types';
import type { CacheStore } from '@/server/cache/v3-redis';
import { reserveSttRequestId } from '@/server/cache/stt-dedupe-cache';
import { V3LocalStateStore } from '@/server/db/v3-local-state';
import { voiceJobQueuePayloadSchema, type VoiceJobRequest } from '@/shared/contracts/v3-voice-job';

export type QueueVoiceProcessingResult =
  | {
      ok: true;
      deduplicated: true;
      queueProvider: VoiceJobQueue['provider'];
      clientRequestId: string;
    }
  | {
      ok: true;
      deduplicated: false;
      queueProvider: VoiceJobQueue['provider'];
      clientRequestId: string;
      messageId: string;
    };

type RowCountResult = {
  id: number;
};

export async function queueVoiceProcessingRequest(
  runner: Queryable,
  queue: VoiceJobQueue,
  dedupeStore: CacheStore,
  input: VoiceJobRequest
): Promise<QueueVoiceProcessingResult> {
  const reserved = await reserveSttRequestId(input.clientRequestId, dedupeStore);
  if (!reserved) {
    return {
      ok: true,
      deduplicated: true,
      queueProvider: queue.provider,
      clientRequestId: input.clientRequestId
    };
  }

  const insertResult = await runner.query<RowCountResult>(
    `
      INSERT INTO voice_processing_log (
        user_id,
        client_request_id,
        s3_key,
        credits_used,
        status
      )
      VALUES ($1, $2::uuid, $3, $4, 'queued')
      ON CONFLICT (client_request_id) DO NOTHING
      RETURNING id
    `,
    [input.userId, input.clientRequestId, input.s3Key, input.creditsRequired]
  );

  if (!insertResult.rowCount) {
    return {
      ok: true,
      deduplicated: true,
      queueProvider: queue.provider,
      clientRequestId: input.clientRequestId
    };
  }

  const payload = voiceJobQueuePayloadSchema.parse({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    s3Key: input.s3Key,
    creditsRequired: input.creditsRequired,
    requestedAt: new Date().toISOString()
  });

  let enqueued;
  try {
    enqueued = await queue.enqueue(payload);
  } catch (error) {
    await runner.query(
      `
        UPDATE voice_processing_log
        SET status = 'enqueue_failed'
        WHERE client_request_id = $1::uuid
      `,
      [input.clientRequestId]
    );
    throw error;
  }

  return {
    ok: true,
    deduplicated: false,
    queueProvider: enqueued.provider,
    clientRequestId: input.clientRequestId,
    messageId: enqueued.messageId
  };
}

export async function queueVoiceProcessingRequestLocal(
  state: V3LocalStateStore,
  queue: VoiceJobQueue,
  dedupeStore: CacheStore,
  input: VoiceJobRequest
): Promise<QueueVoiceProcessingResult> {
  const reserved = await reserveSttRequestId(input.clientRequestId, dedupeStore);
  if (!reserved) {
    return {
      ok: true,
      deduplicated: true,
      queueProvider: queue.provider,
      clientRequestId: input.clientRequestId
    };
  }

  const inserted = state.insertVoiceLog({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    s3Key: input.s3Key,
    creditsUsed: input.creditsRequired,
    status: 'queued'
  });

  if (!inserted) {
    return {
      ok: true,
      deduplicated: true,
      queueProvider: queue.provider,
      clientRequestId: input.clientRequestId
    };
  }

  const payload = voiceJobQueuePayloadSchema.parse({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    s3Key: input.s3Key,
    creditsRequired: input.creditsRequired,
    requestedAt: new Date().toISOString()
  });

  const enqueued = await queue.enqueue(payload);

  return {
    ok: true,
    deduplicated: false,
    queueProvider: enqueued.provider,
    clientRequestId: input.clientRequestId,
    messageId: enqueued.messageId
  };
}
