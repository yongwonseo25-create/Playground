import type {
  BillingReservationResult,
  BillingSettlementResult
} from '@/server/billing/firestore-billing-store';

export interface GenerateOutputInput {
  uid: string;
  clientRequestId: string;
  prompt: string;
  outputType: string;
  costCredits: number;
  timeoutMs: number;
}

export interface OutputGeneratorRequest {
  uid: string;
  clientRequestId: string;
  prompt: string;
  outputType: string;
}

export interface OutputGeneratorResult {
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

export interface BillingStore {
  reserve(input: GenerateOutputInput): Promise<BillingReservationResult>;
  markExecuting(uid: string, clientRequestId: string): Promise<void>;
  deduct(
    input: OutputGeneratorResult & {
      uid: string;
      clientRequestId: string;
    }
  ): Promise<BillingSettlementResult>;
  refund(input: { uid: string; clientRequestId: string; reason: string }): Promise<BillingSettlementResult>;
}

export interface OutputGenerator {
  generate(input: OutputGeneratorRequest): Promise<OutputGeneratorResult>;
}

export class OutputGenerationRefundedError extends Error {
  constructor(
    message: string,
    public readonly settlement: BillingSettlementResult
  ) {
    super(message);
    this.name = 'OutputGenerationRefundedError';
  }
}

export interface GenerateOutputResult {
  outputText: string;
  reusedExistingResult: boolean;
  settlement: BillingSettlementResult;
  providerModel: string | null;
  providerUsage: OutputGeneratorResult['providerUsage'];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Generation timed out after ${timeoutMs}ms.`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

export class PayPerOutputService {
  constructor(
    private readonly billingStore: BillingStore,
    private readonly outputGenerator: OutputGenerator
  ) {}

  async execute(input: GenerateOutputInput): Promise<GenerateOutputResult> {
    const reservation = await this.billingStore.reserve(input);

    if (reservation.kind === 'already-deducted') {
      return {
        outputText: reservation.outputText ?? '',
        reusedExistingResult: true,
        providerModel: reservation.providerModel ?? null,
        providerUsage: null,
        settlement: {
          transactionId: reservation.transactionId,
          billingStatus: 'deducted',
          availableCredits: reservation.availableCredits ?? 0,
          pendingCredits: reservation.pendingCredits ?? 0,
          revalidateKeys: reservation.revalidateKeys
        }
      };
    }

    try {
      await this.billingStore.markExecuting(input.uid, input.clientRequestId);
      const output = await withTimeout(
        this.outputGenerator.generate({
          uid: input.uid,
          clientRequestId: input.clientRequestId,
          prompt: input.prompt,
          outputType: input.outputType
        }),
        input.timeoutMs
      );

      const settlement = await this.billingStore.deduct({
        uid: input.uid,
        clientRequestId: input.clientRequestId,
        outputText: output.outputText,
        providerName: output.providerName,
        providerModel: output.providerModel,
        providerLatencyMs: output.providerLatencyMs,
        secretVersion: output.secretVersion,
        providerUsage: output.providerUsage
      });

      return {
        outputText: output.outputText,
        reusedExistingResult: false,
        providerModel: output.providerModel,
        providerUsage: output.providerUsage,
        settlement
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown output generation error.';
      const settlement = await this.billingStore.refund({
        uid: input.uid,
        clientRequestId: input.clientRequestId,
        reason: message
      });
      throw new OutputGenerationRefundedError(message, settlement);
    }
  }
}
