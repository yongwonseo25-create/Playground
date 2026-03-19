'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_TRANSCRIPT_PREVIEW,
  type VoiceReducerState
} from '@/features/voice-capture/types/voice-types';
import {
  type VoiceCaptureSubmitPayload,
  useVoiceCaptureMachine
} from '@/features/voice-capture/state/use-voice-capture-machine';
import {
  getV4Destination,
  listV4Destinations,
  type V4Destination,
  type V4DestinationKey
} from '@/shared/contracts/v4/common';
import { type ZhiDispatchResponse } from '@/shared/contracts/v4/zhi';
import { submitZhiDispatch } from '@/features/v4-zhi/services/submit-zhi-dispatch';

type Step = 'step1' | 'step2' | 'step3';

const STEP3_RETURN_DELAY_MS = 2200;
const zhiDestinations = listV4Destinations('zhi');

function getUiStep(status: VoiceReducerState): Step {
  if (status === 'success') {
    return 'step3';
  }

  if (status === 'stopping' || status === 'uploading' || status === 'error') {
    return 'step2';
  }

  return 'step1';
}

function transcriptReady(transcriptText: string): boolean {
  const normalized = transcriptText.trim();
  return normalized.length > 0 && normalized !== DEFAULT_TRANSCRIPT_PREVIEW;
}

