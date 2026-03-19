import { NextResponse } from 'next/server';
import { zhiDestinationsResponseSchema } from '@/shared/contracts/v4/zhi';
import { handleV4IdempotentJsonRequest } from '@/server/v4/shared/idempotency';
import { listZhiCatalog } from '@/server/v4/zhi/orchestrator';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    return handleV4IdempotentJsonRequest(request, 'v4:zhi:destinations', async () => ({
      status: 200,
      body: zhiDestinationsResponseSchema.parse({
        ok: true,
        mode: 'zhi',
        destinations: listZhiCatalog()
      })
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read the ZHI destination catalog.';

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
