import type { Prisma } from '@prisma/client';
import { persistJsonPayload } from './payload-storage';

type OutboxCreateCapableClient = {
  outboxMessage: {
    create: (args: { data: Prisma.OutboxMessageUncheckedCreateInput }) => Promise<unknown>;
  };
};

export type EnqueueOutboxEventInput = {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  idempotencyKey: string;
  payload: unknown;
  availableAt?: Date;
  storageNamespace?: string;
};

export async function buildOutboxCreateInput(input: EnqueueOutboxEventInput) {
  const persistedPayload = await persistJsonPayload({
    namespace: input.storageNamespace ?? `outbox/${input.aggregateType}/${input.eventType}`,
    value: input.payload
  });

  return {
    aggregateId: input.aggregateId,
    aggregateType: input.aggregateType,
    topic: input.eventType,
    idempotencyKey: input.idempotencyKey,
    status: 'pending',
    payloadInline:
      persistedPayload.inlineJson === null ? null : JSON.stringify(persistedPayload.inlineJson),
    payloadUri: persistedPayload.externalUri,
    payloadBytes: persistedPayload.sizeBytes,
    payloadSha256: persistedPayload.sha256,
    availableAt: input.availableAt ?? new Date()
  } satisfies Prisma.OutboxMessageUncheckedCreateInput;
}

export async function enqueueOutboxEvent(
  db: OutboxCreateCapableClient,
  input: EnqueueOutboxEventInput
) {
  return db.outboxMessage.create({
    data: await buildOutboxCreateInput(input)
  });
}
