'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

type FreeTrialModalProps = {
  triggerLabel?: string;
};

const TOTAL_SPOTS = 250;
const INITIAL_FILLED = 183;
const UPDATED_FILLED = 184;

export function FreeTrialModal({ triggerLabel = '무료로 시작하기' }: FreeTrialModalProps) {
  const [open, setOpen] = useState(false);
  const [filledSpots, setFilledSpots] = useState(INITIAL_FILLED);

  const closeModal = () => {
    setOpen(false);
    setFilledSpots(INITIAL_FILLED);
  };

  const openModal = () => {
    setFilledSpots(INITIAL_FILLED);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      setFilledSpots(UPDATED_FILLED);
    }, 3000);

    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const progressValue = useMemo(() => (filledSpots / TOTAL_SPOTS) * 100, [filledSpots]);

  return (
    <>
      <button
        type="button"
        data-testid="free-trial-open-trigger"
        onClick={openModal}
        className="group relative inline-flex w-48 overflow-hidden rounded-md p-[3px] text-white transition duration-200"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg,transparent_0%,transparent_50%,#3b82f6_100%)] opacity-30 blur-sm"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-2 left-1/2 h-5 w-36 -translate-x-1/2 rounded-full bg-blue-500/20 opacity-70 blur-sm"
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-[3px] rounded-[5px] bg-zinc-950" />
        <span className="relative z-10 inline-flex w-full items-center justify-center py-3.5 font-semibold tracking-wide text-white">
          {triggerLabel}
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            data-testid="free-trial-modal-backdrop"
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            onClick={closeModal}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="free-trial-modal-title"
              data-testid="free-trial-modal"
              className="relative mx-auto w-full max-w-md overflow-y-auto touch-pan-y rounded-2xl border border-white/10 bg-zinc-950 p-6 text-zinc-100 shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md sm:p-8"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.985 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-16 -top-20 h-44 rounded-full bg-blue-500/16 blur-[92px]"
              />

              <button
                type="button"
                data-testid="free-trial-close"
                aria-label="Close modal"
                onClick={closeModal}
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 transition duration-200 hover:bg-white/5 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span>{`Founding Member ${filledSpots}/${TOTAL_SPOTS} Spots Filled`}</span>
              </div>

              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10" data-testid="free-trial-progress-track">
                <motion.div
                  data-testid="free-trial-progress"
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                  initial={false}
                  animate={{ width: `${progressValue}%` }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                />
              </div>

              <h2 id="free-trial-modal-title" className="break-keep text-balance text-2xl font-semibold leading-snug text-gray-100 sm:text-3xl">
                당신의 업무 방식이 바뀌는 데 필요한 시간,
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">단 7일!</span>
              </h2>

              <p className="mt-4 text-sm leading-relaxed text-gray-400">
                Voxera는 즉시 실행되는 프리미엄 업무 자동화 에이전트입니다. 반복 업무와 컨텍스트 전환을 줄이고, 팀의 실행 속도를 상위 1% 수준으로 끌어올립니다.
              </p>

              <div className="mt-7 grid gap-3">
                <button
                  type="button"
                  data-testid="free-trial-google-cta"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-5 text-sm font-semibold text-zinc-100 shadow-[0_2px_12px_rgba(0,0,0,0.35)] transition duration-200 hover:border-blue-500/60 hover:bg-zinc-700 hover:shadow-[0_0_28px_rgba(59,130,246,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
                    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-1.9 3.1l3.1 2.4c1.8-1.7 2.8-4.1 2.8-6.9 0-.7-.1-1.4-.2-2H12z" />
                    <path fill="#34A853" d="M12 22c2.6 0 4.7-.8 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.4 0-4.4-1.6-5.1-3.7H3.7v2.3C5.3 19.9 8.4 22 12 22z" />
                    <path fill="#FBBC05" d="M6.9 14.5c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V8.4H3.7C3.2 9.5 3 10.7 3 12s.2 2.5.7 3.6l3.2-2.5z" />
                    <path fill="#4285F4" d="M12 6.8c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.7 3.8 14.6 3 12 3 8.4 3 5.3 5.1 3.7 8.4l3.2 2.5c.7-2.1 2.7-3.7 5.1-3.7z" />
                  </svg>
                  시작하기
                </button>

                <button
                  type="button"
                  data-testid="free-trial-secondary-cta"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-5 text-sm font-semibold text-zinc-100 shadow-[0_2px_12px_rgba(0,0,0,0.35)] transition duration-200 hover:border-blue-500/60 hover:bg-zinc-700 hover:shadow-[0_0_28px_rgba(59,130,246,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-zinc-400 text-[10px] font-bold leading-none text-zinc-200">
                    N
                  </span>
                  시작하기
                </button>
              </div>

              <p className="mt-6 text-center text-xs leading-relaxed text-gray-500">7일 무료 체험 후 결제 · 불만족 시 1초 만에 취소 가능 ·<br /><span className="text-white">단 1원도 청구되지 않습니다.</span></p>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}


