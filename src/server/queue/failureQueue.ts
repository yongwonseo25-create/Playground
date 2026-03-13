import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { WebhookClient, type WebhookPayload } from '@/server/reliability/WebhookClient';

export type FailureQueueItem = {
  idempotencyKey: string;
  payload: WebhookPayload;
  attempts: number;
  nextAttemptAt: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
};

export type FailureQueueOptions = {
  filePath?: string;
  pollIntervalMs?: number;
  maxBackoffMs?: number;
  client: WebhookClient;
  now?: () => number;
};

const DEFAULT_QUEUE_FILE = path.join(process.cwd(), '.runtime', 'failure-queue.jsonl');

export class FailureQueue {
  private readonly filePath: string;
  private readonly pollIntervalMs: number;
  private readonly maxBackoffMs: number;
  private readonly client: WebhookClient;
  private readonly now: () => number;
  private workerTimer: NodeJS.Timeout | null = null;
  private activeProcess: Promise<void> | null = null;

  constructor(options: FailureQueueOptions) {
    this.filePath = options.filePath ?? DEFAULT_QUEUE_FILE;
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30_000;
    this.client = options.client;
    this.now = options.now ?? Date.now;
  }

  startWorker(): void {
    if (this.workerTimer) {
      return;
    }

    this.workerTimer = setInterval(() => {
      void this.processDue();
    }, this.pollIntervalMs);

    this.workerTimer.unref();
  }

  stopWorker(): void {
    if (!this.workerTimer) {
      return;
    }
    clearInterval(this.workerTimer);
    this.workerTimer = null;
  }

  async enqueue(idempotencyKey: string, payload: WebhookPayload): Promise<boolean> {
    const items = await this.readAll();
    if (items.some((item) => item.idempotencyKey === idempotencyKey)) {
      return false;
    }

    const now = this.now();
    const nowIso = new Date(now).toISOString();
    items.push({
      idempotencyKey,
      payload,
      attempts: 0,
      nextAttemptAt: now,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await this.writeAll(items);
    return true;
  }

  async size(): Promise<number> {
    const items = await this.readAll();
    return items.length;
  }

  async processDue(): Promise<void> {
    if (this.activeProcess) {
      return this.activeProcess;
    }

    this.activeProcess = this.processDueInternal();
    try {
      await this.activeProcess;
    } finally {
      this.activeProcess = null;
    }
  }

  private async processDueInternal(): Promise<void> {
    const now = this.now();
    const items = await this.readAll();
    if (items.length === 0) {
      return;
    }

    const nextItems: FailureQueueItem[] = [];

    for (const item of items) {
      if (item.nextAttemptAt > now) {
        nextItems.push(item);
        continue;
      }

      try {
        await this.client.send(item.payload, item.idempotencyKey);
      } catch (error) {
        const attempts = item.attempts + 1;
        const backoffMs = Math.min(this.maxBackoffMs, 1000 * 2 ** Math.min(attempts, 6));
        nextItems.push({
          ...item,
          attempts,
          lastError: error instanceof Error ? error.message : 'Unknown queue retry error',
          nextAttemptAt: this.now() + backoffMs,
          updatedAt: new Date(this.now()).toISOString()
        });
      }
    }

    await this.writeAll(nextItems);
  }

  private async ensureFile(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    try {
      await readFile(this.filePath, 'utf8');
    } catch {
      await writeFile(this.filePath, '', 'utf8');
    }
  }

  private async readAll(): Promise<FailureQueueItem[]> {
    await this.ensureFile();
    const raw = await readFile(this.filePath, 'utf8');
    if (!raw.trim()) {
      return [];
    }

    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const items: FailureQueueItem[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as FailureQueueItem;
        if (parsed && typeof parsed.idempotencyKey === 'string') {
          items.push(parsed);
        }
      } catch {
        continue;
      }
    }
    return items;
  }

  private async writeAll(items: FailureQueueItem[]): Promise<void> {
    await this.ensureFile();
    const tempPath = `${this.filePath}.tmp`;
    const nextRaw = items.map((item) => JSON.stringify(item)).join('\n');
    await writeFile(tempPath, nextRaw, 'utf8');
    await rename(tempPath, this.filePath);
  }
}
