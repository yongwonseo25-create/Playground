import type { MockVoicePayload } from '@/server/voice/mock-payload-store';

export type MockSttResult = {
  provider: 'mock-stt';
  transcriptText: string;
};

type SleepFn = (ms: number) => Promise<void>;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);
    timeout.unref?.();
  });
}

export async function processMockSttPayload(
  payload: MockVoicePayload,
  sleep: SleepFn = defaultSleep,
  delayMs = 3_000
): Promise<MockSttResult> {
  await sleep(delayMs);

  return {
    provider: 'mock-stt',
    transcriptText:
      payload.transcriptText?.trim() ||
      `[mock-stt] user ${payload.userId} request ${payload.clientRequestId} processed from ${payload.s3Key}`
  };
}
