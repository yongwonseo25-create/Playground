import type { Prisma, PrismaClient } from '@prisma/client';
import type { SolapiAdapter } from '@/integrations/solapi/solapi-adapter';
import {
  decideFallback,
  type FallbackChannel,
  type PrimarySendResult
} from '@/integrations/solapi/solapi-fallback';
import {
  renderAtaPayload,
  renderBmsFreePayload,
  renderFallbackPayload,
  type SolapiFallbackChannel,
  type SolapiFallbackMessagePayload,
  type SolapiPrimaryChannel,
  type SolapiPrimaryMessagePayload
} from '@/integrations/solapi/solapi-kakao';
import { getPrismaClient } from '@/server/prisma/client';
import type { SqsQueueService } from '@/server/queue/sqs-queue.service';

export type MessageDispatchChannel = SolapiPrimaryChannel | SolapiFallbackChannel;
export type MessageDispatchStage = 'primary' | 'fallback';
export type MessageDispatchStatus =
  | 'reserved'
  | 'retry-pending'
  | 'failed'
  | 'delivered'
  | 'commit-reconcile';

export interface MessageDispatchBillingContext {
  user_id: string;
  session_id: string;
  audio_duration: number;
  billed_transcription_unit: number;
  billed_execution_unit: number;
  execution_attempted?: boolean;
}

export type MessageDispatchPrimaryRequest =
  | {
      type: 'ATA';
      to: string;
      from: string;
      pfId: string;
      templateId: string;
      variables: Record<string, string>;
    }
  | {
      type: 'BMS_FREE';
      to: string;
      from: string;
      pfId: string;
      text: string;
    };

export interface MessageDispatchFallbackRequest {
  text: string;
  preferredChannel: FallbackChannel;
  subject?: string;
}

export interface MessageDispatchInput {
  idempotencyKey: string;
  billingContext: MessageDispatchBillingContext;
  primary: MessageDispatchPrimaryRequest;
  fallback: MessageDispatchFallbackRequest;
  metadata?: Record<string, string>;
}

export interface MessageDispatchRecord {
  dispatchId: string;
  idempotencyKey: string;
  status: MessageDispatchStatus;
  finalChannel?: MessageDispatchChannel | null;
}

export type DispatchReservationResult =
  | { kind: 'reserved'; record: MessageDispatchRecord }
  | { kind: 'already-delivered'; record: MessageDispatchRecord }
  | { kind: 'in-flight'; record: MessageDispatchRecord }
  | { kind: 'commit-reconcile'; record: MessageDispatchRecord };

export interface ReserveMessageDispatchInput {
  idempotencyKey: string;
  recipient: string;
  sender: string;
  primaryChannel: SolapiPrimaryChannel;
  preferredFallbackChannel: SolapiFallbackChannel;
  billingContext: MessageDispatchBillingContext;
  metadata?: Record<string, string>;
}

export interface DispatchAttemptSnapshot extends PrimarySendResult {
  stage: MessageDispatchStage;
  channel: MessageDispatchChannel;
  groupId?: string;
  messageId?: string;
}

export interface DispatchFailureSnapshot {
  stage: MessageDispatchStage;
  channel?: MessageDispatchChannel;
  statusCode?: string;
  statusMessage?: string;
  httpStatus?: number;
  groupId?: string;
  messageId?: string;
  reason: string;
}

export interface DeliveredCommitSnapshot {
  dispatchId: string;
  finalChannel: MessageDispatchChannel;
  deliveredAt: Date;
  primaryAttempt: DispatchAttemptSnapshot;
  fallbackAttempt?: DispatchAttemptSnapshot;
}

export interface CommitReconcileSnapshot extends DeliveredCommitSnapshot {
  failureReason: string;
}

export interface MessageDispatchCommitTransaction<TTx = unknown> {
  billingTx?: TTx;
  markDelivered(input: DeliveredCommitSnapshot): Promise<'transitioned' | 'already-delivered'>;
}

export interface MessageDispatchStore<TTx = unknown> {
  reserve(input: ReserveMessageDispatchInput): Promise<DispatchReservationResult>;
  recordPrimaryAttempt(dispatchId: string, attempt: DispatchAttemptSnapshot): Promise<void>;
  recordFallbackAttempt(dispatchId: string, attempt: DispatchAttemptSnapshot): Promise<void>;
  markRetryPending(dispatchId: string, failure: DispatchFailureSnapshot): Promise<void>;
  markFailed(dispatchId: string, failure: DispatchFailureSnapshot): Promise<void>;
  markCommitReconcileRequired(dispatchId: string, failure: CommitReconcileSnapshot): Promise<void>;
  withCommitTransaction<T>(
    callback: (tx: MessageDispatchCommitTransaction<TTx>) => Promise<T>
  ): Promise<T>;
}

