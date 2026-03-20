import type { SendResult } from '@/server/reliability/WebhookClient';
import { WebhookClient } from '@/server/reliability/WebhookClient';
import {
  type V4ExecutionWebhookPayload,
  v4ExecutionWebhookPayloadSchema
} from '@/shared/contracts/v4/common';
import { getV4ServerEnv } from '@/server/v4/shared/env';

let sharedWebhookClient: WebhookClient | null = null;
let sharedWebhookKey: string | null = null;

function getWebhookClient(): WebhookClient {
  const env = getV4ServerEnv();
  const nextKey = `${env.MAKE_WEBHOOK_URL}:${env.MAKE_WEBHOOK_SECRET}`;

  if (!sharedWebhookClient || sharedWebhookKey !== nextKey) {
    sharedWebhookClient = new WebhookClient({
      webhookUrl: env.MAKE_WEBHOOK_URL,
      webhookSecret: env.MAKE_WEBHOOK_SECRET,
      timeoutMs: 2_500,
      maxRetries: 2,
      retryBaseMs: 250
    });
    sharedWebhookKey = nextKey;
  }

  return sharedWebhookClient;
}

export async function deliverV4Webhook(
  payload: V4ExecutionWebhookPayload,
  transactionId: string
): Promise<SendResult> {
  const parsedPayload = v4ExecutionWebhookPayloadSchema.parse(payload);
  const client = getWebhookClient();
  return client.send(parsedPayload, transactionId);
}
