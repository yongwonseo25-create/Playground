'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Mail, MessageCircleMore, NotebookPen, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionChip } from '@/components/voxera/action-chip';
import { RecordingCard } from '@/components/voxera/recording-card';
import { voxeraTokens, type VoxeraChipTone } from '@/shared/design/design-tokens';
import type { V4DestinationKey, V4StructuredField } from '@/shared/contracts/v4/common';
import type { HitlApprovalCard, HitlApprovalResponse } from '@/shared/contracts/v4/hitl';
import type { ZhiDispatchResponse } from '@/shared/contracts/v4/zhi';
import {
  approveHybridHitlCard,
  createHybridHitlCard,
  fetchHybridHitlQueue,
  queueHybridZhiDispatch
} from '@/features/v4-hybrid/services/v4-hybrid-client';

type HybridDestinationId = 'notion' | 'kakao' | 'gmail' | 'gdocs';

type HybridDestination = {
  id: HybridDestinationId;
  label: string;
  description: string;
  mode: 'zhi' | 'hitl';
  modeLabel: string;
  backendKey: V4DestinationKey;
  tone: VoxeraChipTone;
  placeholder: string;
  helper: string;
  Icon: typeof NotebookPen;
};

const HYBRID_DESTINATIONS: HybridDestination[] = [
  {
    id: 'notion',
    label: 'Notion',
    description: 'Queue a polished note immediately.',
    mode: 'zhi',
    modeLabel: 'ZHI',
    backendKey: 'notion',
    tone: 'notion',
    placeholder: 'Notion에 바로 실행할 메모를 입력하세요.',
    helper: 'Typed notes go straight into the execution lane.',
    Icon: NotebookPen
  },
  {
    id: 'gdocs',
    label: 'Google Docs',
    description: 'Queue a clean draft instantly.',
    mode: 'zhi',
    modeLabel: 'ZHI',
    backendKey: 'google_docs',
    tone: 'gdocs',
    placeholder: 'Google Docs에 보낼 초안을 입력하세요.',
    helper: 'Typed notes queue immediately.',
    Icon: FileText
  },
  {
    id: 'gmail',
    label: 'Gmail',
    description: 'Open a polished approval card.',
    mode: 'hitl',
    modeLabel: 'HITL',
    backendKey: 'gmail',
    tone: 'gmail',
    placeholder: '승인 후 발송할 Gmail 메모를 입력하세요.',
    helper: 'A structured card appears before execution.',
    Icon: Mail
  },
  {
    id: 'kakao',
    label: 'KakaoTalk',
    description: 'Review the message before execution.',
    mode: 'hitl',
    modeLabel: 'HITL',
    backendKey: 'kakaotalk',
    tone: 'kakao',
    placeholder: '승인 대기용 KakaoTalk 메모를 입력하세요.',
    helper: 'A structured card appears before execution.',
    Icon: MessageCircleMore
  }
];

const HYBRID_DESTINATION_BY_KEY: Record<V4DestinationKey, HybridDestinationId> = {
  notion: 'notion',
  google_docs: 'gdocs',
  gmail: 'gmail',
  kakaotalk: 'kakao'
};

function buildFieldValueMap(fields: V4StructuredField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, field.value]));
}

function mapApprovalFields(
  approval: HitlApprovalCard | null,
  fieldValues: Record<string, string>
): V4StructuredField[] {
  if (!approval) {
    return [];
  }

  return approval.fields.map((field) => ({
    ...field,
    value: fieldValues[field.key] ?? field.value
  }));
}