export interface BillingCommitInput {
  billingContext: MessageDispatchBillingContext;
  finalChannel: MessageDispatchChannel;
  deliveredAt: Date;
  dispatchId: string;
}

export interface ExecutionBillingLogWriter<TTx = unknown> {
  commitDelivered(tx: TTx | undefined, input: BillingCommitInput): Promise<void>;
}

export interface AlertService {
  notifyCritical(input: {
    dispatchId: string;
    idempotencyKey: string;
    statusCode?: string;
    statusMessage?: string;
    finalFallbackChannel: SolapiFallbackChannel;
  }): Promise<void>;
}

export interface MessageDispatchRetryQueueJob {
  kind: 'message-dispatch-retry';
  sessionId: string;
  dispatchId: string;
  idempotencyKey: string;
  stage: MessageDispatchStage;
  queuedAt: string;
  routing: {
    provider: 'solapi';
    recipient: string;
    sender: string;
    primaryChannel: SolapiPrimaryChannel;
    preferredFallbackChannel: SolapiFallbackChannel;
    attemptedChannel: MessageDispatchChannel;
  };
  failure: {
    reason: string;
    statusCode?: string;
    statusMessage?: string;
    httpStatus?: number;
    groupId?: string;
    messageId?: string;
  };
}

export interface MessageDispatchResult {
  dispatchId: string;
  idempotencyKey: string;
  status: 'delivered' | 'failed';
  reusedExistingDelivery: boolean;
  finalChannel: MessageDispatchChannel | null;
  billingCommitted: boolean;
  primaryAttempt?: DispatchAttemptSnapshot;
  fallbackAttempt?: DispatchAttemptSnapshot;
}

export interface MessageDispatchServiceOptions<TTx = unknown> {
  requireAtomicBillingCommit?: boolean;
  billingLogWriter: ExecutionBillingLogWriter<TTx>;
  retryQueue: Pick<SqsQueueService, 'enqueue'>;
  alertService?: AlertService;
  now?: () => Date;
}

type PrismaExecutionBillingClient = PrismaClient | Prisma.TransactionClient;

export class MessageDispatchConflictError extends Error {
  constructor(
    message: string,
    public readonly record: MessageDispatchRecord
  ) {
    super(message);
    this.name = 'MessageDispatchConflictError';
  }
}

export class MessageDispatchRetryableError extends Error {
  constructor(
    message: string,
    public readonly dispatchId: string,
    public readonly attempt: DispatchFailureSnapshot
  ) {
    super(message);
    this.name = 'MessageDispatchRetryableError';
  }
}

export class MessageDispatchRetryQueueError extends Error {
  constructor(
    message: string,
    public readonly dispatchId: string,
    public readonly causeValue: unknown
  ) {
    super(message);
    this.name = 'MessageDispatchRetryQueueError';
    this.cause = causeValue;
  }
}

export class MessageDispatchCommitError extends Error {
  constructor(
    message: string,
    public readonly dispatchId: string,
    public readonly finalChannel: MessageDispatchChannel,
    public readonly causeValue: unknown
  ) {
    super(message);
    this.name = 'MessageDispatchCommitError';
    this.cause = causeValue;
  }
}

export class MessageDispatchService<TTx = unknown> {
  private readonly requireAtomicBillingCommit: boolean;
  private readonly now: () => Date;

  constructor(
    private readonly adapter: SolapiAdapter,
    private readonly store: MessageDispatchStore<TTx>,
    private readonly options: MessageDispatchServiceOptions<TTx>
  ) {
    this.requireAtomicBillingCommit = options.requireAtomicBillingCommit ?? true;
    this.now = options.now ?? (() => new Date());
  }

