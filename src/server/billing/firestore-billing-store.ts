import { Firestore, Timestamp } from 'firebase-admin/firestore';

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

export type BillingPhase = 'reserved' | 'executing' | 'deducted' | 'refunded';

type WalletDocument = {
  availableCredits?: number;
  pendingCredits?: number;
  deductedCredits?: number;
  refundedCredits?: number;
};

type BillingTransactionDocument = {
  uid: string;
  clientRequestId: string;
  costCredits: number;
  outputType: string;
  promptPreview: string;
  status: BillingPhase;
  providerModel?: string;
  providerName?: string;
  providerLatencyMs?: number;
  outputText?: string;
  secretVersion?: string;
  lastError?: string;
};

export interface ReserveBillingInput {
  uid: string;
  clientRequestId: string;
  costCredits: number;
  prompt: string;
  outputType: string;
}

export interface DeductBillingInput {
  uid: string;
  clientRequestId: string;
  outputText: string;
  providerName: string;
  providerModel: string;
  providerLatencyMs: number;
  secretVersion: string | null;
  providerUsage: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  } | null;
}

export interface RefundBillingInput {
  uid: string;
  clientRequestId: string;
  reason: string;
}

export interface BillingSettlementResult {
  transactionId: string;
  billingStatus: Extract<BillingPhase, 'deducted' | 'refunded'>;
  availableCredits: number;
  pendingCredits: number;
  revalidateKeys: string[];
}

export interface BillingReservationResult {
  kind: 'reserved' | 'already-deducted';
  transactionId: string;
  costCredits: number;
  outputText?: string;
  providerModel?: string;
  availableCredits?: number;
  pendingCredits?: number;
  revalidateKeys: string[];
}

