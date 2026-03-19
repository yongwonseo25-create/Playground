import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import {
  type V4ExecutionWebhookPayload,
  v4ExecutionWebhookPayloadSchema
} from '@/shared/contracts/v4/common';
import { getV4ServerEnv } from '@/server/v4/shared/env';
import { getV4RuntimeStore } from '@/server/v4/shared/runtime-store';

type EncryptedBufferRecord = {
  algorithm: 'aes-256-gcm';
  cipherText: string;
  iv: string;
  authTag: string;
  createdAt: string;
  expiresAt: string;
};

function getEncryptionKey(): Buffer {
  const env = getV4ServerEnv();
  return createHash('sha256').update(env.V4_REDIS_ENCRYPTION_KEY, 'utf8').digest();
}

export function createExecutionBufferKey(referenceId: string): string {
  return `v4:buffer:${referenceId}`;
}

export async function writeExecutionBuffer(
  bufferKey: string,
  payload: V4ExecutionWebhookPayload
): Promise<{ bufferKey: string; expiresAt: string }> {
  const env = getV4ServerEnv();
  const parsedPayload = v4ExecutionWebhookPayloadSchema.parse(payload);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const plainText = Buffer.from(JSON.stringify(parsedPayload), 'utf8');
  const cipherText = Buffer.concat([cipher.update(plainText), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const expiresAt = new Date(Date.now() + env.V4_EXECUTION_BUFFER_TTL_SEC * 1000).toISOString();
  const record: EncryptedBufferRecord = {
    algorithm: 'aes-256-gcm',
    cipherText: cipherText.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    createdAt: new Date().toISOString(),
    expiresAt
  };

  const store = await getV4RuntimeStore();
  await store.set(bufferKey, JSON.stringify(record), env.V4_EXECUTION_BUFFER_TTL_SEC);

  return {
    bufferKey,
    expiresAt
  };
}

export async function readExecutionBuffer(bufferKey: string): Promise<V4ExecutionWebhookPayload | null> {
  const store = await getV4RuntimeStore();
  const rawRecord = await store.get(bufferKey);
  if (!rawRecord) {
    return null;
  }

  const record = JSON.parse(rawRecord) as EncryptedBufferRecord;
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  const plainText = Buffer.concat([
    decipher.update(Buffer.from(record.cipherText, 'base64')),
    decipher.final()
  ]);

  return v4ExecutionWebhookPayloadSchema.parse(JSON.parse(plainText.toString('utf8')));
}

export async function deleteExecutionBuffer(bufferKey: string): Promise<void> {
  const store = await getV4RuntimeStore();
  await store.del(bufferKey);
}