  async dispatch(input: MessageDispatchInput): Promise<MessageDispatchResult> {
    const primaryChannel = input.primary.type;
    const reservation = await this.store.reserve({
      idempotencyKey: input.idempotencyKey,
      recipient: input.primary.to,
      sender: input.primary.from,
      primaryChannel,
      preferredFallbackChannel: input.fallback.preferredChannel,
      billingContext: input.billingContext,
      metadata: input.metadata
    });

    if (reservation.kind === 'already-delivered') {
      return {
        dispatchId: reservation.record.dispatchId,
        idempotencyKey: input.idempotencyKey,
        status: 'delivered',
        reusedExistingDelivery: true,
        finalChannel: reservation.record.finalChannel ?? null,
        billingCommitted: true
      };
    }

    if (reservation.kind === 'in-flight') {
      throw new MessageDispatchConflictError(
        `Dispatch ${reservation.record.dispatchId} is already in-flight for idempotency key ${input.idempotencyKey}.`,
        reservation.record
      );
    }

    if (reservation.kind === 'commit-reconcile') {
      throw new MessageDispatchConflictError(
        `Dispatch ${reservation.record.dispatchId} already delivered externally but billing commit requires reconciliation.`,
        reservation.record
      );
    }

    const dispatchId = reservation.record.dispatchId;
    const primaryPayload = renderPrimaryPayload(input.primary);
    assertDisableSms(primaryPayload);

    const primaryAttempt = await this.sendViaGroup({
      dispatchId,
      idempotencyKey: input.idempotencyKey,
      stage: 'primary',
      channel: primaryChannel,
      payload: primaryPayload,
      metadata: input.metadata
    });

    if (primaryAttempt.ok) {
      return this.commitDelivered({
        dispatchId,
        input,
        finalChannel: primaryChannel,
        primaryAttempt
      });
    }

    await this.store.recordPrimaryAttempt(dispatchId, primaryAttempt);

    const fallbackDecision = decideFallback(
      primaryAttempt,
      input.fallback.preferredChannel,
      input.fallback.text
    );

    if (fallbackDecision.shouldRetryPrimary) {
      const failure = toFailureSnapshot(primaryAttempt, 'Primary Solapi transport failure requires queued retry.');
      await this.queueRetry({
        dispatchId,
        input,
        attempt: primaryAttempt,
        failure
      });
      throw new MessageDispatchRetryableError(
        'Primary Solapi transport failure requires retry instead of billing commit.',
        dispatchId,
        failure
      );
    }

    if (fallbackDecision.route === 'NONE') {
      await this.store.markFailed(
        dispatchId,
        toFailureSnapshot(primaryAttempt, 'Primary dispatch failed without an allowed fallback route.')
      );
      return {
        dispatchId,
        idempotencyKey: input.idempotencyKey,
        status: 'failed',
        reusedExistingDelivery: false,
        finalChannel: null,
        billingCommitted: false,
        primaryAttempt
      };
    }

    if (fallbackDecision.shouldAlert) {
      await this.options.alertService?.notifyCritical({
        dispatchId,
        idempotencyKey: input.idempotencyKey,
        statusCode: primaryAttempt.statusCode,
        statusMessage: primaryAttempt.statusMessage,
        finalFallbackChannel: fallbackDecision.route
      });
    }

    const fallbackPayload = renderFallbackPayload({
      to: input.primary.to,
      from: input.primary.from,
      text: input.fallback.text,
      preferred: fallbackDecision.route,
      subject: input.fallback.subject
    });
    const fallbackAttempt = await this.sendViaGroup({
      dispatchId,
      idempotencyKey: input.idempotencyKey,
      stage: 'fallback',
      channel: fallbackPayload.type,
      payload: fallbackPayload,
      metadata: input.metadata
    });

    if (fallbackAttempt.ok) {
      return this.commitDelivered({
        dispatchId,
        input,
        finalChannel: fallbackAttempt.channel,
        primaryAttempt,
        fallbackAttempt
      });
    }

    await this.store.recordFallbackAttempt(dispatchId, fallbackAttempt);

    if (shouldRetryAttempt(fallbackAttempt)) {
      const failure = toFailureSnapshot(
        fallbackAttempt,
        'Fallback Solapi transport failure requires queued retry without billing commit.'
      );
      await this.queueRetry({
        dispatchId,
        input,
        attempt: fallbackAttempt,
        failure
      });
      throw new MessageDispatchRetryableError(
        'Fallback Solapi transport failure requires retry instead of billing commit.',
        dispatchId,
        failure
      );
    }

    await this.store.markFailed(
      dispatchId,
      toFailureSnapshot(fallbackAttempt, 'Fallback dispatch failed; billing commit is intentionally withheld.')
    );

    return {
      dispatchId,
      idempotencyKey: input.idempotencyKey,
      status: 'failed',
      reusedExistingDelivery: false,
      finalChannel: null,
      billingCommitted: false,
      primaryAttempt,
      fallbackAttempt
    };
  }

