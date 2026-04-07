import { randomUUID } from 'node:crypto';
import type { BillingAccount, BillingTransaction, Prisma, PrismaClient } from '@prisma/client';
import { enqueueOutboxEvent } from '@ssce/db/transactional-outbox';
import { runSerializableTransactionWithRetry } from '@ssce/db/serializable-retry';
import type {
  BillingReservationResult,
  BillingSettlementResult,
  GenerateOutputInput,
  OutputGeneratorResult
} from './pay-per-output-service';

type BillingDbClient = PrismaClient | Prisma.TransactionClient;

export class PaymentRequiredError extends Error {
  readonly statusCode = 402;

  constructor(message: string) {
    super(message);
    this.name = 'PaymentRequiredError';
  }
}

export class BillingConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'BillingConflictError';
  }
}

export class BillingInvariantError extends Error {
  readonly statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = 'BillingInvariantError';
  }
}

function getRevalidateKeys(uid: string): string[] {
  return [`wallet:${uid}`, `billing:${uid}`];
}

function parseProviderUsage(value: string | null) {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as OutputGeneratorResult['providerUsage'];
}

function balances(account: BillingAccount) {
  return {
    availableCredits: account.availableCredits,
    pendingCredits: account.pendingCredits
  };
}

async function requireAccount(db: BillingDbClient, uid: string) {
  const account = await db.billingAccount.findUnique({
    where: { uid }
  });

  if (!account) {
    throw new PaymentRequiredError('Wallet does not exist for this user.');
  }

  return account;
}

async function requireTransaction(db: BillingDbClient, clientRequestId: string) {
  const transaction = await db.billingTransaction.findUnique({
    where: { clientRequestId }
  });

  if (!transaction) {
    throw new BillingInvariantError('Billing transaction is missing.');
  }

  return transaction;
}

export class PostgresBillingStore {
  constructor(private readonly prisma: PrismaClient) {}

  async reserve(input: GenerateOutputInput): Promise<BillingReservationResult> {
    return runSerializableTransactionWithRetry(this.prisma, async (rawTx) => {
      const tx = rawTx as Prisma.TransactionClient;
      const existing = await tx.billingTransaction.findUnique({
        where: { clientRequestId: input.clientRequestId }
      });

      if (existing) {
        if (existing.uid !== input.uid) {
          throw new BillingConflictError('clientRequestId is already owned by another user.');
        }

        if (existing.status === 'deducted') {
          const account = await requireAccount(tx, input.uid);
          return {
            kind: 'already-deducted',
            transactionId: input.clientRequestId,
            costCredits: existing.costCredits,
            outputText: existing.outputText ?? undefined,
            providerModel: existing.providerModel ?? undefined,
            ...balances(account),
            revalidateKeys: getRevalidateKeys(input.uid)
          };
        }

        throw new BillingConflictError(
          `clientRequestId is already ${existing.status}. Retry with a new clientRequestId.`
        );
      }

      const account = await requireAccount(tx, input.uid);

      if (account.availableCredits < input.costCredits) {
        throw new PaymentRequiredError(
          `Insufficient credits. Required ${input.costCredits}, available ${account.availableCredits}.`
        );
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + input.timeoutMs);

      await tx.billingAccount.update({
        where: { uid: input.uid },
        data: {
          availableCredits: account.availableCredits - input.costCredits,
          pendingCredits: account.pendingCredits + input.costCredits,
          occVersion: {
            increment: 1
          }
        }
      });

      const transactionId = randomUUID();
      await tx.billingTransaction.create({
        data: {
          id: transactionId,
          uid: input.uid,
          clientRequestId: input.clientRequestId,
          costCredits: input.costCredits,
          outputType: input.outputType,
          promptPreview: input.prompt.slice(0, 1_000),
          status: 'reserved',
          expiresAt,
          heartbeatAt: now,
          reservedAt: now
        }
      });

      await enqueueOutboxEvent(tx, {
        aggregateId: transactionId,
        aggregateType: 'billing_transaction',
        eventType: 'billing.transaction.reserved',
        idempotencyKey: `billing:${input.clientRequestId}:reserved`,
        payload: {
          uid: input.uid,
          clientRequestId: input.clientRequestId,
          costCredits: input.costCredits,
          outputType: input.outputType,
          expiresAt: expiresAt.toISOString()
        }
      });

      return {
        kind: 'reserved',
        transactionId: input.clientRequestId,
        costCredits: input.costCredits,
        revalidateKeys: getRevalidateKeys(input.uid)
      };
    });
  }

  async markExecuting(uid: string, clientRequestId: string): Promise<void> {
    await runSerializableTransactionWithRetry(this.prisma, async (rawTx) => {
      const tx = rawTx as Prisma.TransactionClient;
      const transaction = await requireTransaction(tx, clientRequestId);

      if (transaction.uid !== uid) {
        throw new BillingConflictError('Billing transaction user mismatch.');
      }

      if (transaction.status !== 'reserved') {
        return;
      }

      const now = new Date();
      await tx.billingTransaction.update({
        where: { clientRequestId },
        data: {
          status: 'executing',
          executingAt: now,
          heartbeatAt: now
        }
      });

      await enqueueOutboxEvent(tx, {
        aggregateId: transaction.id,
        aggregateType: 'billing_transaction',
        eventType: 'billing.transaction.executing',
        idempotencyKey: `billing:${clientRequestId}:executing`,
        payload: {
          uid,
          clientRequestId,
          executingAt: now.toISOString()
        }
      });
    });
  }

