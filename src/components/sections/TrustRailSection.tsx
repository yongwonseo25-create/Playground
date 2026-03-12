'use client';

import { motion } from 'framer-motion';

const brands = ['NOTION', 'GOOGLE', 'NAVER MEMO', 'KAKAO'];

export function TrustRailSection() {
  return (
    <section className="px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,22,36,0.92),rgba(11,17,27,0.96))] px-6 py-5 shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
          <motion.div
            animate={{ x: ['0%', '-33.333%'] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className="flex min-w-max items-center gap-10 whitespace-nowrap"
          >
            {[...brands, ...brands, ...brands].map((brand, index) => (
              <span
                key={`${brand}-${index}`}
                className="text-sm font-semibold tracking-[0.34em] text-slate-200/88 sm:text-base"
              >
                {brand}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
