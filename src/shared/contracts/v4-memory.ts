import { z } from 'zod';

export const memorySourceTypeSchema = z.enum(['transcript', 'note', 'chat']);
export const memoryKindSchema = z.enum(['fact', 'preference', 'task', 'profile']);
export const memoryRetentionClassSchema = z.enum(['short_term', 'preference']);
export const memoryProviderSchema = z.enum(['local', 'openai']);

export const memoryExtractionRequestSchema = z
  .object({
    userId: z.number().int().positive(),
    sourceText: z.string().trim().min(1).max(20_000),
    sourceType: memorySourceTypeSchema.default('transcript'),
    sourceId: z.string().trim().min(1).max(128).optional(),
    observedAt: z.string().datetime({ offset: true }).optional()
  })
  .strict();

export type MemoryExtractionRequest = z.infer<typeof memoryExtractionRequestSchema>;

export const memoryCandidateSchema = z
  .object({
    content: z.string().trim().min(1).max(1_000),
    kind: memoryKindSchema,
    retentionClass: memoryRetentionClassSchema,
    ttlDays: z.number().int().positive(),
    confidence: z.number().min(0).max(1)
  })
  .strict();

export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;

export const memoryExtractionModelResponseSchema = z
  .object({
    summary: z.string().trim().min(1).max(2_000),
    items: z.array(memoryCandidateSchema).max(20)
  })
  .strict();

export type MemoryExtractionModelResponse = z.infer<typeof memoryExtractionModelResponseSchema>;

export const memoryRecordSchema = z
  .object({
    memoryId: z.string().uuid(),
    userId: z.number().int().positive(),
    content: z.string().trim().min(1).max(1_000),
    kind: memoryKindSchema,
    retentionClass: memoryRetentionClassSchema,
    ttlDays: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
    sourceText: z.string().trim().min(1).max(20_000),
    sourceType: memorySourceTypeSchema,
    sourceId: z.string().trim().min(1).max(128).optional(),
    createdAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true })
  })
  .strict();

export type MemoryRecord = z.infer<typeof memoryRecordSchema>;

export const memoryExtractionResponseSchema = z
  .object({
    ok: z.literal(true),
    provider: memoryProviderSchema,
    summary: z.string().trim().min(1).max(2_000),
    purgedExpiredCount: z.number().int().nonnegative(),
    items: z.array(memoryRecordSchema)
  })
  .strict();

export type MemoryExtractionResponse = z.infer<typeof memoryExtractionResponseSchema>;

export const memoryListResponseSchema = z
  .object({
    ok: z.literal(true),
    provider: memoryProviderSchema,
    purgedExpiredCount: z.number().int().nonnegative(),
    items: z.array(memoryRecordSchema)
  })
  .strict();

export type MemoryListResponse = z.infer<typeof memoryListResponseSchema>;

export const memoryDeleteRequestSchema = z
  .object({
    userId: z.number().int().positive(),
    memoryIds: z.array(z.string().uuid()).max(1_000).optional()
  })
  .strict();

export type MemoryDeleteRequest = z.infer<typeof memoryDeleteRequestSchema>;

export const memoryDeleteResponseSchema = z
  .object({
    ok: z.literal(true),
    deletedCount: z.number().int().nonnegative()
  })
  .strict();

export type MemoryDeleteResponse = z.infer<typeof memoryDeleteResponseSchema>;
