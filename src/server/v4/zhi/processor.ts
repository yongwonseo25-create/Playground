import { deliverV4Webhook } from '@/server/v4/shared/make-dispatch';
import {
  deleteExecutionBuffer,
  readExecutionBuffer
} from '@/server/v4/shared/execution-buffer';
import { type V4ExecutionJob } from '@/server/v4/shared/queue';
import { completeExecutionCreditTransaction } from '@/server/v4/shared/execution-credits';
import {
  findZhiDispatchByExecutionId,
  markZhiDispatchExecuted,
  markZhiDispatchProcessing
} from '@/server/v4/zhi/zhi-repository';

export async function processZhiExecutionJob(job: V4ExecutionJob): Promise<void> {
  const dispatch = await findZhiDispatchByExecutionId(job.referenceId);
  if (!dispatch || dispatch.status === 'executed') {
    await deleteExecutionBuffer(job.bufferKey);
    return;
  }

  await markZhiDispatchProcessing(dispatch.executionId, job.attempts);

  const payload = await readExecutionBuffer(job.bufferKey);
  if (!payload) {
    throw new Error(`Encrypted execution buffer expired for ${dispatch.executionId}.`);
  }

  await deliverV4Webhook(payload, job.webhookIdempotencyKey);
  await completeExecutionCreditTransaction({
    transactionId: job.webhookIdempotencyKey,
    referenceId: dispatch.executionId,
    accountKey: dispatch.accountKey,
    reason: `v4:${dispatch.destinationKey}:complete`
  });
  await markZhiDispatchExecuted(dispatch.executionId);
  await deleteExecutionBuffer(job.bufferKey);
}
