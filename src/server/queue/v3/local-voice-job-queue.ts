import { randomUUID } from 'node:crypto';
import type { DequeuedVoiceJob, EnqueueVoiceJobResult, VoiceJobQueue } from '@/server/queue/v3/types';
import type { VoiceJobQueuePayload } from '@/shared/contracts/v3-voice-job';

type LocalQueueState = {
  available: Array<{
    messageId: string;
    payload: VoiceJobQueuePayload;
  }>;
  inFlight: Map<string, { messageId: string; payload: VoiceJobQueuePayload }>;
};

function getLocalQueueState(): LocalQueueState {
  const globalState = globalThis as typeof globalThis & {
    __voxeraV3LocalQueueState?: LocalQueueState;
  };

  if (!globalState.__voxeraV3LocalQueueState) {
    globalState.__voxeraV3LocalQueueState = {
      available: [],
      inFlight: new Map()
    };
  }

  return globalState.__voxeraV3LocalQueueState;
}

export class LocalVoiceJobQueue implements VoiceJobQueue {
  readonly provider = 'local' as const;

  async enqueue(payload: VoiceJobQueuePayload): Promise<EnqueueVoiceJobResult> {
    const messageId = randomUUID();
    getLocalQueueState().available.push({
      messageId,
      payload
    });

    return {
      provider: this.provider,
      messageId
    };
  }

  async receive(maxMessages = 1): Promise<DequeuedVoiceJob[]> {
    const state = getLocalQueueState();
    const jobs: DequeuedVoiceJob[] = [];

    while (jobs.length < maxMessages && state.available.length > 0) {
      const next = state.available.shift();
      if (!next) {
        break;
      }

      const receiptId = randomUUID();
      state.inFlight.set(receiptId, next);
      jobs.push({
        receiptId,
        messageId: next.messageId,
        payload: next.payload
      });
    }

    return jobs;
  }

  async ack(receiptIds: readonly string[]): Promise<void> {
    const state = getLocalQueueState();
    for (const receiptId of receiptIds) {
      state.inFlight.delete(receiptId);
    }
  }

  async size(): Promise<number> {
    return getLocalQueueState().available.length;
  }
}

export function resetLocalVoiceJobQueue(): void {
  const state = getLocalQueueState();
  state.available = [];
  state.inFlight.clear();
}
