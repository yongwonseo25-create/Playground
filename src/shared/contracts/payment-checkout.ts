import { z } from 'zod';

export const paymentCheckoutRequestSchema = z
  .object({
    userId: z.coerce.number().int().positive(),
    requestId: z.uuid(),
    creditsDelta: z.coerce.number().int().positive().max(100000),
    successPath: z.string().trim().min(1).startsWith('/').optional(),
    cancelPath: z.string().trim().min(1).startsWith('/').optional()
  })
  .strict();

export type PaymentCheckoutRequest = z.infer<typeof paymentCheckoutRequestSchema>;

export const paymentCheckoutResponseSchema = z
  .object({
    ok: z.literal(true),
    sessionId: z.string().min(1),
    checkoutUrl: z.url(),
    requestId: z.uuid()
  })
  .strict();

export type PaymentCheckoutResponse = z.infer<typeof paymentCheckoutResponseSchema>;
