import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '@/server/prisma/client';

interface NotionConnectionPayload {
  accessToken: string;
  botId: string;
  workspaceId: string;
  workspaceName?: string;
  workspaceIcon?: string | null;
  duplicatedTemplateId?: string | null;
  owner?: Record<string, unknown>;
}

export async function storeNotionOAuthConnection(payload: NotionConnectionPayload) {
  const encryptedToken = encryptAccessToken(payload.accessToken);
  const prisma = getPrismaClient();

  await prisma.notionOAuthConnection.upsert({
    where: {
      workspaceId: payload.workspaceId
    },
    create: {
      workspaceId: payload.workspaceId,
      botId: payload.botId,
      workspaceName: payload.workspaceName ?? null,
      workspaceIcon: payload.workspaceIcon ?? null,
      duplicatedTemplateId: payload.duplicatedTemplateId ?? null,
      ownerJson: serializeOwner(payload.owner),
      encryptedAccessToken: encryptedToken.ciphertext,
      encryptionIv: encryptedToken.iv,
      encryptionTag: encryptedToken.authTag
    },
    update: {
      botId: payload.botId,
      workspaceName: payload.workspaceName ?? null,
      workspaceIcon: payload.workspaceIcon ?? null,
      duplicatedTemplateId: payload.duplicatedTemplateId ?? null,
      ownerJson: serializeOwner(payload.owner),
      encryptedAccessToken: encryptedToken.ciphertext,
      encryptionIv: encryptedToken.iv,
      encryptionTag: encryptedToken.authTag
    }
  });
}

export async function getStoredNotionAccessToken(params: { workspaceId: string }) {
  const prisma = getPrismaClient();
  const record = await prisma.notionOAuthConnection.findUnique({
    where: {
      workspaceId: params.workspaceId
    }
  });

  if (!record) {
    return null;
  }

  return decryptAccessToken({
    ciphertext: record.encryptedAccessToken,
    iv: record.encryptionIv,
    authTag: record.encryptionTag
  });
}

function encryptAccessToken(accessToken: string) {
  const key = resolveEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(accessToken, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

function decryptAccessToken(input: { ciphertext: string; iv: string; authTag: string }) {
  const key = resolveEncryptionKey();
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(input.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(input.authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function resolveEncryptionKey() {
  const rawKey = process.env.NOTION_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('Missing NOTION_TOKEN_ENCRYPTION_KEY environment variable.');
  }

  const base64Buffer = tryDecode(rawKey, 'base64');
  if (base64Buffer && base64Buffer.length === 32) {
    return base64Buffer;
  }

  const hexBuffer = tryDecode(rawKey, 'hex');
  if (hexBuffer && hexBuffer.length === 32) {
    return hexBuffer;
  }

  const utf8Buffer = Buffer.from(rawKey, 'utf8');
  if (utf8Buffer.length === 32) {
    return utf8Buffer;
  }

  throw new Error(
    'NOTION_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64, hex, or raw utf8).'
  );
}

function tryDecode(input: string, encoding: BufferEncoding) {
  try {
    return Buffer.from(input, encoding);
  } catch {
    return null;
  }
}

function serializeOwner(owner?: Record<string, unknown>) {
  return owner ? (JSON.parse(JSON.stringify(owner)) as Prisma.InputJsonValue) : Prisma.JsonNull;
}
