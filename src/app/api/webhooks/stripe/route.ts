import { NextResponse } from 'next/server';
import { formatZodIssues } from '@/shared/contracts/common';
import { setCachedUserCredits } from '@/server/cache/credit-cache';
import {
  stripeWebhookAckSchema,
  stripeWebhookEventSchema,
  type StripeWebhookEvent
} from '@/shared/contracts/stripe-webhook';
import { getV3ServerEnv } from '@/server/config/v3-env';
import { withV3Client } from '@/server/db/v3-pg';
import { processStripePayment } from '@/server/payments/payment-core';
import { verifyStripeSignature } from '@/server/payments/stripe-signature';

export const runtime = 'nodejs';

const SUPPORTED_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'payment_intent.succeeded',
  'charge.succeeded'
]);

function extractPaymentInput(event: StripeWebhookEvent) {
  const object = event.data.object;
  const amount = object.amount_total ?? object.amount_received ?? object.amount ?? 0;
  const currency = (object.currency ?? 'usd').toLowerCase();
  const userId = Number(object.metadata.userId);
  const requestId = object.metadata.requestId;
  const creditsDelta = Number(object.metadata.creditsDelta ?? Math.max(1, Math.floor(amount / 100)));

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Stripe metadata.userId must be a positive integer string.');
  }

  if (!Number.isInteger(creditsDelta) || creditsDelta <= 0) {
    throw new Error('Stripe metadata.creditsDelta must be a positive integer string.');
  }

  return {
    eventId: event.id,
    eventType: event.type,
    userId,
    requestId,
    amount,
    currency,
    creditsDelta,
    stripeObjectId: object.id,
    stripeChargeId: object.payment_intent,
    livemode: event.livemode,
    sourceCreatedAt: event.created ? new Date(event.created * 1000) : undefined
  };
}

export async function POST(request: Request) {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ ok: false, error: 'Unable to read raw webhook body.' }, { status: 400 });
  }

  const env = getV3ServerEnv();
  const signature = request.headers.get('stripe-signature');

  try {
    verifyStripeSignature({
      payload: rawBody,
      header: signature,
      secret: env.STRIPE_WEBHOOK_SECRET,
      toleranceSeconds: env.STRIPE_WEBHOOK_TOLERANCE_SEC
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe signature verification failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid Stripe webhook JSON.' }, { status: 400 });
  }

  const parsedEvent = stripeWebhookEventSchema.safeParse(parsedJson);
  if (!parsedEvent.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid Stripe webhook payload contract.',
        issues: formatZodIssues(parsedEvent.error)
      },
      { status: 400 }
    );
  }

  const event = parsedEvent.data;
  if (env.NEXT_PUBLIC_APP_ENV !== 'production' && event.livemode) {
    return NextResponse.json({ ok: false, error: 'Live mode Stripe events are rejected outside production.' }, { status: 400 });
  }

  if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
    return NextResponse.json(
      stripeWebhookAckSchema.parse({
        ok: true,
        status: 'ignored',
        eventId: event.id
      })
    );
  }

  let paymentInput;
  try {
    paymentInput = extractPaymentInput(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Stripe payment metadata.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const result = await withV3Client((client) => processStripePayment(client, paymentInput));

  if (result.status === 'processed') {
    await setCachedUserCredits(paymentInput.userId, result.newCredits);
  }

  return NextResponse.json(
    stripeWebhookAckSchema.parse({
      ok: true,
      status: result.status,
      eventId: result.eventId,
      requestId: result.requestId
    })
  );
}