export function V4ZhiCaptureScreen() {
  const [selectedDestinationKey, setSelectedDestinationKey] = useState<V4DestinationKey | null>(null);
  const [lastDispatchResult, setLastDispatchResult] = useState<ZhiDispatchResponse | null>(null);
  const autoSubmitRef = useRef<string | null>(null);

  const selectedDestination = useMemo(() => {
    return selectedDestinationKey ? getV4Destination(selectedDestinationKey) : null;
  }, [selectedDestinationKey]);

  const { state, actions } = useVoiceCaptureMachine({
    onSubmit: async (payload: VoiceCaptureSubmitPayload) => {
      if (!selectedDestination) {
        throw new Error('Choose a destination before running ZHI execution.');
      }

      const response = await submitZhiDispatch({
        clientRequestId: payload.clientRequestId,
        transcriptText: payload.transcriptText,
        destinationKey: selectedDestination.key,
        sessionId: payload.sessionId,
        sttProvider: payload.sttProvider,
        audioDurationSec: payload.audioDurationSec
      });

      setLastDispatchResult(response);
    }
  });

  const step = getUiStep(state.status);
  const isRecording = state.status === 'recording';
  const isSending = state.status === 'uploading';
  const canRecord = Boolean(selectedDestination);

  useEffect(() => {
    if (state.status === 'success') {
      const timeout = window.setTimeout(() => {
        autoSubmitRef.current = null;
        setLastDispatchResult(null);
        actions.reset();
      }, STEP3_RETURN_DELAY_MS);

      return () => window.clearTimeout(timeout);
    }
  }, [actions, state.status]);

  useEffect(() => {
    if (!selectedDestination) {
      return;
    }

    if (
      state.status !== 'stopping' ||
      !state.transcriptFinalized ||
      !transcriptReady(state.transcriptPreview)
    ) {
      return;
    }

    const submitKey = state.sessionId ?? state.transcriptPreview;
    if (autoSubmitRef.current === submitKey) {
      return;
    }

    autoSubmitRef.current = submitKey;
    void actions.submitRecording();
  }, [
    actions,
    selectedDestination,
    state.sessionId,
    state.status,
    state.transcriptFinalized,
    state.transcriptPreview
  ]);

  const handleDestinationSelect = (destinationKey: V4DestinationKey) => {
    if (state.status !== 'idle' && state.status !== 'ready' && state.status !== 'success') {
      return;
    }

    autoSubmitRef.current = null;
    setLastDispatchResult(null);
    setSelectedDestinationKey(destinationKey);
    if (state.status === 'success') {
      actions.reset();
    }
  };

  const handleMicPress = () => {
    if (!canRecord) {
      return;
    }

    if (isRecording) {
      actions.stopRecording();
      return;
    }

    autoSubmitRef.current = null;
    setLastDispatchResult(null);
    void actions.startRecording();
  };

  const handleRetry = async () => {
    if (isSending) {
      return;
    }

    await actions.submitRecording();
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#03111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(245,158,11,0.16),transparent_30%),linear-gradient(180deg,#041221_0%,#02070f_100%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-8">
        <header className="space-y-3 pb-8">
          <p className="text-[11px] uppercase tracking-[0.38em] text-cyan-200/72">Speak Once. Execute Everywhere.</p>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-semibold tracking-[0.12em] text-cyan-50">VOXERA</h1>
              <p className="mt-2 max-w-[260px] text-sm leading-6 text-slate-300/78">
                Choose the destination first. ZHI runs the captured intent into Make.com immediately after speech stops.
              </p>
            </div>
            {selectedDestination ? (
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Active</p>
                <p className="text-sm font-medium text-white">{selectedDestination.label}</p>
              </div>
            ) : null}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {step === 'step1' ? (
            <motion.section
              key="step1"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-1 flex-col"
            >
              <div className="space-y-3">
                <p className="text-sm font-medium text-cyan-100">Where should we execute?</p>
                <div className="grid grid-cols-2 gap-3">
                  {zhiDestinations.map((destination) => {
                    const isSelected = selectedDestination?.key === destination.key;

                    return (
                      <button
                        key={destination.key}
                        type="button"
                        data-testid={`destination-${destination.key}`}
                        onClick={() => handleDestinationSelect(destination.key)}
                        className={[
                          'rounded-[26px] border px-4 py-4 text-left transition',
                          isSelected
                            ? 'border-cyan-300/70 bg-cyan-300/12 shadow-[0_0_0_1px_rgba(103,232,249,0.2),0_18px_42px_rgba(8,145,178,0.18)]'
                            : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'
                        ].join(' ')}
                      >
                        <p className="text-sm font-semibold text-white">{destination.label}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-300/72">{destination.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-10 flex flex-1 flex-col items-center justify-center">
                <motion.button
                  type="button"
                  onClick={handleMicPress}
                  whileTap={{ scale: canRecord ? 0.97 : 1 }}
                  animate={
                    isRecording
                      ? {
                          scale: [1, 1.03, 1],
                          boxShadow: [
                            '0 20px 48px rgba(34,211,238,0.18)',
                            '0 24px 54px rgba(34,211,238,0.28)',
                            '0 20px 48px rgba(34,211,238,0.18)'
                          ]
                        }
                      : {
                          scale: 1,
                          boxShadow: '0 18px 40px rgba(15,23,42,0.48)'
                        }
                  }
                  transition={{ duration: 1.8, repeat: isRecording ? Infinity : 0 }}
                  data-testid="voice-mic-button"
                  aria-label={isRecording ? 'Stop recording and continue' : 'Start recording'}
                  disabled={!canRecord}
                  className={[
                    'relative flex h-52 w-52 items-center justify-center rounded-full border text-slate-950 transition',
                    canRecord
                      ? 'border-cyan-200/40 bg-[radial-gradient(circle_at_32%_28%,#a5f3fc_0%,#22d3ee_45%,#0891b2_100%)]'
                      : 'border-white/10 bg-slate-900/90 text-white/40'
                  ].join(' ')}
                >
                  <div className="absolute inset-3 rounded-full border border-white/20" />
                  <div className="relative z-10 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-950/18">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
                        <path d="M17 11a1 1 0 1 0-2 0 3 3 0 1 1-6 0 1 1 0 1 0-2 0 5 5 0 0 0 4 4.9V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.1A5 5 0 0 0 17 11Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold">{canRecord ? 'Hold the command line in your voice' : 'Choose a destination first'}</p>
                  </div>
                </motion.button>

                <p className="mt-6 text-center text-sm leading-6 text-slate-300/72">
                  {selectedDestination
                    ? `${selectedDestination.label} is armed for zero-human execution.`
                    : 'Pick Slack or Jira to arm the automatic execution lane.'}
                </p>
              </div>
            </motion.section>
          ) : null}

          {step === 'step2' ? (
            <motion.section
              key="step2"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-1 flex-col"
            >
              <div className="rounded-[30px] border border-cyan-300/18 bg-slate-950/84 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.35)] backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/64">Immediate Lane</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {selectedDestination?.label ?? 'ZHI'}
                    </h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300/74">
                    {isSending ? 'Executing' : state.status === 'error' ? 'Retry Required' : 'Preparing'}
                  </div>
                </div>

                <div
                  data-testid="voice-transcript-box"
                  className="mt-5 min-h-[220px] rounded-[24px] border border-white/8 bg-slate-900/72 p-4 text-sm leading-7 text-slate-100/92"
                >
                  {state.transcriptPreview}
                </div>

                <div className="mt-5 rounded-[24px] border border-cyan-400/12 bg-cyan-400/[0.06] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/62">Execution status</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200/88">
                    {isSending
                      ? `Dispatching directly to ${selectedDestination?.label ?? 'the destination'} and charging one execution credit only after webhook success.`
                      : state.status === 'error'
                        ? state.lastError ?? 'The execution failed before the webhook completed.'
                        : 'Preparing the final payload from the live transcript.'}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={actions.reset}
                  disabled={isSending}
                  data-testid="voice-cancel-button"
                  className="h-14 flex-1 rounded-2xl border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleRetry}
                  disabled={isSending || state.status !== 'error'}
                  data-testid="voice-send-button"
                  className="h-14 flex-1 rounded-2xl bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                >
                  {isSending ? 'Executing...' : 'Retry Execution'}
                </Button>
              </div>
            </motion.section>
          ) : null}

          {step === 'step3' ? (
            <motion.section
              key="step3"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center"
            >
              <div
                data-testid="voice-success-container"
                className="w-full rounded-[34px] border border-emerald-300/18 bg-emerald-400/[0.08] p-8 text-center shadow-[0_24px_60px_rgba(16,185,129,0.12)]"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-300 text-slate-950 shadow-[0_0_30px_rgba(52,211,153,0.28)]">
                  <svg width="34" height="34" viewBox="0 0 52 52" fill="none" aria-hidden="true">
                    <path
                      d="M14 27l8 8 16-18"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-emerald-100/72">Executed</p>
                <h2 data-testid="voice-success-text" className="mt-3 text-3xl font-semibold text-white">
                  Sent to {lastDispatchResult?.destination.label ?? selectedDestination?.label ?? 'destination'}
                </h2>
                <p className="mt-4 text-sm leading-6 text-emerald-50/82">
                  1 execution credit was charged only after Make.com delivery completed.
                </p>
                <div className="mt-6 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/84">
                  Remaining credits: <span className="font-semibold">{lastDispatchResult?.credits.remainingCredits ?? '--'}</span>
                </div>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}
