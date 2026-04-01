import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  BillingConflictError,
  BillingInvariantError,
  FirestoreBillingStore,
  PaymentRequiredError
} from '@/server/billing/firestore-billing-store';
import { generateOutputRequestSchema } from '@/server/billing/generate-output-contract';
import {
  OutputGenerationRefundedError,
  PayPerOutputService
} from '@/server/billing/pay-per-output-service';
import { verifyFirebaseUserFromRequest, UnauthorizedError } from '@/server/auth/verify-firebase-user';
import { getServerEnv } from '@/server/config/server-env';
import { getAdminFirestore, getSecretManagerClient } from '@/server/firebase/admin';
import {
  GoogleAiStudioGenerator,
  SecretManagerAccessor
} from '@/server/generation/google-ai-studio-generator';
import { enqueueVoxeraPipeline } from '@/server/worker/voxera-queue';

export const runtime = 'nodejs';

function jsonError(status: number, error: string, extras: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...extras
    },
    { status }
  );
}

function buildService(): PayPerOutputService {
  const env = getServerEnv();
  const billingStore = new FirestoreBillingStore(getAdminFirestore());
  const generator = new GoogleAiStudioGenerator({
    apiBaseUrl: env.GOOGLE_AI_STUDIO_API_BASE_URL,
    apiKeySecretName: env.GOOGLE_AI_STUDIO_API_KEY_SECRET,
    model: env.GOOGLE_AI_STUDIO_MODEL,
    secretAccessor: new SecretManagerAccessor(getSecretManagerClient())
  });

  return new PayPerOutputService(billingStore, generator);
}

export async function POST(request: Request) {
  const env = getServerEnv();

  try {
    const user = await verifyFirebaseUserFromRequest(request);
    const parsedBody = generateOutputRequestSchema.parse(await request.json());
    // 1. [Phase 3] 클라이언트 STT/프롬프트 접수 및 비동기 워커에 Enqueue
    const t1_stt_ms_client = 150; // Mock: 실제로는 클라이언트가 STT 처리하고 넘긴 시간 측정값
    
    // (Optional) PENDING 상태 예약 처리는 원본 service.execute의 앞부분을 분리하거나 Worker에서 선처리 가능.
    // 여기서는 응답 최적화를 위해 Enqueue 직후 바로 클라이언트를 풀어줍니다.
    const job = await enqueueVoxeraPipeline({
      userId: user.uid,
      sessionId: parsedBody.clientRequestId,
      sttText: parsedBody.prompt,
      userStylePrompt: '사용자 지정 스타일 (예: 존댓말 명확히)',
      audioDurationSec: parsedBody.audio_duration || 0,
      t1_stt_ms: t1_stt_ms_client,
    });

    return NextResponse.json({
      ok: true,
      status: 'ACCEPTED',
      jobId: job.id,
      message: '요청이 정상적으로 대기열에 추가되었습니다. 비동기로 처리됩니다.'
    }, { status: 202 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(400, 'Invalid generate-output payload.', {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      });
    }

    if (error instanceof UnauthorizedError) {
      return jsonError(error.statusCode, error.message);
    }

    if (error instanceof PaymentRequiredError) {
      return jsonError(error.statusCode, error.message);
    }

    if (error instanceof BillingConflictError || error instanceof BillingInvariantError) {
      return jsonError(error.statusCode, error.message);
    }

    if (error instanceof OutputGenerationRefundedError) {
      error.settlement.revalidateKeys.forEach((tag) => revalidateTag(tag, 'max'));
      return jsonError(502, error.message, {
        billing: {
          transactionId: error.settlement.transactionId,
          status: error.settlement.billingStatus,
          availableCredits: error.settlement.availableCredits,
          pendingCredits: error.settlement.pendingCredits,
          costCredits: env.GENERATE_OUTPUT_COST_CREDITS
        },
        revalidateKeys: error.settlement.revalidateKeys
      });
    }

    const message = error instanceof Error ? error.message : 'Unknown generate-output failure.';
    return jsonError(500, message);
  }
}
