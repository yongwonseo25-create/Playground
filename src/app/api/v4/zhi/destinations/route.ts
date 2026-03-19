import { NextResponse } from 'next/server';
import { zhiDestinationsResponseSchema } from '@/shared/contracts/v4/zhi';
import { listZhiCatalog } from '@/server/v4/zhi/orchestrator';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    zhiDestinationsResponseSchema.parse({
      ok: true,
      mode: 'zhi',
      destinations: listZhiCatalog()
    })
  );
}
