import { Prisma } from '@prisma/client';

export const PRISMA_SERIALIZABLE_RETRY_CODE = 'P2034';

type TransactionCapableClient = {
  $transaction<T>(
    callback: (tx: unknown) => Promise<T>,
    options?: {
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T>;
};

type RetryOptions = {
  maxRetries?: number;
  onRetry?: (attempt: number, error: unknown) => void;
};

type ErrorWithCode = Error & {
  code?: string;
};

export function isSerializableRetryError(error: unknown): error is ErrorWithCode {
  return (
    error instanceof Error &&
    typeof (error as ErrorWithCode).code === 'string' &&
    (error as ErrorWithCode).code === PRISMA_SERIALIZABLE_RETRY_CODE
  );
}

export function createSerializableRetryError(message: string) {
  const error = new Error(message) as ErrorWithCode;
  error.code = PRISMA_SERIALIZABLE_RETRY_CODE;
  return error;
}

export async function runSerializableTransactionWithRetry<T>(
  prisma: TransactionCapableClient,
  callback: (tx: unknown) => Promise<T>,
  options: RetryOptions = {}
) {
  const maxRetries = options.maxRetries ?? 3;
  let attempt = 0;

  while (true) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      if (!isSerializableRetryError(error) || attempt >= maxRetries) {
        throw error;
      }

      attempt += 1;
      options.onRetry?.(attempt, error);
    }
  }
}
