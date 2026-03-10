'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useVoiceCaptureMachine } from '@/features/voice-capture/state/use-voice-capture-machine';
import type { VoiceReducerState } from '@/features/voice-capture/types/voice-types';

type Step = 'step1' | 'step2' | 'step3';

const STEP3_CIRCLE_DURATION_MS = 700;
const STEP3_RETURN_DELAY_AFTER_TEXT_MS = 2000;

function getUiStep(status: VoiceReducerState): Step {
  if (status === 'success') {
    return 'step3';
  }

  if (status === 'stopping' || status === 'uploading' || status === 'error') {
    return 'step2';
  }

  return 'step1';
}

const screenFade: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.24, ease: [0.4, 0, 1, 1] }
  }
};

const micPlateVariants: Variants = {
  idle: {
    scale: 1,
    boxShadow:
      '0 14px 32px rgba(0,0,0,0.36), 0 0 0 1px rgba(56,189,248,0.12), 0 0 10px 2px rgba(34,211,238,0.10)',
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
  },
  recording: {
    scale: [1, 1.015, 1],
    boxShadow: [
      '0 16px 34px rgba(0,0,0,0.38), 0 0 0 1px rgba(56,189,248,0.18), 0 0 12px 3px rgba(34,211,238,0.16)',
      '0 18px 38px rgba(0,0,0,0.40), 0 0 0 1px rgba(56,189,248,0.26), 0 0 18px 5px rgba(34,211,238,0.24)',
      '0 20px 42px rgba(0,0,0,0.42), 0 0 0 1px rgba(56,189,248,0.34), 0 0 24px 7px rgba(34,211,238,0.30)',
      '0 18px 38px rgba(0,0,0,0.40), 0 0 0 1px rgba(56,189,248,0.26), 0 0 18px 5px rgba(34,211,238,0.24)',
      '0 16px 34px rgba(0,0,0,0.38), 0 0 0 1px rgba(56,189,248,0.18), 0 0 12px 3px rgba(34,211,238,0.16)'
    ],
    transition: {
      duration: 2.2,
      ease: 'easeInOut',
      repeat: Infinity
    }
  }
};

const micButtonVariants: Variants = {
  idle: {
    scale: 1,
    filter: 'brightness(1)'
  },
  recording: {
    scale: 1.3,
    filter: ['brightness(1)', 'brightness(1.06)', 'brightness(1)'],
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

const waveformContainerVariants: Variants = {
  idle: {
    opacity: 0.82,
    y: 0,
    transition: { duration: 0.3 }
  },
  recording: {
    opacity: 1,
    y: [0, -1.5, 0],
    transition: {
      duration: 2.4,
      ease: 'easeInOut',
      repeat: Infinity
    }
  }
};

const sendRingVariants: Variants = {
  idle: {
    opacity: 0,
    rotate: 0
  },
  sending: {
    opacity: 1,
    rotate: 360,
    transition: {
      rotate: {
        duration: 1.2,
        repeat: Infinity,
        ease: 'linear'
      },
      opacity: {
        duration: 0.16
      }
    }
  }
};

const completionTextVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      delay: STEP3_CIRCLE_DURATION_MS / 1000,
      duration: 0.24,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

const STEP1_WAVEFORM_TRACES = [
  { idle: 20, peak: 36 },
  { idle: 28, peak: 54 },
  { idle: 18, peak: 34 },
  { idle: 36, peak: 68 },
  { idle: 52, peak: 96 },
  { idle: 40, peak: 78 },
  { idle: 24, peak: 42 },
  { idle: 58, peak: 108 },
  { idle: 34, peak: 64 },
  { idle: 22, peak: 40 },
  { idle: 30, peak: 56 },
  { idle: 16, peak: 30 }
] as const;

export function VoiceCaptureScreen() {
  const { state, actions } = useVoiceCaptureMachine();
  const step = getUiStep(state.status);
  const isRecording = state.status === 'recording';
  const isSending = state.status === 'uploading';

  useEffect(() => {
    if (step !== 'step3') {
      return;
    }

    const totalMs = STEP3_CIRCLE_DURATION_MS + STEP3_RETURN_DELAY_AFTER_TEXT_MS;
    const timeout = window.setTimeout(() => {
      actions.reset();
    }, totalMs);

    return () => window.clearTimeout(timeout);
  }, [actions, step]);

  const handleMicTouch = () => {
    if (step !== 'step1') {
      return;
    }

    if (isRecording) {
      actions.stopRecording();
      return;
    }

    actions.startRecording();
  };

  const handleCancel = () => {
    if (isSending) {
      return;
    }

    actions.reset();
  };

  const handleSend = async () => {
    if (isSending) {
      return;
    }

    await actions.submitRecording();
  };

  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_50%_45%,rgba(56,189,248,0.12),transparent_42%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(3,7,18,1))]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.12),transparent_65%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-8">
        <header className="flex justify-center">
          <h1 className="text-[20px] font-semibold uppercase tracking-[0.28em] text-white/95">VOXERA</h1>
        </header>

        <div className="flex-1">
          <AnimatePresence mode="wait">
            {step === 'step1' && (
              <Step1Main
                key="step1"
                isRecording={isRecording}
                onMicTouch={handleMicTouch}
                disabled={state.status === 'permission-requesting'}
              />
            )}

            {step === 'step2' && (
              <Step2Confirm
                key="step2"
                transcript={state.transcriptPreview}
                isSending={isSending}
                errorMessage={state.lastError}
                onCancel={handleCancel}
                onSend={handleSend}
              />
            )}

            {step === 'step3' && <Step3Complete key="step3" />}
          </AnimatePresence>
        </div>
        {step !== 'step1' ? (
          <footer className="pt-6">
            <p className="whitespace-nowrap text-center text-[14px] font-medium tracking-[0.02em] text-white/68">
              Speak. Awaken your second brain.
            </p>
          </footer>
        ) : null}
      </div>
    </main>
  );
}

