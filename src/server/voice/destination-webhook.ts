import { createWebhookSignature } from '@/server/webhook/WebhookSigner';
import { makeWebhookPayloadSchema, type MakeWebhookPayload } from '@/shared/contracts/voice-submit';

type FetchLike = typeof fetch;

function requiredDestinationWebhookUrl(rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error('DESTINATION_WEBHOOK_URL is missing.');
  }

  const parsed = new URL(value);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('DESTINATION_WEBHOOK_URL must use http:// or https://.');
  }

  return parsed.toString();
}

function requiredDestinationWebhookSecret(): string {
  const resolved =
    process.env.DESTINATION_WEBHOOK_SECRET?.trim() || process.env.MAKE_WEBHOOK_SECRET?.trim();

  if (!resolved) {
    throw new Error('DESTINATION_WEBHOOK_SECRET or MAKE_WEBHOOK_SECRET is required.');
  }

  return resolved;
}

export function createDestinationPayload(input: MakeWebhookPayload): MakeWebhookPayload {
  return makeWebhookPayloadSchema.parse(input);
}

export async function sendDestinationWebhook(
  payload: MakeWebhookPayload,
  fetchImpl: FetchLike = fetch,
  destinationUrl: string = requiredDestinationWebhookUrl(process.env.DESTINATION_WEBHOOK_URL)
): Promise<void> {
  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const signature = createWebhookSignature(
    {
      timestamp,
      body
    },
    requiredDestinationWebhookSecret()
  );

  const response = await fetchImpl(destinationUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-timestamp': timestamp,
      'x-webhook-signature': signature,
      'x-idempotency-key': payload.clientRequestId
    },
    body,
    signal: AbortSignal.timeout(3_000)
  });

  if (!response.ok) {
    throw new Error(`Destination webhook responded with ${response.status}.`);
  }
}
