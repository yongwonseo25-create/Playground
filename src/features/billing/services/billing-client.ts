'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  paymentCheckoutResponseSchema,
  type PaymentCheckoutRequest
} from '@/shared/contracts/payment-checkout';
import { userCreditsResponseSchema, type UserCreditsResponse } from '@/shared/contracts/v3-user-credits';

type FetchLike = typeof fetch;

type StripeLoader = (publishableKey: string) => Promise<Stripe | null>;

type RedirectResult = Awaited<ReturnType<Stripe['redirectToCheckout']>>;

export function getStripeTestPublishableKey(
  rawValue: string | undefined = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
): string {
  const resolved = rawValue?.trim();

  if (!resolved) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing.');
  }

  if (!resolved.startsWith('pk_test_')) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_.');
  }

  return resolved;
}

type StartCheckoutOptions = Pick<
  PaymentCheckoutRequest,
  'userId' | 'creditsDelta' | 'successPath' | 'cancelPath'
> & {
  fetchImpl?: FetchLike;
  stripeLoader?: StripeLoader;
  publishableKey?: string;
  requestIdFactory?: () => string;
  locationAssign?: (url: string) => void;
};

function createDefaultRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  throw new Error('crypto.randomUUID is unavailable in the current runtime.');
}

function resolveLocationAssign(): ((url: string) => void) | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (url: string) => {
    window.location.assign(url);
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Server response was not valid JSON.');
  }
}

export async function loadBillingCredits(
  userId: number,
  fetchImpl: FetchLike = fetch
): Promise<UserCreditsResponse> {
  const response = await fetchImpl(`/api/user/credits?userId=${userId}`, {
    method: 'GET',
    cache: 'no-store'
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'Unable to load user credits.';
    throw new Error(message);
  }

  return userCreditsResponseSchema.parse(payload);
}

export async function startStripeCheckout({
  userId,
  creditsDelta,
  successPath,
  cancelPath,
  fetchImpl = fetch,
  stripeLoader = loadStripe,
  publishableKey,
  requestIdFactory = createDefaultRequestId,
  locationAssign = resolveLocationAssign()
}: StartCheckoutOptions) {
  const stripeKey = getStripeTestPublishableKey(publishableKey);
  const requestId = requestIdFactory();

  const response = await fetchImpl('/api/payment/checkout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      requestId,
      creditsDelta,
      successPath,
      cancelPath
    })
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'Unable to create a Stripe checkout session.';
    throw new Error(message);
  }

  const parsed = paymentCheckoutResponseSchema.parse(payload);
  const stripe = await stripeLoader(stripeKey);

  if (!stripe) {
    if (locationAssign) {
      locationAssign(parsed.checkoutUrl);
      return parsed;
    }

    throw new Error('Stripe.js failed to initialize.');
  }

  const redirectResult = (await stripe.redirectToCheckout({
    sessionId: parsed.sessionId
  })) as RedirectResult;

  if (redirectResult?.error) {
    if (locationAssign) {
      locationAssign(parsed.checkoutUrl);
      return parsed;
    }

    throw new Error(redirectResult.error.message);
  }

  return parsed;
}
