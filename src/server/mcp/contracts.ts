import { z } from 'zod';
import {
  cloudUpdateBatchSchema,
  reviewerFeedbackSchema
} from '@/server/mcp/reviewer-static-analysis';

export const updatesPullParamsSchema = z.object({
  cursor: z.string().nullable().optional().default(null)
});

export const updatesPullResultSchema = z.object({
  cursor: z.string().nullable().default(null),
  updates: z.array(cloudUpdateBatchSchema).default([])
});

export const reviewsSubmitParamsSchema = reviewerFeedbackSchema;

export const reviewsSubmitResultSchema = z.object({
  ok: z.literal(true)
});

export type UpdatesPullParams = z.infer<typeof updatesPullParamsSchema>;
export type UpdatesPullResult = z.infer<typeof updatesPullResultSchema>;
export type ReviewsSubmitParams = z.infer<typeof reviewsSubmitParamsSchema>;
export type ReviewsSubmitResult = z.infer<typeof reviewsSubmitResultSchema>;
