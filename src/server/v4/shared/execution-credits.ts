import type { PoolClient } from 'pg';
import {
  type V4ExecutionCreditChargeResult,
  v4ExecutionCreditChargeResultSchema
} from '@/shared/contracts/v4/common';
import { getV4ServerEnv } from '@/server/v4/shared/env';
import { withV4Transaction } from '@/server/v4/shared/database';

type ClientLike = Pick<PoolClient, 'query'>;

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

export async function consumeExecutionCredit(input: {
  referenceId: string;
  accountKey?: string;
  reason: string;
}): Promise<V4ExecutionCreditChargeResult> {
  const env = getV4ServerEnv();
  const resolvedAccountKey = input.accountKey ?? env.V4_EXECUTION_CREDIT_ACCOUNT_KEY;

  return withV4Transaction(async (client) => {
    await ensureExecutionCreditAccount(client, resolvedAccountKey);

    const accountResult = await client.query<{ balance: number }>(
      `
        SELECT balance
        FROM v4_execution_credit_accounts
        WHERE account_key = $1
        FOR UPDATE
      `,
      [resolvedAccountKey]
    );

    if (accountResult.rowCount === 0) {
      throw new Error(`Execution credit account "${resolvedAccountKey}" was not found.`);
    }

    const existingChargeResult = await client.query(
      `
        SELECT reference_id
        FROM v4_execution_credit_ledger
        WHERE reference_id = $1
      `,
      [input.referenceId]
    );

    if (existingChargeResult.rowCount) {
      return v4ExecutionCreditChargeResultSchema.parse({
        accountKey: resolvedAccountKey,
        remainingCredits: accountResult.rows[0].balance,
        deducted: false
      });
    }

    if (accountResult.rows[0].balance < 1) {
      throw new Error(`Execution credit balance is exhausted for "${resolvedAccountKey}".`);
    }

    const updatedAccountResult = await client.query<{ balance: number }>(
      `
        UPDATE v4_execution_credit_accounts
        SET balance = balance - 1,
            updated_at = NOW()
        WHERE account_key = $1
        RETURNING balance
      `,
      [resolvedAccountKey]
    );

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
      deducted: true
    });
  });
}