  private async commitDelivered(input: {
    dispatchId: string;
    input: MessageDispatchInput;
    finalChannel: MessageDispatchChannel;
    primaryAttempt: DispatchAttemptSnapshot;
    fallbackAttempt?: DispatchAttemptSnapshot;
  }): Promise<MessageDispatchResult> {
    const deliveredAt = this.now();
    const deliveredSnapshot: DeliveredCommitSnapshot = {
      dispatchId: input.dispatchId,
      finalChannel: input.finalChannel,
      deliveredAt,
      primaryAttempt: input.primaryAttempt,
      fallbackAttempt: input.fallbackAttempt
    };

    try {
      await this.store.withCommitTransaction(async (tx) => {
        if (this.requireAtomicBillingCommit && !tx.billingTx) {
          throw new Error(
            'Atomic billing commit requires the dispatch store to provide a shared transaction context.'
          );
        }

        const deliveryTransition = await tx.markDelivered(deliveredSnapshot);
        if (deliveryTransition === 'transitioned') {
          await this.options.billingLogWriter.commitDelivered(tx.billingTx, {
            billingContext: input.input.billingContext,
            finalChannel: input.finalChannel,
            deliveredAt,
            dispatchId: input.dispatchId
          });
        }
      });
    } catch (error) {
      await this.safelyMarkCommitReconcileRequired({
        ...deliveredSnapshot,
        failureReason: toErrorMessage(error)
      });

      throw new MessageDispatchCommitError(
        'Solapi delivery succeeded but billing commit rolled back. Manual reconciliation is required before retry.',
        input.dispatchId,
        input.finalChannel,
        error
      );
    }

    return {
      dispatchId: input.dispatchId,
      idempotencyKey: input.input.idempotencyKey,
      status: 'delivered',
      reusedExistingDelivery: false,
      finalChannel: input.finalChannel,
      billingCommitted: true,
      primaryAttempt: input.primaryAttempt,
      fallbackAttempt: input.fallbackAttempt
    };
  }

  private async safelyMarkCommitReconcileRequired(snapshot: CommitReconcileSnapshot) {
    try {
      await this.store.markCommitReconcileRequired(snapshot.dispatchId, snapshot);
    } catch {
      // The original commit error remains authoritative. This call only attempts to surface reconciliation state.
    }
  }

  private async sendViaGroup(input: {
    dispatchId: string;
    idempotencyKey: string;
    stage: MessageDispatchStage;
    channel: MessageDispatchChannel;
    payload: SolapiPrimaryMessagePayload | SolapiFallbackMessagePayload;
    metadata?: Record<string, string>;
  }): Promise<DispatchAttemptSnapshot> {
    try {
      const group = await this.adapter.createGroup({
        allowDuplicates: false,
        strict: true,
        customFields: {
          dispatchId: input.dispatchId,
          idempotencyKey: input.idempotencyKey,
          stage: input.stage,
          channel: input.channel,
          ...input.metadata
        }
      });
      const addedMessages = isFallbackPayload(input.payload)
        ? await this.adapter.addMessages(group.groupId, [input.payload])
        : await this.adapter.addMessages(group.groupId, [input.payload]);
      const item = addedMessages.resultList[0];
      const ok = isSuccessfulSolapiAttempt(item, addedMessages.errorCount);

      return {
        stage: input.stage,
        channel: input.channel,
        ok,
        groupId: group.groupId,
        messageId: item?.messageId,
        statusCode: item?.statusCode,
        statusMessage: item?.statusMessage
      };
    } catch (error) {
      return {
        stage: input.stage,
        channel: input.channel,
        ok: false,
        httpStatus: extractHttpStatus(error),
        statusMessage: toErrorMessage(error)
      };
    }
  }

  private async queueRetry(input: {
    dispatchId: string;
    input: MessageDispatchInput;
    attempt: DispatchAttemptSnapshot;
    failure: DispatchFailureSnapshot;
  }) {
    const retryJob = buildRetryQueueJob({
      ...input,
      queuedAt: this.now().toISOString()
    });

    try {
      await this.options.retryQueue.enqueue(retryJob, {
        messageAttributes: {
          jobType: retryJob.kind,
          dispatchId: retryJob.dispatchId,
          sessionId: retryJob.sessionId,
          stage: retryJob.stage,
          attemptedChannel: retryJob.routing.attemptedChannel
        }
      });
    } catch (error) {
      throw new MessageDispatchRetryQueueError(
        'Retry queue enqueue failed; async retry cannot be scheduled.',
        input.dispatchId,
        error
      );
    }

    await this.store.markRetryPending(input.dispatchId, input.failure);
  }
}

