import type { VoiceJobQueuePayload } from '@/shared/contracts/v3-voice-job';

export type QueueProviderName = 'local' | 'sqs';

export type EnqueueVoiceJobResult = {
  provider: QueueProviderName;
  messageId: string;
};

export type DequeuedVoiceJob = {
  receiptId: string;
  messageId: string;
  payload: VoiceJobQueuePayload;
};

export interface VoiceJobQueue {
  readonly provider: QueueProviderName;
  enqueue(payload: VoiceJobQueuePayload): Promise<EnqueueVoiceJobResult>;
  receive(maxMessages?: number): Promise<DequeuedVoiceJob[]>;
  ack(receiptIds: readonly string[]): Promise<void>;
  size(): Promise<number>;
}
