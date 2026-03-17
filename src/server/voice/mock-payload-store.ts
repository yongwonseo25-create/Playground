export type MockVoicePayload = {
  s3Key: string;
  clientRequestId: string;
  userId: number;
  rawPayload: string;
  transcriptText?: string;
  sessionId?: string;
  pcmFrameCount?: number;
  sttProvider?: 'whisper' | 'return-zero';
  audioDurationSec?: number;
  createdAt: string;
};

type MockPayloadStoreState = Map<string, MockVoicePayload>;

function getSharedMockPayloadState(): MockPayloadStoreState {
  const globalState = globalThis as typeof globalThis & {
    __voxeraMockVoicePayloadStore?: MockPayloadStoreState;
  };

  if (!globalState.__voxeraMockVoicePayloadStore) {
    globalState.__voxeraMockVoicePayloadStore = new Map();
  }

  return globalState.__voxeraMockVoicePayloadStore;
}

export class MockVoicePayloadStore {
  constructor(private readonly storage: MockPayloadStoreState = getSharedMockPayloadState()) {}

  put(payload: MockVoicePayload): void {
    this.storage.set(payload.s3Key, payload);
  }

  get(s3Key: string): MockVoicePayload | null {
    return this.storage.get(s3Key) ?? null;
  }

  drop(s3Key: string): void {
    this.storage.delete(s3Key);
  }

  size(): number {
    return this.storage.size;
  }
}

export function resetMockVoicePayloadStore(): void {
  getSharedMockPayloadState().clear();
}
