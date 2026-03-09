import type { BackendConnectionState, VoiceSessionContract } from '@/shared/contracts/voice';

export type VoiceCaptureStatus = 'idle' | 'listening' | 'processing' | 'complete' | 'error';

export interface VoiceCaptureUiState {
  status: VoiceCaptureStatus;
  confidence: number;
  transcriptPreview: string;
  connection: BackendConnectionState;
}

export const initialVoiceCaptureState: VoiceCaptureUiState = {
  status: 'idle',
  confidence: 0,
  transcriptPreview: 'No audio session yet.',
  connection: 'disconnected'
};

export const voiceSessionPlaceholder: VoiceSessionContract = {
  transport: {
    protocol: 'wss',
    endpoint: '/api/voice/session',
    auth: 'unknown'
  },
  audio: {
    inputFormat: 'unknown',
    sampleRateHz: null,
    channelCount: null
  },
  events: {
    clientToServer: [],
    serverToClient: []
  }
};
