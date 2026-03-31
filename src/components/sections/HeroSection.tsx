'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { VoiceHologramMic } from '@/components/sections/VoiceHologramMic';

type HeroSectionProps = {
  onPrimaryClick: () => void;
  onSecondaryClick: () => void;
};

export function HeroSection({ onPrimaryClick, onSecondaryClick }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden px-5 pb-8 pt-20 sm:px-8 lg:px-12 lg:pt-24">
      <div className="absolute inset-x-0 top-8 h-72 bg-[radial-gradient(circle_at_center,rgba(86,204,242,0.2),transparent_62%)] blur-3xl" />
      <div className="absolute right-12 top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(187,107,217,0.2),transparent_65%)] blur-3xl" />

      <div className="mx-auto flex max-w-6xl flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-4xl text-center"
        >
          <h1 className="break-keep text-center text-[2.2rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-[4.2rem]">
            <span className="block">1초. 4개 앱. 0번의 클릭.</span>
            <span className="mt-3 block">말하면 정리되고, 즉시 꽂힌다.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl break-keep text-center text-base leading-relaxed text-slate-300 sm:text-lg">
            카카오톡, 노션, 구글, 네이버 메모까지 이어지는 음성 실행 플랫폼을,
            <br />
            한 번에. 실계정 B2B 보이스 오퍼레이션 엔진.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              onClick={onPrimaryClick}
              className="voxera-glow-button h-auto min-w-[220px] rounded-2xl border border-violet-300/30 bg-[linear-gradient(135deg,#4c1d95_0%,#5b21b6_46%,#38bdf8_100%)] px-8 py-4 text-base font-semibold text-white shadow-[0_20px_60px_rgba(91,33,182,0.35)] hover:opacity-95"
            >
              <span className="relative z-10">무료로 시작하기</span>
            </Button>
            <Button
              size="lg"
              onClick={onSecondaryClick}
              className="h-auto min-w-[220px] rounded-2xl border border-white/45 bg-transparent px-8 py-4 text-base font-semibold text-slate-100 shadow-none hover:bg-white/5"
            >
              30초 데모 보기
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="mt-16 flex w-full max-w-5xl items-center justify-center lg:mt-24"
        >
          <div className="relative overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(5,10,18,0.95),rgba(7,11,19,0.98))] px-5 py-6 shadow-[0_30px_90px_rgba(2,6,23,0.45)] sm:px-8 sm:py-8">
            <VoiceHologramMic />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
