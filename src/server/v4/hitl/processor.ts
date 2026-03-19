import { deliverV4Webhook } from '@/server/v4/shared/make-dispatch';
import {
  deleteExecutionBuffer,
  readExecutionBuffer
} from '@/server/v4/shared/execution-buffer';
import { type V4ExecutionJob } from '@/server/v4/shared/queue';
import { consumeExecutionCredit } from '@/server/v4/shared/execution-credits';
import {
  getApprovalById,
  markHitlApprovalExecuted,
  markHitlApprovalProcessing
} from '@/server/v4/hitl/approval-store';

export async function processHitlExecutionJob(job: V4ExecutionJob): Promise<void> {
  const approval = await getApprovalById(job.referenceId);
  if (!approval || approval.status === 'executed' || approval.status === 'rejected') {
    await deleteExecutionBuffer(job.bufferKey);
    return;
  }

  await markHitlApprovalProcessing(approval.approvalId, job.attempts);

  const payload = await readExecutionBuffer(job.bufferKey);
  if (!payload) {
    throw new Error(`Encrypted execution buffer expired for ${approval.approvalId}.`);
  }

  await deliverV4Webhook(payload, job.webhookIdempotencyKey);
  await consumeExecutionCredit({
    referenceId: approval.approvalId,
    accountKey: approval.accountKey,
    reason: `v4:${approval.destination.key}:approve-execute`
  });
  await markHitlApprovalExecuted(approval.approvalId);
  await deleteExecutionBuffer(job.bufferKey);
}
