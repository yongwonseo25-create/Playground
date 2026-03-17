import { voiceSttProviderSchema } from '@/shared/contracts/voice';
import { z } from 'zod';

export const voiceJobRequestSchema = z
  .object({
    userId: z.coerce.number().int().positive(),
    clientRequestId: z.uuid(),
    s3Key: z.string().trim().min(1).max(500),
    creditsRequired: z.coerce.number().int().nonnegative().default(0),
    transcriptText: z.string().trim().min(1).max(20_000).optional(),
    sessionId: z.string().trim().min(1).max(512).optional(),
    pcmFrameCount: z.coerce.number().int().nonnegative().optional(),
    stt_provider: voiceSttProviderSchema.optional(),
    audio_duration_sec: z.coerce.number().nonnegative().optional()
  })
  .strict();

export type VoiceJobRequest = z.infer<typeof voiceJobRequestSchema>;

export const voiceJobQueuePayloadSchema = z
  .object({
    userId: z.number().int().positive(),
    clientRequestId: z.uuid(),
    s3Key: z.string().trim().min(1).max(500),
    creditsRequired: z.number().int().nonnegative(),
    requestedAt: z.iso.datetime()
  })
  .strict();

export type VoiceJobQueuePayload = z.infer<typeof voiceJobQueuePayloadSchema>;

export const voiceJobEnqueueResponseSchema = z
  .object({
    ok: z.literal(true),
    clientRequestId: z.uuid(),
    queueProvider: z.enum(['local', 'sqs']),
    deduplicated: z.boolean(),
    acceptedForProcessing: z.boolean().default(true),
    messageId: z.string().min(1).optional()
  })
  .strict();

export type VoiceJobEnqueueResponse = z.infer<typeof voiceJobEnqueueResponseSchema>;
