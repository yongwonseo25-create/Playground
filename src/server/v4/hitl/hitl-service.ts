import {
  getV4Destination,
  type V4Destination,
  type V4ExecutionWebhookPayload,
  type V4StructuredField
} from '@/shared/contracts/v4/common';
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
import { enqueueV4ExecutionJob } from '@/server/v4/shared/queue';
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

function buildStructuredFields(destination: V4Destination, transcriptText: string): V4StructuredField[] {
  if (destination.key === 'crm') {
    return [
      {
        key: 'account_name',
        label: 'Account Name',
        value: '',
        kind: 'text',
        required: true,
        placeholder: 'Acme Corp'
      },
      {
        key: 'contact_summary',
        label: 'Contact Summary',
        value: transcriptText.slice(0, 240),
        kind: 'textarea',
        required: true,
        placeholder: 'Summarize the customer intent'
      },
      {
        key: 'next_action',
        label: 'Next Action',
        value: 'Follow up within 24 hours',
        kind: 'text',
        required: true,
        placeholder: 'Define the operator action'
      }
    ];
  }

  return [
    {
      key: 'summary',
      label: 'Summary',
      value: transcriptText,
      kind: 'textarea',
      required: true
    }
  ];
}

function fieldsToPayload(fields: V4StructuredField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, field.value]));
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
    structuredPayload: fieldsToPayload(input.fields),
    sttProvider: 'whisper',
    audioDurationSec: 0,
    executedAt: new Date().toISOString()
  };
}

export async function createHitlApprovalCard(input: HitlCardRequest): Promise<HitlCardResponse> {
  const destination = assertHitlDestination(input.destinationKey);
  const approval = await createPendingApproval({
    ...input,
    fields: buildStructuredFields(destination, input.transcriptText)
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
      idempotencyKey: approval.jobId ? approval.jobId : undefined
    });
  }

  const jobId = crypto.randomUUID();
  const webhookIdempotencyKey = crypto.randomUUID();
  const bufferKey = createExecutionBufferKey(approval.approvalId);
  const payload = buildWebhookPayload({
    approvalId: approval.approvalId,
    clientRequestId: approval.clientRequestId,
    destination: approval.destination,
    transcriptText: approval.transcriptText,
    fields: nextFields
  });
  const buffer = await writeExecutionBuffer(bufferKey, payload);
  const queuedApproval = await queueApprovalExecution({
    approvalId,
    actor: input.actor,
    fields: nextFields,
    jobId,
    bufferKey,
    webhookIdempotencyKey
  });

  await enqueueV4ExecutionJob({
    jobId,
    lane: 'hitl',
    referenceId: approval.approvalId,
    bufferKey,
    webhookIdempotencyKey,
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
    idempotencyKey: webhookIdempotencyKey
  });
}
