import type { Artifact, Prisma, PrismaClient, StyleSignature } from '@prisma/client';
import type { ZodType } from 'zod';
import type {
  ArtifactPayload,
  FeedbackArtifact,
  FeedbackResponse,
  GenerateResponse,
  HarvestResponse,
  ScopeContext,
  SsceErrorResponse,
  SsceIssue,
  SsceScopeType,
  TraitSignal
} from '@adapter/validators/ssce-zod';
import {
  feedbackRequestSchema,
  feedbackResponseSchema,
  generateRequestSchema,
  generateResponseSchema,
  harvestRequestSchema,
  harvestResponseSchema,
  mapZodIssues,
  ssceErrorResponseSchema
} from '@adapter/validators/ssce-zod';
import { persistJsonPayload } from '@ssce/db/payload-storage';
import { createSerializableRetryError, runSerializableTransactionWithRetry } from '@ssce/db/serializable-retry';
import { getSscePrismaClient } from '@ssce/db/ssce-prisma';
import { enqueueOutboxEvent } from '@ssce/db/transactional-outbox';
import {
  getSemanticDiffOracle,
  type SemanticDiffOracle,
  type SemanticDiffOracleResult
} from '@ssce/services/semantic-diff-oracle';

export interface SsceRouterDependencies {
  prisma?: PrismaClient;
  now?: () => Date;
  semanticDiffOracle?: SemanticDiffOracle;
}

export type SsceRouteResult<TSuccess> =
  | { status: number; body: TSuccess }
  | { status: number; body: SsceErrorResponse };

type ScopeDescriptor = {
  scopeType: SsceScopeType;
  scopeKey: string;
  destinationKey: string | null;
  recipientKey: string | null;
  taskKey: string | null;
};

type SsceDbClient = PrismaClient | Prisma.TransactionClient;

const DEFAULT_SCOPE_ORDER: readonly SsceScopeType[] = ['global', 'destination', 'recipient', 'task'];

class SsceRouterError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly issues: SsceIssue[] = []
  ) {
    super(message);
  }
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  issues: SsceIssue[] = []
): SsceRouteResult<never> {
  return {
    status,
    body: ssceErrorResponseSchema.parse({
      ok: false,
      error: {
        code,
        message,
        issues
      }
    })
  };
}

