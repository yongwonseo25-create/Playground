import type { Artifact, Prisma, PrismaClient, StyleSignature } from '@prisma/client';
import type { ZodType } from 'zod';
import type {
  ArtifactPayload,
  FeedbackArtifact,
  FeedbackRequest,
  FeedbackResponse,
  GenerateRequest,
  GenerateResponse,
  HarvestRequest,
  HarvestResponse,
  ReferenceLinkInput,
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
import type { ArtifactRecord } from '@ssce/db/schema/ssce-schema';
import { getSscePrismaClient } from '@ssce/db/ssce-prisma';
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
  artifactKindOverride?: ArtifactRecord['artifactKind']
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

async function upsertSignatureFromHarvest(
  db: SsceDbClient,
  scope: ScopeDescriptor,
  context: ScopeContext,
  signals: TraitSignal[],
  sourceArtifactId: string
) {
  const summary = createTraitSummary(signals);

  return db.styleSignature.upsert({
    where: {
      workspaceId_scopeType_scopeKey: {
        workspaceId: context.workspace_id,
        scopeType: scope.scopeType,
        scopeKey: scope.scopeKey
      }
    },
    update: {
      signatureVersion: { increment: 1 },
      signalCount: { increment: signals.length },
      confidenceScore: { set: 0.95 }, // Harvest adds a significant baseline confidence
      traitsJson: serializeJson({
        summary,
        signal_count: signals.length, // This will be overwritten by a proper merge if needed, but for now we follow the existing pattern
        last_harvest_source_artifact_id: sourceArtifactId
      }),
      sourceArtifactId
    },
    create: {
      workspaceId: context.workspace_id,
      scopeType: scope.scopeType,
      scopeKey: scope.scopeKey,
      destinationKey: scope.destinationKey,
      recipientKey: scope.recipientKey,
      taskKey: scope.taskKey,
      signatureVersion: 1,
      signalCount: signals.length,
      confidenceScore: Math.min(1, 0.35 + signals.length * 0.1),
      traitsJson: serializeJson({
        summary,
        signal_count: signals.length
      }),
      sourceArtifactId
    }
  });
}

async function upsertSignatureFromFeedback(
  db: SsceDbClient,
  scope: ScopeDescriptor,
  context: ScopeContext,
  oracleAnalysis: SemanticDiffOracleResult,
  sourceArtifactId: string
) {
  const scopeUpdate = oracleAnalysis.scope_updates[scope.scopeType];
  const summary = createTraitSummary(scopeUpdate.trait_signals);

  return db.styleSignature.upsert({
    where: {
      workspaceId_scopeType_scopeKey: {
        workspaceId: context.workspace_id,
        scopeType: scope.scopeType,
        scopeKey: scope.scopeKey
      }
    },
    update: {
      signatureVersion: { increment: 1 },
      signalCount: { increment: scopeUpdate.signal_count_delta },
      confidenceScore: { increment: scopeUpdate.confidence_delta },
      traitsJson: serializeJson({
        summary,
        last_oracle_provider: oracleAnalysis.provider,
        last_diff_summary: oracleAnalysis.diff_summary.summary,
        last_diff_snapshot: oracleAnalysis.diff_summary,
        last_lexical_changes: oracleAnalysis.lexical_changes,
        last_structure_changes: oracleAnalysis.structure_changes,
        last_tone_delta: oracleAnalysis.tone_delta,
        last_scope_update: scopeUpdate
      }),
      sourceArtifactId
    },
    create: {
      workspaceId: context.workspace_id,
      scopeType: scope.scopeType,
      scopeKey: scope.scopeKey,
      destinationKey: scope.destinationKey,
      recipientKey: scope.recipientKey,
      taskKey: scope.taskKey,
      signatureVersion: 1,
      signalCount: scopeUpdate.signal_count_delta,
      confidenceScore: Math.min(1, Math.max(0.35, 0.35 + scopeUpdate.confidence_delta)),
      traitsJson: serializeJson({
        bootstrap_from_feedback: true,
        summary,
        last_oracle_provider: oracleAnalysis.provider,
        last_diff_summary: oracleAnalysis.diff_summary.summary,
        last_diff_snapshot: oracleAnalysis.diff_summary,
        last_lexical_changes: oracleAnalysis.lexical_changes,
        last_structure_changes: oracleAnalysis.structure_changes,
        last_tone_delta: oracleAnalysis.tone_delta,
        last_scope_update: scopeUpdate
      }),
      sourceArtifactId
    }
  });
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
        const result = await prisma.$transaction(async (tx) => {
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
              await upsertSignatureFromHarvest(
                tx,
                scope,
                parsed.data,
                parsed.data.content_signals,
                sourceArtifact.id
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
              payloadSnapshot: serializeJson(parsed.data),
              createdAt: now()
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
        const result = await prisma.$transaction(async (tx) => {
          const scopes = buildScopeDescriptors(parsed.data);
          const scopeMap = new Map(scopes.map((scope) => [scope.scopeType, scope]));
          const requestedScopeOrder = parsed.data.override_scope_order ?? [...DEFAULT_SCOPE_ORDER];
          const signatures = [];

          for (const scopeType of requestedScopeOrder) {
            const scope = scopeMap.get(scopeType);
            if (!scope) {
              continue;
            }

            const signature = await tx.styleSignature.findUnique({
              where: {
                workspaceId_scopeType_scopeKey: {
                  workspaceId: parsed.data.workspace_id,
                  scopeType: scope.scopeType,
                  scopeKey: scope.scopeKey
                }
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
                    `${signature.scopeType} -> ${signature.scopeKey} (confidence ${signature.confidenceScore.toFixed(2)})`
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

          const event = await tx.styleEvent.create({
            data: {
              workspaceId: parsed.data.workspace_id,
              eventType: 'generate',
              artifactId: generatedDraft.id,
              generatedDraftArtifactId: generatedDraft.id,
              signatureId: signatures[0]?.id ?? null,
              diffSummary: null,
              payloadSnapshot: serializeJson({
                request: parsed.data,
                compoundSummary
              }),
              createdAt: now()
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

        const result = await prisma.$transaction(async (tx) => {
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
              await upsertSignatureFromFeedback(tx, scope, parsed.data, oracleAnalysis, finalArtifact.id)
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
                payloadSnapshot: serializeJson({
                  request: parsed.data,
                  oracle_analysis: oracleAnalysis
                }),
                createdAt: now()
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
