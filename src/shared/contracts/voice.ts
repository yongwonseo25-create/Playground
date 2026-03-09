export type BackendConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface VoiceSessionContract {
  transport: {
    protocol: 'wss' | 'https';
    endpoint: string;
    auth: 'jwt' | 'cookie' | 'unknown';
  };
  audio: {
    inputFormat: 'pcm16' | 'float32' | 'unknown';
    sampleRateHz: number | null;
    channelCount: number | null;
  };
  events: {
    clientToServer: string[];
    serverToClient: string[];
  };
}

/**
 * Typed placeholder only.
 * Replace this with a real fetcher once backend contracts are finalized.
 */
export async function getVoiceSessionContractPlaceholder(): Promise<VoiceSessionContract> {
  return {
    transport: {
      protocol: 'wss',
      endpoint: '/api/voice/session',
      auth: 'unknown'
    },
    audio: {
      inputFormat: 'unknown',
      sampleRateHz: null,
      channelCount: null
    },
    events: {
      clientToServer: [],
      serverToClient: []
    }
  };
}
