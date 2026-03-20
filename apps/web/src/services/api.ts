import { Destination } from '../types';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://127.0.0.1:8788';

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export const api = {
  async startVoiceSession(destination: Destination): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ destination })
    });

    const data = await parseJson<{ sessionId: string }>(response);
    return data.sessionId;
  },

  async uploadVoiceBlob(sessionId: string, audioBlob: Blob, destination: Destination): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        destination,
        audioByteLength: audioBlob.size
      })
    });

    await parseJson(response);
  },

  async getProcessingResult(sessionId: string, onProgress: (step: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(`${API_BASE_URL}/api/session/${sessionId}/events`);
      let settled = false;

      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        eventSource.close();
        callback();
      };

      eventSource.addEventListener('progress', (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as { step: number };
        onProgress(payload.step);
      });

      eventSource.addEventListener('result', (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as { text: string };
        finish(() => resolve(payload.text));
      });

      eventSource.addEventListener('error', (event) => {
        const payload = (event as MessageEvent<string>).data
          ? (JSON.parse((event as MessageEvent).data) as { message?: string })
          : null;
        finish(() => reject(new Error(payload?.message ?? 'Processing stream disconnected.')));
      });
    });
  },

  async sendStructuredOutput(sessionId: string, destination: Destination, text: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId, destination, text })
    });

    await parseJson(response);
  },

  async resetSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId })
    });

    await parseJson(response);
  }
};
