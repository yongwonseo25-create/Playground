import { queryV4 } from '@/server/v4/shared/database';
import { getV4ServerEnv } from '@/server/v4/shared/env';

type ZhiDispatchRow = {
  execution_id: string;
  client_request_id: string;
  destination_key: string;
  transcript_text: string;
  structured_payload: Record<string, unknown>;
  status: string;
  job_id: string;
  buffer_key: string;
  webhook_idempotency_key: string;
  credit_transaction_id: string | null;
  retry_count: number;
  last_error: string | null;
  account_key: string;
  webhook_delivered_at: string | null;
  credit_consumed_at: string | null;
  queued_at: string;
  created_at: string;
  updated_at: string;
};

function toIsoString(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export interface ZhiDispatchRecord {
  executionId: string;
  clientRequestId: string;
  destinationKey: string;
  transcriptText: string;
  structuredPayload: Record<string, unknown>;
  status: string;
  jobId: string;
  bufferKey: string;
  webhookIdempotencyKey: string;
  transactionId: string | null;
  retryCount: number;
  lastError: string | null;
  accountKey: string;
  webhookDeliveredAt: string | null;
  creditConsumedAt: string | null;
  queuedAt: string;
  createdAt: string;
  updatedAt: string;
}

function mapZhiDispatchRecord(row: ZhiDispatchRow): ZhiDispatchRecord {
  return {
    executionId: row.execution_id,
    clientRequestId: row.client_request_id,
    destinationKey: row.destination_key,
    transcriptText: row.transcript_text,
    structuredPayload: row.structured_payload,
    status: row.status,
    jobId: row.job_id,
    bufferKey: row.buffer_key,
    webhookIdempotencyKey: row.webhook_idempotency_key,
    transactionId: row.credit_transaction_id,
    retryCount: row.retry_count,
    lastError: row.last_error,
    accountKey: row.account_key,
    webhookDeliveredAt: toIsoString(row.webhook_delivered_at),
    creditConsumedAt: toIsoString(row.credit_consumed_at),
    queuedAt: toIsoString(row.queued_at) ?? new Date().toISOString(),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

export async function findZhiDispatchByClientRequestId(
  clientRequestId: string
): Promise<ZhiDispatchRecord | null> {
  const result = await queryV4<ZhiDispatchRow>(
    `
      SELECT execution_id,
             client_request_id,
             destination_key,
             transcript_text,
             structured_payload,
             status,
             job_id,
             buffer_key,
             webhook_idempotency_key,
             credit_transaction_id,
             retry_count,
             last_error,
             account_key,
             webhook_delivered_at,
             credit_consumed_at,
             queued_at,
             created_at,
             updated_at
      FROM v4_dispatches
      WHERE client_request_id = $1
    `,
    [clientRequestId]
  );

  return result.rowCount ? mapZhiDispatchRecord(result.rows[0]) : null;
}

export async function findZhiDispatchByExecutionId(
  executionId: string
): Promise<ZhiDispatchRecord | null> {
  const result = await queryV4<ZhiDispatchRow>(
    `
      SELECT execution_id,
             client_request_id,
             destination_key,
             transcript_text,
             structured_payload,
             status,
             job_id,
             buffer_key,
             webhook_idempotency_key,
             credit_transaction_id,
             retry_count,
             last_error,
             account_key,
             webhook_delivered_at,
             credit_consumed_at,
             queued_at,
             created_at,
             updated_at
      FROM v4_dispatches
      WHERE execution_id = $1
    `,
    [executionId]
  );

  return result.rowCount ? mapZhiDispatchRecord(result.rows[0]) : null;
}

export async function createZhiDispatchRecord(input: {
  executionId: string;
  jobId: string;
  bufferKey: string;
  webhookIdempotencyKey: string;
  transactionId: string;
  clientRequestId: string;
  destinationKey: string;
  transcriptText: string;
  structuredPayload: Record<string, unknown>;
  accountKey?: string;
}): Promise<ZhiDispatchRecord> {
  const accountKey = input.accountKey ?? getV4ServerEnv().V4_EXECUTION_CREDIT_ACCOUNT_KEY;
  const result = await queryV4<ZhiDispatchRow>(
    `
      INSERT INTO v4_dispatches (
        execution_id,
        client_request_id,
        destination_key,
        transcript_text,
        structured_payload,
        status,
        job_id,
        buffer_key,
        webhook_idempotency_key,
        credit_transaction_id,
        account_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING execution_id,
                client_request_id,
                destination_key,
                transcript_text,
                structured_payload,
                status,
                job_id,
                buffer_key,
                webhook_idempotency_key,
                credit_transaction_id,
                retry_count,
                last_error,
                account_key,
                webhook_delivered_at,
                credit_consumed_at,
                queued_at,
                created_at,
                updated_at
    `,
    [
      input.executionId,
      input.clientRequestId,
      input.destinationKey,
      input.transcriptText,
      JSON.stringify(input.structuredPayload),
      'queued',
      input.jobId,
      input.bufferKey,
      input.webhookIdempotencyKey,
      input.transactionId,
      accountKey
    ]
  );

  return mapZhiDispatchRecord(result.rows[0]);
}

export async function markZhiDispatchProcessing(executionId: string, retryCount: number): Promise<void> {
  await queryV4(
    `
      UPDATE v4_dispatches
      SET status = 'processing',
          retry_count = $2,
          updated_at = NOW()
      WHERE execution_id = $1
    `,
    [executionId, retryCount]
  );
}

export async function markZhiDispatchQueuedForRetry(
  executionId: string,
  errorMessage: string,
  retryCount: number
): Promise<void> {
  await queryV4(
    `
      UPDATE v4_dispatches
      SET status = 'queued',
          retry_count = $2,
          last_error = $3,
          updated_at = NOW()
      WHERE execution_id = $1
    `,
    [executionId, retryCount, errorMessage]
  );
}

export async function markZhiDispatchExecuted(executionId: string): Promise<void> {
  await queryV4(
    `
      UPDATE v4_dispatches
      SET status = 'executed',
          last_error = NULL,
          webhook_delivered_at = NOW(),
          credit_consumed_at = NOW(),
          updated_at = NOW()
      WHERE execution_id = $1
    `,
    [executionId]
  );
}

export async function markZhiDispatchFailed(
  executionId: string,
  errorMessage: string,
  retryCount: number
): Promise<void> {
  await queryV4(
    `
      UPDATE v4_dispatches
      SET status = 'failed',
          retry_count = $2,
          last_error = $3,
          updated_at = NOW()
      WHERE execution_id = $1
    `,
    [executionId, retryCount, errorMessage]
  );
}
