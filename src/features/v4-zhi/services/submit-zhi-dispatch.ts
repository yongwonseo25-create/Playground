'use client';

import { formatZodIssues } from '@/shared/contracts/common';
import {
  type ZhiDispatchRequest,
  type ZhiDispatchResponse,
  zhiDispatchRequestSchema,
  zhiDispatchResponseSchema
} from '@/shared/contracts/v4/zhi';

function formatIssues(issues: ReturnType<typeof formatZodIssues>): string {
  if (issues.length === 0) {
    return '';
  }

  return issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ');
}

export async function submitZhiDispatch(payload: ZhiDispatchRequest): Promise<ZhiDispatchResponse> {
  const parsedPayload = zhiDispatchRequestSchema.safeParse(payload);
  if (!parsedPayload.success) {
    throw new Error(`Invalid ZHI dispatch request. ${formatIssues(formatZodIssues(parsedPayload.error))}`);
  }

  const response = await fetch('/api/v4/zhi/dispatch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': parsedPayload.data.clientRequestId
    },
    body: JSON.stringify(parsedPayload.data)
  });

  const rawResponse = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      rawResponse && typeof rawResponse.error === 'string' ? rawResponse.error : 'ZHI dispatch failed.';
    throw new Error(message);
  }

  const parsedResponse = zhiDispatchResponseSchema.safeParse(rawResponse);
  if (!parsedResponse.success) {
    throw new Error(
      `ZHI dispatch response contract mismatch. ${formatIssues(formatZodIssues(parsedResponse.error))}`
    );
  }

  return parsedResponse.data;
}
