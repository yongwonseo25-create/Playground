import {
  MAX_RECORDING_MS,
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
  | { type: 'STOP_RECORDING' }
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
        lastError: action.reason
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

      const elapsedMs = Math.min(action.now - state.recordingStartedAt, MAX_RECORDING_MS);
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
        elapsedMs: MAX_RECORDING_MS,
        recordingStartedAt: null
      };
    }
    case 'STOP_RECORDING': {
      if (state.status !== 'recording' || state.elapsedMs < MAX_RECORDING_MS) {
        return state;
      }

      return {
        ...state,
        status: ensureValidStatus('stopping'),
        elapsedMs: MAX_RECORDING_MS,
        recordingStartedAt: null
      };
    }
    case 'LOCK_SUBMISSION': {
      if (state.status !== 'stopping') {
        return state;
      }

      return {
        ...state,
        status: ensureValidStatus('uploading'),
        clientRequestId: action.clientRequestId,
        submissionLocked: true
      };
    }
    case 'UPLOAD_SUCCESS': {
      if (state.status !== 'uploading' || !state.submissionLocked) {
        return state;
      }

      return {
        ...state,
        status: ensureValidStatus('success')
      };
    }
    case 'UPLOAD_ERROR': {
      return {
        ...state,
        status: ensureValidStatus('error'),
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
