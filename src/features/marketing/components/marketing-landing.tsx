'use client';

import { BentoGridSection } from '@/components/sections/BentoGridSection';
import { HeroSection } from '@/components/sections/HeroSection';
import { TrustRailSection } from '@/components/sections/TrustRailSection';
import { FreeTrialModal } from '@/features/marketing/components/free-trial-modal';
import { useState } from 'react';

export function MarketingLanding() {
  const [isFreeTrialOpen, setIsFreeTrialOpen] = useState(false);

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[#06090F] text-white">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(143,160,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(143,160,184,0.12)_1px,transparent_1px)] bg-[size:80px_80px] opacity-[0.12]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#06090F_0%,#0B111B_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_32%_18%,rgba(86,204,242,0.14),transparent_34%),radial-gradient(circle_at_72%_14%,rgba(187,107,217,0.16),transparent_32%)]" />

        <div className="relative z-10">
          <HeroSection
            onPrimaryClick={() => setIsFreeTrialOpen(true)}
            onSecondaryClick={() => setIsFreeTrialOpen(true)}
          />
          <TrustRailSection />
          <BentoGridSection />
        </div>
      </main>
      <FreeTrialModal open={isFreeTrialOpen} onOpenChange={setIsFreeTrialOpen} />
    </>
  );
}
