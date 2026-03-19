import { NextResponse } from 'next/server';
import { buildContractError } from '@/shared/contracts/common';
import { hitlCardRequestSchema, hitlCardResponseSchema } from '@/shared/contracts/v4/hitl';
import { handleV4IdempotentJsonRequest } from '@/server/v4/shared/idempotency';
import { createHitlApprovalCard } from '@/server/v4/hitl/hitl-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid JSON body.',
        issues: []
      },
      { status: 400 }
    );
  }

  const parsedBody = hitlCardRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(buildContractError('Invalid V4 HITL card request.', parsedBody.error), {
      status: 400
    });
  }

  try {
    return handleV4IdempotentJsonRequest(request, 'v4:hitl:cards', async () => ({
      status: 201,
      body: hitlCardResponseSchema.parse(await createHitlApprovalCard(parsedBody.data))
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'HITL card creation failed.';

    return NextResponse.json(
      {
        ok: false,
        error: message,
        issues: []
      },
      { status: 500 }
    );
  }
}
