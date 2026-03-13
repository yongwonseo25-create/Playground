'use client';

import { clientEnv } from '@/shared/config/env.client';
import { formatZodIssues } from '@/shared/contracts/common';
import {
  type BackendConnectionState,
  voiceClientEventSchema,
  voiceServerEventSchema
} from '@/shared/contracts/voice';

const WORKLET_MODULE_PATH = '/audio/voxera-pcm16-capture.worklet.js';
const FINAL_TRANSCRIPT_WAIT_MS = 1500;
const SOCKET_CLOSE_WAIT_MS = 750;

type StopReason = 'manual' | 'timeout' | 'reset' | 'submit' | 'unmount' | 'runtime-error';

export interface VoiceRuntimeSnapshot {
  sessionId: string;
  transcriptText: string;
  transcriptFinalized: boolean;
  pcmFrameCount: number;
  connection: BackendConnectionState;
}

export interface RealtimeVoiceSessionCallbacks {
  onConnectionChange: (connection: BackendConnectionState) => void;
  onTranscript: (payload: {
    text: string;
    finalized: boolean;
    pcmFrameCount: number;
    sessionId: string;
  }) => void;
  onMetricsChange: (payload: { pcmFrameCount: number; sessionId: string }) => void;
  onRuntimeError: (message: string) => void;
}

export interface RealtimeVoiceSession {
  sessionId: string;
  getSnapshot: () => VoiceRuntimeSnapshot;
  stopCapture: (reason: StopReason) => Promise<VoiceRuntimeSnapshot>;
  close: (reason: StopReason) => Promise<void>;
}

