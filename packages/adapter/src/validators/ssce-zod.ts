import { z, type ZodError } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);
const optionalNonEmptyStringSchema = z.string().trim().min(1).optional();
const nullableNonEmptyStringSchema = z.string().trim().min(1).nullable();
const sscePrimitiveValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);
const ssceMetadataSchema = z.record(z.string(), sscePrimitiveValueSchema);

export const ssceScopeTypeSchema = z.enum(['global', 'destination', 'recipient', 'task']);
export const artifactKindSchema = z.enum(['reference', 'generated_draft', 'final_artifact']);
export const contentFormatSchema = z.enum(['plain_text', 'markdown', 'html', 'json']);
export const styleEventTypeSchema = z.enum(['harvest', 'generate', 'feedback']);
export const referenceEdgeTypeSchema = z.enum([
  'references',
  'derived_from',
  'context_for',
  'finalized_from'
]);

export const artifactPayloadSchema = z
  .object({
    external_id: optionalNonEmptyStringSchema,
    title: nullableNonEmptyStringSchema.optional(),
    content: nonEmptyStringSchema,
    content_format: contentFormatSchema.default('markdown'),
    artifact_kind: artifactKindSchema.default('reference'),
    structure_outline: z.array(nonEmptyStringSchema).default([]),
    metadata: ssceMetadataSchema.default({})
  })
  .strict();

export const scopeContextSchema = z
  .object({
    workspace_id: nonEmptyStringSchema,
    destination_key: optionalNonEmptyStringSchema,
    recipient_key: optionalNonEmptyStringSchema,
    task_key: optionalNonEmptyStringSchema
  })
  .strict();

export const traitSignalSchema = z
  .object({
    trait_key: nonEmptyStringSchema,
    evidence: nonEmptyStringSchema,
    weight: z.number().min(0).max(1).default(0.5)
  })
  .strict();

export const referenceLinkInputSchema = z
  .object({
    target_artifact_external_id: nonEmptyStringSchema,
    edge_type: referenceEdgeTypeSchema.default('references'),
    weight: z.number().min(0).max(1).default(0.5),
    rationale: optionalNonEmptyStringSchema
  })
  .strict();

export const harvestRequestSchema = scopeContextSchema
  .extend({
    source_artifact: artifactPayloadSchema.extend({
      artifact_kind: z.literal('reference').default('reference')
    }),
    related_artifacts: z.array(artifactPayloadSchema).default([]),
    content_signals: z.array(traitSignalSchema).min(1),
    reference_links: z.array(referenceLinkInputSchema).default([])
  })
  .strict();

export const signatureSnapshotSchema = z
  .object({
    id: nonEmptyStringSchema,
    scope_type: ssceScopeTypeSchema,
    scope_key: nonEmptyStringSchema,
    confidence_score: z.number().min(0).max(1),
    signal_count: z.number().int().min(0)
  })
  .strict();

export const harvestResponseSchema = z
  .object({
    ok: z.literal(true),
    artifact_id: nonEmptyStringSchema,
    event_id: nonEmptyStringSchema,
    harvested_signatures: z.array(signatureSnapshotSchema).min(1),
    linked_reference_edges: z.number().int().min(0)
  })
  .strict();

export const generateRequestSchema = scopeContextSchema
  .extend({
    prompt: nonEmptyStringSchema,
    artifact_title: optionalNonEmptyStringSchema,
    desired_format: contentFormatSchema.default('markdown'),
    max_reference_artifacts: z.number().int().min(0).max(50).default(5),
    override_scope_order: z.array(ssceScopeTypeSchema).min(1).max(4).optional()
  })
  .strict();

export const artifactEnvelopeSchema = z
  .object({
    id: nonEmptyStringSchema,
    external_id: nullableNonEmptyStringSchema,
    title: nullableNonEmptyStringSchema,
    content: nonEmptyStringSchema,
    content_format: contentFormatSchema,
    artifact_kind: artifactKindSchema,
    structure_outline: z.array(nonEmptyStringSchema),
    metadata: ssceMetadataSchema
  })
  .strict();

