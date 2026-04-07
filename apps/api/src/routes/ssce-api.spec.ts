import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSerializableRetryError, runSerializableTransactionWithRetry } from '../db/serializable-retry';
import { MAX_INLINE_JSON_BYTES, persistJsonPayload } from '../db/payload-storage';
import { createSsceRouter } from './ssce-router';
import { PayPerOutputService, OutputGenerationRefundedError } from '../services/pay-per-output-service';
import { BillingTimeoutSweeper, BILLING_TIMEOUT_SWEEPER_LOCK_SQL } from '../workers/billing-timeout-sweeper';

function buildHarvestPayload() {
  return {
    workspace_id: 'workspace-alpha',
    destination_key: 'gmail',
    recipient_key: 'ceo@voxera.ai',
    task_key: 'weekly-brief',
    source_artifact: {
      external_id: 'artifact-ref-1',
      title: 'Approved email',
      content: 'Keep the executive summary short and lead with the KPI delta.',
      content_format: 'markdown' as const,
      artifact_kind: 'reference' as const,
      structure_outline: ['subject', 'summary', 'next steps'],
      metadata: {
        language: 'en'
      }
    },
    related_artifacts: [
      {
        external_id: 'artifact-ref-2',
        title: 'Previous weekly brief',
        content: 'Use numbered actions and close with owner + deadline.',
        content_format: 'markdown' as const,
        artifact_kind: 'reference' as const,
        structure_outline: ['summary', 'actions'],
        metadata: {}
      }
    ],
    content_signals: [
      {
        trait_key: 'tone.executive',
        evidence: 'Direct and compressed.',
        weight: 0.9
      },
      {
        trait_key: 'format.numbered_actions',
        evidence: 'Actions appear as an ordered list.',
        weight: 0.7
      }
    ],
    reference_links: [
      {
        target_artifact_external_id: 'artifact-ref-2',
        edge_type: 'references' as const,
        weight: 0.8,
        rationale: 'Primary precedent'
      }
    ]
  };
}

function buildFeedbackPayload() {
  return {
    workspace_id: 'workspace-alpha',
    destination_key: 'gmail',
    recipient_key: 'ceo@voxera.ai',
    task_key: 'weekly-brief',
    generated_draft: {
      artifact_id: 'draft-1',
      title: 'Weekly brief draft',
      content: 'Prompt: Draft the next weekly brief. Use concise KPI framing.',
      content_format: 'markdown' as const,
      structure_outline: ['opening', 'body', 'closing'],
      metadata: {}
    },
    final_artifact: {
      title: 'Weekly brief final',
      content:
        'Prompt: Draft the next weekly brief. Lead with KPI delta. Use numbered actions. Close with owners and deadlines.',
      content_format: 'markdown' as const,
      structure_outline: ['opening', 'kpi delta', 'actions', 'owners'],
      metadata: {}
    },
    feedback_notes: 'Human editor tightened the CTA and added explicit owners.',
    accepted_reference_artifact_ids: []
  };
}

function createOracle() {
  return {
    analyze: vi.fn(async () => ({
      provider: 'heuristic-oracle-v1',
      lexical_changes: {
        added_keywords: ['owners', 'kpi', 'deadlines'],
        removed_keywords: [],
        reinforced_keywords: ['actions'],
        lexical_shift_score: 0.4,
        compression_delta: 0,
        sentence_delta: 0
      },
      structure_changes: {
        added_sections: ['actions', 'owners'],
        removed_sections: [],
        reordered_sections: 0,
        heading_delta: 0,
        list_delta: 1,
        structure_score: 0.5
      },
      tone_delta: {
        before: {
          directness: 0.4,
          concision: 0.4,
          formality: 0.4,
          warmth: 0.3,
          urgency: 0.3,
          analytical: 0.3,
          structure: 0.4
        },
        after: {
          directness: 0.7,
          concision: 0.6,
          formality: 0.5,
          warmth: 0.2,
          urgency: 0.4,
          analytical: 0.5,
          structure: 0.7
        },
        primary_shift: 'more_directness',
        secondary_shifts: ['more_structure'],
        intensity_score: 0.5,
        rationale: 'Editor tightened the artifact.'
      },
      diff_summary: {
        added_sentences: 1,
        removed_sentences: 0,
        changed_structure_sections: 2,
        summary: 'Oracle detected stronger CTA structure.'
      },
      scope_updates: {
        global: {
          summary: 'Global directness increased.',
          trait_signals: [
            {
              trait_key: 'tone.direct',
              evidence: 'CTA is stronger.',
              weight: 0.8
            }
          ],
          confidence_delta: 0.1,
          signal_count_delta: 1
        },
        destination: {
          summary: 'Destination favors action blocks.',
          trait_signals: [
            {
              trait_key: 'format.actions',
              evidence: 'Numbered actions added.',
              weight: 0.7
            }
          ],
          confidence_delta: 0.08,
          signal_count_delta: 1
        },
        recipient: {
          summary: 'Recipient style unchanged.',
          trait_signals: [],
          confidence_delta: 0.02,
          signal_count_delta: 0
        },
        task: {
          summary: 'Task now emphasizes owners.',
          trait_signals: [
            {
              trait_key: 'task.owner_deadline',
              evidence: 'Owners and deadlines were added.',
              weight: 0.72
            }
          ],
          confidence_delta: 0.09,
          signal_count_delta: 1
        }
      }
    }))
  };
}