function Step1Main({
  isRecording,
  onMicTouch,
  disabled
}: {
  isRecording: boolean;
  onMicTouch: () => void;
  disabled: boolean;
}) {
  return (
    <motion.section
      variants={screenFade}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col items-center"
    >
      <div className="pt-16" />

      <div className="flex w-full flex-col items-center justify-center">
        <motion.div
          variants={waveformContainerVariants}
          animate={isRecording ? 'recording' : 'idle'}
          className="mb-10 flex h-[128px] w-[84%] items-center justify-center"
          aria-hidden="true"
        >
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full">
            <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-cyan-200/22 shadow-[0_0_14px_rgba(56,189,248,0.28)]" />
            <div className="absolute inset-x-6 top-1/2 h-10 -translate-y-1/2 bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_72%)] blur-xl" />
            <div className="relative flex h-full items-center justify-center gap-[7px]">
              {STEP1_WAVEFORM_TRACES.map((trace, index) => (
                <motion.span
                  key={index}
                  className="block w-[2px] rounded-full bg-gradient-to-b from-cyan-100 via-sky-300 to-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.72),0_0_22px_rgba(34,211,238,0.36)]"
                  initial={{
                    height: `${trace.idle}px`,
                    opacity: 0.72
                  }}
                  animate={
                    isRecording
                      ? {
                          height: [
                            `${Math.max(16, Math.round(trace.peak * 0.42))}px`,
                            `${Math.round(trace.peak * 0.82)}px`,
                            `${trace.peak}px`,
                            `${Math.round(trace.peak * 0.58)}px`,
                            `${Math.round(trace.peak * 0.92)}px`
                          ],
                          opacity: [0.62, 0.94, 1, 0.78, 0.96],
                          boxShadow: [
                            '0 0 8px rgba(56,189,248,0.42), 0 0 16px rgba(34,211,238,0.18)',
                            '0 0 12px rgba(56,189,248,0.58), 0 0 24px rgba(34,211,238,0.26)',
                            '0 0 16px rgba(125,211,252,0.72), 0 0 32px rgba(34,211,238,0.34)',
                            '0 0 10px rgba(56,189,248,0.5), 0 0 18px rgba(34,211,238,0.22)',
                            '0 0 14px rgba(125,211,252,0.66), 0 0 28px rgba(34,211,238,0.3)'
                          ]
                        }
                      : {
                          height: `${trace.idle}px`,
                          opacity: 0.6,
                          boxShadow: '0 0 8px rgba(56,189,248,0.34), 0 0 16px rgba(34,211,238,0.16)'
                        }
                  }
                  transition={{
                    duration: 1.35 + (index % 5) * 0.14,
                    repeat: Infinity,
                    ease: [0.42, 0, 0.58, 1],
                    delay: index * 0.05
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={micPlateVariants}
          animate={isRecording ? 'recording' : 'idle'}
          className="relative flex h-36 w-36 items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.18),rgba(255,255,255,0.04)_30%,rgba(15,23,42,0.92)_68%,rgba(2,6,23,1)_100%)] ring-1 ring-sky-300/18 backdrop-blur-md before:absolute before:inset-[7px] before:rounded-full before:bg-slate-950/78 after:absolute after:inset-[2px] after:rounded-full after:border after:border-white/10"
        >
          <motion.button
            type="button"
            onClick={onMicTouch}
            variants={micButtonVariants}
            animate={isRecording ? 'recording' : 'idle'}
            whileTap={{ scale: isRecording ? 1.25 : 0.96 }}
            className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-b from-sky-400 via-cyan-400 to-sky-500 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300/80 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={isRecording ? 'Stop recording and continue' : 'Start recording'}
            data-testid="voice-mic-button"
            disabled={disabled}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
              <path d="M17 11a1 1 0 1 0-2 0 3 3 0 1 1-6 0 1 1 0 1 0-2 0 5 5 0 0 0 4 4.9V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.1A5 5 0 0 0 17 11Z" />
            </svg>
          </motion.button>
        </motion.div>
      </div>
    </motion.section>
  );
}

function Step2Confirm({
  transcript,
  isSending,
  errorMessage,
  onCancel,
  onSend
}: {
  transcript: string;
  isSending: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <motion.section
      variants={screenFade}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      <div className="pt-20" />

      <div className="flex flex-1 flex-col items-center">
        <div className="w-full">
          <div className="relative mx-auto w-full max-w-[420px]">
            <motion.div
              variants={sendRingVariants}
              animate={isSending ? 'sending' : 'idle'}
              aria-hidden="true"
              data-testid="voice-send-ring"
              data-state={isSending ? 'sending' : 'idle'}
              className="pointer-events-none absolute inset-0 rounded-[30px] [background:conic-gradient(from_0deg,rgba(34,211,238,0)_0deg,rgba(34,211,238,0.92)_75deg,rgba(125,211,252,0)_160deg,rgba(34,211,238,0)_360deg)] p-[1.5px] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] [mask-composite:xor] [-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] [-webkit-mask-composite:xor]"
            />

            <div className="relative min-h-[336px] w-full rounded-[30px] border border-cyan-400/42 bg-slate-950/88 px-5 py-5 shadow-[0_0_0_1px_rgba(56,189,248,0.14),0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-md">
              <div
                data-testid="voice-transcript-box"
                className="voxera-scroll h-[276px] w-full overflow-y-auto touch-pan-y overscroll-contain scroll-smooth pr-2"
              >
                <p className="whitespace-pre-wrap break-words text-[16px] leading-8 text-white/92">{transcript}</p>
              </div>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 w-full rounded-2xl border border-rose-300/18 bg-rose-400/8 px-4 py-3 text-[13px] text-rose-100/90">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-8 flex w-full gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSending}
            data-testid="voice-cancel-button"
            className="h-14 flex-1 rounded-2xl border border-white/14 bg-white/[0.04] text-[15px] font-semibold text-white/88 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSend}
            disabled={isSending}
            data-testid="voice-send-button"
            className="h-14 flex-1 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 text-[15px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function Step3Complete() {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  return (
    <motion.section
      variants={screenFade}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full items-center justify-center"
      data-testid="voice-success-container"
    >
      <div className="flex flex-col items-center justify-center">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <svg viewBox="0 0 120 120" className="absolute h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={radius} stroke="rgba(34,197,94,0.14)" strokeWidth="6" fill="transparent" />
            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              stroke="rgb(74, 222, 128)"
              strokeWidth="6"
              strokeLinecap="round"
              fill="transparent"
              initial={{
                strokeDasharray: circumference,
                strokeDashoffset: circumference,
                filter: 'drop-shadow(0 0 0px rgba(74,222,128,0))'
              }}
              animate={{
                strokeDasharray: circumference,
                strokeDashoffset: 0,
                filter: [
                  'drop-shadow(0 0 0px rgba(74,222,128,0))',
                  'drop-shadow(0 0 10px rgba(74,222,128,0.42))',
                  'drop-shadow(0 0 16px rgba(74,222,128,0.58))'
                ]
              }}
              transition={{
                duration: STEP3_CIRCLE_DURATION_MS / 1000,
                ease: [0.33, 1, 0.68, 1]
              }}
            />
          </svg>

          <motion.svg
            viewBox="0 0 52 52"
            className="relative z-10 h-12 w-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              delay: STEP3_CIRCLE_DURATION_MS / 1000,
              duration: 0.16,
              ease: 'easeOut'
            }}
            aria-hidden="true"
          >
            <motion.path
              d="M14 27l8 8 16-18"
              fill="transparent"
              stroke="rgb(134,239,172)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{
                pathLength: 0,
                filter: 'drop-shadow(0 0 0px rgba(134,239,172,0))'
              }}
              animate={{
                pathLength: 1,
                filter: [
                  'drop-shadow(0 0 0px rgba(134,239,172,0))',
                  'drop-shadow(0 0 10px rgba(134,239,172,0.42))'
                ]
              }}
              transition={{
                delay: STEP3_CIRCLE_DURATION_MS / 1000,
                duration: 0.26,
                ease: [0.22, 1, 0.36, 1]
              }}
            />
          </motion.svg>
        </div>

        <motion.h2
          variants={completionTextVariants}
          initial="initial"
          animate="animate"
          data-testid="voice-success-text"
          className="mt-6 text-center text-[28px] font-semibold tracking-[-0.02em] text-emerald-300"
        >
          전송 완료!
        </motion.h2>
      </div>
    </motion.section>
  );
}
