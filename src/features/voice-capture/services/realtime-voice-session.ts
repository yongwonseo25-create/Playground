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
const SERVER_READY_TIMEOUT_MS = 5000;
const MICROPHONE_CONSTRAINTS = {
  audio: {
    channelCount: { ideal: 1 },
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
} as const;

export const WSS_READY_TIMEOUT_ERROR_MESSAGE =
  '서버 연결이 지연되고 있습니다. 잠시 후 다시 시도해주세요.';

let retainedMicrophoneStream: MediaStream | null = null;

export type VoiceEntryErrorCode =
  | 'secure-context-required'
  | 'browser-microphone-unsupported'
  | 'browser-audio-worklet-unsupported'
  | 'microphone-not-found'
  | 'browser-permission-denied'
  | 'os-permission-denied'
  | 'microphone-busy'
  | 'microphone-unavailable'
  | 'audio-worklet-init-failed'
  | 'server-connection-delayed';

export class VoiceEntryError extends Error {
  readonly code: VoiceEntryErrorCode;

  constructor(code: VoiceEntryErrorCode, message: string) {
    super(message);
    this.name = 'VoiceEntryError';
    this.code = code;
  }
}

type StopReason = 'manual' | 'timeout' | 'reset' | 'submit' | 'unmount' | 'runtime-error';

export interface VoiceRuntimeSnapshot {
  sessionId: string;
  transcriptText: string;
  transcriptFinalized: boolean;
  pcmFrameCount: number;
  sttProvider: 'whisper' | 'return-zero' | null;
  audioDurationSec: number;
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

function stopMediaStreamTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

function clearRetainedMicrophoneStream(stream?: MediaStream | null): void {
  if (stream && retainedMicrophoneStream !== stream) {
    return;
  }

  stopMediaStreamTracks(retainedMicrophoneStream);
  retainedMicrophoneStream = null;
}

function getRetainedMicrophoneStreamClone(): MediaStream | null {
  if (!retainedMicrophoneStream) {
    return null;
  }

  const hasLiveAudioTrack = retainedMicrophoneStream
    .getAudioTracks()
    .some((track) => track.readyState === 'live');

  if (!hasLiveAudioTrack) {
    clearRetainedMicrophoneStream(retainedMicrophoneStream);
    return null;
  }

  return retainedMicrophoneStream.clone();
}

function retainMicrophoneStream(stream: MediaStream): void {
  clearRetainedMicrophoneStream();
  retainedMicrophoneStream = stream;

  stream.getAudioTracks().forEach((track) => {
    track.addEventListener('ended', () => {
      if (
        retainedMicrophoneStream === stream &&
        !stream.getAudioTracks().some((audioTrack) => audioTrack.readyState === 'live')
      ) {
        clearRetainedMicrophoneStream(stream);
      }
    });
  });
}

async function getOrCreateMicrophoneStream(): Promise<MediaStream> {
  const retainedClone = getRetainedMicrophoneStreamClone();
  if (retainedClone) {
    return retainedClone;
  }

  const grantedStream = await navigator.mediaDevices.getUserMedia(MICROPHONE_CONSTRAINTS);
  retainMicrophoneStream(grantedStream);
  return grantedStream.clone();
}

export function releaseRetainedMicrophoneStream(): void {
  clearRetainedMicrophoneStream();
}

async function classifyGetUserMediaError(error: unknown): Promise<VoiceEntryError> {
  const typedError = error as DOMException | Error | undefined;
  const name = typedError?.name ?? '';
  const message = typedError?.message?.toLowerCase() ?? '';

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new VoiceEntryError(
      'microphone-not-found',
      '마이크 장치를 찾을 수 없습니다. 마이크를 연결해 주세요.'
    );
  }

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    if (
      message.includes('system') ||
      message.includes('operating system') ||
      message.includes('permission denied by system')
    ) {
      return new VoiceEntryError(
        'os-permission-denied',
        '운영체제에서 마이크 접근이 차단되었습니다. 시스템 설정을 확인해 주세요.'
      );
    }

    return new VoiceEntryError(
      'browser-permission-denied',
      '브라우저에서 마이크 권한이 차단되었습니다. 주소창 권한 설정에서 허용해 주세요.'
    );
  }

  if (name === 'SecurityError') {
    return new VoiceEntryError(
      'os-permission-denied',
      '운영체제 또는 브라우저 보안 설정으로 마이크 접근이 차단되었습니다.'
    );
  }

  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    if (
      message.includes('system') ||
      message.includes('permission denied') ||
      message.includes('denied by system')
    ) {
      return new VoiceEntryError(
        'os-permission-denied',
        '운영체제에서 마이크 접근이 차단되었습니다. 시스템 설정을 확인해 주세요.'
      );
    }

    return new VoiceEntryError(
      'microphone-busy',
      '다른 앱이 마이크를 사용 중입니다. 사용 중인 앱을 종료해 주세요.'
    );
  }

  return new VoiceEntryError(
    'microphone-unavailable',
    '마이크에 접근할 수 없습니다. 기기와 권한 상태를 확인해 주세요.'
  );
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `voxera-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveSessionLanguage(): string {
  if (typeof navigator === 'undefined') {
    return 'en-US';
  }

  return navigator.languages?.find((language) => language.trim().length > 0) ?? navigator.language ?? 'en-US';
}

function resolveSessionRoutingHints(): { premiumKoAccuracy: boolean; workflow?: string } {
  if (typeof window === 'undefined') {
    return { premiumKoAccuracy: false };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const premiumFlag = searchParams.get('premium_ko_accuracy');
  const workflow = searchParams.get('workflow')?.trim();

  return {
    premiumKoAccuracy: premiumFlag === 'true',
    workflow: workflow && workflow.length > 0 ? workflow : undefined
  };
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
    throw new VoiceEntryError(
      'secure-context-required',
      'HTTPS 환경에서만 마이크를 사용할 수 있습니다.'
    );
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new VoiceEntryError(
      'browser-microphone-unsupported',
      '이 브라우저는 마이크 녹음을 지원하지 않습니다.'
    );
  }

  if (typeof window.AudioContext === 'undefined') {
    throw new VoiceEntryError(
      'browser-audio-worklet-unsupported',
      '이 브라우저는 실시간 음성 캡처를 지원하지 않습니다. 최신 브라우저를 사용해 주세요.'
    );
  }

  const sessionId = createSessionId();
  const sessionLanguage = resolveSessionLanguage();
  const sessionRoutingHints = resolveSessionRoutingHints();
  let connection: BackendConnectionState = 'connecting';
  let transcriptText = '';
  let transcriptFinalized = false;
  let pcmFrameCount = 0;
  let sttProvider: 'whisper' | 'return-zero' | null = null;
  let audioDurationSec = 0;
  let serverReady = false;
  let audioStopped = false;
  let socketClosedByClient = false;
  let startupSettled = false;
  let stopPromise: Promise<VoiceRuntimeSnapshot> | null = null;
  let closePromise: Promise<void> | null = null;
  let resolveFinalTranscriptWait: (() => void) | null = null;
  let resolveServerReady: (() => void) | null = null;
  let rejectServerReady: ((error: Error) => void) | null = null;
  let serverReadyTimeoutId: number | null = null;
  const finalTranscriptWait = new Promise<void>((resolve) => {
    resolveFinalTranscriptWait = resolve;
  });
  const serverReadyPromise = new Promise<void>((resolve, reject) => {
    resolveServerReady = resolve;
    rejectServerReady = reject;
  });
  const pendingChunks: ArrayBuffer[] = [];

  callbacks.onConnectionChange(connection);

  let stream: MediaStream;
  try {
    stream = await getOrCreateMicrophoneStream();
  } catch (error) {
    const classifiedError = await classifyGetUserMediaError(error);
    if (classifiedError.code === 'browser-permission-denied') {
      throw new VoicePermissionError(classifiedError.message);
    }

    throw classifiedError;
  }

  const audioContext = new window.AudioContext({
    latencyHint: 'interactive'
  });

  try {
    await audioContext.audioWorklet.addModule(WORKLET_MODULE_PATH);
    await audioContext.resume();
  } catch (error) {
    stopMediaStreamTracks(stream);
    await audioContext.close().catch(() => undefined);
    throw new VoiceEntryError(
      'audio-worklet-init-failed',
      error instanceof Error
        ? `AudioWorklet 초기화에 실패했습니다. ${error.message}`
        : 'AudioWorklet 초기화에 실패했습니다.'
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
    stopMediaStreamTracks(stream);
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
    sttProvider,
    audioDurationSec,
    connection
  });

  const resolveTranscriptWait = () => {
    resolveFinalTranscriptWait?.();
    resolveFinalTranscriptWait = null;
  };

  const clearServerReadyTimeout = () => {
    if (serverReadyTimeoutId === null) {
      return;
    }

    window.clearTimeout(serverReadyTimeoutId);
    serverReadyTimeoutId = null;
  };

  const settleServerReady = (error?: Error) => {
    if (startupSettled) {
      return;
    }

    startupSettled = true;
    clearServerReadyTimeout();

    if (error) {
      rejectServerReady?.(error);
      rejectServerReady = null;
      resolveServerReady = null;
      return;
    }

    resolveServerReady?.();
    resolveServerReady = null;
    rejectServerReady = null;
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
    stopMediaStreamTracks(stream);
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
        const runtimeError = new Error('Received non-JSON data from the WSS voice runtime.');
        if (!startupSettled) {
          settleServerReady(runtimeError);
          resolveTranscriptWait();
          return;
        }

        callbacks.onRuntimeError(runtimeError.message);
        return;
      }

      const parsedMessage = voiceServerEventSchema.safeParse(payload);
      if (!parsedMessage.success) {
        const runtimeError = new Error(
          `Invalid incoming WSS contract. ${formatContractIssues(formatZodIssues(parsedMessage.error))}`
        );
        if (!startupSettled) {
          settleServerReady(runtimeError);
          resolveTranscriptWait();
          return;
        }

        callbacks.onRuntimeError(runtimeError.message);
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
          settleServerReady();
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
          sttProvider = message.stt_provider ?? sttProvider;
          audioDurationSec = message.audio_duration_sec ?? audioDurationSec;
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
          const runtimeError = new Error(message.error);
          if (!startupSettled) {
            settleServerReady(runtimeError);
            resolveTranscriptWait();
            break;
          }

          connection = 'error';
          callbacks.onConnectionChange(connection);
          callbacks.onRuntimeError(runtimeError.message);
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

    const runtimeError = new Error('The WSS voice runtime reported a transport error.');
    if (!startupSettled) {
      settleServerReady(runtimeError);
      resolveTranscriptWait();
      return;
    }

    connection = 'error';
    callbacks.onConnectionChange(connection);
    callbacks.onRuntimeError(runtimeError.message);
    resolveTranscriptWait();
  });

  socket.addEventListener('close', (event) => {
    if (socketClosedByClient) {
      connection = 'disconnected';
      callbacks.onConnectionChange(connection);
      resolveTranscriptWait();
      return;
    }

    const closeError = new Error(event.reason || 'The WSS voice runtime closed unexpectedly.');
    if (!startupSettled) {
      settleServerReady(closeError);
      resolveTranscriptWait();
      return;
    }

    connection = event.code === 1000 ? 'disconnected' : 'error';
    callbacks.onConnectionChange(connection);

    if (event.code !== 1000) {
      callbacks.onRuntimeError(closeError.message);
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
      language: sessionLanguage,
      premium_ko_accuracy: sessionRoutingHints.premiumKoAccuracy,
      workflow: sessionRoutingHints.workflow,
      sentAt: new Date().toISOString(),
      audio: {
        format: 'pcm16',
        sampleRateHz: audioContext.sampleRate,
        channelCount: 1
      }
    });

    serverReadyTimeoutId = window.setTimeout(() => {
      settleServerReady(
        new VoiceEntryError('server-connection-delayed', WSS_READY_TIMEOUT_ERROR_MESSAGE)
      );
    }, SERVER_READY_TIMEOUT_MS);

    await serverReadyPromise;
  } catch (error) {
    pendingChunks.length = 0;
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
      clearServerReadyTimeout();
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
