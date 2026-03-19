import type { PoolClient } from 'pg';
import {
  type V4ExecutionCreditChargeResult,
  v4ExecutionCreditChargeResultSchema
} from '@/shared/contracts/v4/common';
import { getV4ServerEnv } from '@/server/v4/shared/env';
import { withV4Transaction } from '@/server/v4/shared/database';

type ClientLike = Pick<PoolClient, 'query'>;
type CreditAccountRow = {
  balance: number;
  version: number;
};

async function ensureExecutionCreditAccount(client: ClientLike, accountKey: string): Promise<void> {
  const env = getV4ServerEnv();
  const isLocalLike =
    env.NEXT_PUBLIC_APP_ENV === 'local' || env.NEXT_PUBLIC_APP_ENV === 'development';

  if (!isLocalLike) {
    return;
  }

  await client.query(
    `
      INSERT INTO v4_execution_credit_accounts (account_key, balance)
      VALUES ($1, $2)
      ON CONFLICT (account_key) DO NOTHING
    `,
    [accountKey, env.V4_EXECUTION_CREDIT_INITIAL_BALANCE]
  );
}

async function readCreditAccount(
  client: ClientLike,
  accountKey: string
): Promise<CreditAccountRow | null> {
  const result = await client.query<CreditAccountRow>(
    `
      SELECT balance, version
      FROM v4_execution_credit_accounts
      WHERE account_key = $1
    `,
    [accountKey]
  );

  return result.rowCount ? result.rows[0] : null;
}

export async function consumeExecutionCredit(input: {
  referenceId: string;
  accountKey?: string;
  reason: string;
}): Promise<V4ExecutionCreditChargeResult> {
  const env = getV4ServerEnv();
  const resolvedAccountKey = input.accountKey ?? env.V4_EXECUTION_CREDIT_ACCOUNT_KEY;
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await withV4Transaction(async (client) => {
        await ensureExecutionCreditAccount(client, resolvedAccountKey);

        const existingChargeResult = await client.query<{ reference_id: string }>(
          `
            SELECT reference_id
            FROM v4_execution_credit_ledger
            WHERE reference_id = $1
          `,
          [input.referenceId]
        );

        const accountSnapshot = await readCreditAccount(client, resolvedAccountKey);
        if (!accountSnapshot) {
          throw new Error(`Execution credit account "${resolvedAccountKey}" was not found.`);
        }

        if (existingChargeResult.rowCount) {
          return v4ExecutionCreditChargeResultSchema.parse({
            accountKey: resolvedAccountKey,
            remainingCredits: accountSnapshot.balance,
            deducted: false,
            version: accountSnapshot.version
          });
        }

        if (accountSnapshot.balance < 1) {
          throw new Error(`Execution credit balance is exhausted for "${resolvedAccountKey}".`);
        }

        const updatedAccountResult = await client.query<CreditAccountRow>(
          `
            UPDATE v4_execution_credit_accounts
            SET balance = balance - 1,
                version = version + 1,
                updated_at = NOW()
            WHERE account_key = $1
              AND version = $2
              AND balance >= 1
            RETURNING balance, version
          `,
          [resolvedAccountKey, accountSnapshot.version]
        );

        if (updatedAccountResult.rowCount === 0) {
          throw new Error('V4_EXECUTION_CREDIT_VERSION_CONFLICT');
        }

        await client.query(
          `
            INSERT INTO v4_execution_credit_ledger (entry_id, reference_id, account_key, delta, reason)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [`ledger_${crypto.randomUUID()}`, input.referenceId, resolvedAccountKey, -1, input.reason]
        );

        return v4ExecutionCreditChargeResultSchema.parse({
          accountKey: resolvedAccountKey,
          remainingCredits: updatedAccountResult.rows[0].balance,
          deducted: true,
          version: updatedAccountResult.rows[0].version
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'V4_EXECUTION_CREDIT_VERSION_CONFLICT') {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Execution credit update kept conflicting for "${resolvedAccountKey}".`);
}
