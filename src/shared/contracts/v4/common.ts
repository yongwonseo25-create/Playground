import { z } from 'zod';

export const v4ExecutionModeSchema = z.enum(['zhi', 'hitl']);
export type V4ExecutionMode = z.infer<typeof v4ExecutionModeSchema>;

export const v4DestinationKeySchema = z.enum(['slack', 'jira', 'crm']);
export type V4DestinationKey = z.infer<typeof v4DestinationKeySchema>;

export const v4StructuredFieldKindSchema = z.enum(['text', 'textarea']);
export type V4StructuredFieldKind = z.infer<typeof v4StructuredFieldKindSchema>;

export const v4StructuredFieldSchema = z
  .object({
    key: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(128),
    value: z.string().trim().max(5_000),
    kind: v4StructuredFieldKindSchema,
    required: z.boolean().default(true),
    placeholder: z.string().trim().max(160).optional()
  })
  .strict();

export type V4StructuredField = z.infer<typeof v4StructuredFieldSchema>;

export const v4ApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'processing',
  'rejected',
  'executed',
  'failed'
]);

export type V4ApprovalStatus = z.infer<typeof v4ApprovalStatusSchema>;

export const v4DestinationSchema = z
  .object({
    key: v4DestinationKeySchema,
    label: z.string().trim().min(1).max(128),
    mode: v4ExecutionModeSchema,
    requiresApproval: z.boolean(),
    description: z.string().trim().min(1).max(280),
    accent: z.enum(['cyan', 'amber', 'emerald']),
    makeNamespace: z.string().trim().min(1).max(64)
  })
  .strict();

export type V4Destination = z.infer<typeof v4DestinationSchema>;

export const v4DestinationCatalog = z.array(v4DestinationSchema).parse([
  {
    key: 'slack',
    label: 'Slack',
    mode: 'zhi',
    requiresApproval: false,
    description: 'Speak once and push the action straight into the team channel.',
    accent: 'cyan',
    makeNamespace: 'slack_message'
  },
  {
    key: 'jira',
    label: 'Jira',
    mode: 'zhi',
    requiresApproval: false,
    description: 'Turn the captured request into an execution ticket immediately.',
    accent: 'amber',
    makeNamespace: 'jira_issue'
  },
  {
    key: 'crm',
    label: 'CRM',
    mode: 'hitl',
    requiresApproval: true,
    description: 'Draft a structured customer card, review it, then approve execution.',
    accent: 'emerald',
    makeNamespace: 'crm_record'
  }
]);

export function listV4Destinations(mode?: V4ExecutionMode): V4Destination[] {
  if (!mode) {
    return [...v4DestinationCatalog];
  }

  return v4DestinationCatalog.filter((destination) => destination.mode === mode);
}

export function getV4Destination(destinationKey: string): V4Destination | null {
  return v4DestinationCatalog.find((destination) => destination.key === destinationKey) ?? null;
}

export const v4ExecutionCreditChargeResultSchema = z
  .object({
    accountKey: z.string().trim().min(1).max(128),
    remainingCredits: z.number().int().nonnegative(),
    deducted: z.boolean(),
    version: z.number().int().nonnegative()
  })
  .strict();

export type V4ExecutionCreditChargeResult = z.infer<typeof v4ExecutionCreditChargeResultSchema>;

export const v4DispatchStatusSchema = z.enum(['queued', 'processing', 'executed', 'failed']);
export type V4DispatchStatus = z.infer<typeof v4DispatchStatusSchema>;

export const v4ExecutionWebhookPayloadSchema = z
  .object({
    mode: v4ExecutionModeSchema,
    referenceId: z.string().trim().min(1).max(128),
    clientRequestId: z.string().trim().min(1).max(128),
    destinationKey: v4DestinationKeySchema,
    destinationLabel: z.string().trim().min(1).max(128),
    transcriptText: z.string().trim().min(1).max(20_000),
    structuredFields: z.array(v4StructuredFieldSchema).default([]),
    structuredPayload: z.record(z.string(), z.unknown()).default({}),
    sessionId: z.string().trim().max(128).optional(),
    sttProvider: z.enum(['whisper', 'return-zero']).default('whisper'),
    audioDurationSec: z.number().nonnegative().default(0),
    executedAt: z.string().datetime({ offset: true })
  })
  .strict();

export type V4ExecutionWebhookPayload = z.infer<typeof v4ExecutionWebhookPayloadSchema>;
