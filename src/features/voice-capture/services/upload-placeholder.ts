export interface UploadPcmPayload {
  clientRequestId: string;
  pcmFrameCount: number;
}

/**
 * Backend contract placeholder only.
 * Replace with real WSS/webhook upload orchestration when contract is finalized.
 */
export async function uploadPcmPlaceholder(payload: UploadPcmPayload): Promise<{ acknowledged: true }> {
  if (!payload.clientRequestId) {
    throw new Error('Missing clientRequestId lock.');
  }

  return Promise.resolve({ acknowledged: true });
}
