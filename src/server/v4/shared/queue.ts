import { z } from 'zod';
import { getV4RuntimeStore } from '@/server/v4/shared/runtime-store';

const V4_EXECUTION_STREAM_KEY = 'v4:execution:stream';
const V4_EXECUTION_RETRY_KEY = 'v4:execution:retry';
const V4_EXECUTION_CURSOR_KEY = 'v4:execution:cursor';

export const v4ExecutionJobSchema = z
  .object({
    jobId: z.string().uuid(),
    lane: z.enum(['zhi', 'hitl']),
    referenceId: z.string().trim().min(1).max(128),
    bufferKey: z.string().trim().min(1).max(256),
    webhookIdempotencyKey: z.string().uuid(),
    accountKey: z.string().trim().min(1).max(128),
    attempts: z.number().int().nonnegative().default(0),
    expiresAt: z.string().datetime({ offset: true })
  })
  .strict();

export type V4ExecutionJob = z.infer<typeof v4ExecutionJobSchema>;

export async function enqueueV4ExecutionJob(job: V4ExecutionJob): Promise<string> {
  const parsedJob = v4ExecutionJobSchema.parse(job);
  const store = await getV4RuntimeStore();
  return store.xAdd(V4_EXECUTION_STREAM_KEY, {
    job: JSON.stringify(parsedJob)
  });
}

export async function scheduleV4ExecutionRetry(job: V4ExecutionJob, nextAttemptAt: number): Promise<void> {
  const parsedJob = v4ExecutionJobSchema.parse(job);
  const store = await getV4RuntimeStore();
  await store.zAdd(V4_EXECUTION_RETRY_KEY, nextAttemptAt, JSON.stringify(parsedJob));
}

export async function promoteDueV4ExecutionRetries(limit = 25): Promise<number> {
  const store = await getV4RuntimeStore();
  const dueItems = await store.zRangeByScore(V4_EXECUTION_RETRY_KEY, Date.now(), limit);

  for (const item of dueItems) {
    await store.xAdd(V4_EXECUTION_STREAM_KEY, {
      job: item
    });
    await store.zRem(V4_EXECUTION_RETRY_KEY, item);
  }

  return dueItems.length;
}

export async function readQueuedV4ExecutionJobs(limit = 25): Promise<
  Array<{
    streamId: string;
    job: V4ExecutionJob;
  }>
> {
  const store = await getV4RuntimeStore();
  const cursor = (await store.get(V4_EXECUTION_CURSOR_KEY)) ?? '0-0';
  const entries = await store.xRead(V4_EXECUTION_STREAM_KEY, cursor, limit);

  return entries.map((entry) => ({
    streamId: entry.id,
    job: v4ExecutionJobSchema.parse(JSON.parse(entry.fields.job ?? '{}'))
  }));
}

export async function ackQueuedV4ExecutionJob(streamId: string): Promise<void> {
  const store = await getV4RuntimeStore();
  await store.set(V4_EXECUTION_CURSOR_KEY, streamId);
}
