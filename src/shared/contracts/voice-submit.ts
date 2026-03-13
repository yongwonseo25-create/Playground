import { z } from 'zod';
import { contractErrorResponseSchema } from '@/shared/contracts/common';

const optionalLooseStringSchema = z.string().trim().max(512).optional();
const sttProviderSchema = z.enum(['whisper', 'return-zero']);

export const voiceSubmitRequestSchema = z
  .object({
    clientRequestId: z.string().trim().min(1).max(128),
    transcriptText: z.string().trim().min(1).max(20_000),
    spreadsheetId: optionalLooseStringSchema,
    slackChannelId: optionalLooseStringSchema,
    sessionId: optionalLooseStringSchema,
    pcmFrameCount: z.number().int().nonnegative().optional(),
    stt_provider: sttProviderSchema.optional(),
    audio_duration_sec: z.number().nonnegative().optional()
  })
  .strict();

export type VoiceSubmitRequest = z.infer<typeof voiceSubmitRequestSchema>;

export const makeWebhookPayloadSchema = z
  .object({
    clientRequestId: z.string().trim().min(1).max(128),
    transcriptText: z.string().trim().min(1).max(20_000),
    spreadsheetId: z.string().trim().max(512).default(''),
    slackChannelId: z.string().trim().max(512).default(''),
    sessionId: z.string().trim().max(512).default(''),
    pcmFrameCount: z.number().int().nonnegative().default(0),
    stt_provider: sttProviderSchema.default('whisper'),
    audio_duration_sec: z.number().nonnegative().default(0),
    createdAt: z.string().datetime({ offset: true })
  })
  .strict();

export type MakeWebhookPayload = z.infer<typeof makeWebhookPayloadSchema>;

export const voiceSubmitSuccessResponseSchema = z
  .object({
    ok: z.literal(true),
    acceptedForRetry: z.boolean(),
    stt_provider: sttProviderSchema,
    audio_duration_sec: z.number().nonnegative(),
    circuitState: z.enum(['CLOSED', 'OPEN', 'HALF_OPEN']).optional(),
    mocked: z.boolean().optional(),
    reason: z.string().min(1).optional()
  })
  .strict();

export type VoiceSubmitSuccessResponse = z.infer<typeof voiceSubmitSuccessResponseSchema>;

export const voiceSubmitResponseSchema = z.union([
  voiceSubmitSuccessResponseSchema,
  contractErrorResponseSchema
]);

export type VoiceSubmitResponse = z.infer<typeof voiceSubmitResponseSchema>;
