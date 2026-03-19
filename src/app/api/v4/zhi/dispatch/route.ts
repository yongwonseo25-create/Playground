import { NextResponse } from 'next/server';
import { buildContractError } from '@/shared/contracts/common';
import {
  zhiDispatchRequestSchema,
  zhiDispatchResponseSchema
} from '@/shared/contracts/v4/zhi';
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
    const response = await dispatchZhiCommand(parsedBody.data);
    return NextResponse.json(zhiDispatchResponseSchema.parse(response), { status: 200 });
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
