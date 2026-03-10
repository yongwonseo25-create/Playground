import type { BackendConnectionState, VoiceSessionContract } from '@/shared/contracts/voice';

export const FIXED_VOICE_STATES = [
  'idle',
  'permission-requesting',
  'ready',
  'recording',
  'stopping',
  'uploading',
  'success',
  'error'
] as const;

export type VoiceReducerState = (typeof FIXED_VOICE_STATES)[number];

export const MAX_RECORDING_MS = 15000;

export const DEFAULT_TRANSCRIPT_PREVIEW =
  'Your captured voice transcript will appear here.\nEdit-free confirmation flow starts immediately.';

export interface VoiceCaptureMachineState {
  status: VoiceReducerState;
  connection: BackendConnectionState;
  elapsedMs: number;
  maxRecordingMs: number;
  recordingStartedAt: number | null;
  clientRequestId: string | null;
  submissionLocked: boolean;
  transcriptPreview: string;
  lastError: string | null;
}

export const initialVoiceCaptureState: VoiceCaptureMachineState = {
  status: 'idle',
  connection: 'disconnected',
  elapsedMs: 0,
  maxRecordingMs: MAX_RECORDING_MS,
  recordingStartedAt: null,
  clientRequestId: null,
  submissionLocked: false,
  transcriptPreview: DEFAULT_TRANSCRIPT_PREVIEW,
  lastError: null
};

export const voiceSessionPlaceholder: VoiceSessionContract = {
  transport: {
    protocol: 'wss',
    endpoint: '/api/voice/session',
    auth: 'unknown'
  },
  audio: {
    inputFormat: 'pcm16',
    sampleRateHz: null,
    channelCount: null
  },
  events: {
    clientToServer: [],
    serverToClient: []
  }
};
