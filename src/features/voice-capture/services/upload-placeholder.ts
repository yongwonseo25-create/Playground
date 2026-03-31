export interface UploadPcmPayload {
  clientRequestId: string;
  transcriptText: string;
  spreadsheetId: string;
  slackChannelId: string;
  sessionId: string;
  pcmFrameCount: number;
}

export interface UploadPcmResult {
  ok: boolean;
  acceptedForRetry: boolean;
  reason: string;
  mocked: boolean;
  circuitState: string | null;
}

const LIVE_SUBMIT_TIMEOUT_MS = 15000;

function assertValidPayload(payload: UploadPcmPayload) {
  if (!payload.clientRequestId) {
    throw new Error('Missing clientRequestId lock.');
  }

  if (!payload.transcriptText.trim()) {
    throw new Error('Transcript is not ready for live submission.');
  }

  if (!payload.pcmFrameCount) {
    throw new Error('PCM capture is empty. Record again before sending.');
  }
}

export async function uploadPcmLive(payload: UploadPcmPayload): Promise<UploadPcmResult> {
  assertValidPayload(payload);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), LIVE_SUBMIT_TIMEOUT_MS);

  try {
    const response = await fetch('/api/voice/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    let result: Partial<UploadPcmResult> & { ok?: boolean; error?: string } = {};
    try {
      result = (await response.json()) as Partial<UploadPcmResult> & { ok?: boolean; error?: string };
    } catch {
      throw new Error('Live submit route returned invalid JSON.');
    }

    if (!response.ok || result.ok !== true) {
      throw new Error(
        typeof result.error === 'string'
          ? result.error
          : typeof result.reason === 'string'
          ? result.reason
          : `Live submit failed with status ${response.status}.`
      );
    }

    return {
      ok: true,
      acceptedForRetry: Boolean(result.acceptedForRetry),
      reason: typeof result.reason === 'string' ? result.reason : '',
      mocked: Boolean(result.mocked),
      circuitState: typeof result.circuitState === 'string' ? result.circuitState : null
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Live submit timed out after 15 seconds.');
    }

    throw error instanceof Error ? error : new Error('Live submit failed.');
  } finally {
    window.clearTimeout(timeout);
  }
}
