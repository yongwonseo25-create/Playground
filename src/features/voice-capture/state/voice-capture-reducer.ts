import type { BackendConnectionState } from '@/shared/contracts/voice';
import {
  type VoiceCaptureMachineState,
  type VoiceReducerState,
  DEFAULT_TRANSCRIPT_PREVIEW,
  initialVoiceCaptureState
} from '@/features/voice-capture/types/voice-types';

export type VoiceCaptureAction =
  | { type: 'REQUEST_PERMISSION' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED'; reason: string }
  | { type: 'START_RECORDING'; startedAt: number; sessionId: string }
  | { type: 'TICK'; now: number }
  | { type: 'STOP_RECORDING'; stoppedAt: number }
  | { type: 'AUTO_STOP_AT_LIMIT' }
  | { type: 'LOCK_SUBMISSION'; clientRequestId: string }
  | { type: 'UPLOAD_SUCCESS'; acceptedForRetry: boolean; message: string | null }
  | { type: 'UPLOAD_ERROR'; reason: string }
  | { type: 'SET_CONNECTION_STATE'; connection: BackendConnectionState }
  | {
      type: 'SYNC_TRANSCRIPT';
      transcriptPreview: string;
      finalized: boolean;
      pcmFrameCount?: number;
    }
  | { type: 'SYNC_PCM_FRAME_COUNT'; pcmFrameCount: number }
  | { type: 'RUNTIME_ERROR'; reason: string }
  | { type: 'RESET' };

function ensureValidStatus(status: VoiceReducerState): VoiceReducerState {
  return status;
}

export function voiceCaptureReducer(
  state: VoiceCaptureMachineState,
  action: VoiceCaptureAction
): VoiceCaptureMachineState {
  switch (action.type) {
    case 'REQUEST_PERMISSION': {
      return {
        ...state,
        status: ensureValidStatus('permission-requesting'),
        lastError: null
      };
    }
    case 'PERMISSION_GRANTED': {
      return {
        ...state,
        status: ensureValidStatus('ready'),
        lastError: null
      };
    }
    case 'PERMISSION_DENIED': {
      return {
        ...state,
        status: ensureValidStatus('error'),
        connection: 'disconnected',
        sessionId: null,
        pcmFrameCount: 0,
        lastError: action.reason,
        submissionMessage: null,
        submissionLocked: false,
        clientRequestId: null,
        transcriptPreview: DEFAULT_TRANSCRIPT_PREVIEW,
        transcriptFinalized: false
      };
    }
    case 'START_RECORDING': {
      return {
        ...state,
        status: ensureValidStatus('recording'),
        connection: 'connecting',
        recordingStartedAt: action.startedAt,
        elapsedMs: 0,
        sessionId: action.sessionId,
        pcmFrameCount: 0,
        clientRequestId: null,
        submissionLocked: false,
        lastError: null,
        transcriptPreview: DEFAULT_TRANSCRIPT_PREVIEW,
        transcriptFinalized: false
      };
    }
    case 'TICK': {
      if (state.status !== 'recording' || state.recordingStartedAt === null) {
        return state;
      }

      const elapsedMs = Math.min(action.now - state.recordingStartedAt, state.maxRecordingMs);
      return {
        ...state,
        elapsedMs
      };
    }
    case 'AUTO_STOP_AT_LIMIT': {
      if (state.status !== 'recording') {
        return state;
      }

      return {
        ...state,
        status: ensureValidStatus('stopping'),
        elapsedMs: state.maxRecordingMs,
        recordingStartedAt: null
      };
    }
    case 'STOP_RECORDING': {
      if (state.status !== 'recording' || state.recordingStartedAt === null) {
        return state;
      }

      const elapsedMs = Math.min(action.stoppedAt - state.recordingStartedAt, state.maxRecordingMs);

      return {
        ...state,
        status: ensureValidStatus('stopping'),
        elapsedMs: Math.max(0, elapsedMs),
        recordingStartedAt: null
      };
    }
    case 'LOCK_SUBMISSION': {
      if (state.status !== 'stopping' && state.status !== 'error') {
        return state;
      }

      return {
        ...state,
        status: ensureValidStatus('uploading'),
        clientRequestId: action.clientRequestId,
        submissionLocked: true,
        submissionMessage: null,
        lastError: null
      };
    }
    case 'UPLOAD_SUCCESS': {
      if (state.status !== 'uploading' || !state.submissionLocked) {
        return state;
      }

      return {
        ...state,
        status: ensureValidStatus('success'),
        submissionAcceptedForRetry: action.acceptedForRetry,
        submissionMessage: action.message,
        lastError: null
      };
    }
    case 'UPLOAD_ERROR': {
      return {
        ...state,
        status: ensureValidStatus('error'),
        clientRequestId: null,
        submissionMessage: null,
        submissionLocked: false,
        lastError: action.reason
      };
    }
    case 'SET_CONNECTION_STATE': {
      return {
        ...state,
        connection: action.connection
      };
    }
    case 'SYNC_TRANSCRIPT': {
      return {
        ...state,
        transcriptPreview: action.transcriptPreview,
        transcriptFinalized: action.finalized,
        pcmFrameCount: action.pcmFrameCount ?? state.pcmFrameCount
      };
    }
    case 'SYNC_PCM_FRAME_COUNT': {
      return {
        ...state,
        pcmFrameCount: action.pcmFrameCount
      };
    }
    case 'RUNTIME_ERROR': {
      return {
        ...state,
        status: ensureValidStatus('error'),
        connection: 'error',
        submissionLocked: false,
        clientRequestId: null,
        lastError: action.reason
      };
    }
    case 'RESET': {
      return initialVoiceCaptureState;
    }
    default: {
      return state;
    }
  }
}
