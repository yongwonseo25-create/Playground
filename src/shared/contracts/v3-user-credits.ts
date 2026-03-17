import { z } from 'zod';

export const userCreditsQuerySchema = z
  .object({
    userId: z.coerce.number().int().positive()
  })
  .strict();

export const userCreditsResponseSchema = z
  .object({
    ok: z.literal(true),
    userId: z.number().int().positive(),
    credits: z.number().int().nonnegative(),
    source: z.enum(['cache', 'database'])
  })
  .strict();

export type UserCreditsResponse = z.infer<typeof userCreditsResponseSchema>;
