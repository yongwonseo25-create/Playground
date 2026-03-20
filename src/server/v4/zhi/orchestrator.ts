import type { V4Destination } from '@/shared/contracts/v4/common';
import {
  getV4Destination,
  listV4Destinations,
  type V4ExecutionWebhookPayload
} from '@/shared/contracts/v4/common';
import type { V4StructuredPayload } from '@/shared/contracts/v4/schemas';
import {
  type ZhiDispatchRequest,
  type ZhiDispatchResponse,
  zhiDispatchResponseSchema
} from '@/shared/contracts/v4/zhi';
import {
  createExecutionBufferKey,
  writeExecutionBuffer
} from '@/server/v4/shared/execution-buffer';
import {
  refundExecutionCreditTransaction,
  reserveExecutionCredit
} from '@/server/v4/shared/execution-credits';
import { enqueueV4ExecutionJob } from '@/server/v4/shared/queue';
import { prepareV4StructuredOutput } from '@/server/v4/shared/structured-output';
import { ensureV4WorkerRunning } from '@/server/v4/shared/worker';
import {
  createZhiDispatchRecord,
  findZhiDispatchByClientRequestId
} from '@/server/v4/zhi/zhi-repository';

export function listZhiCatalog(): V4Destination[] {
  return listV4Destinations('zhi');
}

function assertZhiDestination(destinationKey: string): V4Destination {
  const destination = getV4Destination(destinationKey);

  if (!destination || destination.mode !== 'zhi') {
    throw new Error(`Destination "${destinationKey}" is not configured for V4 ZHI execution.`);
  }

  return destination;
}

function buildWebhookPayload(input: {
  executionId: string;
  request: ZhiDispatchRequest;
  destination: V4Destination;
  structuredPayload: V4StructuredPayload;
}): V4ExecutionWebhookPayload {
  const { executionId, request, destination, structuredPayload } = input;

  return {
    mode: 'zhi',
    referenceId: executionId,
    clientRequestId: request.clientRequestId,
    destinationKey: destination.key,
    destinationLabel: destination.label,
    transcriptText: request.transcriptText,
    structuredFields: [],
    structuredPayload,
    sessionId: request.sessionId,
    sttProvider: request.sttProvider,
    audioDurationSec: request.audioDurationSec,
    executedAt: new Date().toISOString()
  };
}

export async function dispatchZhiCommand(input: ZhiDispatchRequest): Promise<ZhiDispatchResponse> {
  const destination = assertZhiDestination(input.destinationKey);
  const existingRecord = await findZhiDispatchByClientRequestId(input.clientRequestId);

  if (existingRecord) {
    return zhiDispatchResponseSchema.parse({
      ok: true,
      mode: 'zhi',
      status: 'duplicate',
      executionId: existingRecord.executionId,
      jobId: existingRecord.jobId,
      destination,
      idempotencyKey: existingRecord.webhookIdempotencyKey,
      queuedAt: existingRecord.queuedAt,
      dispatchState: existingRecord.status
    });
  }

  const executionId = `zhi_${crypto.randomUUID()}`;
  const jobId = crypto.randomUUID();
  const structuredResult = await prepareV4StructuredOutput({
    lane: 'zhi',
    destinationKey: destination.key,
    transcriptText: input.transcriptText
  });
  const payload = buildWebhookPayload({
    executionId,
    request: input,
    destination,
    structuredPayload: structuredResult.payload
  });
  const reservation = await reserveExecutionCredit({
    referenceId: executionId,
    destinationKey: destination.key,
    accountKey: input.accountKey,
    reason: `v4:${destination.key}:reserve`
  });

  try {
    const bufferKey = createExecutionBufferKey(executionId);
    const buffer = await writeExecutionBuffer(bufferKey, payload);
    const dispatchRecord = await createZhiDispatchRecord({
      executionId,
      jobId,
      bufferKey,
      webhookIdempotencyKey: reservation.transactionId,
      transactionId: reservation.transactionId,
      clientRequestId: input.clientRequestId,
      transcriptText: input.transcriptText,
      destinationKey: destination.key,
      structuredPayload: structuredResult.payload,
      accountKey: input.accountKey
    });

    await enqueueV4ExecutionJob({
      jobId,
      lane: 'zhi',
      referenceId: executionId,
      bufferKey,
      webhookIdempotencyKey: reservation.transactionId,
      accountKey: dispatchRecord.accountKey,
      attempts: 0,
      expiresAt: buffer.expiresAt
    });
    ensureV4WorkerRunning();

    return zhiDispatchResponseSchema.parse({
      ok: true,
      mode: 'zhi',
      status: 'queued',
      executionId,
      jobId,
      destination,
      idempotencyKey: reservation.transactionId,
      queuedAt: dispatchRecord.queuedAt,
      dispatchState: dispatchRecord.status
    });
  } catch (error) {
    await refundExecutionCreditTransaction({
      transactionId: reservation.transactionId,
      referenceId: executionId,
      accountKey: reservation.accountKey,
      reason: `v4:${destination.key}:reserve-refund`,
      failureReason: error instanceof Error ? error.message : 'Dispatch queue setup failed.'
    });
    throw error;
  }
}
