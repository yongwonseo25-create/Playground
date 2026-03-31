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
    const service = buildService();
    const result = await service.execute({
      uid: user.uid,
      clientRequestId: parsedBody.clientRequestId,
      prompt: parsedBody.prompt,
      outputType: parsedBody.outputType,
      costCredits: env.GENERATE_OUTPUT_COST_CREDITS,
      timeoutMs: env.GENERATE_OUTPUT_TIMEOUT_MS
    });

    result.settlement.revalidateKeys.forEach((tag) => revalidateTag(tag, 'max'));

    return NextResponse.json({
      ok: true,
      outputText: result.outputText,
      reusedExistingResult: result.reusedExistingResult,
      providerModel: result.providerModel,
      providerUsage: result.providerUsage,
      billing: {
        transactionId: result.settlement.transactionId,
        status: result.settlement.billingStatus,
        availableCredits: result.settlement.availableCredits,
        pendingCredits: result.settlement.pendingCredits,
        costCredits: env.GENERATE_OUTPUT_COST_CREDITS
      },
      revalidateKeys: result.settlement.revalidateKeys
    });
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
