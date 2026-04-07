'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
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
import { clientEnv } from '@/shared/config/env.client';

type ServerEvent =
  | { type: 'session.ready'; sessionId: string }
  | { type: 'session.transcript'; transcriptText: string; pcmFrameCount: number }
  | { type: 'session.error'; reason: string };

type TranscriptWaiter = {
  resolve: (transcriptText: string) => void;
  reject: (reason: string) => void;
  timeout: number;
};

function isTranscriptReady(transcriptText: string): boolean {
  const normalized = transcriptText.trim();
  return normalized.length > 0 && normalized !== DEFAULT_TRANSCRIPT_PREVIEW.trim();
}

function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `voxera-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveSubmitTargets(): {
  spreadsheetId?: string;
  slackChannelId?: string;
  notionDatabaseId?: string;
  notionParentPageId?: string;
} {
  if (typeof window === 'undefined') {
    return {};
  }

  const searchParams = new URLSearchParams(window.location.search);
  const pick = (key: string) => {
    const value = searchParams.get(key)?.trim();
    return value && value.length > 0 ? value : undefined;
  };

  return {
    spreadsheetId: pick('spreadsheetId'),
    slackChannelId: pick('slackChannelId'),
    notionDatabaseId: pick('notionDatabaseId'),
    notionParentPageId: pick('notionParentPageId')
  };
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
    pcmFrameCountRef.current = Math.max(pcmFrameCountRef.current, snapshot.pcmFrameCount);
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

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pcmFrameCountRef = useRef(0);
  const stopCommandSentRef = useRef(false);
  const transcriptWaitersRef = useRef<TranscriptWaiter[]>([]);

  const clearTranscriptWaiters = useCallback((reason: string) => {
    for (const waiter of transcriptWaitersRef.current) {
      window.clearTimeout(waiter.timeout);
      waiter.reject(reason);
    }

    transcriptWaitersRef.current = [];
  }, []);

  function resolveTranscriptWaiters(transcriptText: string) {
    if (!isTranscriptReady(transcriptText)) {
      return;
    }

    for (const waiter of transcriptWaitersRef.current) {
      window.clearTimeout(waiter.timeout);
      waiter.resolve(transcriptText.trim());
    }

    transcriptWaitersRef.current = [];
  }

  function waitForTranscriptReady(): Promise<string> {
    if (isTranscriptReady(state.transcriptPreview)) {
      return Promise.resolve(state.transcriptPreview.trim());
    }

    return new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        transcriptWaitersRef.current = transcriptWaitersRef.current.filter(
          (waiter) => waiter.timeout !== timeout
        );
        reject(new Error('Transcript did not arrive before submit timeout.'));
      }, 5000);

      transcriptWaitersRef.current.push({
        resolve,
        reject: (reason) => reject(new Error(reason)),
        timeout
      });
    });
  }

  function parseServerEvent(raw: string): ServerEvent | null {
    try {
      const parsed = JSON.parse(raw) as ServerEvent;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function handleServerEvent(event: ServerEvent) {
    switch (event.type) {
      case 'session.ready': {
        sessionIdRef.current = event.sessionId;
        break;
      }
      case 'session.transcript': {
        const transcriptText = event.transcriptText || initialVoiceCaptureState.transcriptPreview;
        pcmFrameCountRef.current = Math.max(pcmFrameCountRef.current, event.pcmFrameCount || 0);
        dispatch({
          type: 'SYNC_TRANSCRIPT',
          transcriptPreview: transcriptText,
          finalized: true,
          pcmFrameCount: pcmFrameCountRef.current
        });
        resolveTranscriptWaiters(transcriptText);
        break;
      }
      case 'session.error': {
        clearTranscriptWaiters(event.reason);
        dispatch({ type: 'UPLOAD_ERROR', reason: event.reason });
        break;
      }
      default:
        break;
    }
  }

  async function ensureSocketOpen(sessionId: string): Promise<WebSocket> {
    const current = wsRef.current;
    if (current && current.readyState === WebSocket.OPEN) {
      return current;
    }

    return await new Promise<WebSocket>((resolve, reject) => {
      const wsUrl = new URL(clientEnv.NEXT_PUBLIC_WSS_URL);
      wsUrl.searchParams.set('sessionId', sessionId);

      const socket = new WebSocket(wsUrl.toString());
      let settled = false;

      socket.onopen = () => {
        if (settled) {
          return;
        }

        settled = true;
        wsRef.current = socket;
        resolve(socket);
      };

      socket.onmessage = (message) => {
        if (typeof message.data !== 'string') {
          return;
        }

        const event = parseServerEvent(message.data);
        if (event) {
          handleServerEvent(event);
        }
      };

      socket.onerror = () => {
        if (settled) {
          return;
        }

        settled = true;
        reject(new Error('WebSocket connection failed.'));
      };

      socket.onclose = () => {
        if (!settled) {
          settled = true;
          reject(new Error('WebSocket closed before opening.'));
        }

        clearTranscriptWaiters('Connection closed while waiting for transcript.');
        wsRef.current = null;
      };
    });
  }

  const cleanupCapture = useCallback(async (closeSocket: boolean) => {
    const node = audioNodeRef.current;
    if (node) {
      node.port.onmessage = null;
      node.disconnect();
      audioNodeRef.current = null;
    }

    const stream = mediaStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    const audioContext = audioContextRef.current;
    if (audioContext) {
      await audioContext.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    if (closeSocket) {
      const socket = wsRef.current;
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }

      clearTranscriptWaiters('Voice session closed.');
      wsRef.current = null;
      sessionIdRef.current = null;
    }
  }, [clearTranscriptWaiters]);

  const stopCaptureAndFinalize = useCallback(async () => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'session.stop',
          sessionId: sessionIdRef.current,
          pcmFrameCount: pcmFrameCountRef.current
        })
      );
    }

    await cleanupCapture(false);
  }, [cleanupCapture]);

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
          pcmFrameCountRef.current = Math.max(pcmFrameCountRef.current, pcmFrameCount);
          dispatch({
            type: 'SYNC_TRANSCRIPT',
            transcriptPreview: text,
            finalized,
            pcmFrameCount
          });
        },
        onMetricsChange: ({ pcmFrameCount }) => {
          pcmFrameCountRef.current = Math.max(pcmFrameCountRef.current, pcmFrameCount);
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
    const submitTargets = resolveSubmitTargets();
    dispatch({ type: 'LOCK_SUBMISSION', clientRequestId });

    try {
      const activeSession = activeSessionRef.current;
      const snapshot = activeSession?.getSnapshot();
      const effectivePcmFrameCount =
        state.pcmFrameCount || snapshot?.pcmFrameCount || pcmFrameCountRef.current;

      if (effectivePcmFrameCount <= 0) {
        dispatch({ type: 'UPLOAD_ERROR', reason: 'PCM capture is empty. Record again before sending.' });
        return;
      }

      if (activeSession) {
        await activeSession.close('submit');
        activeSessionRef.current = null;
      }

      const submitResult = await submitVoiceCapture({
        clientRequestId,
        transcriptText,
        spreadsheetId: submitTargets.spreadsheetId,
        slackChannelId: submitTargets.slackChannelId,
        notionDatabaseId: submitTargets.notionDatabaseId,
        notionParentPageId: submitTargets.notionParentPageId,
        sessionId: state.sessionId ?? snapshot?.sessionId ?? undefined,
        pcmFrameCount: effectivePcmFrameCount,
        stt_provider: snapshot?.sttProvider ?? 'whisper',
        audio_duration_sec: snapshot?.audioDurationSec ?? 0
      });
      dispatch({
        type: 'UPLOAD_SUCCESS',
        acceptedForRetry: submitResult.acceptedForRetry,
        message: submitResult.reason ?? null
      });
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