function createSsceTestPrisma(options: { failSerializableOnce?: boolean } = {}) {
  let idSeq = 0;
  let failedSerializable = false;
  const state = {
    artifacts: [] as any[],
    styleSignatures: [] as any[],
    styleEvents: [] as any[],
    referenceEdges: [] as any[],
    outboxMessages: [] as any[]
  };

  function nextId(prefix: string) {
    idSeq += 1;
    return `${prefix}-${idSeq}`;
  }

  const prisma = {
    state,
    artifact: {
      async create({ data }: any) {
        const row = {
          id: data.id ?? nextId('artifact'),
          createdAt: data.createdAt ?? new Date(),
          updatedAt: data.updatedAt ?? new Date(),
          ...data
        };
        state.artifacts.push(row);
        return row;
      },
      async findUnique({ where }: any) {
        return state.artifacts.find((artifact) => artifact.id === where.id) ?? null;
      }
    },
    styleSignature: {
      async findFirst({ where, orderBy }: any) {
        const rows = state.styleSignatures.filter(
          (signature) =>
            signature.workspaceId === where.workspaceId &&
            signature.scopeType === where.scopeType &&
            signature.scopeKey === where.scopeKey &&
            signature.isCurrent === where.isCurrent
        );
        rows.sort((left, right) => {
          if (orderBy?.versionNo === 'desc') {
            return right.versionNo - left.versionNo;
          }

          return left.versionNo - right.versionNo;
        });
        return rows[0] ?? null;
      },
      async create({ data }: any) {
        const row = {
          id: data.id ?? nextId('signature'),
          createdAt: data.createdAt ?? new Date(),
          updatedAt: data.updatedAt ?? new Date(),
          ...data
        };
        state.styleSignatures.push(row);
        return row;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const signature of state.styleSignatures) {
          if (
            signature.id === where.id &&
            signature.occVersion === where.occVersion &&
            signature.isCurrent === where.isCurrent
          ) {
            signature.isCurrent = data.isCurrent;
            signature.supersededAt = data.supersededAt;
            signature.occVersion += data.occVersion.increment;
            signature.updatedAt = new Date();
            count += 1;
          }
        }

        return {
          count
        };
      }
    },
    styleEvent: {
      async create({ data }: any) {
        const row = {
          id: data.id ?? nextId('event'),
          createdAt: data.createdAt ?? new Date(),
          ...data
        };
        state.styleEvents.push(row);
        return row;
      },
      async findFirst({ where }: any) {
        return state.styleEvents.find((event) => event.eventType === where.eventType) ?? null;
      }
    },
    referenceEdge: {
      async create({ data }: any) {
        const row = {
          id: data.id ?? nextId('edge'),
          createdAt: data.createdAt ?? new Date(),
          ...data
        };
        state.referenceEdges.push(row);
        return row;
      }
    },
    outboxMessage: {
      async create({ data }: any) {
        const row = {
          id: data.id ?? nextId('outbox'),
          createdAt: data.createdAt ?? new Date(),
          updatedAt: data.updatedAt ?? new Date(),
          ...data
        };
        state.outboxMessages.push(row);
        return row;
      }
    },
    async $transaction<T>(callback: (tx: any) => Promise<T>) {
      if (options.failSerializableOnce && !failedSerializable) {
        failedSerializable = true;
        throw createSerializableRetryError('Injected serialization failure.');
      }

      return callback(prisma);
    }
  };

  return prisma;
}

