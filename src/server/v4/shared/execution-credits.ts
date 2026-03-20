import type { PoolClient } from 'pg';
import { getV4ServerEnv } from '@/server/v4/shared/env';
import { withV4Transaction, queryV4 } from '@/server/v4/shared/database';

type ClientLike = Pick<PoolClient, 'query'>;
type CreditAccountRow = {
  balance: number;
  version: number;
};

type CreditTransactionRow = {
  transaction_id: string;
  reference_id: string;
  account_key: string;
  destination_key: string;
  status: ExecutionCreditTransactionStatus;
  reason: string;
  failure_reason: string | null;
  settled_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type ExecutionCreditTransactionStatus = 'pending' | 'completed' | 'refunded';

export interface ExecutionCreditAccountSnapshot {
  accountKey: string;
  balance: number;
  version: number;
}

export interface ExecutionCreditTransactionSnapshot {
  transactionId: string;
  referenceId: string;
  accountKey: string;
  destinationKey: string;
  status: ExecutionCreditTransactionStatus;
  reason: string;
  failureReason?: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionCreditReservationResult {
  transactionId: string;
  accountKey: string;
  remainingCredits: number;
  status: ExecutionCreditTransactionStatus;
  reserved: boolean;
  version: number;
}

export interface ExecutionCreditSettlementResult {
  transactionId: string;
  accountKey: string;
  remainingCredits: number;
  status: ExecutionCreditTransactionStatus;
  changed: boolean;
  version: number;
}

function toIsoString(value: string | Date | null): string | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function mapTransactionRow(row: CreditTransactionRow): ExecutionCreditTransactionSnapshot {
  return {
    transactionId: row.transaction_id,
    referenceId: row.reference_id,
    accountKey: row.account_key,
    destinationKey: row.destination_key,
    status: row.status,
    reason: row.reason,
    failureReason: row.failure_reason ?? undefined,
    settledAt: toIsoString(row.settled_at),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString()
  };
}

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

async function readExecutionTransactionByReferenceId(
  client: ClientLike,
  referenceId: string
): Promise<ExecutionCreditTransactionSnapshot | null> {
  const result = await client.query<CreditTransactionRow>(
    `
      SELECT transaction_id,
             reference_id,
             account_key,
             destination_key,
             status,
             reason,
             failure_reason,
             settled_at,
             created_at,
             updated_at
      FROM v4_execution_credit_transactions
      WHERE reference_id = $1
    `,
    [referenceId]
  );

  return result.rowCount ? mapTransactionRow(result.rows[0]) : null;
}

async function readExecutionTransactionById(
  client: ClientLike,
  transactionId: string
): Promise<ExecutionCreditTransactionSnapshot | null> {
  const result = await client.query<CreditTransactionRow>(
    `
      SELECT transaction_id,
             reference_id,
             account_key,
             destination_key,
             status,
             reason,
             failure_reason,
             settled_at,
             created_at,
             updated_at
      FROM v4_execution_credit_transactions
      WHERE transaction_id = $1
    `,
    [transactionId]
  );

  return result.rowCount ? mapTransactionRow(result.rows[0]) : null;
}

async function insertLedgerEntry(input: {
  client: ClientLike;
  transactionId: string;
  referenceId: string;
  accountKey: string;
  delta: number;
  reason: string;
  entryType: 'reserve' | 'complete' | 'refund';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await input.client.query(
    `
      INSERT INTO v4_execution_credit_ledger (
        entry_id,
        reference_id,
        account_key,
        transaction_id,
        delta,
        reason,
        entry_type,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      `ledger_${crypto.randomUUID()}`,
      input.referenceId,
      input.accountKey,
      input.transactionId,
      input.delta,
      input.reason,
      input.entryType,
      JSON.stringify(input.metadata ?? {})
    ]
  );
}

export async function reserveExecutionCredit(input: {
  referenceId: string;
  destinationKey: string;
  accountKey?: string;
  reason: string;
}): Promise<ExecutionCreditReservationResult> {
  const env = getV4ServerEnv();
  const resolvedAccountKey = input.accountKey ?? env.V4_EXECUTION_CREDIT_ACCOUNT_KEY;
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await withV4Transaction(async (client) => {
        await ensureExecutionCreditAccount(client, resolvedAccountKey);

        const existingTransaction = await readExecutionTransactionByReferenceId(client, input.referenceId);
        const accountSnapshot = await readCreditAccount(client, resolvedAccountKey);
        if (!accountSnapshot) {
          throw new Error(`Execution credit account "${resolvedAccountKey}" was not found.`);
        }

        if (existingTransaction) {
          return {
            transactionId: existingTransaction.transactionId,
            accountKey: resolvedAccountKey,
            remainingCredits: accountSnapshot.balance,
            status: existingTransaction.status,
            reserved: false,
            version: accountSnapshot.version
          };
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

        const transactionId = crypto.randomUUID();
        await client.query(
          `
            INSERT INTO v4_execution_credit_transactions (
              transaction_id,
              reference_id,
              account_key,
              destination_key,
              status,
              reason
            )
            VALUES ($1, $2, $3, $4, 'pending', $5)
          `,
          [transactionId, input.referenceId, resolvedAccountKey, input.destinationKey, input.reason]
        );

        await insertLedgerEntry({
          client,
          transactionId,
          referenceId: input.referenceId,
          accountKey: resolvedAccountKey,
          delta: -1,
          reason: input.reason,
          entryType: 'reserve',
          metadata: {
            destinationKey: input.destinationKey
          }
        });

        return {
          transactionId,
          accountKey: resolvedAccountKey,
          remainingCredits: updatedAccountResult.rows[0].balance,
          status: 'pending' as const,
          reserved: true,
          version: updatedAccountResult.rows[0].version
        };
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

export async function completeExecutionCreditTransaction(input: {
  transactionId: string;
  referenceId: string;
  accountKey?: string;
  reason: string;
}): Promise<ExecutionCreditSettlementResult> {
  const env = getV4ServerEnv();
  const resolvedAccountKey = input.accountKey ?? env.V4_EXECUTION_CREDIT_ACCOUNT_KEY;

  return withV4Transaction(async (client) => {
    await ensureExecutionCreditAccount(client, resolvedAccountKey);
    const transaction = await readExecutionTransactionById(client, input.transactionId);
    if (!transaction) {
      throw new Error(`Execution credit transaction "${input.transactionId}" was not found.`);
    }

    const accountSnapshot = await readCreditAccount(client, transaction.accountKey);
    if (!accountSnapshot) {
      throw new Error(`Execution credit account "${transaction.accountKey}" was not found.`);
    }

    if (transaction.status === 'completed') {
      return {
        transactionId: transaction.transactionId,
        accountKey: transaction.accountKey,
        remainingCredits: accountSnapshot.balance,
        status: transaction.status,
        changed: false,
        version: accountSnapshot.version
      };
    }

    if (transaction.status === 'refunded') {
      return {
        transactionId: transaction.transactionId,
        accountKey: transaction.accountKey,
        remainingCredits: accountSnapshot.balance,
        status: transaction.status,
        changed: false,
        version: accountSnapshot.version
      };
    }

    await client.query(
      `
        UPDATE v4_execution_credit_transactions
        SET status = 'completed',
            failure_reason = NULL,
            settled_at = NOW(),
            updated_at = NOW()
        WHERE transaction_id = $1
      `,
      [transaction.transactionId]
    );

    await insertLedgerEntry({
      client,
      transactionId: transaction.transactionId,
      referenceId: input.referenceId,
      accountKey: transaction.accountKey,
      delta: 0,
      reason: input.reason,
      entryType: 'complete'
    });

    return {
      transactionId: transaction.transactionId,
      accountKey: transaction.accountKey,
      remainingCredits: accountSnapshot.balance,
      status: 'completed',
      changed: true,
      version: accountSnapshot.version
    };
  });
}

export async function refundExecutionCreditTransaction(input: {
  transactionId: string;
  referenceId: string;
  accountKey?: string;
  reason: string;
  failureReason: string;
}): Promise<ExecutionCreditSettlementResult> {
  const env = getV4ServerEnv();
  const resolvedAccountKey = input.accountKey ?? env.V4_EXECUTION_CREDIT_ACCOUNT_KEY;
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await withV4Transaction(async (client) => {
        await ensureExecutionCreditAccount(client, resolvedAccountKey);
        const transaction = await readExecutionTransactionById(client, input.transactionId);
        if (!transaction) {
          throw new Error(`Execution credit transaction "${input.transactionId}" was not found.`);
        }

        const accountSnapshot = await readCreditAccount(client, transaction.accountKey);
        if (!accountSnapshot) {
          throw new Error(`Execution credit account "${transaction.accountKey}" was not found.`);
        }

        if (transaction.status === 'refunded') {
          return {
            transactionId: transaction.transactionId,
            accountKey: transaction.accountKey,
            remainingCredits: accountSnapshot.balance,
            status: 'refunded',
            changed: false,
            version: accountSnapshot.version
          };
        }

        if (transaction.status === 'completed') {
          return {
            transactionId: transaction.transactionId,
            accountKey: transaction.accountKey,
            remainingCredits: accountSnapshot.balance,
            status: 'completed',
            changed: false,
            version: accountSnapshot.version
          };
        }

        const updatedAccountResult = await client.query<CreditAccountRow>(
          `
            UPDATE v4_execution_credit_accounts
            SET balance = balance + 1,
                version = version + 1,
                updated_at = NOW()
            WHERE account_key = $1
              AND version = $2
            RETURNING balance, version
          `,
          [transaction.accountKey, accountSnapshot.version]
        );

        if (updatedAccountResult.rowCount === 0) {
          throw new Error('V4_EXECUTION_CREDIT_VERSION_CONFLICT');
        }

        await client.query(
          `
            UPDATE v4_execution_credit_transactions
            SET status = 'refunded',
                failure_reason = $2,
                settled_at = NOW(),
                updated_at = NOW()
            WHERE transaction_id = $1
          `,
          [transaction.transactionId, input.failureReason]
        );

        await insertLedgerEntry({
          client,
          transactionId: transaction.transactionId,
          referenceId: input.referenceId,
          accountKey: transaction.accountKey,
          delta: 1,
          reason: input.reason,
          entryType: 'refund',
          metadata: {
            failureReason: input.failureReason
          }
        });

        return {
          transactionId: transaction.transactionId,
          accountKey: transaction.accountKey,
          remainingCredits: updatedAccountResult.rows[0].balance,
          status: 'refunded',
          changed: true,
          version: updatedAccountResult.rows[0].version
        };
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'V4_EXECUTION_CREDIT_VERSION_CONFLICT') {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Execution credit refund kept conflicting for "${resolvedAccountKey}".`);
}

export async function getExecutionCreditAccountSnapshot(
  accountKey: string
): Promise<ExecutionCreditAccountSnapshot | null> {
  const result = await queryV4<CreditAccountRow>(
    `
      SELECT balance, version
      FROM v4_execution_credit_accounts
      WHERE account_key = $1
    `,
    [accountKey]
  );

  if (!result.rowCount) {
    return null;
  }

  return {
    accountKey,
    balance: result.rows[0].balance,
    version: result.rows[0].version
  };
}

export async function findExecutionCreditTransactionByReferenceId(
  referenceId: string
): Promise<ExecutionCreditTransactionSnapshot | null> {
  return withV4Transaction(async (client) => readExecutionTransactionByReferenceId(client, referenceId));
}

export async function findExecutionCreditTransactionById(
  transactionId: string
): Promise<ExecutionCreditTransactionSnapshot | null> {
  return withV4Transaction(async (client) => readExecutionTransactionById(client, transactionId));
}
