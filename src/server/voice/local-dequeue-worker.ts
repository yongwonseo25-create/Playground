import { setCachedUserCredits } from '@/server/cache/credit-cache';
import { V3LocalStateStore } from '@/server/db/v3-local-state';
import { query, type Queryable } from '@/server/db/v3-pg';
import { isMemoryDatabaseRuntime } from '@/server/db/v3-runtime';
import { getVoiceJobQueue } from '@/server/queue/v3';
import { createDestinationPayload, sendDestinationWebhook } from '@/server/voice/destination-webhook';
import { MockVoicePayloadStore } from '@/server/voice/mock-payload-store';
import { processMockSttPayload, type MockSttResult } from '@/server/voice/mock-stt-processor';
import { deductVoiceCredits } from '@/server/voice/voice-credit-core';
import type { VoiceJobQueue } from '@/server/queue/v3/types';

type LocalDequeueWorkerDependencies = {
  queue?: VoiceJobQueue;
  payloadStore?: MockVoicePayloadStore;
  runner?: Queryable;
  localState?: V3LocalStateStore;
  processor?: (payload: Parameters<typeof processMockSttPayload>[0]) => Promise<MockSttResult>;
  destinationSender?: (payload: ReturnType<typeof createDestinationPayload>) => Promise<void>;
  pollIntervalMs?: number;
};

export class LocalVoiceDequeueWorker {
  private isRunning = false;
  private isTicking = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly pollIntervalMs: number;
  private readonly queue: VoiceJobQueue;
  private readonly payloadStore: MockVoicePayloadStore;
  private readonly runner: Queryable;
  private readonly localState: V3LocalStateStore;
  private readonly processor: (payload: Parameters<typeof processMockSttPayload>[0]) => Promise<MockSttResult>;
  private readonly destinationSender: (payload: ReturnType<typeof createDestinationPayload>) => Promise<void>;

  constructor({
    queue = getVoiceJobQueue(),
    payloadStore = new MockVoicePayloadStore(),
    runner = { query },
    localState = new V3LocalStateStore(),
    processor = (payload) => processMockSttPayload(payload),
    destinationSender = sendDestinationWebhook,
    pollIntervalMs = 500
  }: LocalDequeueWorkerDependencies = {}) {
    this.queue = queue;
    this.payloadStore = payloadStore;
    this.runner = runner;
    this.localState = localState;
    this.processor = processor;
    this.destinationSender = destinationSender;
    this.pollIntervalMs = pollIntervalMs;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.scheduleNextTick(0);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<number> {
    if (this.isTicking) {
      return 0;
    }

    this.isTicking = true;

    try {
      const jobs = await this.queue.receive(1);

      for (const job of jobs) {
        const clientRequestId = job.payload.clientRequestId;
        const stagedPayload = this.payloadStore.get(job.payload.s3Key);
        let transcriptText: string | null = null;

        if (isMemoryDatabaseRuntime()) {
          this.localState.updateVoiceLogStatus(clientRequestId, 'processing');
        } else {
          await this.runner.query(
            `
              UPDATE voice_processing_log
              SET status = 'processing'
              WHERE client_request_id = $1::uuid
            `,
            [clientRequestId]
          );
        }

        if (!stagedPayload) {
          if (isMemoryDatabaseRuntime()) {
            this.localState.updateVoiceLogStatus(clientRequestId, 'missing_payload');
          } else {
            await this.runner.query(
              `
                UPDATE voice_processing_log
                SET status = 'missing_payload'
                WHERE client_request_id = $1::uuid
              `,
              [clientRequestId]
            );
          }
          await this.queue.ack([job.receiptId]);
          continue;
        }

        try {
          const mockSttResult = await this.processor(stagedPayload);
          transcriptText = mockSttResult.transcriptText;

          const creditResult = isMemoryDatabaseRuntime()
            ? await this.localState.deductCreditsWithLock(
                stagedPayload.userId,
                clientRequestId,
                job.payload.creditsRequired
              )
            : await deductVoiceCredits(this.runner, {
                clientRequestId
              });

          if (
            ('status' in creditResult &&
              (creditResult.status === 'insufficient_credits' || creditResult.status === 'duplicate')) ||
            ('ok' in creditResult && creditResult.ok === false)
          ) {
            continue;
          }

          const remainingCredits = 'remainingCredits' in creditResult ? creditResult.remainingCredits : null;
          if (remainingCredits !== null) {
            await setCachedUserCredits(stagedPayload.userId, remainingCredits);
          }

          const destinationPayload = createDestinationPayload({
            clientRequestId,
            transcriptText,
            spreadsheetId: '',
            slackChannelId: '',
            sessionId: stagedPayload.sessionId ?? stagedPayload.clientRequestId,
            pcmFrameCount: stagedPayload.pcmFrameCount ?? 0,
            stt_provider: stagedPayload.sttProvider ?? 'whisper',
            audio_duration_sec: stagedPayload.audioDurationSec ?? 0,
            createdAt: new Date().toISOString()
          });

          try {
            await this.destinationSender(destinationPayload);

            if (isMemoryDatabaseRuntime()) {
              this.localState.updateVoiceLogStatus(clientRequestId, 'completed');
            } else {
              await this.runner.query(
                `
                  UPDATE voice_processing_log
                  SET status = 'completed'
                  WHERE client_request_id = $1::uuid
                `,
                [clientRequestId]
              );
            }
          } catch (error) {
            if (isMemoryDatabaseRuntime()) {
              this.localState.updateVoiceLogStatus(clientRequestId, 'webhook_failed');
            } else {
              await this.runner.query(
                `
                  UPDATE voice_processing_log
                  SET status = 'webhook_failed'
                  WHERE client_request_id = $1::uuid
                `,
                [clientRequestId]
              );
            }
            throw error;
          }
        } catch (error) {
          if (!isMemoryDatabaseRuntime()) {
            await this.runner.query(
              `
                UPDATE voice_processing_log
                SET status = CASE
                  WHEN status IN ('completed', 'webhook_failed', 'insufficient_credits')
                    THEN status
                  ELSE 'failed'
                END
                WHERE client_request_id = $1::uuid
              `,
              [clientRequestId]
            );
          } else {
            const record = this.localState.getVoiceLog(clientRequestId);
            if (record && !['completed', 'webhook_failed', 'insufficient_credits'].includes(record.status)) {
              this.localState.updateVoiceLogStatus(clientRequestId, 'failed');
            }
          }
        } finally {
          // Zero-retention local mock: drop the staged payload immediately after processing.
          this.payloadStore.drop(job.payload.s3Key);
          transcriptText = null;
          await this.queue.ack([job.receiptId]);
        }
      }

      return jobs.length;
    } finally {
      this.isTicking = false;
    }
  }

  private scheduleNextTick(delayMs: number): void {
    if (!this.isRunning) {
      return;
    }

    this.timer = setTimeout(async () => {
      try {
        await this.runOnce();
      } finally {
        this.scheduleNextTick(this.pollIntervalMs);
      }
    }, delayMs);
    this.timer.unref?.();
  }
}

let sharedLocalVoiceWorker: LocalVoiceDequeueWorker | null = null;

export function ensureLocalVoiceWorkerStarted(): LocalVoiceDequeueWorker {
  if (!sharedLocalVoiceWorker) {
    sharedLocalVoiceWorker = new LocalVoiceDequeueWorker();
  }

  sharedLocalVoiceWorker.start();
  return sharedLocalVoiceWorker;
}

export function resetLocalVoiceWorker(): void {
  sharedLocalVoiceWorker?.stop();
  sharedLocalVoiceWorker = null;
}
