import { NextResponse } from 'next/server';
import { buildContractError } from '@/shared/contracts/common';
import {
  hitlApprovalRequestSchema,
  hitlApprovalResponseSchema
} from '@/shared/contracts/v4/hitl';
import { handleV4IdempotentJsonRequest } from '@/server/v4/shared/idempotency';
import { resolveHitlApproval } from '@/server/v4/hitl/hitl-service';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: {
    params: Promise<{ approvalId: string }>;
  }
) {
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

  const parsedBody = hitlApprovalRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(buildContractError('Invalid V4 HITL approval request.', parsedBody.error), {
      status: 400
    });
  }

  const { approvalId } = await context.params;

  try {
    return handleV4IdempotentJsonRequest(request, `v4:hitl:approval:${approvalId}`, async () => {
      const response = hitlApprovalResponseSchema.parse(
        await resolveHitlApproval(approvalId, parsedBody.data)
      );

      return {
        status: response.status === 'approved' ? 202 : 200,
        body: response
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'HITL approval resolution failed.';

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
