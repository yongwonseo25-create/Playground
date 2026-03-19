import { deleteExecutionBuffer } from '@/server/v4/shared/execution-buffer';
import {
  ackQueuedV4ExecutionJob,
  type V4ExecutionJob,
  promoteDueV4ExecutionRetries,
  readQueuedV4ExecutionJobs,
  scheduleV4ExecutionRetry
} from '@/server/v4/shared/queue';
import { getV4ServerEnv } from '@/server/v4/shared/env';
import { logV4WorkerEvent } from '@/server/v4/shared/worker-log';
import {
  markHitlApprovalFailed,
  markHitlApprovalQueuedForRetry
} from '@/server/v4/hitl/approval-store';
import { processHitlExecutionJob } from '@/server/v4/hitl/processor';
import {
  markZhiDispatchFailed,
  markZhiDispatchQueuedForRetry
} from '@/server/v4/zhi/zhi-repository';
import { processZhiExecutionJob } from '@/server/v4/zhi/processor';

let workerTimer: NodeJS.Timeout | null = null;
let activeDrain: Promise<number> | null = null;

function computeRetryDelayMs(attempts: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.max(0, attempts));
}

async function markRetryState(job: V4ExecutionJob, errorMessage: string, retryCount: number): Promise<void> {
  if (job.lane === 'zhi') {
    await markZhiDispatchQueuedForRetry(job.referenceId, errorMessage, retryCount);
    return;
  }

  await markHitlApprovalQueuedForRetry(job.referenceId, errorMessage, retryCount);
}

async function markFailureState(job: V4ExecutionJob, errorMessage: string, retryCount: number): Promise<void> {
  if (job.lane === 'zhi') {
    await markZhiDispatchFailed(job.referenceId, errorMessage, retryCount);
    return;
  }

  await markHitlApprovalFailed(job.referenceId, errorMessage, retryCount);
}

async function processExecutionJob(job: V4ExecutionJob): Promise<void> {
  if (job.lane === 'zhi') {
    await processZhiExecutionJob(job);
    return;
  }

  await processHitlExecutionJob(job);
}

export function ensureV4WorkerRunning(): void {
  if (workerTimer) {
    return;
  }

  const pollIntervalMs = getV4ServerEnv().V4_WORKER_POLL_INTERVAL_MS;
  workerTimer = setInterval(() => {
    void drainV4ExecutionWorkerOnce();
  }, pollIntervalMs);
  workerTimer.unref?.();
}

export async function drainV4ExecutionWorkerOnce(): Promise<number> {
  if (activeDrain) {
    return activeDrain;
  }

  activeDrain = (async () => {
    await promoteDueV4ExecutionRetries();
    const entries = await readQueuedV4ExecutionJobs();
    let processedCount = 0;

    for (const entry of entries) {
      processedCount += 1;
      const { job } = entry;

      try {
        await processExecutionJob(job);
        await logV4WorkerEvent({
          level: 'info',
          event: 'job.executed',
          lane: job.lane,
          jobId: job.jobId,
          referenceId: job.referenceId
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown V4 worker execution failure.';
        const retryCount = job.attempts + 1;
        const nextDelayMs = computeRetryDelayMs(job.attempts);
        const expiresAtMs = Date.parse(job.expiresAt);

        if (Number.isFinite(expiresAtMs) && Date.now() + nextDelayMs < expiresAtMs) {
          await markRetryState(job, errorMessage, retryCount);
          await scheduleV4ExecutionRetry(
            {
              ...job,
              attempts: retryCount
            },
            Date.now() + nextDelayMs
          );
          await logV4WorkerEvent({
            level: 'error',
            event: 'job.retry_scheduled',
            lane: job.lane,
            jobId: job.jobId,
            referenceId: job.referenceId,
            detail: errorMessage
          });
        } else {
          await markFailureState(job, errorMessage, retryCount);
          await deleteExecutionBuffer(job.bufferKey);
          await logV4WorkerEvent({
            level: 'error',
            event: 'job.failed',
            lane: job.lane,
            jobId: job.jobId,
            referenceId: job.referenceId,
            detail: errorMessage
          });
        }
      } finally {
        await ackQueuedV4ExecutionJob(entry.streamId);
      }
    }

    return processedCount;
  })();

  try {
    return await activeDrain;
  } finally {
    activeDrain = null;
  }
}

export async function resetV4WorkerForTests(): Promise<void> {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }

  if (activeDrain) {
    await activeDrain.catch(() => {});
  }
  activeDrain = null;
}
