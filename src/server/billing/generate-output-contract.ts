import { z } from 'zod';

export const DEFAULT_OUTPUT_COST_CREDITS = 10;

export const generateOutputRequestSchema = z.object({
  clientRequestId: z
    .string()
    .trim()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/, 'clientRequestId may only contain URL-safe id characters.'),
  prompt: z.string().trim().min(1).max(8_000),
  outputType: z.enum(['summary', 'action-plan', 'reply', 'structured']).default('summary'),
  metadata: z
    .object({
      sourceSessionId: z.string().trim().max(128).optional(),
      requestedBy: z.string().trim().max(128).optional()
    })
    .optional()
});

export type GenerateOutputRequest = z.infer<typeof generateOutputRequestSchema>;
