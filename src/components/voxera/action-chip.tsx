'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { voxeraTokens, type VoxeraChipTone } from '@/shared/design/design-tokens';

interface ActionChipProps {
  label: string;
  description: string;
  modeLabel: string;
  Icon: LucideIcon;
  tone: VoxeraChipTone;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
}

export function ActionChip({
  label,
  description,
  modeLabel,
  Icon,
  tone,
  selected = false,
  onClick,
  disabled = false,
  testId
}: ActionChipProps) {
  const chipTone = voxeraTokens.color.chips[tone];

  return (
    <motion.button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -3, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={voxeraTokens.motion.spring}
      className={cn(
        'group relative overflow-hidden rounded-[22px] border bg-bg-surface px-4 py-4 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'border-transparent' : 'border-stroke hover:border-stroke-hover'
      )}
      style={{
        boxShadow: selected ? chipTone.glowShadow : undefined,
        borderColor: selected ? chipTone.borderHover : undefined
      }}
    >
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
        style={{
          background: `radial-gradient(circle at top left, ${chipTone.glowColor}, transparent 58%)`
        }}
      />

      <div className="relative z-10 flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"
          style={{ color: chipTone.accent }}
        >
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display text-base font-medium text-text-primary">{label}</p>
            <span className="rounded-full border border-stroke bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-text-secondary">
              {modeLabel}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
        </div>
      </div>
    </motion.button>
  );
}
