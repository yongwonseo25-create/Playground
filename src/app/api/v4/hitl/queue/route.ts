import { NextResponse } from 'next/server';
import { hitlQueueResponseSchema } from '@/shared/contracts/v4/hitl';
import { handleV4IdempotentJsonRequest } from '@/server/v4/shared/idempotency';
import { listHitlQueue } from '@/server/v4/hitl/hitl-service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    return handleV4IdempotentJsonRequest(request, 'v4:hitl:queue', async () => ({
      status: 200,
      body: hitlQueueResponseSchema.parse(await listHitlQueue())
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read the HITL queue.';

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
