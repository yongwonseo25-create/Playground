import { Request, Response, Router } from 'express';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const router = Router();

// ESM 환경 대응
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 수동 로드 (설계 지침 준수)
const envPath = path.join(__dirname, '..', '..', '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * [핵심 로직 3: OAuth 토큰 암호화]
 * AES-256-GCM 대칭키 암호화 유틸리티
 */
function encrypt(text: string): string {
  if (!ENCRYPTION_SECRET) throw new Error('ENCRYPTION_SECRET is missing');
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * [notion-auth.controller.ts]
 * 노션 OAuth 콜백 처리 및 암호화 저장 라우트
 */
router.post('/callback', async (req: Request, res: Response) => {
  const { userId, workspaceId, accessToken, refreshToken, expiresAt, botId, notionWorkspaceId, notionWorkspaceName } = req.body;

  try {
    // 1. 토큰 암호화 (보안 규칙 5, 40번 지점 준수)
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;

    // 2. 통합 테이블 UPSERT (원자성 확보 및 유저 바인딩)
    const integration = await prisma.userIntegration.upsert({
      where: { workspaceId },
      update: {
        userId,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: encryptedRefreshToken,
        tokenExpiresAt: expiresAt ? new Date(expiresAt) : null,
        notionWorkspaceId,
        notionWorkspaceName,
        botId,
        updatedAt: new Date(),
      },
      create: {
        userId,
        workspaceId,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: encryptedRefreshToken,
        tokenExpiresAt: expiresAt ? new Date(expiresAt) : null,
        notionWorkspaceId,
        notionWorkspaceName,
        botId,
      },
    });

    console.log(`[AUTH] Notion integration success: ${workspaceId} for user ${userId}`);
    res.status(200).json({ success: true, integrationId: integration.id });

  } catch (error: any) {
    console.error('[AUTH_ERROR]', error.message);
    res.status(500).json({ error: 'Failed to save encrypted notion integration' });
  }
});

export default router;
