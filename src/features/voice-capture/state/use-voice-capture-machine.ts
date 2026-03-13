'use client';

import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
  createRealtimeVoiceSession,
  type RealtimeVoiceSession,
  type VoiceRuntimeSnapshot,
  VoicePermissionError
} from '@/features/voice-capture/services/realtime-voice-session';
import { submitVoiceCapture } from '@/features/voice-capture/services/submit-voice-capture';
import { voiceCaptureReducer } from '@/features/voice-capture/state/voice-capture-reducer';
import {
  DEFAULT_TRANSCRIPT_PREVIEW,
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

async function requestMicrophonePermission(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support microphone capture.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

export function useVoiceCaptureMachine() {
  const [state, dispatch] = useReducer(voiceCaptureReducer, initialVoiceCaptureState);
  const activeSessionRef = useRef<RealtimeVoiceSession | null>(null);

  const handleRuntimeFailure = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Voice runtime failed.';
    dispatch({ type: 'RUNTIME_ERROR', reason: message });

    const activeSession = activeSessionRef.current;
    activeSessionRef.current = null;
    if (activeSession) {
      void activeSession.close('runtime-error');
    }
  };

  const syncSnapshot = (snapshot: VoiceRuntimeSnapshot) => {
    dispatch({ type: 'SYNC_PCM_FRAME_COUNT', pcmFrameCount: snapshot.pcmFrameCount });

    if (snapshot.transcriptText.trim().length > 0) {
      dispatch({
        type: 'SYNC_TRANSCRIPT',
        transcriptPreview: snapshot.transcriptText,
        finalized: snapshot.transcriptFinalized,
        pcmFrameCount: snapshot.pcmFrameCount
      });
    }
  };

  const stopActiveSession = (reason: 'manual' | 'timeout' | 'reset' | 'submit' | 'unmount') => {
    const activeSession = activeSessionRef.current;
    if (!activeSession) {
      return;
    }

    void activeSession
      .stopCapture(reason)
      .then((snapshot) => {
        syncSnapshot(snapshot);
      })
      .catch((error) => {
        handleRuntimeFailure(error);
      });
  };

  useEffect(() => {
    if (state.status !== 'recording' || state.recordingStartedAt === null) {
      return;
    }

    const timeoutMs = Math.max(0, MAX_RECORDING_MS - state.elapsedMs);

    const stopTimer = window.setTimeout(() => {
      dispatch({ type: 'AUTO_STOP_AT_LIMIT' });

      const activeSession = activeSessionRef.current;
      if (!activeSession) {
        return;
      }

      void activeSession
        .stopCapture('timeout')
        .then((snapshot) => {
          syncSnapshot(snapshot);
        })
        .catch((error) => {
          handleRuntimeFailure(error);
        });
    }, timeoutMs);

    const tickTimer = window.setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() });
    }, 100);

    return () => {
      window.clearTimeout(stopTimer);
      window.clearInterval(tickTimer);
    };
  }, [state.status, state.recordingStartedAt, state.elapsedMs]);

  useEffect(() => {
    return () => {
      const activeSession = activeSessionRef.current;
      activeSessionRef.current = null;

      if (activeSession) {
        void activeSession.close('unmount');
      }
    };
  }, []);

  const progress = useMemo(() => {
    return Math.round((state.elapsedMs / state.maxRecordingMs) * 100);
  }, [state.elapsedMs, state.maxRecordingMs]);

  const remainingMs = Math.max(0, state.maxRecordingMs - state.elapsedMs);

  const requestPermission = async () => {
    if (state.status !== 'idle') {
      return;
    }

    dispatch({ type: 'REQUEST_PERMISSION' });

    try {
      await requestMicrophonePermission();
      dispatch({ type: 'PERMISSION_GRANTED' });
    } catch (error) {
      dispatch({
        type: 'PERMISSION_DENIED',
        reason: error instanceof Error ? error.message : 'Microphone permission was denied.'
      });
    }
  };

  const startRecording = async () => {
    if (state.status !== 'idle' && state.status !== 'ready' && state.status !== 'success') {
      return;
    }

    dispatch({ type: 'REQUEST_PERMISSION' });

    try {
      const previousSession = activeSessionRef.current;
      activeSessionRef.current = null;
      if (previousSession) {
        await previousSession.close('reset');
      }

      const session = await createRealtimeVoiceSession({
        onConnectionChange: (connection) => {
          dispatch({ type: 'SET_CONNECTION_STATE', connection });
        },
        onTranscript: ({ text, finalized, pcmFrameCount }) => {
          dispatch({
            type: 'SYNC_TRANSCRIPT',
            transcriptPreview: text,
            finalized,
            pcmFrameCount
          });
        },
        onMetricsChange: ({ pcmFrameCount }) => {
          dispatch({ type: 'SYNC_PCM_FRAME_COUNT', pcmFrameCount });
        },
        onRuntimeError: (message) => {
          handleRuntimeFailure(new Error(message));
        }
      });

      activeSessionRef.current = session;
      dispatch({ type: 'PERMISSION_GRANTED' });
      dispatch({
        type: 'START_RECORDING',
        startedAt: Date.now(),
        sessionId: session.sessionId
      });
    } catch (error) {
      if (error instanceof VoicePermissionError) {
        dispatch({ type: 'PERMISSION_DENIED', reason: error.message });
        return;
      }

      handleRuntimeFailure(error);
    }
  };

  const stopRecording = () => {
    if (state.status !== 'recording') {
      return;
    }

    dispatch({ type: 'STOP_RECORDING', stoppedAt: Date.now() });
    stopActiveSession('manual');
  };

  const submitRecording = async () => {
    if ((state.status !== 'stopping' && state.status !== 'error') || state.submissionLocked) {
      return;
    }

    const transcriptText = state.transcriptPreview.trim();
    if (!transcriptText || transcriptText === DEFAULT_TRANSCRIPT_PREVIEW) {
      dispatch({
        type: 'UPLOAD_ERROR',
        reason: 'Transcript is not ready from the WSS runtime yet.'
      });
      return;
    }

    const clientRequestId = createClientRequestId();
    dispatch({ type: 'LOCK_SUBMISSION', clientRequestId });

    try {
      const activeSession = activeSessionRef.current;
      const snapshot = activeSession?.getSnapshot();

      if (activeSession) {
        await activeSession.close('submit');
        activeSessionRef.current = null;
      }

      await submitVoiceCapture({
        clientRequestId,
        transcriptText,
        sessionId: state.sessionId ?? snapshot?.sessionId ?? undefined,
        pcmFrameCount: state.pcmFrameCount || snapshot?.pcmFrameCount || 0,
        stt_provider: snapshot?.sttProvider ?? 'whisper',
        audio_duration_sec: snapshot?.audioDurationSec ?? 0
      });
      dispatch({ type: 'UPLOAD_SUCCESS' });
    } catch (error) {
      dispatch({
        type: 'UPLOAD_ERROR',
        reason: error instanceof Error ? error.message : 'Upload failed.'
      });
    }
  };

  const reset = () => {
    const activeSession = activeSessionRef.current;
    activeSessionRef.current = null;
    if (activeSession) {
      void activeSession.close('reset');
    }
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
