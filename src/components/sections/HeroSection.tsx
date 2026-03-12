'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const leftWaveform = [
  { height: 'h-16', tone: 'from-[#79f7e2] via-[#63e6ff] to-[#ff82dc]', duration: 1.6, delay: 0 },
  { height: 'h-24', tone: 'from-[#ff82dc] via-[#c58fff] to-[#7c8cff]', duration: 1.85, delay: 0.1 },
  { height: 'h-20', tone: 'from-[#ffe07a] via-[#ffb86b] to-[#f97316]', duration: 2.15, delay: 0.2 },
  { height: 'h-28', tone: 'from-[#77d6ff] via-[#56ccf2] to-[#5b21b6]', duration: 1.95, delay: 0.05 },
  { height: 'h-[88px]', tone: 'from-[#c59bff] via-[#ff73d6] to-[#7af7e3]', duration: 2.35, delay: 0.18 }
];

const rightWaveform = [
  { height: 'h-[88px]', tone: 'from-[#c59bff] via-[#ff73d6] to-[#7af7e3]', duration: 1.75, delay: 0.06 },
  { height: 'h-28', tone: 'from-[#77d6ff] via-[#56ccf2] to-[#5b21b6]', duration: 2.25, delay: 0.16 },
  { height: 'h-20', tone: 'from-[#ffe07a] via-[#ffb86b] to-[#f97316]', duration: 2.05, delay: 0.02 },
  { height: 'h-24', tone: 'from-[#ff82dc] via-[#c58fff] to-[#7c8cff]', duration: 1.9, delay: 0.14 },
  { height: 'h-16', tone: 'from-[#79f7e2] via-[#63e6ff] to-[#ff82dc]', duration: 2.45, delay: 0.22 }
];

type HeroSectionProps = {
  onPrimaryClick: () => void;
  onSecondaryClick: () => void;
};

function WaveformCluster({
  bars,
  align
}: {
  bars: { height: string; tone: string; duration: number; delay: number }[];
  align: 'left' | 'right';
}) {
  return (
    <div
      className={`hidden items-center gap-3 lg:flex ${
        align === 'left' ? 'justify-end pr-4' : 'justify-start pl-4'
      }`}
      aria-hidden="true"
    >
      {bars.map((bar, index) => (
        <span
          key={`${align}-${index}`}
          className={`voxera-eq-bar w-3 rounded-full bg-gradient-to-b ${bar.tone} ${bar.height} shadow-[0_0_22px_rgba(125,211,252,0.35)]`}
          style={{ animationDuration: `${bar.duration}s`, animationDelay: `${bar.delay + index * 0.03}s` }}
        />
      ))}
    </div>
  );
}

export function HeroSection({ onPrimaryClick, onSecondaryClick }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden px-5 pb-8 pt-20 sm:px-8 lg:px-12 lg:pt-24">
      <div className="absolute inset-x-0 top-8 h-72 bg-[radial-gradient(circle_at_center,rgba(86,204,242,0.18),transparent_62%)] blur-3xl" />
      <div className="absolute right-12 top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(187,107,217,0.18),transparent_65%)] blur-3xl" />

      <div className="mx-auto flex max-w-6xl flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-4xl text-center"
        >
          <h1 className="break-keep text-center text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-[4.25rem]">
            <span className="block">1초. 4개 앱. 0번의 클릭.</span>
            <span className="mt-3 block">말하면 정리되고, 즉시 꽂힌다.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl break-keep text-center text-base leading-7 text-slate-300 sm:text-lg">
            카카오톡, 노션, 구글, 네이버 메모까지 이어지는 음성 실행 플랫폼을,
            <br />
            한 번에. 실계정 B2B 보이스 오퍼레이션 엔진.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              onClick={onPrimaryClick}
              className="voxera-glow-button h-auto min-w-[220px] rounded-2xl border border-violet-300/30 bg-[linear-gradient(135deg,#33145e_0%,#5b21b6_48%,#22d3ee_100%)] px-8 py-4 text-base font-semibold text-white shadow-[0_20px_60px_rgba(91,33,182,0.35)] hover:opacity-95"
            >
              <span className="relative z-10">무료로 시작하기</span>
            </Button>
            <Button
              size="lg"
              onClick={onSecondaryClick}
              className="h-auto min-w-[220px] rounded-2xl border border-white/12 bg-[linear-gradient(135deg,rgba(16,24,39,0.94),rgba(20,34,56,0.92))] px-8 py-4 text-base font-semibold text-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.35)] hover:border-cyan-300/30 hover:bg-[linear-gradient(135deg,rgba(20,32,52,0.96),rgba(32,57,94,0.92))]"
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
          <div className="grid w-full grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <WaveformCluster bars={leftWaveform} align="left" />

            <div className="relative mx-auto">
              <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),transparent_70%)] blur-3xl" />
              <div className="absolute inset-3 rounded-[44px] bg-[radial-gradient(circle_at_50%_35%,rgba(122,247,227,0.16),transparent_55%),radial-gradient(circle_at_82%_40%,rgba(197,155,255,0.18),transparent_52%)] blur-2xl" />
              <motion.div
                animate={{ scale: [0.985, 1.015, 0.99], opacity: [0.92, 1, 0.94] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                className="relative overflow-hidden rounded-[46px] border border-white/10 bg-white/5 p-3 shadow-[0_0_90px_rgba(255,255,255,0.12)] backdrop-blur-2xl"
              >
                <Image
                  src="/images/mike-image.jpg"
                  alt="Voxera microphone core"
                  width={400}
                  height={400}
                  priority
                  className="h-[280px] w-[280px] origin-top-left scale-[1.15] rounded-[34px] object-cover sm:h-[340px] sm:w-[340px] lg:h-[400px] lg:w-[400px]"
                />
              </motion.div>
            </div>

            <WaveformCluster bars={rightWaveform} align="right" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
