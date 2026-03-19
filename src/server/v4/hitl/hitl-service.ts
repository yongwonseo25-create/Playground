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
import { deliverV4Webhook } from '@/server/v4/shared/make-dispatch';
import { consumeExecutionCredit } from '@/server/v4/shared/execution-credits';
import {
  createPendingApproval,
  getApprovalById,
  listPendingApprovals,
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

  if (approval.status === 'executed') {
    const credits = await consumeExecutionCredit({
      referenceId: approval.approvalId,
      accountKey: approval.accountKey,
      reason: `v4:${approval.destination.key}:approve-execute`
    });

    return hitlApprovalResponseSchema.parse({
      ok: true,
      mode: 'hitl',
      approval,
      credits
    });
  }

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
      approval: rejectedApproval
    });
  }

  await deliverV4Webhook(
    buildWebhookPayload({
      approvalId: approval.approvalId,
      clientRequestId: approval.clientRequestId,
      destination: approval.destination,
      transcriptText: approval.transcriptText,
      fields: nextFields
    }),
    approval.clientRequestId
  );

  const credits = await consumeExecutionCredit({
    referenceId: approval.approvalId,
    accountKey: approval.accountKey,
    reason: `v4:${approval.destination.key}:approve-execute`
  });

  const executedApproval = await updateApproval({
    approvalId,
    status: 'executed',
    actor: input.actor,
    fields: nextFields
  });

  return hitlApprovalResponseSchema.parse({
    ok: true,
    mode: 'hitl',
    approval: executedApproval,
    credits
  });
}