export const generateResponseSchema = z
  .object({
    ok: z.literal(true),
    event_id: nonEmptyStringSchema,
    generated_draft: artifactEnvelopeSchema.extend({
      artifact_kind: z.literal('generated_draft')
    }),
    applied_signatures: z.array(signatureSnapshotSchema),
    compound_summary: z.array(nonEmptyStringSchema)
  })
  .strict();

export const feedbackArtifactSchema = z
  .object({
    artifact_id: optionalNonEmptyStringSchema,
    title: nullableNonEmptyStringSchema.optional(),
    content: nonEmptyStringSchema,
    content_format: contentFormatSchema.default('markdown'),
    structure_outline: z.array(nonEmptyStringSchema).default([]),
    metadata: ssceMetadataSchema.default({})
  })
  .strict();

export const feedbackRequestSchema = scopeContextSchema
  .extend({
    generated_draft: feedbackArtifactSchema,
    final_artifact: feedbackArtifactSchema,
    feedback_notes: z.string().trim().optional(),
    accepted_reference_artifact_ids: z.array(nonEmptyStringSchema).default([])
  })
  .strict();

export const diffSummarySchema = z
  .object({
    added_sentences: z.number().int().min(0),
    removed_sentences: z.number().int().min(0),
    changed_structure_sections: z.number().int().min(0),
    summary: nonEmptyStringSchema
  })
  .strict();

export const feedbackResponseSchema = z
  .object({
    ok: z.literal(true),
    event_id: nonEmptyStringSchema,
    final_artifact_id: nonEmptyStringSchema,
    diff_summary: diffSummarySchema,
    updated_signature_ids: z.array(nonEmptyStringSchema)
  })
  .strict();

export const ssceIssueSchema = z
  .object({
    code: nonEmptyStringSchema,
    path: z.string(),
    message: nonEmptyStringSchema
  })
  .strict();

export const ssceErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: nonEmptyStringSchema,
        message: nonEmptyStringSchema,
        issues: z.array(ssceIssueSchema)
      })
      .strict()
  })
  .strict();

export const ssceRouteContractSchema = z
  .object({
    harvest: z.object({ request: harvestRequestSchema, response: harvestResponseSchema }).strict(),
    generate: z.object({ request: generateRequestSchema, response: generateResponseSchema }).strict(),
    feedback: z.object({ request: feedbackRequestSchema, response: feedbackResponseSchema }).strict()
  })
  .strict();

export function mapZodIssues(error: ZodError): SsceIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.join('.'),
    message: issue.message
  }));
}

export type SsceScopeType = z.infer<typeof ssceScopeTypeSchema>;
export type ArtifactKind = z.infer<typeof artifactKindSchema>;
export type ContentFormat = z.infer<typeof contentFormatSchema>;
export type StyleEventType = z.infer<typeof styleEventTypeSchema>;
export type ReferenceEdgeType = z.infer<typeof referenceEdgeTypeSchema>;
export type ScopeContext = z.infer<typeof scopeContextSchema>;
export type ArtifactPayload = z.infer<typeof artifactPayloadSchema>;
export type TraitSignal = z.infer<typeof traitSignalSchema>;
export type ReferenceLinkInput = z.infer<typeof referenceLinkInputSchema>;
export type HarvestRequest = z.infer<typeof harvestRequestSchema>;
export type HarvestResponse = z.infer<typeof harvestResponseSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type GenerateResponse = z.infer<typeof generateResponseSchema>;
export type FeedbackArtifact = z.infer<typeof feedbackArtifactSchema>;
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;
export type SsceIssue = z.infer<typeof ssceIssueSchema>;
export type SsceErrorResponse = z.infer<typeof ssceErrorResponseSchema>;
