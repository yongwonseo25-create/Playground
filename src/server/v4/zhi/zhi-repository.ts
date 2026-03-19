import { queryV4 } from '@/server/v4/shared/database';
import { getV4ServerEnv } from '@/server/v4/shared/env';

type ZhiDispatchRow = {
  execution_id: string;
  client_request_id: string;
  destination_key: string;
  transcript_text: string;
  structured_payload: Record<string, unknown>;
  status: string;
  account_key: string;
  webhook_delivered_at: string | null;
  credit_consumed_at: string | null;
  created_at: string;
  updated_at: string;
};

export interface ZhiDispatchRecord {
  executionId: string;
  clientRequestId: string;
  destinationKey: string;
  transcriptText: string;
  structuredPayload: Record<string, unknown>;
  status: string;
  accountKey: string;
  webhookDeliveredAt: string | null;
  creditConsumedAt: string | null;
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
    accountKey: row.account_key,
    webhookDeliveredAt: row.webhook_delivered_at,
    creditConsumedAt: row.credit_consumed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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
             account_key,
             webhook_delivered_at,
             credit_consumed_at,
             created_at,
             updated_at
      FROM v4_dispatches
      WHERE client_request_id = $1
    `,
    [clientRequestId]
  );

  return result.rowCount ? mapZhiDispatchRecord(result.rows[0]) : null;
}

export async function createZhiDispatchRecord(input: {
  clientRequestId: string;
  destinationKey: string;
  transcriptText: string;
  structuredPayload: Record<string, unknown>;
  accountKey?: string;
}): Promise<ZhiDispatchRecord> {
  const accountKey = input.accountKey ?? getV4ServerEnv().V4_EXECUTION_CREDIT_ACCOUNT_KEY;
  const executionId = `zhi_${crypto.randomUUID()}`;
  const result = await queryV4<ZhiDispatchRow>(
    `
      INSERT INTO v4_dispatches (
        execution_id,
        client_request_id,
        destination_key,
        transcript_text,
        structured_payload,
        status,
        account_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING execution_id,
                client_request_id,
                destination_key,
                transcript_text,
                structured_payload,
                status,
                account_key,
                webhook_delivered_at,
                credit_consumed_at,
                created_at,
                updated_at
    `,
    [
      executionId,
      input.clientRequestId,
      input.destinationKey,
      input.transcriptText,
      JSON.stringify(input.structuredPayload),
      'pending',
      accountKey
    ]
  );

  return mapZhiDispatchRecord(result.rows[0]);
}

export async function markZhiDispatchExecuted(executionId: string): Promise<void> {
  await queryV4(
    `
      UPDATE v4_dispatches
      SET status = 'executed',
          webhook_delivered_at = NOW(),
          credit_consumed_at = NOW(),
          updated_at = NOW()
      WHERE execution_id = $1
    `,
    [executionId]
  );
}
