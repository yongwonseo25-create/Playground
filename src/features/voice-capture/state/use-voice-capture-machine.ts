'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { toast } from 'sonner';
import { uploadPcmLive } from '@/features/voice-capture/services/upload-placeholder';
import { voiceCaptureReducer } from '@/features/voice-capture/state/voice-capture-reducer';
import {
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

function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `voxera-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isTranscriptReady(transcriptText: string) {
  const trimmed = transcriptText.trim();
  return trimmed.length > 0 && trimmed !== initialVoiceCaptureState.transcriptPreview;
}

export function useVoiceCaptureMachine() {
  const [state, dispatch] = useReducer(voiceCaptureReducer, initialVoiceCaptureState);

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
          type: 'SET_TRANSCRIPT_PREVIEW',
          transcript: transcriptText
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
    const spreadsheetId = window.localStorage.getItem('voxera.spreadsheetId') ?? '';
    const slackChannelId = window.localStorage.getItem('voxera.slackChannelId') ?? '';
    dispatch({ type: 'SET_ROUTING_TARGETS', spreadsheetId, slackChannelId });
  }, []);

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

  useEffect(() => {
    if (state.status !== 'stopping' || stopCommandSentRef.current) {
      return;
    }

    stopCommandSentRef.current = true;
    void stopCaptureAndFinalize();
  }, [state.status, stopCaptureAndFinalize]);

  useEffect(() => {
    return () => {
      void cleanupCapture(true);
    };
  }, [cleanupCapture]);

  const progress = useMemo(() => {
    return Math.round((state.elapsedMs / state.maxRecordingMs) * 100);
  }, [state.elapsedMs, state.maxRecordingMs]);

  const remainingMs = Math.max(0, state.maxRecordingMs - state.elapsedMs);

  const startRecording = () => {
    void (async () => {
      const startedAt = Date.now();

      if (state.status === 'idle') {
        dispatch({ type: 'REQUEST_PERMISSION' });
        dispatch({ type: 'PERMISSION_GRANTED' });
      } else if (state.status !== 'ready' && state.status !== 'success') {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          }
        });

        const sessionId = createSessionId();
        const socket = await ensureSocketOpen(sessionId);

        const audioContext = new AudioContext({ sampleRate: 16000 });
        await audioContext.audioWorklet.addModule('/audio/pcm-worklet-processor.js');

        const source = audioContext.createMediaStreamSource(stream);
        const pcmNode = new AudioWorkletNode(audioContext, 'voxera-pcm-processor');
        const silence = audioContext.createGain();
        silence.gain.value = 0;

        pcmNode.port.onmessage = (message) => {
          if (!(message.data instanceof ArrayBuffer)) {
            return;
          }

          pcmFrameCountRef.current += message.data.byteLength / Int16Array.BYTES_PER_ELEMENT;

          if (socket.readyState === WebSocket.OPEN) {
            socket.send(message.data);
          }
        };

        source.connect(pcmNode);
        pcmNode.connect(silence);
        silence.connect(audioContext.destination);

        sessionIdRef.current = sessionId;
        mediaStreamRef.current = stream;
        audioContextRef.current = audioContext;
        audioNodeRef.current = pcmNode;
        pcmFrameCountRef.current = 0;
        stopCommandSentRef.current = false;

        socket.send(
          JSON.stringify({
            type: 'session.start',
            sessionId,
            sampleRateHz: audioContext.sampleRate,
            spreadsheetId: state.spreadsheetId,
            slackChannelId: state.slackChannelId
          })
        );

        dispatch({ type: 'START_RECORDING', startedAt });
      } catch (error) {
        await cleanupCapture(true);
        dispatch({
          type: 'PERMISSION_DENIED',
          reason: error instanceof Error ? error.message : 'Microphone capture failed.'
        });
      }
    })();
  };

  const requestPermission = () => {
    if (state.status !== 'idle') {
      return;
    }

    dispatch({ type: 'REQUEST_PERMISSION' });
    dispatch({ type: 'PERMISSION_GRANTED' });
  };

  const stopRecording = () => {
    if (state.status !== 'recording') {
      return;
    }

    dispatch({ type: 'STOP_RECORDING', stoppedAt: Date.now() });
  };

  const submitRecording = async () => {
    if (state.status !== 'stopping' && state.status !== 'error') {
      return;
    }

    if (pcmFrameCountRef.current <= 0) {
      dispatch({ type: 'UPLOAD_ERROR', reason: 'PCM capture is empty. Record again before sending.' });
      return;
    }

    const clientRequestId = createClientRequestId();
    dispatch({ type: 'LOCK_SUBMISSION', clientRequestId });

    try {
      const transcriptText = await waitForTranscriptReady();

      const result = await uploadPcmLive({
        clientRequestId,
        transcriptText,
        spreadsheetId: state.spreadsheetId,
        slackChannelId: state.slackChannelId,
        sessionId: sessionIdRef.current ?? '',
        pcmFrameCount: pcmFrameCountRef.current
      });

      if (result.acceptedForRetry) {
        toast.message('Background delivery in progress', {
          description:
            result.reason || 'Primary delivery is queued. The backend will continue processing.'
        });
      }

      dispatch({
        type: 'UPLOAD_SUCCESS',
        acceptedForRetry: result.acceptedForRetry,
        message:
          result.reason ||
          (result.acceptedForRetry
            ? 'Queued for background delivery.'
            : 'Transcript metadata reached /api/voice/submit.')
      });
    } catch (error) {
      dispatch({
        type: 'UPLOAD_ERROR',
        reason: error instanceof Error ? error.message : 'Upload failed.'
      });
    }
  };

  const reset = () => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'session.cancel',
          sessionId: sessionIdRef.current
        })
      );
    }

    void cleanupCapture(true);
    stopCommandSentRef.current = false;
    pcmFrameCountRef.current = 0;
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
