import { z } from 'zod';

const stripeMetadataSchema = z.object({
  userId: z.string().trim().regex(/^\d+$/),
  requestId: z.string().uuid(),
  creditsDelta: z.string().trim().regex(/^\d+$/).optional()
});

const stripeObjectSchema = z
  .object({
    id: z.string().trim().min(1),
    amount_total: z.number().int().nonnegative().optional(),
    amount_received: z.number().int().nonnegative().optional(),
    amount: z.number().int().nonnegative().optional(),
    currency: z.string().trim().min(1).optional(),
    payment_intent: z.string().trim().min(1).optional(),
    metadata: stripeMetadataSchema
  })
  .passthrough();

export const stripeWebhookEventSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  livemode: z.boolean().optional().default(false),
  created: z.number().int().nonnegative().optional(),
  data: z.object({
    object: stripeObjectSchema
  })
});

export type StripeWebhookEvent = z.infer<typeof stripeWebhookEventSchema>;

export const stripeWebhookAckSchema = z.object({
  ok: z.literal(true),
  status: z.enum(['processed', 'duplicate', 'ignored']),
  eventId: z.string().trim().min(1),
  requestId: z.string().uuid().optional()
});

export type StripeWebhookAck = z.infer<typeof stripeWebhookAckSchema>;
