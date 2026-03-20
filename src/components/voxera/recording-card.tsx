'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { LoaderCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { voxeraTokens, type VoxeraChipTone } from '@/shared/design/design-tokens';
import type { HitlApprovalCard } from '@/shared/contracts/v4/hitl';

type CardFieldValues = Record<string, string>;

interface RecordingCardProps {
  open: boolean;
  title: string;
  subtitle: string;
  tone: VoxeraChipTone;
  transcriptText: string;
  approval: HitlApprovalCard | null;
  fieldValues: CardFieldValues;
  isPreparing: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onGenerate: () => void;
  onApprove: () => void;
  onFieldChange: (key: string, value: string) => void;
}

function hasMissingRequiredFields(approval: HitlApprovalCard | null, fieldValues: CardFieldValues): boolean {
  if (!approval) {
    return true;
  }

  return approval.fields.some((field) => field.required && !(fieldValues[field.key] ?? field.value ?? '').trim());
}

export function RecordingCard({
  open,
  title,
  subtitle,
  tone,
  transcriptText,
  approval,
  fieldValues,
  isPreparing,
  isSubmitting,
  errorMessage,
  onClose,
  onGenerate,
  onApprove,
  onFieldChange
}: RecordingCardProps) {
  const chipTone = voxeraTokens.color.chips[tone];
  const canApprove = !isPreparing && !isSubmitting && !hasMissingRequiredFields(approval, fieldValues);
  const primaryLabel = approval
    ? isSubmitting
      ? 'Executing...'
      : 'Approve & Execute'
    : isPreparing
      ? 'Generating...'
      : 'Generate Structured Card';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="voxera-recording-card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/42 px-4 pb-4 pt-12 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 44, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 36, opacity: 0 }}
            transition={voxeraTokens.motion.spring}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-3xl rounded-[34px] border border-white/12 bg-white/[0.08] p-6 pb-7 shadow-[0_28px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-8"
            style={{ boxShadow: chipTone.glowShadow }}
          >
            <div className="mx-auto h-1 w-14 rounded-full bg-white/12" />

            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl tracking-[-0.04em] text-text-primary">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close approval sheet"
                className="rounded-full bg-white/[0.08] p-2 text-text-secondary transition hover:bg-white/[0.14] hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 rounded-[28px] bg-black/20 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-text-secondary">Memo</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-primary">
                {transcriptText.trim() || 'Type a request to stage the approval payload.'}
              </p>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-[22px] bg-red-500/10 px-4 py-3 text-sm text-red-100 backdrop-blur-sm">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {isPreparing || !approval ? (
                <div className="rounded-[28px] bg-white/[0.04] px-4 py-10 text-center text-sm text-text-secondary backdrop-blur-sm">
                  <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-text-primary" />
                  <p className="mt-3">Preparing your review card...</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {approval.fields.map((field) => {
                  const value = fieldValues[field.key] ?? field.value;
                  const commonClassName =
                    'mt-3 w-full rounded-[22px] bg-black/20 px-4 py-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-tertiary focus:bg-black/28';

                  return (
                    <motion.label
                      key={field.key}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="block rounded-[26px] bg-white/[0.05] p-4 backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-text-primary">{field.label}</span>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                          {field.required ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      {field.kind === 'textarea' ? (
                        <textarea
                          data-testid={`recording-card-field-${field.key}`}
                          rows={4}
                          value={value}
                          placeholder={field.placeholder}
                          onChange={(event) => onFieldChange(field.key, event.target.value)}
                          className={cn(commonClassName, 'resize-none')}
                        />
                      ) : (
                        <input
                          data-testid={`recording-card-field-${field.key}`}
                          type="text"
                          value={value}
                          placeholder={field.placeholder}
                          onChange={(event) => onFieldChange(field.key, event.target.value)}
                          className={commonClassName}
                        />
                      )}
                    </motion.label>
                  );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-12 flex-1 rounded-full border-white/10 bg-white/[0.04] text-text-primary hover:bg-white/[0.08]"
              >
                Continue Editing
              </Button>
              <Button
                type="button"
                onClick={approval ? onApprove : onGenerate}
                disabled={approval ? !canApprove : isPreparing}
                data-testid={approval ? 'approve-execute-button' : 'generate-structured-card-button'}
                className="h-12 flex-1 rounded-full bg-white text-black hover:bg-white/90"
              >
                {primaryLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
