import { z } from 'zod';
import {
  v4DispatchStatusSchema,
  v4DestinationKeySchema,
  v4DestinationSchema,
  v4ExecutionCreditChargeResultSchema
} from '@/shared/contracts/v4/common';

export const zhiPayloadSchema = z.record(z.string(), z.unknown());

export const zhiDispatchRequestSchema = z
  .object({
    clientRequestId: z.string().min(1),
    transcriptText: z.string().min(1).max(20_000),
    destinationKey: v4DestinationKeySchema,
    sessionId: z.string().trim().min(1).max(128).optional(),
    sttProvider: z.enum(['whisper', 'return-zero']).default('whisper'),
    audioDurationSec: z.number().nonnegative().default(0),
    accountKey: z.string().trim().min(1).max(128).optional()
  })
  .strict();

export type ZhiDispatchRequest = z.infer<typeof zhiDispatchRequestSchema>;

export const zhiDispatchResponseSchema = z
  .object({
    ok: z.literal(true),
    mode: z.literal('zhi'),
    status: z.enum(['queued', 'duplicate']),
    executionId: z.string().min(1),
    jobId: z.string().uuid(),
    destination: v4DestinationSchema,
    idempotencyKey: z.string().uuid(),
    queuedAt: z.string().datetime({ offset: true }),
    dispatchState: v4DispatchStatusSchema
  })
  .strict();

export type ZhiDispatchResponse = z.infer<typeof zhiDispatchResponseSchema>;

export const zhiDestinationsResponseSchema = z
  .object({
    ok: z.literal(true),
    mode: z.literal('zhi'),
    destinations: z.array(v4DestinationSchema)
  })
  .strict();

export type ZhiDestinationsResponse = z.infer<typeof zhiDestinationsResponseSchema>;
