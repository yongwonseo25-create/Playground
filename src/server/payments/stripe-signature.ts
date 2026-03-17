import { createHmac, timingSafeEqual } from 'node:crypto';

type StripeSignatureOptions = {
  payload: string;
  header: string | null;
  secret: string;
  toleranceSeconds: number;
  now?: () => number;
};

function parseHeader(header: string): { timestamp: number; signatures: string[] } {
  const fragments = header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const timestampPart = fragments.find((fragment) => fragment.startsWith('t='));
  const v1Parts = fragments.filter((fragment) => fragment.startsWith('v1='));

  if (!timestampPart || v1Parts.length === 0) {
    throw new Error('Malformed Stripe-Signature header.');
  }

  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error('Invalid Stripe-Signature timestamp.');
  }

  return {
    timestamp,
    signatures: v1Parts.map((fragment) => fragment.slice(3)).filter(Boolean)
  };
}

function secureCompare(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyStripeSignature({
  payload,
  header,
  secret,
  toleranceSeconds,
  now = Date.now
}: StripeSignatureOptions): { timestamp: number } {
  if (!header) {
    throw new Error('Missing Stripe-Signature header.');
  }

  const parsed = parseHeader(header);
  const ageSeconds = Math.abs(Math.floor(now() / 1000) - parsed.timestamp);
  if (ageSeconds > toleranceSeconds) {
    throw new Error('Stripe webhook signature timestamp is outside the tolerance window.');
  }

  const signedPayload = `${parsed.timestamp}.${payload}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const valid = parsed.signatures.some((signature) => secureCompare(expected, signature));

  if (!valid) {
    throw new Error('Stripe webhook signature verification failed.');
  }

  return { timestamp: parsed.timestamp };
}
