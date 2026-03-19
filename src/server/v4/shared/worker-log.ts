import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const V4_WORKER_LOG_PATH = path.join(process.cwd(), '.runtime', 'v4-worker.log');

export async function logV4WorkerEvent(input: {
  level: 'info' | 'error';
  event: string;
  lane?: 'zhi' | 'hitl';
  jobId?: string;
  referenceId?: string;
  detail?: string;
}): Promise<void> {
  try {
    await mkdir(path.dirname(V4_WORKER_LOG_PATH), { recursive: true });
    await appendFile(
      V4_WORKER_LOG_PATH,
      `${JSON.stringify({
        ...input,
        timestamp: new Date().toISOString()
      })}\n`,
      'utf8'
    );
  } catch {
    // Best-effort runtime logging only.
  }
}
