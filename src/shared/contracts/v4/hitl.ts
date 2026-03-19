import { z } from 'zod';
import {
  v4ApprovalStatusSchema,
  v4DestinationKeySchema,
  v4DestinationSchema,
  v4ExecutionCreditChargeResultSchema,
  v4StructuredFieldSchema
} from '@/shared/contracts/v4/common';

export const hitlCardRequestSchema = z
  .object({
    clientRequestId: z.string().min(1),
    transcriptText: z.string().min(1).max(20_000),
    destinationKey: v4DestinationKeySchema,
    sessionId: z.string().trim().min(1).max(128).optional(),
    accountKey: z.string().trim().min(1).max(128).optional()
  })
  .strict();

export type HitlCardRequest = z.infer<typeof hitlCardRequestSchema>;

export const hitlApprovalCardSchema = z
  .object({
    approvalId: z.string().min(1),
    clientRequestId: z.string().min(1),
    destination: v4DestinationSchema,
    transcriptText: z.string().min(1).max(20_000),
    fields: z.array(v4StructuredFieldSchema),
    status: v4ApprovalStatusSchema,
    accountKey: z.string().min(1),
    createdAt: z.string().datetime(),
    resolvedAt: z.string().datetime().optional(),
    actor: z.string().min(1).optional()
  })
  .strict();

export type HitlApprovalCard = z.infer<typeof hitlApprovalCardSchema>;

export const hitlCardResponseSchema = z
  .object({
    ok: z.literal(true),
    mode: z.literal('hitl'),
    approval: hitlApprovalCardSchema
  })
  .strict();

export type HitlCardResponse = z.infer<typeof hitlCardResponseSchema>;

export const hitlApprovalRequestSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    actor: z.string().min(1),
    fields: z.array(v4StructuredFieldSchema).default([])
  })
  .strict();

export type HitlApprovalRequest = z.infer<typeof hitlApprovalRequestSchema>;

export const hitlApprovalResponseSchema = z
  .object({
    ok: z.literal(true),
    mode: z.literal('hitl'),
    approval: hitlApprovalCardSchema,
    credits: v4ExecutionCreditChargeResultSchema.optional()
  })
  .strict();

export type HitlApprovalResponse = z.infer<typeof hitlApprovalResponseSchema>;

export const hitlQueueResponseSchema = z
  .object({
    ok: z.literal(true),
    mode: z.literal('hitl'),
    pending: z.array(hitlApprovalCardSchema)
  })
  .strict();

export type HitlQueueResponse = z.infer<typeof hitlQueueResponseSchema>;
