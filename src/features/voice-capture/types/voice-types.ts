import {
  voiceSessionContract,
  type BackendConnectionState,
  type VoiceSessionContract
} from '@/shared/contracts/voice';

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
  'Your captured voice transcript will appear here.\nTranscript updates only from the live WSS runtime.';

export interface VoiceCaptureMachineState {
  status: VoiceReducerState;
  connection: BackendConnectionState;
  elapsedMs: number;
  maxRecordingMs: number;
  recordingStartedAt: number | null;
  sessionId: string | null;
  pcmFrameCount: number;
  clientRequestId: string | null;
  submissionLocked: boolean;
  transcriptPreview: string;
  transcriptFinalized: boolean;
  lastError: string | null;
}

export const initialVoiceCaptureState: VoiceCaptureMachineState = {
  status: 'idle',
  connection: 'disconnected',
  elapsedMs: 0,
  maxRecordingMs: MAX_RECORDING_MS,
  recordingStartedAt: null,
  sessionId: null,
  pcmFrameCount: 0,
  clientRequestId: null,
  submissionLocked: false,
  transcriptPreview: DEFAULT_TRANSCRIPT_PREVIEW,
  transcriptFinalized: false,
  lastError: null
};

export const liveVoiceSessionContract: VoiceSessionContract = voiceSessionContract;
