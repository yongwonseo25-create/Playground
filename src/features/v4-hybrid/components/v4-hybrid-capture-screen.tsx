'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  FileText,
  LoaderCircle,
  Mail,
  MessageCircleMore,
  NotebookPen
} from 'lucide-react';
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
    description: 'Queue the spoken idea straight into the execution lane.',
    mode: 'zhi',
    modeLabel: 'ZHI',
    backendKey: 'jira',
    tone: 'notion',
    placeholder: '예: 오늘 회의 내용을 Notion 액션아이템으로 정리해줘.',
    helper: 'Select a destination, add a temporary draft, and queue it instantly.',
    Icon: NotebookPen
  },
  {
    id: 'kakao',
    label: 'KakaoTalk',
    description: 'Stage a structured card first, then approve execution.',
    mode: 'hitl',
    modeLabel: 'HITL',
    backendKey: 'crm',
    tone: 'kakao',
    placeholder: '예: 카카오톡으로 고객 후속 안내 문구를 준비해줘.',
    helper: 'Typing here opens a structured approval card before anything is sent.',
    Icon: MessageCircleMore
  },
  {
    id: 'gmail',
    label: 'Gmail',
    description: 'Review the outbound payload before execution credit is spent.',
    mode: 'hitl',
    modeLabel: 'HITL',
    backendKey: 'crm',
    tone: 'gmail',
    placeholder: '예: 오늘 미팅 요약을 후속 이메일 초안으로 만들어줘.',
    helper: 'The approval button is the only point that triggers credit deduction.',
    Icon: Mail
  },
  {
    id: 'gdocs',
    label: 'Google Docs',
    description: 'Push a refined draft into the queue-first automation track.',
    mode: 'zhi',
    modeLabel: 'ZHI',
    backendKey: 'slack',
    tone: 'gdocs',
    placeholder: '예: 인터뷰 메모를 문서 초안으로 정리해서 보내줘.',
    helper: 'ZHI responds immediately with a queued worker status.',
    Icon: FileText
  }
];

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
  const [selectedDestinationId, setSelectedDestinationId] = useState<HybridDestinationId>('notion');
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastZhiResult, setLastZhiResult] = useState<ZhiDispatchResponse | null>(null);
  const [lastApprovalResult, setLastApprovalResult] = useState<HitlApprovalResponse | null>(null);

  const deferredDraftText = useDeferredValue(draftText.trim());
  const selectedDestination = useMemo(() => {
    return (
      HYBRID_DESTINATIONS.find((destination) => destination.id === selectedDestinationId) ??
      HYBRID_DESTINATIONS[0]
    );
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
        setErrorMessage(error instanceof Error ? error.message : 'Failed to refresh the HITL queue.');
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
    if (selectedDestination.mode !== 'hitl') {
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
  }, [deferredDraftText, selectedDestination.mode, sheetDismissed]);

  const handleDestinationSelect = (destinationId: HybridDestinationId) => {
    startTransition(() => {
      setSelectedDestinationId(destinationId);
    });
    setDraftText('');
    setErrorMessage(null);
    setStatusMessage(null);
    setLastZhiResult(null);
    setLastApprovalResult(null);
    setActiveApproval(null);
    setFieldValues({});
    setIsPreparingCard(false);
    setSheetOpen(false);
    setSheetDismissed(false);
  };

  const handleDraftReset = () => {
    setDraftText('');
    setErrorMessage(null);
    setStatusMessage(null);
    setLastZhiResult(null);
    setLastApprovalResult(null);
    setActiveApproval(null);
    setFieldValues({});
    setIsPreparingCard(false);
    setSheetOpen(false);
    setSheetDismissed(false);
  };

  const handlePrepareHitlCard = async () => {
    if (!deferredDraftText) {
      setErrorMessage('Enter a draft before preparing the structured card.');
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
    setStatusMessage('Preparing a structured data card...');
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
      setStatusMessage(`Structured card ready for ${selectedDestination.label}.`);
      await refreshHitlQueue(response.approval.approvalId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create the approval card.');
    } finally {
      setIsPreparingCard(false);
    }
  };

  const handleZhiDispatch = async () => {
    if (!draftText.trim()) {
      setErrorMessage('Enter a draft before queueing ZHI.');
      return;
    }

    setIsDispatching(true);
    setErrorMessage(null);
    setStatusMessage('Queueing the request for resilient execution...');
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
      setStatusMessage(`Queued for ${selectedDestination.label}.`);
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
    setStatusMessage('Approving and handing execution to the worker...');
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
      setStatusMessage('Approved. Execution is now queued asynchronously.');
      await refreshHitlQueue();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Approval failed.');
    } finally {
      setIsApproving(false);
    }
  };

  const hitlInputLocked = selectedDestination.mode === 'hitl' && (isPreparingCard || Boolean(activeApproval));
  const primaryActionLabel = selectedDestination.mode === 'zhi' ? 'Queue Action' : 'Structured Card Auto-Open';

  return (
    <>
      <main className="relative min-h-dvh overflow-hidden bg-bg-page text-text-primary">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_26%),radial-gradient(circle_at_88%_14%,rgba(76,132,255,0.12),transparent_22%),radial-gradient(circle_at_52%_100%,rgba(250,224,66,0.1),transparent_20%)]" />

        <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 pb-10 pt-8 sm:px-8 lg:px-10">
          <motion.header
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
          >
            <div className="rounded-[30px] border border-stroke bg-bg-surface/90 p-6 shadow-md backdrop-blur">
              <div
                data-testid="voxera-brand"
                className="inline-flex rounded-full border border-stroke bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-text-secondary"
              >
                VOXERA
              </div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-text-secondary">Speak once. Execute everywhere.</p>
              <h1 className="font-display mt-4 max-w-xl text-4xl tracking-[-0.05em] text-text-primary sm:text-5xl">
                Destination-first routing for ZHI and HITL.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">
                This hybrid surface isolates the new front-end shell inside its own worktree, keeps the V4 resilience
                backend intact, and lets operators move between immediate queueing and approval-first execution.
              </p>
            </div>

            <div className="rounded-[30px] border border-stroke bg-bg-overlay/80 p-6 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.28em] text-text-secondary">Current lane</p>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"
                  style={{ color: voxeraTokens.color.chips[selectedDestination.tone].accent }}
                >
                  <selectedDestination.Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-2xl text-text-primary">{selectedDestination.label}</p>
                  <p className="text-sm text-text-secondary">{selectedDestination.modeLabel} lane selected</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-text-secondary">{selectedDestination.helper}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-[20px] border border-stroke bg-white/[0.02] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Queue</p>
                  <p className="mt-2 text-text-primary">{hitlQueue.length}</p>
                </div>
                <div className="rounded-[20px] border border-stroke bg-white/[0.02] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Action</p>
                  <p className="mt-2 text-text-primary">{primaryActionLabel}</p>
                </div>
              </div>
            </div>
          </motion.header>

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {HYBRID_DESTINATIONS.map((destination, index) => (
              <motion.div
                key={destination.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * voxeraTokens.motion.stagger, duration: 0.32 }}
              >
                <ActionChip
                  label={destination.label}
                  description={destination.description}
                  modeLabel={destination.modeLabel}
                  tone={destination.tone}
                  Icon={destination.Icon}
                  selected={selectedDestination.id === destination.id}
                  onClick={() => handleDestinationSelect(destination.id)}
                  testId={`action-chip-${destination.id}`}
                />
              </motion.div>
            ))}
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
              className="rounded-[30px] border border-stroke bg-bg-surface/90 p-6 shadow-md"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-text-secondary">Temporary input</p>
                  <h2 className="font-display mt-2 text-2xl text-text-primary">{selectedDestination.label}</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDraftReset}
                  className="rounded-2xl border-stroke bg-transparent text-text-primary hover:bg-white/[0.04]"
                >
                  Reset
                </Button>
              </div>

              <label className="mt-5 block">
                <span className="text-sm text-text-secondary">Draft request</span>
                <textarea
                  data-testid="hybrid-text-input"
                  rows={8}
                  value={draftText}
                  readOnly={hitlInputLocked}
                  placeholder={selectedDestination.placeholder}
                  onChange={(event) => {
                    setDraftText(event.target.value);
                    setErrorMessage(null);
                    setStatusMessage(null);
                    setLastZhiResult(null);
                    setLastApprovalResult(null);
                    if (!event.target.value.trim()) {
                      setSheetDismissed(false);
                    }
                  }}
                  className="mt-3 w-full resize-none rounded-[24px] border border-stroke bg-bg-input px-5 py-4 text-sm leading-7 text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-stroke-active"
                />
              </label>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {selectedDestination.mode === 'zhi' ? (
                  <Button
                    type="button"
                    onClick={handleZhiDispatch}
                    disabled={isDispatching}
                    data-testid="zhi-queue-button"
                    className="h-12 rounded-2xl bg-white px-5 text-black hover:bg-white/90"
                  >
                    {isDispatching ? 'Queueing...' : 'Queue Action'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      void handlePrepareHitlCard();
                    }}
                    disabled={!draftText.trim()}
                    data-testid="open-hitl-card-button"
                    className="h-12 rounded-2xl bg-white px-5 text-black hover:bg-white/90"
                  >
                    {isPreparingCard ? 'Preparing card...' : 'Open Structured Card'}
                  </Button>
                )}

                {activeApproval && !sheetOpen ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSheetDismissed(false);
                      setSheetOpen(true);
                    }}
                    className="h-12 rounded-2xl border-stroke bg-transparent text-text-primary hover:bg-white/[0.04]"
                  >
                    Review Pending Card
                  </Button>
                ) : null}
              </div>

              {hitlInputLocked ? (
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  The draft is locked while the approval card is active. Reset to generate a new card.
                </p>
              ) : null}

              {errorMessage ? (
                <div className="mt-5 rounded-[22px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {errorMessage}
                </div>
              ) : null}

              {statusMessage ? (
                <div className="mt-5 rounded-[22px] border border-stroke bg-white/[0.03] px-4 py-3 text-sm text-text-secondary">
                  {statusMessage}
                </div>
              ) : null}

              {lastZhiResult ? (
                <div
                  data-testid="zhi-queued-status"
                  className="mt-5 rounded-[24px] border border-sky-400/30 bg-sky-400/[0.08] p-5"
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-sky-100/70">Queued</p>
                  <p className="mt-2 font-display text-2xl text-text-primary">
                    Queued for {selectedDestination.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    The API returned immediately. The resilient worker owns delivery and post-success credit charging.
                  </p>
                  <p className="mt-4 font-mono text-xs text-sky-50/80">Job ID {lastZhiResult.jobId}</p>
                </div>
              ) : null}

              {lastApprovalResult ? (
                <div
                  data-testid="hitl-approved-status"
                  className="mt-5 rounded-[24px] border border-emerald-400/30 bg-emerald-400/[0.08] p-5"
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-100/70">Approved</p>
                  <p className="mt-2 font-display text-2xl text-text-primary">Approve &amp; Execute queued</p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">
                    The approval route accepted the request and queued the worker job asynchronously.
                  </p>
                  <p className="mt-4 font-mono text-xs text-emerald-50/80">
                    Job ID {lastApprovalResult.jobId ?? 'pending'}
                  </p>
                </div>
              ) : null}
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.4 }}
              className="rounded-[30px] border border-stroke bg-bg-overlay/80 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-text-secondary">Structured queue</p>
                  <h2 className="font-display mt-2 text-2xl text-text-primary">HITL pending cards</h2>
                </div>
                {isQueueRefreshing ? <LoaderCircle className="h-5 w-5 animate-spin text-text-secondary" /> : null}
              </div>

              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Queue data is pulled from `GET /api/v4/hitl/queue` and reused by the bottom sheet form.
              </p>

              <div className="mt-5 space-y-3">
                {hitlQueue.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-stroke-hover bg-white/[0.02] px-4 py-8 text-center text-sm text-text-secondary">
                    No pending cards yet. Choose KakaoTalk or Gmail and start typing.
                  </div>
                ) : (
                  hitlQueue.map((approval) => (
                    <button
                      key={approval.approvalId}
                      type="button"
                      data-testid="hitl-queue-item"
                      onClick={() => {
                        setSelectedDestinationId('gmail');
                        setActiveApproval(approval);
                        setFieldValues(buildFieldValueMap(approval.fields));
                        setDraftText(approval.transcriptText);
                        setSheetDismissed(false);
                        setSheetOpen(true);
                      }}
                      className="w-full rounded-[22px] border border-stroke bg-white/[0.02] p-4 text-left transition hover:border-stroke-hover hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-text-primary">{approval.destination.label}</p>
                        <span className="rounded-full border border-stroke px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-text-secondary">
                          {approval.status}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-text-secondary">
                        {approval.transcriptText}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div className="mt-6 rounded-[22px] border border-stroke bg-white/[0.02] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-text-secondary">Payload preview</p>
                <div className="mt-3 flex items-start gap-3">
                  <ArrowUpRight className="mt-1 h-4 w-4 text-text-tertiary" />
                  <p className="text-sm leading-6 text-text-secondary">
                    {deferredDraftText || 'Destination chips route the temporary text through the selected V4 lane.'}
                  </p>
                </div>
              </div>
            </motion.aside>
          </section>
        </div>
      </main>

      <RecordingCard
        open={selectedDestination.mode === 'hitl' && sheetOpen}
        title={selectedDestination.label}
        subtitle="Review the queue-backed structured data card before execution."
        tone={selectedDestination.tone}
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
