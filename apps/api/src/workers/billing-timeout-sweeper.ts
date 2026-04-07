import type { BillingAccount, BillingTransaction, Prisma, PrismaClient } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { enqueueOutboxEvent } from '@ssce/db/transactional-outbox';
import { runSerializableTransactionWithRetry } from '@ssce/db/serializable-retry';

type ExpiredBillingRow = {
  id: string;
  uid: string;
  clientRequestId: string;
  costCredits: number;
  status: string;
};

function expiredTransactionClaimSql(now: Date, batchSize: number) {
  return PrismaNamespace.sql`
    SELECT
      id,
      uid,
      client_request_id AS "clientRequestId",
      cost_credits AS "costCredits",
      status
    FROM billing_transactions
    WHERE status IN ('reserved', 'executing')
      AND finalized_at IS NULL
      AND expires_at <= ${now}
    ORDER BY expires_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT ${batchSize}
  `;
}

async function requireAccount(tx: Prisma.TransactionClient, uid: string) {
  const account = await tx.billingAccount.findUnique({
    where: { uid }
  });

  if (!account) {
    throw new Error(`Billing account ${uid} is missing during timeout sweep.`);
  }

  return account;
}

export const BILLING_TIMEOUT_SWEEPER_LOCK_SQL = 'FOR UPDATE SKIP LOCKED';

export class BillingTimeoutSweeper {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async runOnce(batchSize = 25) {
    return runSerializableTransactionWithRetry(this.prisma, async (rawTx) => {
      const tx = rawTx as Prisma.TransactionClient;
      const now = this.now();
      const expiredRows = await tx.$queryRaw<ExpiredBillingRow[]>(
        expiredTransactionClaimSql(now, batchSize)
      );
      const settled: string[] = [];

      for (const row of expiredRows) {
        const account = await requireAccount(tx, row.uid);
        if (account.pendingCredits < row.costCredits) {
          throw new Error(`Billing account ${row.uid} pending credits would go negative during timeout sweep.`);
        }

        await tx.billingAccount.update({
          where: { uid: row.uid },
          data: {
            availableCredits: account.availableCredits + row.costCredits,
            pendingCredits: account.pendingCredits - row.costCredits,
            refundedCredits: account.refundedCredits + row.costCredits,
            occVersion: {
              increment: 1
            }
          }
        });

        await tx.billingTransaction.update({
          where: { clientRequestId: row.clientRequestId },
          data: {
            status: 'refunded',
            lastError: 'Timed out and finalized by the billing sweeper.',
            heartbeatAt: now,
            finalizedAt: now
          }
        });

        await enqueueOutboxEvent(tx, {
          aggregateId: row.id,
          aggregateType: 'billing_transaction',
          eventType: 'billing.transaction.timed_out',
          idempotencyKey: `billing:${row.clientRequestId}:timed-out`,
          payload: {
            uid: row.uid,
            clientRequestId: row.clientRequestId,
            previousStatus: row.status,
            finalizedAt: now.toISOString()
          }
        });

        settled.push(row.clientRequestId);
      }

      return {
        batchSize,
        settledClientRequestIds: settled
      };
    });
  }
}
