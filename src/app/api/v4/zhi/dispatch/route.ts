import { NextResponse } from 'next/server';
import { buildContractError } from '@/shared/contracts/common';
import {
  zhiDispatchRequestSchema,
  zhiDispatchResponseSchema
} from '@/shared/contracts/v4/zhi';
import { handleV4IdempotentJsonRequest } from '@/server/v4/shared/idempotency';
import { dispatchZhiCommand } from '@/server/v4/zhi/orchestrator';

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

  const parsedBody = zhiDispatchRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(buildContractError('Invalid V4 ZHI dispatch request.', parsedBody.error), {
      status: 400
    });
  }

  try {
    return handleV4IdempotentJsonRequest(request, 'v4:zhi:dispatch', async () => {
      const response = await dispatchZhiCommand(parsedBody.data);
      return {
        status: 202,
        body: zhiDispatchResponseSchema.parse(response)
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ZHI dispatch failed.';

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
