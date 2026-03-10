export interface UploadPcmPayload {
  clientRequestId: string;
  pcmFrameCount: number;
}

const PLACEHOLDER_UPLOAD_DELAY_MS = 1200;

/**
 * Backend contract placeholder only.
 * Replace with real WSS/webhook upload orchestration when contract is finalized.
 */
export async function uploadPcmPlaceholder(payload: UploadPcmPayload): Promise<{ acknowledged: true }> {
  if (!payload.clientRequestId) {
    throw new Error('Missing clientRequestId lock.');
  }

  await new Promise((resolve) => {
    window.setTimeout(resolve, PLACEHOLDER_UPLOAD_DELAY_MS);
  });

  return { acknowledged: true };
}