  async heartbeat(uid: string, clientRequestId: string): Promise<void> {
    await this.prisma.billingTransaction.updateMany({
      where: {
        uid,
        clientRequestId,
        status: 'executing',
        finalizedAt: null
      },
      data: {
        heartbeatAt: new Date()
      }
    });
  }

  async deduct(
    input: OutputGeneratorResult & {
      uid: string;
      clientRequestId: string;
    }
  ): Promise<BillingSettlementResult> {
    return runSerializableTransactionWithRetry(this.prisma, async (rawTx) => {
      const tx = rawTx as Prisma.TransactionClient;
      const [account, transaction] = await Promise.all([
        requireAccount(tx, input.uid),
        requireTransaction(tx, input.clientRequestId)
      ]);

      if (transaction.uid !== input.uid) {
        throw new BillingConflictError('Billing transaction user mismatch.');
      }

      if (transaction.status === 'deducted') {
        return {
          transactionId: input.clientRequestId,
          billingStatus: 'deducted',
          ...balances(account),
          revalidateKeys: getRevalidateKeys(input.uid)
        };
      }

      if (transaction.status === 'refunded') {
        throw new BillingConflictError('Cannot deduct a transaction that has already been refunded.');
      }

      if (account.pendingCredits < transaction.costCredits) {
        throw new BillingInvariantError('Wallet pendingCredits would become negative during deduction.');
      }

      const now = new Date();
      await tx.billingAccount.update({
        where: { uid: input.uid },
        data: {
          pendingCredits: account.pendingCredits - transaction.costCredits,
          deductedCredits: account.deductedCredits + transaction.costCredits,
          occVersion: {
            increment: 1
          }
        }
      });

      await tx.billingTransaction.update({
        where: { clientRequestId: input.clientRequestId },
        data: {
          status: 'deducted',
          providerName: input.providerName,
          providerModel: input.providerModel,
          providerLatencyMs: input.providerLatencyMs,
          providerUsageJson: input.providerUsage ? JSON.stringify(input.providerUsage) : null,
          outputText: input.outputText,
          secretVersion: input.secretVersion,
          heartbeatAt: now,
          finalizedAt: now
        }
      });

      await enqueueOutboxEvent(tx, {
        aggregateId: transaction.id,
        aggregateType: 'billing_transaction',
        eventType: 'billing.transaction.deducted',
        idempotencyKey: `billing:${input.clientRequestId}:deducted`,
        payload: {
          uid: input.uid,
          clientRequestId: input.clientRequestId,
          providerModel: input.providerModel,
          providerUsage: input.providerUsage
        }
      });

      return {
        transactionId: input.clientRequestId,
        billingStatus: 'deducted',
        availableCredits: account.availableCredits,
        pendingCredits: account.pendingCredits - transaction.costCredits,
        revalidateKeys: getRevalidateKeys(input.uid)
      };
    });
  }

  async refund(input: { uid: string; clientRequestId: string; reason: string }): Promise<BillingSettlementResult> {
    return runSerializableTransactionWithRetry(this.prisma, async (rawTx) => {
      const tx = rawTx as Prisma.TransactionClient;
      const [account, transaction] = await Promise.all([
        requireAccount(tx, input.uid),
        requireTransaction(tx, input.clientRequestId)
      ]);

      if (transaction.uid !== input.uid) {
        throw new BillingConflictError('Billing transaction user mismatch.');
      }

      if (transaction.status === 'refunded') {
        return {
          transactionId: input.clientRequestId,
          billingStatus: 'refunded',
          ...balances(account),
          revalidateKeys: getRevalidateKeys(input.uid)
        };
      }

      if (transaction.status === 'deducted') {
        throw new BillingConflictError('Cannot refund a transaction that has already been deducted.');
      }

      if (account.pendingCredits < transaction.costCredits) {
        throw new BillingInvariantError('Wallet pendingCredits would become negative during refund.');
      }

      const now = new Date();
      await tx.billingAccount.update({
        where: { uid: input.uid },
        data: {
          availableCredits: account.availableCredits + transaction.costCredits,
          pendingCredits: account.pendingCredits - transaction.costCredits,
          refundedCredits: account.refundedCredits + transaction.costCredits,
          occVersion: {
            increment: 1
          }
        }
      });

      await tx.billingTransaction.update({
        where: { clientRequestId: input.clientRequestId },
        data: {
          status: 'refunded',
          lastError: input.reason,
          finalizedAt: now,
          heartbeatAt: now
        }
      });

      await enqueueOutboxEvent(tx, {
        aggregateId: transaction.id,
        aggregateType: 'billing_transaction',
        eventType: 'billing.transaction.refunded',
        idempotencyKey: `billing:${input.clientRequestId}:refunded`,
        payload: {
          uid: input.uid,
          clientRequestId: input.clientRequestId,
          reason: input.reason
        }
      });

      return {
        transactionId: input.clientRequestId,
        billingStatus: 'refunded',
        availableCredits: account.availableCredits + transaction.costCredits,
        pendingCredits: account.pendingCredits - transaction.costCredits,
        revalidateKeys: getRevalidateKeys(input.uid)
      };
    });
  }

  async readExistingSuccess(uid: string, clientRequestId: string) {
    const transaction = await this.prisma.billingTransaction.findUnique({
      where: { clientRequestId }
    });

    if (!transaction || transaction.uid !== uid || transaction.status !== 'deducted') {
      return null;
    }

    const account = await requireAccount(this.prisma, uid);
    return {
      transaction,
      account,
      providerUsage: parseProviderUsage(transaction.providerUsageJson)
    };
  }
}