export class VoicePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoicePermissionError';
  }
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `voxera-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatContractIssues(issues: ReturnType<typeof formatZodIssues>): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function readSocketText(data: Blob | ArrayBuffer | string): Promise<string | null> {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof Blob) {
    return data.text();
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }

  return null;
}

async function closeSocket(socket: WebSocket, reason: StopReason): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
    return;
  }

  const closePromise = new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, SOCKET_CLOSE_WAIT_MS);

    socket.addEventListener(
      'close',
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });

  socket.close(1000, reason);
  await closePromise;
}

export async function createRealtimeVoiceSession(
  callbacks: RealtimeVoiceSessionCallbacks
): Promise<RealtimeVoiceSession> {
  if (typeof window === 'undefined') {
    throw new Error('Voice runtime is only available in the browser.');
  }

  if (!window.isSecureContext) {
    throw new Error('Voice runtime requires a secure context for microphone capture.');
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support microphone capture.');
  }

  if (typeof window.AudioContext === 'undefined') {
    throw new Error('This browser does not support AudioWorklet capture.');
  }

  const sessionId = createSessionId();
  let connection: BackendConnectionState = 'connecting';
  let transcriptText = '';
  let transcriptFinalized = false;
  let pcmFrameCount = 0;
  let serverReady = false;
  let audioStopped = false;
  let socketClosedByClient = false;
  let stopPromise: Promise<VoiceRuntimeSnapshot> | null = null;
  let closePromise: Promise<void> | null = null;
  let resolveFinalTranscriptWait: (() => void) | null = null;
  const finalTranscriptWait = new Promise<void>((resolve) => {
    resolveFinalTranscriptWait = resolve;
  });
  const pendingChunks: ArrayBuffer[] = [];

  callbacks.onConnectionChange(connection);

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (error) {
    const typedError = error as DOMException | undefined;
    if (typedError?.name === 'NotAllowedError' || typedError?.name === 'SecurityError') {
      throw new VoicePermissionError('Microphone permission was denied.');
    }

    throw new Error('Unable to access the microphone for AudioWorklet capture.');
  }

  const audioContext = new window.AudioContext({
    latencyHint: 'interactive'
  });

  try {
    await audioContext.audioWorklet.addModule(WORKLET_MODULE_PATH);
    await audioContext.resume();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close().catch(() => undefined);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to initialize the AudioWorklet runtime.'
    );
  }

  let socket: WebSocket;
  try {
    socket = await new Promise<WebSocket>((resolve, reject) => {
      const nextSocket = new WebSocket(clientEnv.NEXT_PUBLIC_WSS_URL);
      nextSocket.binaryType = 'arraybuffer';

      const cleanup = () => {
        nextSocket.removeEventListener('open', handleOpen);
        nextSocket.removeEventListener('error', handleError);
        nextSocket.removeEventListener('close', handleCloseBeforeOpen);
      };

      const handleOpen = () => {
        cleanup();
        resolve(nextSocket);
      };

      const handleError = () => {
        cleanup();
        reject(new Error('Failed to connect to the configured WSS voice runtime.'));
      };

      const handleCloseBeforeOpen = () => {
        cleanup();
        reject(new Error('The configured WSS voice runtime closed before the session was ready.'));
      };

      nextSocket.addEventListener('open', handleOpen);
      nextSocket.addEventListener('error', handleError);
      nextSocket.addEventListener('close', handleCloseBeforeOpen);
    });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close().catch(() => undefined);
    throw error instanceof Error ? error : new Error('Failed to connect to the WSS voice runtime.');
  }

  const sourceNode = audioContext.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(audioContext, 'voxera-pcm16-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1]
  });
  const muteNode = audioContext.createGain();
  muteNode.gain.value = 0;

  const getSnapshot = (): VoiceRuntimeSnapshot => ({
    sessionId,
    transcriptText,
    transcriptFinalized,
    pcmFrameCount,
    connection
  });

  const resolveTranscriptWait = () => {
    resolveFinalTranscriptWait?.();
    resolveFinalTranscriptWait = null;
  };

  const flushPendingChunks = () => {
    if (!serverReady || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    while (pendingChunks.length > 0) {
      const chunk = pendingChunks.shift();
      if (chunk) {
        socket.send(chunk);
      }
    }
  };

  const pushControlEvent = (payload: unknown) => {
    const parsedEvent = voiceClientEventSchema.safeParse(payload);
    if (!parsedEvent.success) {
      throw new Error(
        `Invalid outgoing WSS contract. ${formatContractIssues(formatZodIssues(parsedEvent.error))}`
      );
    }

    socket.send(JSON.stringify(parsedEvent.data));
  };

  const stopAudioGraph = async () => {
    if (audioStopped) {
      return;
    }

    audioStopped = true;
    workletNode.port.postMessage({ type: 'stop' });
    sourceNode.disconnect();
    workletNode.disconnect();
    muteNode.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close().catch(() => undefined);
  };

  socket.addEventListener('message', (event) => {
    void (async () => {
      const text = await readSocketText(event.data as Blob | ArrayBuffer | string);
      if (!text) {
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        callbacks.onRuntimeError('Received non-JSON data from the WSS voice runtime.');
        return;
      }

      const parsedMessage = voiceServerEventSchema.safeParse(payload);
      if (!parsedMessage.success) {
        callbacks.onRuntimeError(
          `Invalid incoming WSS contract. ${formatContractIssues(formatZodIssues(parsedMessage.error))}`
        );
        return;
      }

      const message = parsedMessage.data;

      if ('sessionId' in message && message.sessionId !== sessionId) {
        callbacks.onRuntimeError('Received a WSS message for a different voice session.');
        return;
      }

      switch (message.type) {
        case 'session.ready': {
          serverReady = true;
          connection = 'connected';
          callbacks.onConnectionChange(connection);
          flushPendingChunks();
          break;
        }
        case 'transcript.partial': {
          transcriptText = message.text;
          transcriptFinalized = false;
          callbacks.onTranscript({
            text: transcriptText,
            finalized: false,
            pcmFrameCount,
            sessionId
          });
          break;
        }
        case 'transcript.final': {
          transcriptText = message.text;
          transcriptFinalized = true;
          pcmFrameCount = message.pcmFrameCount ?? pcmFrameCount;
          callbacks.onTranscript({
            text: transcriptText,
            finalized: true,
            pcmFrameCount,
            sessionId
          });
          callbacks.onMetricsChange({ pcmFrameCount, sessionId });
          resolveTranscriptWait();
          break;
        }
        case 'session.error': {
          connection = 'error';
          callbacks.onConnectionChange(connection);
          callbacks.onRuntimeError(message.error);
          resolveTranscriptWait();
          break;
        }
      }
    })();
  });

  socket.addEventListener('error', () => {
    if (socketClosedByClient) {
      return;
    }

    connection = 'error';
    callbacks.onConnectionChange(connection);
    callbacks.onRuntimeError('The WSS voice runtime reported a transport error.');
    resolveTranscriptWait();
  });

  socket.addEventListener('close', (event) => {
    if (socketClosedByClient) {
      connection = 'disconnected';
      callbacks.onConnectionChange(connection);
      resolveTranscriptWait();
      return;
    }

    connection = event.code === 1000 ? 'disconnected' : 'error';
    callbacks.onConnectionChange(connection);

    if (event.code !== 1000) {
      callbacks.onRuntimeError(event.reason || 'The WSS voice runtime closed unexpectedly.');
    }

    resolveTranscriptWait();
  });

  workletNode.port.onmessage = (event) => {
    const chunk = event.data as { type?: string; frameCount?: number; buffer?: ArrayBuffer };
    if (chunk.type !== 'pcm-chunk' || typeof chunk.frameCount !== 'number' || !chunk.buffer) {
      return;
    }

    pcmFrameCount += chunk.frameCount;
    callbacks.onMetricsChange({ pcmFrameCount, sessionId });

    if (serverReady && socket.readyState === WebSocket.OPEN) {
      socket.send(chunk.buffer);
      return;
    }

    pendingChunks.push(chunk.buffer.slice(0));
  };

  sourceNode.connect(workletNode);
  workletNode.connect(muteNode);
  muteNode.connect(audioContext.destination);

  try {
    pushControlEvent({
      type: 'session.start',
      sessionId,
      sentAt: new Date().toISOString(),
      audio: {
        format: 'pcm16',
        sampleRateHz: audioContext.sampleRate,
        channelCount: 1
      }
    });
  } catch (error) {
    socketClosedByClient = true;
    await stopAudioGraph();
    await closeSocket(socket, 'runtime-error');
    throw error instanceof Error ? error : new Error('Failed to send the WSS session.start event.');
  }

  const stopCapture = async (reason: StopReason): Promise<VoiceRuntimeSnapshot> => {
    if (stopPromise) {
      return stopPromise;
    }

    stopPromise = (async () => {
      await stopAudioGraph();

      if (socket.readyState === WebSocket.OPEN) {
        pushControlEvent({
          type: 'session.stop',
          sessionId,
          sentAt: new Date().toISOString(),
          totalFrames: pcmFrameCount
        });
      }

      if (!transcriptFinalized) {
        await Promise.race([finalTranscriptWait, delay(FINAL_TRANSCRIPT_WAIT_MS)]);
      }

      return getSnapshot();
    })();

    return stopPromise;
  };

  const close = async (reason: StopReason): Promise<void> => {
    if (closePromise) {
      return closePromise;
    }

    closePromise = (async () => {
      await stopCapture(reason).catch(() => undefined);
      pendingChunks.length = 0;
      socketClosedByClient = true;
      await closeSocket(socket, reason).catch(() => undefined);
      connection = 'disconnected';
      callbacks.onConnectionChange(connection);
    })();

    return closePromise;
  };

  return {
    sessionId,
    getSnapshot,
    stopCapture,
    close
  };
}
