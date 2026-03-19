import { getV4Destination } from '@/shared/contracts/v4/common';
import type { HitlApprovalCard, HitlCardRequest } from '@/shared/contracts/v4/hitl';
import { queryV4 } from '@/server/v4/shared/database';
import { getV4ServerEnv } from '@/server/v4/shared/env';

type HitlApprovalRow = {
  approval_id: string;
  client_request_id: string;
  destination_key: string;
  transcript_text: string;
  structured_fields: string;
  status: HitlApprovalCard['status'];
  job_id: string | null;
  buffer_key: string | null;
  webhook_idempotency_key: string | null;
  retry_count: number;
  last_error: string | null;
  actor: string | null;
  account_key: string;
  executed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIsoString(value: string | Date | null): string | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function mapHitlApprovalCard(row: HitlApprovalRow): HitlApprovalCard {
  const destination = getV4Destination(row.destination_key);
  if (!destination) {
    throw new Error(`Unknown HITL destination "${row.destination_key}".`);
  }

  return {
    approvalId: row.approval_id,
    clientRequestId: row.client_request_id,
    destination,
    transcriptText: row.transcript_text,
    fields: JSON.parse(row.structured_fields) as HitlApprovalCard['fields'],
    status: row.status,
    accountKey: row.account_key,
    jobId: row.job_id ?? undefined,
    retryCount: row.retry_count,
    lastError: row.last_error ?? undefined,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    resolvedAt: toIsoString(row.executed_at),
    actor: row.actor ?? undefined
  };
}

const approvalSelect = `
  SELECT approval_id,
         client_request_id,
         destination_key,
         transcript_text,
         structured_fields::text,
         status,
         job_id,
         buffer_key,
         webhook_idempotency_key,
         retry_count,
         last_error,
         actor,
         account_key,
         executed_at,
         created_at,
         updated_at
  FROM v4_approvals
`;

export async function findApprovalByClientRequestId(
  clientRequestId: string
): Promise<HitlApprovalCard | null> {
  const result = await queryV4<HitlApprovalRow>(
    `
      ${approvalSelect}
      WHERE client_request_id = $1
    `,
    [clientRequestId]
  );

  return result.rowCount ? mapHitlApprovalCard(result.rows[0]) : null;
}

export async function createPendingApproval(
  input: HitlCardRequest & {
    fields: HitlApprovalCard['fields'];
  }
): Promise<HitlApprovalCard> {
  const existingApproval = await findApprovalByClientRequestId(input.clientRequestId);
  if (existingApproval) {
    return existingApproval;
  }

  const accountKey = input.accountKey ?? getV4ServerEnv().V4_EXECUTION_CREDIT_ACCOUNT_KEY;
  const approvalId = `hitl_${crypto.randomUUID()}`;
  const result = await queryV4<HitlApprovalRow>(
    `
      INSERT INTO v4_approvals (
        approval_id,
        client_request_id,
        destination_key,
        transcript_text,
        structured_fields,
        status,
        account_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING approval_id,
                client_request_id,
                destination_key,
                transcript_text,
                structured_fields::text,
                status,
                job_id,
                buffer_key,
                webhook_idempotency_key,
                retry_count,
                last_error,
                actor,
                account_key,
                executed_at,
                created_at,
                updated_at
    `,
    [
      approvalId,
      input.clientRequestId,
      input.destinationKey,
      input.transcriptText,
      JSON.stringify(input.fields),
      'pending',
      accountKey
    ]
  );

  return mapHitlApprovalCard(result.rows[0]);
}

export async function listPendingApprovals(): Promise<HitlApprovalCard[]> {
  const result = await queryV4<HitlApprovalRow>(
    `
      ${approvalSelect}
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `
  );

  return result.rows.map(mapHitlApprovalCard);
}

export async function getApprovalById(approvalId: string): Promise<HitlApprovalCard | null> {
  const result = await queryV4<HitlApprovalRow>(
    `
      ${approvalSelect}
      WHERE approval_id = $1
    `,
    [approvalId]
  );

  return result.rowCount ? mapHitlApprovalCard(result.rows[0]) : null;
}

export async function updateApproval(input: {
  approvalId: string;
  status: HitlApprovalCard['status'];
  fields: HitlApprovalCard['fields'];
  actor?: string;
}): Promise<HitlApprovalCard> {
  const result = await queryV4<HitlApprovalRow>(
    `
      UPDATE v4_approvals
      SET structured_fields = $2,
          status = $3,
          actor = $4,
          executed_at = CASE WHEN $3 IN ('rejected', 'executed', 'failed') THEN NOW() ELSE executed_at END,
          updated_at = NOW()
      WHERE approval_id = $1
      RETURNING approval_id,
                client_request_id,
                destination_key,
                transcript_text,
                structured_fields::text,
                status,
                job_id,
                buffer_key,
                webhook_idempotency_key,
                retry_count,
                last_error,
                actor,
                account_key,
                executed_at,
                created_at,
                updated_at
    `,
    [input.approvalId, JSON.stringify(input.fields), input.status, input.actor ?? null]
  );

  return mapHitlApprovalCard(result.rows[0]);
}

export async function queueApprovalExecution(input: {
  approvalId: string;
  actor: string;
  fields: HitlApprovalCard['fields'];
  jobId: string;
  bufferKey: string;
  webhookIdempotencyKey: string;
}): Promise<HitlApprovalCard> {
  const result = await queryV4<HitlApprovalRow>(
    `
      UPDATE v4_approvals
      SET structured_fields = $2,
          status = 'approved',
          actor = $3,
          job_id = $4,
          buffer_key = $5,
          webhook_idempotency_key = $6,
          retry_count = 0,
          last_error = NULL,
          updated_at = NOW()
      WHERE approval_id = $1
      RETURNING approval_id,
                client_request_id,
                destination_key,
                transcript_text,
                structured_fields::text,
                status,
                job_id,
                buffer_key,
                webhook_idempotency_key,
                retry_count,
                last_error,
                actor,
                account_key,
                executed_at,
                created_at,
                updated_at
    `,
    [
      input.approvalId,
      JSON.stringify(input.fields),
      input.actor,
      input.jobId,
      input.bufferKey,
      input.webhookIdempotencyKey
    ]
  );

  return mapHitlApprovalCard(result.rows[0]);
}

export async function markHitlApprovalProcessing(approvalId: string, retryCount: number): Promise<void> {
  await queryV4(
    `
      UPDATE v4_approvals
      SET status = 'processing',
          retry_count = $2,
          updated_at = NOW()
      WHERE approval_id = $1
    `,
    [approvalId, retryCount]
  );
}

export async function markHitlApprovalQueuedForRetry(
  approvalId: string,
  errorMessage: string,
  retryCount: number
): Promise<void> {
  await queryV4(
    `
      UPDATE v4_approvals
      SET status = 'approved',
          retry_count = $2,
          last_error = $3,
          updated_at = NOW()
      WHERE approval_id = $1
    `,
    [approvalId, retryCount, errorMessage]
  );
}

export async function markHitlApprovalExecuted(approvalId: string): Promise<void> {
  await queryV4(
    `
      UPDATE v4_approvals
      SET status = 'executed',
          last_error = NULL,
          executed_at = NOW(),
          updated_at = NOW()
      WHERE approval_id = $1
    `,
    [approvalId]
  );
}

export async function markHitlApprovalFailed(
  approvalId: string,
  errorMessage: string,
  retryCount: number
): Promise<void> {
  await queryV4(
    `
      UPDATE v4_approvals
      SET status = 'failed',
          retry_count = $2,
          last_error = $3,
          executed_at = NOW(),
          updated_at = NOW()
      WHERE approval_id = $1
    `,
    [approvalId, retryCount, errorMessage]
  );
}