function getRevalidateKeys(uid: string): string[] {
  return [`wallet:${uid}`, `billing:${uid}`];
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export class FirestoreBillingStore {
  constructor(private readonly firestore: Firestore) {}

  async reserve(input: ReserveBillingInput): Promise<BillingReservationResult> {
    const walletRef = this.firestore.collection('wallets').doc(input.uid);
    const transactionRef = this.firestore.collection('billingTransactions').doc(input.clientRequestId);

    return this.firestore.runTransaction(async (transaction) => {
      const [walletSnapshot, transactionSnapshot] = await Promise.all([
        transaction.get(walletRef),
        transaction.get(transactionRef)
      ]);

      if (transactionSnapshot.exists) {
        const existing = transactionSnapshot.data() as BillingTransactionDocument;
        if (existing.uid !== input.uid) {
          throw new BillingConflictError('clientRequestId is already owned by another user.');
        }

        if (existing.status === 'deducted') {
          const wallet = walletSnapshot.data() as WalletDocument | undefined;
          return {
            kind: 'already-deducted',
            transactionId: input.clientRequestId,
            costCredits: existing.costCredits,
            outputText: existing.outputText,
            providerModel: existing.providerModel,
            availableCredits: readNumber(wallet?.availableCredits),
            pendingCredits: readNumber(wallet?.pendingCredits),
            revalidateKeys: getRevalidateKeys(input.uid)
          };
        }

        throw new BillingConflictError(
          `clientRequestId is already ${existing.status}. Retry with a new clientRequestId.`
        );
      }

      if (!walletSnapshot.exists) {
        throw new PaymentRequiredError('Wallet does not exist for this user.');
      }

      const wallet = walletSnapshot.data() as WalletDocument;
      const availableCredits = readNumber(wallet.availableCredits);
      const pendingCredits = readNumber(wallet.pendingCredits);

      if (availableCredits < input.costCredits) {
        throw new PaymentRequiredError(
          `Insufficient credits. Required ${input.costCredits}, available ${availableCredits}.`
        );
      }

      const now = Timestamp.now();
      transaction.set(
        walletRef,
        {
          availableCredits: availableCredits - input.costCredits,
          pendingCredits: pendingCredits + input.costCredits,
          updatedAt: now
        },
        { merge: true }
      );
      transaction.create(transactionRef, {
        uid: input.uid,
        clientRequestId: input.clientRequestId,
        costCredits: input.costCredits,
        outputType: input.outputType,
        promptPreview: input.prompt.slice(0, 1_000),
        status: 'reserved',
        reservedAt: now,
        updatedAt: now
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
    const transactionRef = this.firestore.collection('billingTransactions').doc(clientRequestId);

    await this.firestore.runTransaction(async (transaction) => {
      const transactionSnapshot = await transaction.get(transactionRef);
      if (!transactionSnapshot.exists) {
        throw new BillingInvariantError('Billing transaction is missing before execute step.');
      }

      const current = transactionSnapshot.data() as BillingTransactionDocument;
      if (current.uid !== uid) {
        throw new BillingConflictError('Billing transaction user mismatch.');
      }

      if (current.status === 'reserved') {
        const now = Timestamp.now();
        transaction.update(transactionRef, {
          status: 'executing',
          executingAt: now,
          updatedAt: now
        });
      }
    });
  }

  async deduct(input: DeductBillingInput): Promise<BillingSettlementResult> {
    const walletRef = this.firestore.collection('wallets').doc(input.uid);
    const transactionRef = this.firestore.collection('billingTransactions').doc(input.clientRequestId);

    return this.firestore.runTransaction(async (transaction) => {
      const [walletSnapshot, transactionSnapshot] = await Promise.all([
        transaction.get(walletRef),
        transaction.get(transactionRef)
      ]);

      if (!walletSnapshot.exists || !transactionSnapshot.exists) {
        throw new BillingInvariantError('Missing wallet or billing transaction during deduction.');
      }

      const wallet = walletSnapshot.data() as WalletDocument;
      const current = transactionSnapshot.data() as BillingTransactionDocument;
      const availableCredits = readNumber(wallet.availableCredits);
      const pendingCredits = readNumber(wallet.pendingCredits);
      const deductedCredits = readNumber(wallet.deductedCredits);

      if (current.uid !== input.uid) {
        throw new BillingConflictError('Billing transaction user mismatch.');
      }

      if (current.status === 'deducted') {
        return {
          transactionId: input.clientRequestId,
          billingStatus: 'deducted',
          availableCredits,
          pendingCredits,
          revalidateKeys: getRevalidateKeys(input.uid)
        };
      }

      if (current.status === 'refunded') {
        throw new BillingConflictError('Cannot deduct a transaction that has already been refunded.');
      }

      const nextPendingCredits = pendingCredits - current.costCredits;
      if (nextPendingCredits < 0) {
        throw new BillingInvariantError('Wallet pendingCredits would become negative during deduction.');
      }

      const now = Timestamp.now();
      transaction.set(
        walletRef,
        {
          pendingCredits: nextPendingCredits,
          deductedCredits: deductedCredits + current.costCredits,
          updatedAt: now
        },
        { merge: true }
      );
      transaction.set(
        transactionRef,
        {
          status: 'deducted',
          providerName: input.providerName,
          providerModel: input.providerModel,
          providerLatencyMs: input.providerLatencyMs,
          providerUsage: input.providerUsage,
          outputText: input.outputText,
          secretVersion: input.secretVersion,
          finalizedAt: now,
          updatedAt: now
        },
        { merge: true }
      );

      return {
        transactionId: input.clientRequestId,
        billingStatus: 'deducted',
        availableCredits,
        pendingCredits: nextPendingCredits,
        revalidateKeys: getRevalidateKeys(input.uid)
      };
    });
  }

  async refund(input: RefundBillingInput): Promise<BillingSettlementResult> {
    const walletRef = this.firestore.collection('wallets').doc(input.uid);
    const transactionRef = this.firestore.collection('billingTransactions').doc(input.clientRequestId);

    return this.firestore.runTransaction(async (transaction) => {
      const [walletSnapshot, transactionSnapshot] = await Promise.all([
        transaction.get(walletRef),
        transaction.get(transactionRef)
      ]);

      if (!walletSnapshot.exists || !transactionSnapshot.exists) {
        throw new BillingInvariantError('Missing wallet or billing transaction during refund.');
      }

      const wallet = walletSnapshot.data() as WalletDocument;
      const current = transactionSnapshot.data() as BillingTransactionDocument;
      const availableCredits = readNumber(wallet.availableCredits);
      const pendingCredits = readNumber(wallet.pendingCredits);
      const refundedCredits = readNumber(wallet.refundedCredits);

      if (current.uid !== input.uid) {
        throw new BillingConflictError('Billing transaction user mismatch.');
      }

      if (current.status === 'refunded') {
        return {
          transactionId: input.clientRequestId,
          billingStatus: 'refunded',
          availableCredits,
          pendingCredits,
          revalidateKeys: getRevalidateKeys(input.uid)
        };
      }

      if (current.status === 'deducted') {
        throw new BillingConflictError('Cannot refund a transaction that has already been deducted.');
      }

      const nextAvailableCredits = availableCredits + current.costCredits;
      const nextPendingCredits = pendingCredits - current.costCredits;
      if (nextPendingCredits < 0) {
        throw new BillingInvariantError('Wallet pendingCredits would become negative during refund.');
      }

      const now = Timestamp.now();
      transaction.set(
        walletRef,
        {
          availableCredits: nextAvailableCredits,
          pendingCredits: nextPendingCredits,
          refundedCredits: refundedCredits + current.costCredits,
          updatedAt: now
        },
        { merge: true }
      );
      transaction.set(
        transactionRef,
        {
          status: 'refunded',
          lastError: input.reason,
          finalizedAt: now,
          updatedAt: now
        },
        { merge: true }
      );

      return {
        transactionId: input.clientRequestId,
        billingStatus: 'refunded',
        availableCredits: nextAvailableCredits,
        pendingCredits: nextPendingCredits,
        revalidateKeys: getRevalidateKeys(input.uid)
      };
    });
  }
}
