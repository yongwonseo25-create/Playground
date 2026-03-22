import { z } from 'zod';

export const v4InfraModeSchema = z.enum(['local', 'neon-http']);
export const V4_IDEMPOTENCY_TTL_HOURS = 72 as const;

export const v4InfraJobSchema = z.object({
  idempotencyKey: z.string().min(1),
  scope: z.string().min(1).default('v4-infra'),
  title: z.string().min(1),
  summary: z.string().min(1),
  neonSql: z.string().min(1),
  neonParams: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).default([]),
  notionDatabaseId: z.string().min(1),
  notionStatus: z.string().min(1).default('Inbox'),
  notionCategory: z.string().min(1).default('operations'),
  ttlHours: z.literal(V4_IDEMPOTENCY_TTL_HOURS).default(V4_IDEMPOTENCY_TTL_HOURS)
});

export type V4InfraJob = z.infer<typeof v4InfraJobSchema>;

export const neonOneShotQueryRequestSchema = z.object({
  sql: z.string().min(1),
  params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).default([]),
  timeoutMs: z.number().int().positive().max(60_000).default(15_000)
});

export const neonOneShotQueryResponseSchema = z.object({
  rowCount: z.number().int().nonnegative(),
  rows: z.array(z.record(z.string(), z.unknown()))
});

export type NeonOneShotQueryRequest = z.infer<typeof neonOneShotQueryRequestSchema>;
export type NeonOneShotQueryResponse = z.infer<typeof neonOneShotQueryResponseSchema>;

export const notionDirectWriteRequestSchema = z.object({
  databaseId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  idempotencyKey: z.string().min(1),
  scope: z.string().min(1),
  status: z.string().min(1),
  category: z.string().min(1),
  expiresAt: z.string().min(1),
  createdAt: z.string().min(1),
  rowCount: z.number().int().nonnegative(),
  sqlPreview: z.string().min(1)
});

export const notionDirectWriteResponseSchema = z.object({
  pageId: z.string().min(1),
  url: z.string().url()
});

export type NotionDirectWriteRequest = z.infer<typeof notionDirectWriteRequestSchema>;
export type NotionDirectWriteResponse = z.infer<typeof notionDirectWriteResponseSchema>;
