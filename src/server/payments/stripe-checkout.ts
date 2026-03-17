import Stripe from 'stripe';
import type { PaymentCheckoutRequest } from '@/shared/contracts/payment-checkout';
import { getV3StripeCheckoutEnv } from '@/server/config/v3-env';

export type StripeCheckoutSessionResult = {
  sessionId: string;
  checkoutUrl: string;
  requestId: string;
};

type CheckoutSessionInput = PaymentCheckoutRequest & {
  origin: string;
};

export type StripeLike = {
  checkout: {
    sessions: {
      create(input: Stripe.Checkout.SessionCreateParams): Promise<{
        id: string;
        url: string | null;
      }>;
    };
  };
};

export function getStripeClient(): Stripe {
  const env = getV3StripeCheckoutEnv();
  return new Stripe(env.STRIPE_API_KEY);
}

function resolveOrigin(origin: string): string {
  const trimmed = origin.trim();
  if (!trimmed) {
    throw new Error('Checkout origin is required.');
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function resolvePath(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export async function createStripeCheckoutSession(
  input: CheckoutSessionInput,
  stripeClient: StripeLike = getStripeClient()
): Promise<StripeCheckoutSessionResult> {
  const env = getV3StripeCheckoutEnv();
  const origin = resolveOrigin(input.origin);
  const successPath = resolvePath(input.successPath ?? env.STRIPE_CHECKOUT_SUCCESS_PATH);
  const cancelPath = resolvePath(input.cancelPath ?? env.STRIPE_CHECKOUT_CANCEL_PATH);
  const amountCents = input.creditsDelta * 100;

  const session = await stripeClient.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    success_url: `${origin}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${cancelPath}`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: `VOXERA Credits x${input.creditsDelta}`,
            description: 'Test-mode checkout session for VOXERA V3 credits.'
          }
        }
      }
    ],
    metadata: {
      userId: String(input.userId),
      requestId: input.requestId,
      creditsDelta: String(input.creditsDelta)
    }
  });

  if (!session.url) {
    throw new Error('Stripe checkout session did not return a redirect URL.');
  }

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
    requestId: input.requestId
  };
}
