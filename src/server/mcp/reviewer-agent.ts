import {
  analyzeCloudUpdate,
  reviewerFeedbackSchema,
  type ReviewerFeedback
} from '@/server/mcp/reviewer-static-analysis';
import { updatesPullResultSchema } from '@/server/mcp/contracts';

export interface ReviewerBridge {
  request<T>(method: string, params?: unknown): Promise<T>;
}

export interface ReviewerCycleResult {
  cursor: string | null;
  feedback: ReviewerFeedback[];
}

export async function runReviewerCycle(
  bridge: ReviewerBridge,
  cursor: string | null = null
): Promise<ReviewerCycleResult> {
  const response = updatesPullResultSchema.parse(
    await bridge.request('updates.pull', {
      cursor
    })
  );

  const feedback: ReviewerFeedback[] = [];

  for (const update of response.updates) {
    const review = reviewerFeedbackSchema.parse(analyzeCloudUpdate(update));
    await bridge.request('reviews.submit', review);
    feedback.push(review);
  }

  return {
    cursor: response.cursor,
    feedback
  };
}