function createBillingSweeperPrisma() {
  const accounts = [
    {
      uid: 'user-1',
      availableCredits: 5,
      pendingCredits: 6,
      deductedCredits: 0,
      refundedCredits: 0,
      occVersion: 1
    }
  ];
  const transactions = [
    {
      id: 'tx-1',
      uid: 'user-1',
      clientRequestId: 'req-1',
      costCredits: 3,
      status: 'executing',
      finalizedAt: null,
      claimed: false
    },
    {
      id: 'tx-2',
      uid: 'user-1',
      clientRequestId: 'req-2',
      costCredits: 3,
      status: 'reserved',
      finalizedAt: null,
      claimed: false
    }
  ];
  const outboxMessages: any[] = [];

  const prisma = {
    billingAccount: {
      async findUnique({ where }: any) {
        return accounts.find((account) => account.uid === where.uid) ?? null;
      },
      async update({ where, data }: any) {
        const account = accounts.find((entry) => entry.uid === where.uid);
        if (!account) {
          throw new Error('missing account');
        }

        account.availableCredits = data.availableCredits;
        account.pendingCredits = data.pendingCredits;
        account.refundedCredits = data.refundedCredits;
        account.occVersion += data.occVersion.increment;
        return account;
      }
    },
    billingTransaction: {
      async update({ where, data }: any) {
        const transaction = transactions.find((entry) => entry.clientRequestId === where.clientRequestId);
        if (!transaction) {
          throw new Error('missing transaction');
        }

        transaction.status = data.status;
        transaction.finalizedAt = data.finalizedAt;
        return transaction;
      }
    },
    outboxMessage: {
      async create({ data }: any) {
        outboxMessages.push(data);
        return data;
      }
    },
    async $queryRaw() {
      const available = transactions.filter((transaction) => transaction.finalizedAt === null && !transaction.claimed);
      for (const transaction of available) {
        transaction.claimed = true;
      }
      return available;
    },
    async $transaction<T>(callback: (tx: any) => Promise<T>) {
      return callback(prisma);
    }
  };

  return {
    prisma,
    accounts,
    transactions,
    outboxMessages
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SSCE backend hardening', () => {
  it('harvest compounds four scope signatures and writes an outbox event', async () => {
    const prisma = createSsceTestPrisma();
    const router = createSsceRouter({
      prisma: prisma as any,
      semanticDiffOracle: createOracle() as any
    });

    const result = await router.harvest(buildHarvestPayload());

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect((result.body as any).harvested_signatures).toHaveLength(4);
    expect(prisma.state.styleSignatures.filter((signature) => signature.isCurrent)).toHaveLength(4);
    expect(prisma.state.outboxMessages).toHaveLength(1);
  });

  it('feedback creates append-only signature versions and preserves one current row per scope', async () => {
    const prisma = createSsceTestPrisma();
    const router = createSsceRouter({
      prisma: prisma as any,
      semanticDiffOracle: createOracle() as any
    });

    await router.harvest(buildHarvestPayload());
    const draft = await (prisma as any).artifact.create({
      data: {
        id: 'draft-1',
        workspaceId: 'workspace-alpha',
        externalId: null,
        title: 'Draft',
        content: 'Prompt draft',
        contentFormat: 'markdown',
        artifactKind: 'generated_draft',
        destinationKey: 'gmail',
        recipientKey: 'ceo@voxera.ai',
        taskKey: 'weekly-brief',
        structureOutline: JSON.stringify(['opening']),
        metadataJson: JSON.stringify({})
      }
    });
    expect(draft.id).toBe('draft-1');

    const result = await router.feedback(buildFeedbackPayload());

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(prisma.state.styleSignatures).toHaveLength(8);
    expect(prisma.state.styleSignatures.filter((signature) => signature.isCurrent)).toHaveLength(4);
    expect(
      prisma.state.styleSignatures.filter((signature) => signature.versionNo === 2 && signature.isCurrent)
    ).toHaveLength(4);
    expect(prisma.state.outboxMessages).toHaveLength(2);
  });

  it('retries once on P2034 during signature transaction work', async () => {
    const prisma = createSsceTestPrisma({
      failSerializableOnce: true
    });
    const router = createSsceRouter({
      prisma: prisma as any,
      semanticDiffOracle: createOracle() as any
    });

    const result = await router.harvest(buildHarvestPayload());

    expect(result.status).toBe(200);
    expect((result.body as any).harvested_signatures).toHaveLength(4);
  });

  it('moves JSON payloads above 256 KiB into an external URI', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'voxera-payload-'));
    try {
      const payload = await persistJsonPayload({
        namespace: 'style-events/test',
        storageRoot: tempRoot,
        value: {
          largeText: 'x'.repeat(MAX_INLINE_JSON_BYTES + 32)
        }
      });

      expect(payload.inlineJson).toBeNull();
      expect(payload.externalUri).toMatch(/^file:\/\//);
      expect(payload.sizeBytes).toBeGreaterThan(MAX_INLINE_JSON_BYTES);
      expect(payload.sha256).toHaveLength(64);
    } finally {
      await rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  });

  it('refunds timed-out output generation and sends heartbeats before failure', async () => {
    vi.useFakeTimers();
    const billingStore = {
      reserve: vi.fn(async () => ({
        kind: 'reserved' as const,
        transactionId: 'req-1',
        costCredits: 3,
        revalidateKeys: ['wallet:user-1']
      })),
      markExecuting: vi.fn(async () => undefined),
      heartbeat: vi.fn(async () => undefined),
      deduct: vi.fn(async () => {
        throw new Error('should not deduct');
      }),
      refund: vi.fn(async () => ({
        transactionId: 'req-1',
        billingStatus: 'refunded' as const,
        availableCredits: 10,
        pendingCredits: 0,
        revalidateKeys: ['wallet:user-1']
      }))
    };
    const outputGenerator = {
      generate: vi.fn(() => new Promise<never>(() => undefined))
    };
    const service = new PayPerOutputService(billingStore as any, outputGenerator as any);
    const promise = service.execute({
      uid: 'user-1',
      clientRequestId: 'req-1',
      prompt: 'Long running generation',
      outputType: 'summary',
      costCredits: 3,
      timeoutMs: 4_500
    });
    const assertion = expect(promise).rejects.toBeInstanceOf(OutputGenerationRefundedError);

    await vi.advanceTimersByTimeAsync(5_000);

    await assertion;
    expect(billingStore.markExecuting).toHaveBeenCalledTimes(1);
    expect(billingStore.heartbeat).toHaveBeenCalled();
    expect(billingStore.refund).toHaveBeenCalledTimes(1);
  });

  it('sweeper finalizes expired rows without overlap and uses SKIP LOCKED semantics', async () => {
    const { prisma, accounts, transactions, outboxMessages } = createBillingSweeperPrisma();
    const sweeper = new BillingTimeoutSweeper(prisma as any, () => new Date('2026-04-07T00:00:00Z'));

    expect(BILLING_TIMEOUT_SWEEPER_LOCK_SQL).toContain('FOR UPDATE SKIP LOCKED');

    const firstBatch = await sweeper.runOnce(10);
    const secondBatch = await sweeper.runOnce(10);

    expect(firstBatch.settledClientRequestIds).toEqual(['req-1', 'req-2']);
    expect(secondBatch.settledClientRequestIds).toEqual([]);
    expect(transactions.every((transaction) => transaction.status === 'refunded')).toBe(true);
    expect(accounts[0].availableCredits).toBe(11);
    expect(accounts[0].pendingCredits).toBe(0);
    expect(outboxMessages).toHaveLength(2);
  });

  it('retries serializable callbacks directly when P2034 is raised', async () => {
    let attempts = 0;
    const prisma = {
      async $transaction<T>(callback: (tx: unknown) => Promise<T>) {
        attempts += 1;
        if (attempts === 1) {
          throw createSerializableRetryError('retry me');
        }

        return callback({});
      }
    };

    const result = await runSerializableTransactionWithRetry(
      prisma as any,
      async () => 'ok'
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });
});
