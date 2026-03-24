'use client';

import { Mic } from 'lucide-react';

export type WarmLandingGeneratedProps = {
  onOpenFreeTrial?: () => void;
};

export default function WarmLandingGenerated({ onOpenFreeTrial }: WarmLandingGeneratedProps) {
  return (
    <main className="min-h-screen w-full bg-[#0A0A0A] flex flex-col items-center justify-center">
      <section className="max-w-md mx-auto w-full px-6 flex flex-col items-center justify-center">
        <div className="flex w-full flex-col items-center justify-center text-center">
          <h1 className="text-4xl font-bold text-white text-center text-balance break-keep tracking-tight">
            말하면, 업무가 완성된다
          </h1>

          <button
            type="button"
            onClick={onOpenFreeTrial}
            aria-label="🎤 지금 말해보기"
            className="mt-10 flex h-[120px] w-[120px] items-center justify-center rounded-full bg-zinc-900 text-white transition duration-300 hover:shadow-[0_0_80px_rgba(255,255,255,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Mic className="h-12 w-12" strokeWidth={2.25} />
          </button>

          <button
            type="button"
            onClick={onOpenFreeTrial}
            className="mt-12 rounded-full bg-white px-8 py-4 text-base font-semibold text-zinc-950 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            [🎤 지금 말해보기]
          </button>

          <p className="mt-8 text-sm font-medium text-zinc-400">1,247명이 오늘 이미 체험함</p>
        </div>
      </section>
    </main>
  );
}