export class PrismaExecutionBillingLogWriter
  implements ExecutionBillingLogWriter<PrismaExecutionBillingClient>
{
  constructor(
    private readonly prisma: PrismaExecutionBillingClient = getPrismaClient(),
    private readonly destinationTypeResolver: (
      channel: MessageDispatchChannel
    ) => string = defaultDestinationTypeResolver
  ) {}

  async commitDelivered(
    tx: PrismaExecutionBillingClient | undefined,
    input: BillingCommitInput
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.executionBillingLog.create({
      data: {
        user_id: input.billingContext.user_id,
        session_id: input.billingContext.session_id,
        audio_duration: input.billingContext.audio_duration,
        destination_type: this.destinationTypeResolver(input.finalChannel),
        execution_attempted: input.billingContext.execution_attempted ?? true,
        destination_delivered: true,
        billed_transcription_unit: input.billingContext.billed_transcription_unit,
        billed_execution_unit: input.billingContext.billed_execution_unit
      }
    });
  }
}

function renderPrimaryPayload(
  input: MessageDispatchPrimaryRequest
): SolapiPrimaryMessagePayload {
  if (input.type === 'ATA') {
    return renderAtaPayload({
      to: input.to,
      from: input.from,
      pfId: input.pfId,
      templateId: input.templateId,
      variables: input.variables
    });
  }

  return renderBmsFreePayload({
    to: input.to,
    from: input.from,
    pfId: input.pfId,
    text: input.text
  });
}

function assertDisableSms(payload: SolapiPrimaryMessagePayload) {
  if (payload.kakaoOptions.disableSms !== true) {
    throw new Error('SOLAPI_PRIMARY_DISABLE_SMS_REQUIRED');
  }
}

function isSuccessfulSolapiAttempt(
  item:
    | {
        statusCode: string;
        messageId: string;
      }
    | undefined,
  errorCount: string | number
) {
  if (!item) {
    return false;
  }

  const numericErrorCount =
    typeof errorCount === 'number' ? errorCount : Number.parseInt(errorCount, 10);

  return Number.isFinite(numericErrorCount) && numericErrorCount === 0 && /^2\d{3}$/.test(item.statusCode);
}

function shouldRetryAttempt(attempt: DispatchAttemptSnapshot) {
  return !attempt.ok && attempt.httpStatus !== undefined && (attempt.httpStatus === 429 || attempt.httpStatus >= 500);
}

function toFailureSnapshot(
  attempt: DispatchAttemptSnapshot,
  reason: string
): DispatchFailureSnapshot {
  return {
    stage: attempt.stage,
    channel: attempt.channel,
    statusCode: attempt.statusCode,
    statusMessage: attempt.statusMessage,
    httpStatus: attempt.httpStatus,
    groupId: attempt.groupId,
    messageId: attempt.messageId,
    reason
  };
}

function extractHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = Reflect.get(error, 'status') ?? Reflect.get(error, 'httpStatus');
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown message dispatch error.';
}

function defaultDestinationTypeResolver(channel: MessageDispatchChannel) {
  return `messaging:${channel.toLowerCase()}`;
}

function isFallbackPayload(
  payload: SolapiPrimaryMessagePayload | SolapiFallbackMessagePayload
): payload is SolapiFallbackMessagePayload {
  return payload.type === 'SMS' || payload.type === 'LMS';
}

function buildRetryQueueJob(input: {
  dispatchId: string;
  input: MessageDispatchInput;
  attempt: DispatchAttemptSnapshot;
  failure: DispatchFailureSnapshot;
  queuedAt: string;
}): MessageDispatchRetryQueueJob {
  return {
    kind: 'message-dispatch-retry',
    sessionId: input.input.billingContext.session_id,
    dispatchId: input.dispatchId,
    idempotencyKey: input.input.idempotencyKey,
    stage: input.attempt.stage,
    queuedAt: input.queuedAt,
    routing: {
      provider: 'solapi',
      recipient: input.input.primary.to,
      sender: input.input.primary.from,
      primaryChannel: input.input.primary.type,
      preferredFallbackChannel: input.input.fallback.preferredChannel,
      attemptedChannel: input.attempt.channel
    },
    failure: {
      reason: input.failure.reason,
      statusCode: input.failure.statusCode,
      statusMessage: input.failure.statusMessage,
      httpStatus: input.failure.httpStatus,
      groupId: input.failure.groupId,
      messageId: input.failure.messageId
    }
  };
}