export function V4HybridCaptureScreen() {
  const [selectedDestinationId, setSelectedDestinationId] = useState<HybridDestinationId | null>(null);
  const [draftText, setDraftText] = useState('');
  const [hitlQueue, setHitlQueue] = useState<HitlApprovalCard[]>([]);
  const [activeApproval, setActiveApproval] = useState<HitlApprovalCard | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDismissed, setSheetDismissed] = useState(false);
  const [isQueueRefreshing, setIsQueueRefreshing] = useState(false);
  const [isPreparingCard, setIsPreparingCard] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastZhiResult, setLastZhiResult] = useState<ZhiDispatchResponse | null>(null);
  const [lastApprovalResult, setLastApprovalResult] = useState<HitlApprovalResponse | null>(null);

  const deferredDraftText = useDeferredValue(draftText.trim());
  const selectedDestination = useMemo(() => {
    if (!selectedDestinationId) {
      return null;
    }

    return HYBRID_DESTINATIONS.find((destination) => destination.id === selectedDestinationId) ?? null;
  }, [selectedDestinationId]);

  const refreshHitlQueue = useCallback(
    async (preferredApprovalId?: string | null) => {
      setIsQueueRefreshing(true);

      try {
        const response = await fetchHybridHitlQueue();
        const approvalId = preferredApprovalId ?? activeApproval?.approvalId ?? null;
        const nextApproval = approvalId
          ? response.pending.find((item) => item.approvalId === approvalId) ?? null
          : null;

        startTransition(() => {
          setHitlQueue(response.pending);
        });
        setActiveApproval(nextApproval);
        setFieldValues(nextApproval ? buildFieldValueMap(nextApproval.fields) : {});
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to refresh the queue.');
      } finally {
        setIsQueueRefreshing(false);
      }
    },
    [activeApproval?.approvalId]
  );

  useEffect(() => {
    void refreshHitlQueue();
  }, [refreshHitlQueue]);

  useEffect(() => {
    if (!selectedDestination || selectedDestination.mode !== 'hitl') {
      setIsPreparingCard(false);
      setSheetOpen(false);
      setSheetDismissed(false);
      return;
    }

    if (!deferredDraftText) {
      setIsPreparingCard(false);
      setSheetOpen(false);
      setSheetDismissed(false);
      setActiveApproval(null);
      setFieldValues({});
      return;
    }

    if (sheetDismissed) {
      return;
    }

    setSheetOpen(true);
  }, [deferredDraftText, selectedDestination, sheetDismissed]);

  const clearTransientState = () => {
    setErrorMessage(null);
    setLastZhiResult(null);
    setLastApprovalResult(null);
  };

  const handleDestinationSelect = (destinationId: HybridDestinationId) => {
    startTransition(() => {
      setSelectedDestinationId(destinationId);
    });
    setDraftText('');
    setActiveApproval(null);
    setFieldValues({});
    setIsPreparingCard(false);
    setSheetOpen(false);
    setSheetDismissed(false);
    clearTransientState();
  };

  const handleComposerClose = () => {
    setSelectedDestinationId(null);
    setDraftText('');
    setActiveApproval(null);
    setFieldValues({});
    setIsPreparingCard(false);
    setSheetOpen(false);
    setSheetDismissed(false);
    clearTransientState();
  };

  const handleDraftReset = () => {
    setDraftText('');
    setActiveApproval(null);
    setFieldValues({});
    setIsPreparingCard(false);
    setSheetOpen(false);
    setSheetDismissed(false);
    clearTransientState();
  };

  const handlePrepareHitlCard = async () => {
    if (!selectedDestination || selectedDestination.mode !== 'hitl') {
      return;
    }

    if (!deferredDraftText) {
      setErrorMessage('메모를 먼저 입력하세요.');
      return;
    }

    if (activeApproval || isPreparingCard) {
      setSheetDismissed(false);
      setSheetOpen(true);
      return;
    }

    setSheetDismissed(false);
    setSheetOpen(true);
    setIsPreparingCard(true);
    setErrorMessage(null);
    setLastApprovalResult(null);

    try {
      const response = await createHybridHitlCard({
        clientRequestId: crypto.randomUUID(),
        transcriptText: deferredDraftText,
        destinationKey: selectedDestination.backendKey
      });

      setActiveApproval(response.approval);
      setFieldValues(buildFieldValueMap(response.approval.fields));
      startTransition(() => {
        setHitlQueue((current) => {
          const remaining = current.filter((item) => item.approvalId !== response.approval.approvalId);
          return [response.approval, ...remaining];
        });
      });
      await refreshHitlQueue(response.approval.approvalId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create the review card.');
    } finally {
      setIsPreparingCard(false);
    }
  };

  const handleZhiDispatch = async () => {
    if (!selectedDestination || selectedDestination.mode !== 'zhi') {
      return;
    }

    if (!draftText.trim()) {
      setErrorMessage('메모를 먼저 입력하세요.');
      return;
    }

    setIsDispatching(true);
    setErrorMessage(null);
    setLastApprovalResult(null);

    try {
      const response = await queueHybridZhiDispatch({
        clientRequestId: crypto.randomUUID(),
        transcriptText: draftText.trim(),
        destinationKey: selectedDestination.backendKey,
        sttProvider: 'whisper',
        audioDurationSec: 0
      });

      setLastZhiResult(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to queue the destination.');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleApprove = async () => {
    if (!activeApproval) {
      return;
    }

    setIsApproving(true);
    setErrorMessage(null);
    setLastZhiResult(null);

    try {
      const response = await approveHybridHitlCard({
        approvalId: activeApproval.approvalId,
        idempotencyKey: crypto.randomUUID(),
        payload: {
          decision: 'approve',
          actor: 'voxera-hybrid-ui',
          fields: mapApprovalFields(activeApproval, fieldValues)
        }
      });

      setLastApprovalResult(response);
      setSheetOpen(false);
      setSheetDismissed(false);
      setDraftText('');
      await refreshHitlQueue();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Approval failed.');
    } finally {
      setIsApproving(false);
    }
  };

  const hitlInputLocked = selectedDestination?.mode === 'hitl' && (isPreparingCard || Boolean(activeApproval));

  return (
    <>
      <main className="relative min-h-dvh overflow-hidden bg-bg-page text-text-primary">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_15%_18%,rgba(255,255,255,0.06),transparent_18%),radial-gradient(circle_at_82%_14%,rgba(76,132,255,0.14),transparent_20%),radial-gradient(circle_at_50%_100%,rgba(250,224,66,0.08),transparent_16%)]" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)] blur-3xl" />

        <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center px-6 pb-40 pt-16 sm:px-8">
          <motion.section
            data-testid="voxera-brand"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full max-w-3xl text-center"
          >
            <h1 className="font-display text-4xl tracking-[-0.07em] text-text-primary sm:text-6xl">
              어디에 실행할까요?
            </h1>
            <p className="mt-4 text-sm tracking-[0.01em] text-text-secondary sm:text-base">
              Speak once. Execute everywhere.
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.42 }}
            className="mt-10 flex w-full max-w-4xl flex-wrap items-center justify-center gap-4"
          >
            {HYBRID_DESTINATIONS.map((destination, index) => (
              <motion.div
                key={destination.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + index * voxeraTokens.motion.stagger, duration: 0.28 }}
              >
                <ActionChip
                  label={destination.label}
                  description={destination.description}
                  modeLabel={destination.modeLabel}
                  tone={destination.tone}
                  Icon={destination.Icon}
                  selected={selectedDestination?.id === destination.id}
                  onClick={() => handleDestinationSelect(destination.id)}
                  testId={`action-chip-${destination.id}`}
                />
              </motion.div>
            ))}
          </motion.section>

          <AnimatePresence>
            {errorMessage ? (
              <motion.div
                key={errorMessage}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="mt-6 rounded-full bg-red-500/12 px-4 py-2 text-sm text-red-100 backdrop-blur-sm"
              >
                {errorMessage}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {lastZhiResult && selectedDestination ? (
              <motion.div
                key={lastZhiResult.jobId}
                data-testid="zhi-queued-status"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2 text-sm text-text-primary backdrop-blur-xl"
              >
                <Sparkles className="h-4 w-4 text-text-secondary" />
                <span>Queued for {selectedDestination.label}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {lastApprovalResult ? (
              <motion.div
                key={lastApprovalResult.approval.approvalId}
                data-testid="hitl-approved-status"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2 text-sm text-text-primary backdrop-blur-xl"
              >
                <Sparkles className="h-4 w-4 text-text-secondary" />
                <span>Approve &amp; Execute queued</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {hitlQueue.length > 0 && !sheetOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 14 }}
                className={
                  selectedDestination
                    ? 'fixed inset-x-0 bottom-[248px] z-50 flex flex-wrap items-center justify-center gap-3 px-6 sm:bottom-[228px]'
                    : 'mt-8 flex w-full max-w-3xl flex-wrap items-center justify-center gap-3'
                }
              >
                {hitlQueue.map((approval) => (
                  <button
                    key={approval.approvalId}
                    type="button"
                    data-testid="hitl-queue-item"
                    onClick={() => {
                      setSelectedDestinationId(HYBRID_DESTINATION_BY_KEY[approval.destination.key]);
                      setActiveApproval(approval);
                      setFieldValues(buildFieldValueMap(approval.fields));
                      setDraftText(approval.transcriptText);
                      setSheetDismissed(false);
                      setSheetOpen(true);
                      clearTransientState();
                    }}
                    className="rounded-full bg-white/[0.05] px-4 py-2.5 text-sm text-text-secondary backdrop-blur-lg transition hover:bg-white/[0.1] hover:text-text-primary"
                  >
                    {approval.destination.label}
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {selectedDestination ? (
            <motion.section
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={voxeraTokens.motion.spring}
              className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:px-6"
            >
              <div className="pointer-events-auto w-full max-w-4xl rounded-[34px] bg-white/[0.08] p-4 shadow-[0_-12px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08]"
                      style={{ color: voxeraTokens.color.chips[selectedDestination.tone].accent }}
                    >
                      <selectedDestination.Icon className="h-4 w-4" />
                    </span>
                    <p className="font-display text-lg tracking-[-0.03em] text-text-primary">
                      {selectedDestination.label}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleComposerClose}
                    className="rounded-full bg-white/[0.06] p-2 text-text-secondary transition hover:bg-white/[0.1] hover:text-text-primary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 rounded-[28px] bg-black/20 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <textarea
                    data-testid="hybrid-text-input"
                    rows={6}
                    value={draftText}
                    readOnly={hitlInputLocked}
                    placeholder={selectedDestination.placeholder}
                    onChange={(event) => {
                      setDraftText(event.target.value);
                      clearTransientState();
                      if (!event.target.value.trim()) {
                        setSheetDismissed(false);
                      }
                    }}
                    className="min-h-[140px] w-full resize-none bg-transparent text-base leading-8 text-text-primary outline-none placeholder:text-text-tertiary sm:text-lg"
                  />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-sm text-text-tertiary">
                    {selectedDestination.mode === 'zhi'
                      ? 'Ready to execute instantly.'
                      : activeApproval
                        ? 'Review card is ready.'
                        : 'Type to reveal the review card.'}
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDraftReset}
                      className="h-11 rounded-full border-white/10 bg-white/[0.04] px-5 text-text-primary hover:bg-white/[0.08]"
                    >
                      Clear
                    </Button>

                    {selectedDestination.mode === 'zhi' ? (
                      <Button
                        type="button"
                        onClick={handleZhiDispatch}
                        disabled={isDispatching}
                        data-testid="zhi-queue-button"
                        className="h-11 rounded-full bg-white px-5 text-black hover:bg-white/90"
                      >
                        {isDispatching ? 'Executing...' : 'Execute'}
                      </Button>
                    ) : activeApproval && !sheetOpen ? (
                      <Button
                        type="button"
                        onClick={() => {
                          setSheetDismissed(false);
                          setSheetOpen(true);
                        }}
                        data-testid="open-hitl-card-button"
                        className="h-11 rounded-full bg-white px-5 text-black hover:bg-white/90"
                      >
                        Open Card
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </main>

      <RecordingCard
        open={selectedDestination?.mode === 'hitl' && sheetOpen}
        title={selectedDestination?.label ?? 'Review'}
        subtitle="Review the polished card, then approve execution."
        tone={selectedDestination?.tone ?? 'notion'}
        transcriptText={draftText}
        approval={activeApproval}
        fieldValues={fieldValues}
        isPreparing={isPreparingCard}
        isSubmitting={isApproving}
        errorMessage={errorMessage}
        onClose={() => {
          setSheetOpen(false);
          setSheetDismissed(true);
        }}
        onGenerate={handlePrepareHitlCard}
        onApprove={handleApprove}
        onFieldChange={(key, value) => {
          setFieldValues((current) => ({
            ...current,
            [key]: value
          }));
        }}
      />
    </>
  );
}
