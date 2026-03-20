import {
  getV4Destination,
  type V4Destination,
  type V4ExecutionWebhookPayload,
  type V4StructuredField
} from '@/shared/contracts/v4/common';
import {
  buildStructuredFieldsForDestination,
  buildStructuredPayloadFromFields
} from '@/shared/contracts/v4/schemas';
import {
  type HitlApprovalRequest,
  type HitlApprovalResponse,
  type HitlCardRequest,
  type HitlCardResponse,
  type HitlQueueResponse,
  hitlApprovalResponseSchema,
  hitlCardResponseSchema,
  hitlQueueResponseSchema
} from '@/shared/contracts/v4/hitl';
import {
  createExecutionBufferKey,
  writeExecutionBuffer
} from '@/server/v4/shared/execution-buffer';
import {
  reserveExecutionCredit,
  refundExecutionCreditTransaction
} from '@/server/v4/shared/execution-credits';
import { enqueueV4ExecutionJob } from '@/server/v4/shared/queue';
import { prepareV4StructuredOutput } from '@/server/v4/shared/structured-output';
import { ensureV4WorkerRunning } from '@/server/v4/shared/worker';
import {
  createPendingApproval,
  getApprovalById,
  listPendingApprovals,
  queueApprovalExecution,
  updateApproval
} from '@/server/v4/hitl/approval-store';

function assertHitlDestination(destinationKey: string): V4Destination {
  const destination = getV4Destination(destinationKey);

  if (!destination || destination.mode !== 'hitl') {
    throw new Error(`Destination "${destinationKey}" is not configured for HITL approval flow.`);
  }

  return destination;
}

function buildWebhookPayload(input: {
  approvalId: string;
  clientRequestId: string;
  destination: V4Destination;
  transcriptText: string;
  fields: V4StructuredField[];
}): V4ExecutionWebhookPayload {
  return {
    mode: 'hitl',
    referenceId: input.approvalId,
    clientRequestId: input.clientRequestId,
    destinationKey: input.destination.key,
    destinationLabel: input.destination.label,
    transcriptText: input.transcriptText,
    structuredFields: input.fields,
    structuredPayload: buildStructuredPayloadFromFields(input.destination.key, input.fields),
    sttProvider: 'whisper',
    audioDurationSec: 0,
    executedAt: new Date().toISOString()
  };
}

export async function createHitlApprovalCard(input: HitlCardRequest): Promise<HitlCardResponse> {
  const destination = assertHitlDestination(input.destinationKey);
  const structuredResult = await prepareV4StructuredOutput({
    lane: 'hitl',
    destinationKey: destination.key,
    transcriptText: input.transcriptText
  });
  const approval = await createPendingApproval({
    ...input,
    fields: buildStructuredFieldsForDestination(destination.key, structuredResult.payload)
  });

  return hitlCardResponseSchema.parse({
    ok: true,
    mode: 'hitl',
    approval
  });
}

export async function listHitlQueue(): Promise<HitlQueueResponse> {
  return hitlQueueResponseSchema.parse({
    ok: true,
    mode: 'hitl',
    pending: await listPendingApprovals()
  });
}

export async function resolveHitlApproval(
  approvalId: string,
  input: HitlApprovalRequest
): Promise<HitlApprovalResponse> {
  const approval = await getApprovalById(approvalId);
  if (!approval) {
    throw new Error('Approval card not found.');
  }

  const nextFields = input.fields.length > 0 ? input.fields : approval.fields;

  if (input.decision === 'reject') {
    const rejectedApproval = await updateApproval({
      approvalId,
      status: 'rejected',
      actor: input.actor,
      fields: nextFields
    });

    return hitlApprovalResponseSchema.parse({
      ok: true,
      mode: 'hitl',
      status: 'rejected',
      approval: rejectedApproval
    });
  }

  if (approval.status === 'approved' || approval.status === 'processing' || approval.status === 'executed') {
    return hitlApprovalResponseSchema.parse({
      ok: true,
      mode: 'hitl',
      status: 'duplicate',
      approval,
      jobId: approval.jobId,
      idempotencyKey: approval.transactionId ?? approval.jobId ?? undefined
    });
  }

  const jobId = crypto.randomUUID();
  const normalizedPayload = buildStructuredPayloadFromFields(approval.destination.key, nextFields);
  const normalizedFields = buildStructuredFieldsForDestination(approval.destination.key, normalizedPayload);
  const bufferKey = createExecutionBufferKey(approval.approvalId);
  const payload = buildWebhookPayload({
    approvalId: approval.approvalId,
    clientRequestId: approval.clientRequestId,
    destination: approval.destination,
    transcriptText: approval.transcriptText,
    fields: normalizedFields
  });
  const reservation = await reserveExecutionCredit({
    referenceId: approval.approvalId,
    destinationKey: approval.destination.key,
    accountKey: approval.accountKey,
    reason: `v4:${approval.destination.key}:reserve`
  });

  try {
    const buffer = await writeExecutionBuffer(bufferKey, payload);
    const queuedApproval = await queueApprovalExecution({
      approvalId,
      actor: input.actor,
      fields: normalizedFields,
      jobId,
      bufferKey,
      webhookIdempotencyKey: reservation.transactionId,
      transactionId: reservation.transactionId
    });

    await enqueueV4ExecutionJob({
      jobId,
      lane: 'hitl',
      referenceId: approval.approvalId,
      bufferKey,
      webhookIdempotencyKey: reservation.transactionId,
      accountKey: approval.accountKey,
      attempts: 0,
      expiresAt: buffer.expiresAt
    });
    ensureV4WorkerRunning();

    return hitlApprovalResponseSchema.parse({
      ok: true,
      mode: 'hitl',
      status: 'approved',
      approval: queuedApproval,
      jobId,
      idempotencyKey: reservation.transactionId
    });
  } catch (error) {
    await refundExecutionCreditTransaction({
      transactionId: reservation.transactionId,
      referenceId: approval.approvalId,
      accountKey: approval.accountKey,
      reason: `v4:${approval.destination.key}:reserve-refund`,
      failureReason: error instanceof Error ? error.message : 'Approval queue setup failed.'
    });
    throw error;
  }
}
