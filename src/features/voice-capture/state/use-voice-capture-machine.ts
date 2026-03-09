'use client';

import { useEffect, useMemo, useReducer } from 'react';
import { uploadPcmPlaceholder } from '@/features/voice-capture/services/upload-placeholder';
import { voiceCaptureReducer } from '@/features/voice-capture/state/voice-capture-reducer';
import {
  MAX_RECORDING_MS,
  type VoiceCaptureMachineState,
  initialVoiceCaptureState
} from '@/features/voice-capture/types/voice-types';

function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `voxera-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useVoiceCaptureMachine() {
  const [state, dispatch] = useReducer(voiceCaptureReducer, initialVoiceCaptureState);

  useEffect(() => {
    if (state.status !== 'recording' || state.recordingStartedAt === null) {
      return;
    }

    const timeoutMs = Math.max(0, MAX_RECORDING_MS - state.elapsedMs);

    const stopTimer = window.setTimeout(() => {
      dispatch({ type: 'AUTO_STOP_AT_LIMIT' });
    }, timeoutMs);

    const tickTimer = window.setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() });
    }, 100);

    return () => {
      window.clearTimeout(stopTimer);
      window.clearInterval(tickTimer);
    };
  }, [state.status, state.recordingStartedAt, state.elapsedMs]);

  const progress = useMemo(() => {
    return Math.round((state.elapsedMs / state.maxRecordingMs) * 100);
  }, [state.elapsedMs, state.maxRecordingMs]);

  const remainingMs = Math.max(0, state.maxRecordingMs - state.elapsedMs);

  const requestPermission = () => {
    dispatch({ type: 'REQUEST_PERMISSION' });
    dispatch({ type: 'PERMISSION_GRANTED' });
  };

  const startRecording = () => {
    if (state.status !== 'ready' && state.status !== 'success') {
      return;
    }
    dispatch({ type: 'START_RECORDING', startedAt: Date.now() });
  };

  const stopRecording = () => {
    dispatch({ type: 'STOP_RECORDING' });
  };

  const submitRecording = async () => {
    if (state.status !== 'stopping') {
      return;
    }

    const clientRequestId = createClientRequestId();
    dispatch({ type: 'LOCK_SUBMISSION', clientRequestId });

    try {
      await uploadPcmPlaceholder({ clientRequestId, pcmFrameCount: 0 });
      dispatch({ type: 'UPLOAD_SUCCESS' });
    } catch (error) {
      dispatch({
        type: 'UPLOAD_ERROR',
        reason: error instanceof Error ? error.message : 'Upload failed.'
      });
    }
  };

  const reset = () => {
    dispatch({ type: 'RESET' });
  };

  return {
    state: state as VoiceCaptureMachineState,
    progress,
    remainingMs,
    actions: {
      requestPermission,
      startRecording,
      stopRecording,
      submitRecording,
      reset
    }
  };
}
