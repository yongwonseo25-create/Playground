'use client';

import { motion } from 'framer-motion';

const brands = ['KAKAO', 'NOTION', 'GOOGLE', 'NAVER MEMO'];

export function TrustRailSection() {
  const rail = [...brands, ...brands, ...brands];

  return (
    <section className="px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-full border border-white/28 bg-[rgba(8,13,22,0.9)] px-4 py-3 shadow-[0_16px_50px_rgba(2,6,23,0.3)]">
          <motion.div
            animate={{ x: ['0%', '-33.333%'] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
            className="flex min-w-max items-center gap-10 whitespace-nowrap sm:gap-12"
          >
            {rail.map((brand, index) => (
              <span
                key={`${brand}-${index}`}
                className="text-[10px] font-semibold tracking-[0.28em] text-slate-100/90 sm:text-xs"
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
