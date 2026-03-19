'use client';

import { formatZodIssues } from '@/shared/contracts/common';
import {
  type HitlApprovalRequest,
  type HitlApprovalResponse,
  type HitlCardRequest,
  type HitlCardResponse,
  type HitlQueueResponse,
  hitlApprovalResponseSchema,
  hitlCardResponseSchema,
  hitlQueueResponseSchema
} from '@/shared/contracts/v4/hitl';
import {
  type ZhiDispatchRequest,
  type ZhiDispatchResponse,
  zhiDispatchResponseSchema
} from '@/shared/contracts/v4/zhi';

function formatIssues(issues: ReturnType<typeof formatZodIssues>): string {
  if (issues.length === 0) {
    return '';
  }

  return issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ');
}

async function readJsonResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function readErrorMessage(rawResponse: unknown, fallback: string): string {
  return rawResponse && typeof rawResponse === 'object' && 'error' in rawResponse && typeof rawResponse.error === 'string'
    ? rawResponse.error
    : fallback;
}

export async function queueHybridZhiDispatch(
  payload: ZhiDispatchRequest
): Promise<ZhiDispatchResponse> {
  const response = await fetch('/api/v4/zhi/dispatch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': payload.clientRequestId
    },
    body: JSON.stringify(payload)
  });

  const rawResponse = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(rawResponse, 'ZHI dispatch failed.'));
  }

  const parsed = zhiDispatchResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    throw new Error(
      `ZHI dispatch response contract mismatch. ${formatIssues(formatZodIssues(parsed.error))}`
    );
  }

  return parsed.data;
}

export async function createHybridHitlCard(
  payload: HitlCardRequest
): Promise<HitlCardResponse> {
  const response = await fetch('/api/v4/hitl/cards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': payload.clientRequestId
    },
    body: JSON.stringify(payload)
  });

  const rawResponse = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(rawResponse, 'HITL card creation failed.'));
  }

  const parsed = hitlCardResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    throw new Error(`HITL card response mismatch. ${formatIssues(formatZodIssues(parsed.error))}`);
  }

  return parsed.data;
}

export async function fetchHybridHitlQueue(): Promise<HitlQueueResponse> {
  const response = await fetch('/api/v4/hitl/queue', {
    cache: 'no-store',
    headers: {
      'Idempotency-Key': crypto.randomUUID()
    }
  });

  const rawResponse = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(rawResponse, 'HITL queue fetch failed.'));
  }

  const parsed = hitlQueueResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    throw new Error(`HITL queue response mismatch. ${formatIssues(formatZodIssues(parsed.error))}`);
  }

  return parsed.data;
}

export async function approveHybridHitlCard(input: {
  approvalId: string;
  payload: HitlApprovalRequest;
  idempotencyKey: string;
}): Promise<HitlApprovalResponse> {
  const response = await fetch(`/api/v4/hitl/approvals/${input.approvalId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey
    },
    body: JSON.stringify(input.payload)
  });

  const rawResponse = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(rawResponse, 'HITL approval failed.'));
  }

  const parsed = hitlApprovalResponseSchema.safeParse(rawResponse);
  if (!parsed.success) {
    throw new Error(`HITL approval response mismatch. ${formatIssues(formatZodIssues(parsed.error))}`);
  }

  return parsed.data;
}