function successResponse<T>(schema: ZodType<T>, payload: T, status = 200): SsceRouteResult<T> {
  return {
    status,
    body: schema.parse(payload)
  };
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function buildScopeDescriptors(context: ScopeContext): ScopeDescriptor[] {
  const descriptors: ScopeDescriptor[] = [
    {
      scopeType: 'global',
      scopeKey: `global:${context.workspace_id}`,
      destinationKey: null,
      recipientKey: null,
      taskKey: null
    }
  ];

  if (context.destination_key) {
    descriptors.push({
      scopeType: 'destination',
      scopeKey: `destination:${context.workspace_id}:${context.destination_key}`,
      destinationKey: context.destination_key,
      recipientKey: null,
      taskKey: null
    });
  }

  if (context.recipient_key) {
    descriptors.push({
      scopeType: 'recipient',
      scopeKey: `recipient:${context.workspace_id}:${context.recipient_key}`,
      destinationKey: context.destination_key ?? null,
      recipientKey: context.recipient_key,
      taskKey: null
    });
  }

  if (context.task_key) {
    descriptors.push({
      scopeType: 'task',
      scopeKey: `task:${context.workspace_id}:${context.task_key}`,
      destinationKey: context.destination_key ?? null,
      recipientKey: context.recipient_key ?? null,
      taskKey: context.task_key
    });
  }

  return descriptors;
}

function createTraitSummary(signals: TraitSignal[]): string[] {
  const grouped = new Map<string, number>();

  for (const signal of signals) {
    grouped.set(signal.trait_key, (grouped.get(signal.trait_key) ?? 0) + signal.weight);
  }

  return Array.from(grouped.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([traitKey, weight]) => `${traitKey}:${weight.toFixed(2)}`);
}

function mergeSummary(existingSummary: unknown, nextSummary: string[]) {
  return Array.from(
    new Set([
      ...(Array.isArray(existingSummary)
        ? existingSummary.filter((value): value is string => typeof value === 'string')
        : []),
      ...nextSummary
    ])
  );
}

function artifactPayloadToCreateInput(
  artifact: ArtifactPayload | FeedbackArtifact,
  context: ScopeContext,
  artifactKindOverride?: 'reference' | 'generated_draft' | 'final_artifact'
): Prisma.ArtifactUncheckedCreateInput {
  const artifactPayload = artifact as ArtifactPayload;
  const feedbackArtifact = artifact as FeedbackArtifact;

  return {
    workspaceId: context.workspace_id,
    externalId: artifactPayload.external_id ?? feedbackArtifact.artifact_id ?? null,
    title: artifact.title ?? null,
    content: artifact.content,
    contentFormat: artifact.content_format,
    artifactKind: artifactKindOverride ?? artifactPayload.artifact_kind ?? 'reference',
    destinationKey: context.destination_key ?? null,
    recipientKey: context.recipient_key ?? null,
    taskKey: context.task_key ?? null,
    structureOutline: serializeJson(artifact.structure_outline),
    metadataJson: serializeJson(artifact.metadata)
  };
}

function artifactToEnvelope(artifact: Artifact) {
  return {
    id: artifact.id,
    external_id: artifact.externalId,
    title: artifact.title,
    content: artifact.content,
    content_format: artifact.contentFormat as GenerateResponse['generated_draft']['content_format'],
    artifact_kind: artifact.artifactKind as GenerateResponse['generated_draft']['artifact_kind'],
    structure_outline: parseJson<string[]>(artifact.structureOutline, []),
    metadata: parseJson<Record<string, string | number | boolean | string[]>>(artifact.metadataJson, {})
  };
}

function signatureToSnapshot(signature: StyleSignature) {
  return {
    id: signature.id,
    scope_type: signature.scopeType as SsceScopeType,
    scope_key: signature.scopeKey,
    confidence_score: signature.confidenceScore,
    signal_count: signature.signalCount
  };
}

type SignatureMutationPlan = {
  signalCount: number;
  confidenceScore: number;
  traitsJson: Record<string, unknown>;
};

async function appendSignatureVersion(
  db: SsceDbClient,
  scope: ScopeDescriptor,
  context: ScopeContext,
  plan: SignatureMutationPlan,
  sourceArtifactId: string,
  now: Date
) {
  const current = await db.styleSignature.findFirst({
    where: {
      workspaceId: context.workspace_id,
      scopeType: scope.scopeType,
      scopeKey: scope.scopeKey,
      isCurrent: true
    },
    orderBy: {
      versionNo: 'desc'
    }
  });

  if (current) {
    const retired = await db.styleSignature.updateMany({
      where: {
        id: current.id,
        occVersion: current.occVersion,
        isCurrent: true
      },
      data: {
        isCurrent: false,
        supersededAt: now,
        occVersion: {
          increment: 1
        }
      }
    });

    if (retired.count !== 1) {
      throw createSerializableRetryError(`Current signature changed during ${scope.scopeType} append.`);
    }
  }

  return db.styleSignature.create({
    data: {
      workspaceId: context.workspace_id,
      scopeType: scope.scopeType,
      scopeKey: scope.scopeKey,
      destinationKey: scope.destinationKey,
      recipientKey: scope.recipientKey,
      taskKey: scope.taskKey,
      versionNo: (current?.versionNo ?? 0) + 1,
      occVersion: 1,
      isCurrent: true,
      signalCount: plan.signalCount,
      confidenceScore: plan.confidenceScore,
      traitsJson: serializeJson(plan.traitsJson),
      sourceArtifactId,
      previousSignatureId: current?.id ?? null,
      supersededAt: null
    }
  });
}

async function appendSignatureFromHarvest(
  db: SsceDbClient,
  scope: ScopeDescriptor,
  context: ScopeContext,
  signals: TraitSignal[],
  sourceArtifactId: string,
  now: Date
) {
  const current = await db.styleSignature.findFirst({
    where: {
      workspaceId: context.workspace_id,
      scopeType: scope.scopeType,
      scopeKey: scope.scopeKey,
      isCurrent: true
    },
    orderBy: {
      versionNo: 'desc'
    }
  });
  const existingTraits = current ? parseJson<Record<string, unknown>>(current.traitsJson, {}) : {};
  const summary = createTraitSummary(signals);

  return appendSignatureVersion(
    db,
    scope,
    context,
    {
      signalCount: (current?.signalCount ?? 0) + signals.length,
      confidenceScore: Math.min(1, (current?.confidenceScore ?? 0.35) + 0.05),
      traitsJson: {
        ...existingTraits,
        summary: mergeSummary(existingTraits.summary, summary),
        signal_count: (current?.signalCount ?? 0) + signals.length,
        last_harvest_source_artifact_id: sourceArtifactId
      }
    },
    sourceArtifactId,
    now
  );
}

async function appendSignatureFromFeedback(
  db: SsceDbClient,
  scope: ScopeDescriptor,
  context: ScopeContext,
  oracleAnalysis: SemanticDiffOracleResult,
  sourceArtifactId: string,
  now: Date
) {
  const current = await db.styleSignature.findFirst({
    where: {
      workspaceId: context.workspace_id,
      scopeType: scope.scopeType,
      scopeKey: scope.scopeKey,
      isCurrent: true
    },
    orderBy: {
      versionNo: 'desc'
    }
  });
  const existingTraits = current ? parseJson<Record<string, unknown>>(current.traitsJson, {}) : {};
  const scopeUpdate = oracleAnalysis.scope_updates[scope.scopeType];
  const summary = createTraitSummary(scopeUpdate.trait_signals);

  return appendSignatureVersion(
    db,
    scope,
    context,
    {
      signalCount: (current?.signalCount ?? 0) + scopeUpdate.signal_count_delta,
      confidenceScore: Math.min(1, Math.max(0.35, (current?.confidenceScore ?? 0.35) + scopeUpdate.confidence_delta)),
      traitsJson: {
        ...existingTraits,
        summary: mergeSummary(existingTraits.summary, summary),
        last_oracle_provider: oracleAnalysis.provider,
        last_diff_summary: oracleAnalysis.diff_summary.summary,
        last_diff_snapshot: oracleAnalysis.diff_summary,
        last_lexical_changes: oracleAnalysis.lexical_changes,
        last_structure_changes: oracleAnalysis.structure_changes,
        last_tone_delta: oracleAnalysis.tone_delta,
        last_scope_update: scopeUpdate
      }
    },
    sourceArtifactId,
    now
  );
}

export function createSsceRouter(dependencies: SsceRouterDependencies = {}) {
  const prisma = dependencies.prisma ?? getSscePrismaClient();
  const now = dependencies.now ?? (() => new Date());
  const semanticDiffOracle = dependencies.semanticDiffOracle ?? getSemanticDiffOracle();

  return {
    prisma,

    async harvest(input: unknown): Promise<SsceRouteResult<HarvestResponse>> {
      const parsed = harvestRequestSchema.safeParse(input);
      if (!parsed.success) {
        return errorResponse(
          400,
          'SSCE_HARVEST_INVALID',
          'Harvest payload failed Zod validation.',
          mapZodIssues(parsed.error)
        );
      }

      try {
        const eventSnapshot = await persistJsonPayload({
          namespace: 'style-events/harvest',
          value: parsed.data
        });

        const result = await runSerializableTransactionWithRetry(prisma, async (rawTx) => {
          const tx = rawTx as Prisma.TransactionClient;
          const timestamp = now();

          const sourceArtifact = await tx.artifact.create({
            data: artifactPayloadToCreateInput(parsed.data.source_artifact, parsed.data)
          });

          const relatedArtifacts = [];
          for (const artifact of parsed.data.related_artifacts) {
            relatedArtifacts.push(
              await tx.artifact.create({
                data: artifactPayloadToCreateInput(artifact, parsed.data)
              })
            );
          }

          const artifactsByExternalId = new Map<string, Artifact>();
          for (const artifact of [sourceArtifact, ...relatedArtifacts]) {
            if (artifact.externalId) {
              artifactsByExternalId.set(artifact.externalId, artifact);
            }
          }

          let linkedReferenceEdges = 0;
          for (const link of parsed.data.reference_links) {
            const target = artifactsByExternalId.get(link.target_artifact_external_id);
            if (!target) {
              throw new SsceRouterError(
                400,
                'SSCE_REFERENCE_TARGET_MISSING',
                `Reference target ${link.target_artifact_external_id} was not provided in related_artifacts.`
              );
            }

            await tx.referenceEdge.create({
              data: {
                sourceArtifactId: sourceArtifact.id,
                targetArtifactId: target.id,
                edgeType: link.edge_type,
                weight: link.weight,
                rationale: link.rationale ?? null
              }
            });
            linkedReferenceEdges += 1;
          }

          const signatures = [];
          for (const scope of buildScopeDescriptors(parsed.data)) {
            signatures.push(
              await appendSignatureFromHarvest(
                tx,
                scope,
                parsed.data,
                parsed.data.content_signals,
                sourceArtifact.id,
                timestamp
              )
            );
          }

          const event = await tx.styleEvent.create({
            data: {
              workspaceId: parsed.data.workspace_id,
              eventType: 'harvest',
              artifactId: sourceArtifact.id,
              signatureId: signatures[0]?.id ?? null,
              diffSummary: null,
              payloadSnapshotInline:
                eventSnapshot.inlineJson === null ? null : JSON.stringify(eventSnapshot.inlineJson),
              payloadSnapshotUri: eventSnapshot.externalUri,
              payloadSnapshotSha256: eventSnapshot.sha256,
              payloadSnapshotBytes: eventSnapshot.sizeBytes,
              createdAt: timestamp
            }
          });

          await enqueueOutboxEvent(tx, {
            aggregateId: event.id,
            aggregateType: 'style_event',
            eventType: 'ssce.harvest.recorded',
            idempotencyKey: `ssce:harvest:${event.id}`,
            payload: {
              workspaceId: parsed.data.workspace_id,
              artifactId: sourceArtifact.id,
              signatureIds: signatures.map((signature) => signature.id)
            }
          });

          return {
            ok: true as const,
            artifact_id: sourceArtifact.id,
            event_id: event.id,
            harvested_signatures: signatures.map(signatureToSnapshot),
            linked_reference_edges: linkedReferenceEdges
          };
        });

        return successResponse(harvestResponseSchema, result);
      } catch (error) {
        if (error instanceof SsceRouterError) {
          return errorResponse(error.statusCode, error.code, error.message, error.issues);
        }

        return errorResponse(500, 'SSCE_HARVEST_FAILED', error instanceof Error ? error.message : 'Unknown SSCE harvest failure.');
      }
    },

    async generate(input: unknown): Promise<SsceRouteResult<GenerateResponse>> {
      const parsed = generateRequestSchema.safeParse(input);
      if (!parsed.success) {
        return errorResponse(
          400,
          'SSCE_GENERATE_INVALID',
          'Generate payload failed Zod validation.',
          mapZodIssues(parsed.error)
        );
      }

      try {
        const result = await runSerializableTransactionWithRetry(prisma, async (rawTx) => {
          const tx = rawTx as Prisma.TransactionClient;
          const timestamp = now();
          const scopes = buildScopeDescriptors(parsed.data);
          const scopeMap = new Map(scopes.map((scope) => [scope.scopeType, scope]));
          const requestedScopeOrder = parsed.data.override_scope_order ?? [...DEFAULT_SCOPE_ORDER];
          const signatures = [];

          for (const scopeType of requestedScopeOrder) {
            const scope = scopeMap.get(scopeType);
            if (!scope) {
              continue;
            }

            const signature = await tx.styleSignature.findFirst({
              where: {
                workspaceId: parsed.data.workspace_id,
                scopeType: scope.scopeType,
                scopeKey: scope.scopeKey,
                isCurrent: true
              },
              orderBy: {
                versionNo: 'desc'
              }
            });

            if (signature) {
              signatures.push(signature);
            }
          }

          const compoundSummary =
            signatures.length === 0
              ? ['No prior signatures matched this scope stack; using prompt-only generation.']
              : signatures.map(
                  (signature) =>
                    `${signature.scopeType} -> ${signature.scopeKey} (confidence ${signature.confidenceScore.toFixed(2)}, v${signature.versionNo})`
                );

          const generatedDraft = await tx.artifact.create({
            data: artifactPayloadToCreateInput(
              {
                title: parsed.data.artifact_title ?? 'SSCE generated draft',
                content: [
                  `Prompt: ${parsed.data.prompt}`,
                  '',
                  'Compound style stack:',
                  ...compoundSummary.map((line) => `- ${line}`)
                ].join('\n'),
                content_format: parsed.data.desired_format,
                artifact_kind: 'generated_draft',
                structure_outline: ['opening', 'body', 'closing'],
                metadata: {
                  max_reference_artifacts: parsed.data.max_reference_artifacts
                }
              },
              parsed.data,
              'generated_draft'
            )
          });

          const eventSnapshot = await persistJsonPayload({
            namespace: 'style-events/generate',
            value: {
              request: parsed.data,
              compoundSummary
            }
          });

          const event = await tx.styleEvent.create({
            data: {
              workspaceId: parsed.data.workspace_id,
              eventType: 'generate',
              artifactId: generatedDraft.id,
              generatedDraftArtifactId: generatedDraft.id,
              signatureId: signatures[0]?.id ?? null,
              diffSummary: null,
              payloadSnapshotInline:
                eventSnapshot.inlineJson === null ? null : JSON.stringify(eventSnapshot.inlineJson),
              payloadSnapshotUri: eventSnapshot.externalUri,
              payloadSnapshotSha256: eventSnapshot.sha256,
              payloadSnapshotBytes: eventSnapshot.sizeBytes,
              createdAt: timestamp
            }
          });

          await enqueueOutboxEvent(tx, {
            aggregateId: event.id,
            aggregateType: 'style_event',
            eventType: 'ssce.generate.recorded',
            idempotencyKey: `ssce:generate:${event.id}`,
            payload: {
              workspaceId: parsed.data.workspace_id,
              generatedDraftId: generatedDraft.id,
              appliedSignatureIds: signatures.map((signature) => signature.id)
            }
          });

          return {
            ok: true as const,
            event_id: event.id,
            generated_draft: {
              ...artifactToEnvelope(generatedDraft),
              artifact_kind: 'generated_draft' as const
            },
            applied_signatures: signatures.map(signatureToSnapshot),
            compound_summary: compoundSummary
          };
        });

        return successResponse(generateResponseSchema, result);
      } catch (error) {
        if (error instanceof SsceRouterError) {
          return errorResponse(error.statusCode, error.code, error.message, error.issues);
        }

        return errorResponse(500, 'SSCE_GENERATE_FAILED', error instanceof Error ? error.message : 'Unknown SSCE generate failure.');
      }
    },

    async feedback(input: unknown): Promise<SsceRouteResult<FeedbackResponse>> {
      const parsed = feedbackRequestSchema.safeParse(input);
      if (!parsed.success) {
        return errorResponse(
          400,
          'SSCE_FEEDBACK_INVALID',
          'Feedback payload failed Zod validation.',
          mapZodIssues(parsed.error)
        );
      }

      try {
        const oracleAnalysis = await semanticDiffOracle.analyze({
          context: {
            workspace_id: parsed.data.workspace_id,
            destination_key: parsed.data.destination_key,
            recipient_key: parsed.data.recipient_key,
            task_key: parsed.data.task_key
          },
          generated_draft: parsed.data.generated_draft,
          final_artifact: parsed.data.final_artifact,
          feedback_notes: parsed.data.feedback_notes,
          accepted_reference_artifact_ids: parsed.data.accepted_reference_artifact_ids
        });

        const eventSnapshot = await persistJsonPayload({
          namespace: 'style-events/feedback',
          value: {
            request: parsed.data,
            oracle_analysis: oracleAnalysis
          }
        });

        const result = await runSerializableTransactionWithRetry(prisma, async (rawTx) => {
          const tx = rawTx as Prisma.TransactionClient;
          const timestamp = now();

          if (parsed.data.generated_draft.artifact_id) {
            const knownDraft = await tx.artifact.findUnique({
              where: { id: parsed.data.generated_draft.artifact_id }
            });

            if (!knownDraft) {
              throw new SsceRouterError(
                400,
                'SSCE_GENERATED_DRAFT_UNKNOWN',
                `Generated draft ${parsed.data.generated_draft.artifact_id} does not exist in the SSCE database.`
              );
            }
          }

          const finalArtifact = await tx.artifact.create({
            data: artifactPayloadToCreateInput(parsed.data.final_artifact, parsed.data, 'final_artifact')
          });

          const updatedSignatures = [];
          for (const scope of buildScopeDescriptors(parsed.data)) {
            updatedSignatures.push(
              await appendSignatureFromFeedback(
                tx,
                scope,
                parsed.data,
                oracleAnalysis,
                finalArtifact.id,
                timestamp
              )
            );
          }

          if (parsed.data.generated_draft.artifact_id) {
            await tx.referenceEdge.create({
              data: {
                sourceArtifactId: finalArtifact.id,
                targetArtifactId: parsed.data.generated_draft.artifact_id,
                edgeType: 'finalized_from',
                weight: 1,
                rationale: 'Final artifact accepted after reviewer edits.'
              }
            });
          }

          const event = await tx.styleEvent.create({
            data: {
              workspaceId: parsed.data.workspace_id,
              eventType: 'feedback',
              artifactId: finalArtifact.id,
              generatedDraftArtifactId: parsed.data.generated_draft.artifact_id ?? null,
              finalArtifactId: finalArtifact.id,
              signatureId: updatedSignatures[0]?.id ?? null,
              diffSummary: oracleAnalysis.diff_summary.summary,
              payloadSnapshotInline:
                eventSnapshot.inlineJson === null ? null : JSON.stringify(eventSnapshot.inlineJson),
              payloadSnapshotUri: eventSnapshot.externalUri,
              payloadSnapshotSha256: eventSnapshot.sha256,
              payloadSnapshotBytes: eventSnapshot.sizeBytes,
              createdAt: timestamp
            }
          });

          await enqueueOutboxEvent(tx, {
            aggregateId: event.id,
            aggregateType: 'style_event',
            eventType: 'ssce.feedback.recorded',
            idempotencyKey: `ssce:feedback:${event.id}`,
            payload: {
              workspaceId: parsed.data.workspace_id,
              finalArtifactId: finalArtifact.id,
              updatedSignatureIds: updatedSignatures.map((signature) => signature.id),
              oracleProvider: oracleAnalysis.provider
            }
          });

          return {
            ok: true as const,
            event_id: event.id,
            final_artifact_id: finalArtifact.id,
            diff_summary: oracleAnalysis.diff_summary,
            updated_signature_ids: updatedSignatures.map((signature) => signature.id)
          };
        });

        return successResponse(feedbackResponseSchema, result);
      } catch (error) {
        if (error instanceof SsceRouterError) {
          return errorResponse(error.statusCode, error.code, error.message, error.issues);
        }

        return errorResponse(500, 'SSCE_FEEDBACK_FAILED', error instanceof Error ? error.message : 'Unknown SSCE feedback failure.');
      }
    }
  };
}
