import { getV3QueueEnv } from '@/server/config/v3-env';
import { LocalVoiceJobQueue } from '@/server/queue/v3/local-voice-job-queue';
import { SqsVoiceJobQueue } from '@/server/queue/v3/sqs-voice-job-queue';
import type { VoiceJobQueue } from '@/server/queue/v3/types';

let sharedQueue: VoiceJobQueue | null = null;

export function getVoiceJobQueue(): VoiceJobQueue {
  if (sharedQueue) {
    return sharedQueue;
  }

  const env = getV3QueueEnv();
  sharedQueue = env.QUEUE_PROVIDER === 'sqs' ? new SqsVoiceJobQueue() : new LocalVoiceJobQueue();
  return sharedQueue;
}
