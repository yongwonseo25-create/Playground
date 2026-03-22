import { z } from 'zod';

export const realtimeStreamIdSchema = z.string().trim().regex(/^\d+-\d+$/);

export const realtimeResumeTokenPayloadSchema = z
  .object({
    version: z.literal(1),
    stream: z.string().trim().min(1).max(128),
    last_seq: realtimeStreamIdSchema,
    issued_at: z.string().datetime({ offset: true }),
    connection_id: z.string().trim().min(1).max(128)
  })
  .strict();

export type RealtimeResumeTokenPayload = z.infer<typeof realtimeResumeTokenPayloadSchema>;

export const realtimeReconnectRequestSchema = z
  .object({
    stream: z.string().trim().min(1).max(128),
    resume_token: z.string().trim().min(1).optional(),
    last_seq: realtimeStreamIdSchema.optional()
  })
  .strict();

export type RealtimeReconnectRequest = z.infer<typeof realtimeReconnectRequestSchema>;

export const realtimeStreamEventSchema = z
  .object({
    stream: z.string().trim().min(1).max(128),
    seq: realtimeStreamIdSchema,
    last_seq: realtimeStreamIdSchema,
    resume_token: z.string().trim().min(1),
    payload: z.record(z.string(), z.unknown()),
    created_at: z.string().datetime({ offset: true })
  })
  .strict();

export type RealtimeStreamEvent = z.infer<typeof realtimeStreamEventSchema>;

export const realtimeOutboxStatusSchema = z.enum(['pending', 'delivered']);

export const realtimeOutboxRecordSchema = z
  .object({
    id: z.string().trim().min(1),
    aggregate_type: z.string().trim().min(1),
    aggregate_id: z.string().trim().min(1),
    status: realtimeOutboxStatusSchema,
    payload: z.record(z.string(), z.unknown()),
    created_at: z.string().datetime({ offset: true }),
    expires_at: z.string().datetime({ offset: true }),
    delivered_at: z.string().datetime({ offset: true }).optional()
  })
  .strict();

export type RealtimeOutboxRecord = z.infer<typeof realtimeOutboxRecordSchema>;
