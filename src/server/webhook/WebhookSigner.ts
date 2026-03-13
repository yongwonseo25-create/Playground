import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignatureInput = {
  timestamp: string;
  body: string;
};

export function buildSignatureMessage(input: SignatureInput): string {
  return `${input.timestamp}.${input.body}`;
}

export function createWebhookSignature(input: SignatureInput, secret: string): string {
  const message = buildSignatureMessage(input);
  return createHmac('sha256', secret).update(message).digest('hex');
}

export function verifyWebhookSignature(
  input: SignatureInput,
  secret: string,
  expectedSignature: string
): boolean {
  const actual = createWebhookSignature(input, secret);
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
