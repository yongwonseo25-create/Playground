import { NextResponse } from 'next/server';
import { getSharedV4MemoryStore } from '@/server/v4/memory/memory-store';

export const runtime = 'nodejs';

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { userId?: number } | null;
  const userId = body?.userId;

  if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ ok: false, error: 'Invalid GDPR delete request.' }, { status: 400 });
  }

  const deletedCount = getSharedV4MemoryStore().deleteUser(userId);
  return NextResponse.json({
    ok: true,
    userId,
    deletedCount
  });
}
