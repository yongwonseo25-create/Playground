import {
  type VoiceCaptureMachineState,
  type VoiceReducerState,
  initialVoiceCaptureState
} from '@/features/voice-capture/types/voice-types';

export type VoiceCaptureAction =
  | { type: 'REQUEST_PERMISSION' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED'; reason: string }
  | { type: 'START_RECORDING'; startedAt: number }
  | { type: 'TICK'; now: number }
  | { type: 'STOP_RECORDING'; stoppedAt: number }
  | { type: 'AUTO_STOP_AT_LIMIT' }
  | { type: 'LOCK_SUBMISSION'; clientRequestId: string }
  | { type: 'UPLOAD_SUCCESS' }
  | { type: 'UPLOAD_ERROR'; reason: string }
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
        lastError: action.reason,
        submissionLocked: false,
        clientRequestId: null
      };
    }
    case 'START_RECORDING': {
      return {
        ...state,
        status: ensureValidStatus('recording'),
        recordingStartedAt: action.startedAt,
        elapsedMs: 0,
        clientRequestId: null,
        submissionLocked: false,
        lastError: null
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
        lastError: null
      };
    }
    case 'UPLOAD_ERROR': {
      return {
        ...state,
        status: ensureValidStatus('error'),
        clientRequestId: null,
        submissionLocked: false,
        lastError: action.reason
      };
    }
    case 'RESET': {
      return {
        ...initialVoiceCaptureState,
        connection: state.connection
      };
    }
    default: {
      return state;
    }
  }
}
