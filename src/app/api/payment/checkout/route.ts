import { NextResponse } from 'next/server';
import { formatZodIssues } from '@/shared/contracts/common';
import {
  paymentCheckoutRequestSchema,
  paymentCheckoutResponseSchema
} from '@/shared/contracts/payment-checkout';
import { createStripeCheckoutSession } from '@/server/payments/stripe-checkout';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsedBody = paymentCheckoutRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid checkout request contract.',
        issues: formatZodIssues(parsedBody.error)
      },
      { status: 400 }
    );
  }

  try {
    const requestUrl = new URL(request.url);
    const session = await createStripeCheckoutSession({
      ...parsedBody.data,
      origin: requestUrl.origin
    });

    return NextResponse.json(
      paymentCheckoutResponseSchema.parse({
        ok: true,
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        requestId: session.requestId
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe checkout creation failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
