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
import { deliverV4Webhook } from '@/server/v4/shared/make-dispatch';
import { consumeExecutionCredit } from '@/server/v4/shared/execution-credits';
import {
  createZhiDispatchRecord,
  findZhiDispatchByClientRequestId,
  markZhiDispatchExecuted
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

  if (existingRecord?.status === 'executed') {
    const credits = await consumeExecutionCredit({
      referenceId: existingRecord.executionId,
      accountKey: existingRecord.accountKey,
      reason: `v4:${destination.key}:execute`
    });

    return zhiDispatchResponseSchema.parse({
      ok: true,
      mode: 'zhi',
      status: 'duplicate',
      executionId: existingRecord.executionId,
      destination,
      credits
    });
  }

  const dispatchRecord =
    existingRecord ??
    (await createZhiDispatchRecord({
      clientRequestId: input.clientRequestId,
      transcriptText: input.transcriptText,
      destinationKey: destination.key,
      structuredPayload,
      accountKey: input.accountKey
    }));

  await deliverV4Webhook(
    buildWebhookPayload({
      executionId: dispatchRecord.executionId,
      request: input,
      destination,
      structuredPayload
    }),
    input.clientRequestId
  );

  const credits = await consumeExecutionCredit({
    referenceId: dispatchRecord.executionId,
    accountKey: dispatchRecord.accountKey,
    reason: `v4:${destination.key}:execute`
  });

  await markZhiDispatchExecuted(dispatchRecord.executionId);

  return zhiDispatchResponseSchema.parse({
    ok: true,
    mode: 'zhi',
    status: 'executed',
    executionId: dispatchRecord.executionId,
    destination,
    credits
  });
}
