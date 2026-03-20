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
        'group relative overflow-hidden rounded-full border bg-white/[0.04] px-5 py-3.5 text-left backdrop-blur-xl',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-transparent bg-white/[0.1]'
          : 'border-white/10 hover:border-white/18 hover:bg-white/[0.07]'
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

      <div className="relative z-10 flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08]"
          style={{ color: chipTone.accent }}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <p className="font-display text-sm font-medium tracking-[-0.02em] text-text-primary sm:text-[15px]">
            {label}
          </p>
          <p className="sr-only">
            {description} {modeLabel}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
