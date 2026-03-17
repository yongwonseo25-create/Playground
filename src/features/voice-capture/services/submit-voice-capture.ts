'use client';

import { submitVoiceProcessingJob, type SubmitVoiceProcessingInput } from '@/features/voice-capture/services/v3-voice-process';

export async function submitVoiceCapture(
  payload: SubmitVoiceProcessingInput
) {
  return submitVoiceProcessingJob(payload);
}
