import { z } from 'zod';
import {
  v4DestinationKeySchema,
  type V4Destination,
  v4DestinationSchema,
  type V4ExecutionCreditChargeResult,
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
    status: z.enum(['executed', 'duplicate']),
    executionId: z.string().min(1),
    destination: v4DestinationSchema,
    credits: v4ExecutionCreditChargeResultSchema
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
