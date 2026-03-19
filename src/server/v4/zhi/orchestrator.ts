import type { V4Destination } from '@/shared/contracts/v4/common';
import {
  getV4Destination,
  listV4Destinations,
  type V4ExecutionWebhookPayload
} from '@/shared/contracts/v4/common';
import {
  type ZhiDispatchRequest,
  type ZhiDispatchResponse,
  zhiDispatchResponseSchema
} from '@/shared/contracts/v4/zhi';
import {
  createExecutionBufferKey,
  writeExecutionBuffer
} from '@/server/v4/shared/execution-buffer';
import { enqueueV4ExecutionJob } from '@/server/v4/shared/queue';
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

function buildStructuredPayload(destination: V4Destination, transcriptText: string): Record<string, unknown> {
  if (destination.key === 'slack') {
    return {
      channel: '#ops-automation',
      message: transcriptText,
      source: 'voxera-v4-zhi'
    };
  }

  if (destination.key === 'jira') {
    return {
      projectKey: 'OPS',
      issueType: 'Task',
      summary: transcriptText.slice(0, 120),
      description: transcriptText,
      source: 'voxera-v4-zhi'
    };
  }

  return {
    transcriptText
  };
}

function buildWebhookPayload(input: {
  executionId: string;
  request: ZhiDispatchRequest;
  destination: V4Destination;
  structuredPayload: Record<string, unknown>;
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
  const structuredPayload = buildStructuredPayload(destination, input.transcriptText);
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
  const webhookIdempotencyKey = crypto.randomUUID();
  const payload = buildWebhookPayload({
    executionId,
    request: input,
    destination,
    structuredPayload
  });
  const bufferKey = createExecutionBufferKey(executionId);
  const buffer = await writeExecutionBuffer(bufferKey, payload);

  const dispatchRecord = await createZhiDispatchRecord({
    executionId,
    jobId,
    bufferKey,
    webhookIdempotencyKey,
    clientRequestId: input.clientRequestId,
    transcriptText: input.transcriptText,
    destinationKey: destination.key,
    structuredPayload,
    accountKey: input.accountKey
  });

  await enqueueV4ExecutionJob({
    jobId,
    lane: 'zhi',
    referenceId: executionId,
    bufferKey,
    webhookIdempotencyKey,
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
    idempotencyKey: webhookIdempotencyKey,
    queuedAt: dispatchRecord.queuedAt,
    dispatchState: dispatchRecord.status
  });
}
