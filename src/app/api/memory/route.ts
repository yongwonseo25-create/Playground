import { NextResponse } from 'next/server';
import { formatZodIssues } from '@/shared/contracts/common';
import {
  memoryDeleteRequestSchema,
  memoryListResponseSchema
} from '@/shared/contracts/v4-memory';
import { deleteMemories, listMemories } from '@/server/memory/v4-memory-service';

export const runtime = 'nodejs';

function parseUserId(request: Request): number | null {
  const url = new URL(request.url);
  const rawUserId = url.searchParams.get('userId');
  if (!rawUserId) {
    return null;
  }

  const parsed = Number(rawUserId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function readDeleteBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const userId = parseUserId(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'userId query parameter is required.' }, { status: 400 });
  }

  try {
    const response = await listMemories({ userId });
    return NextResponse.json(memoryListResponseSchema.parse(response));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Memory lookup failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const urlUserId = parseUserId(request);
  const rawBody = await readDeleteBody(request);

  const parsedBody = memoryDeleteRequestSchema.safeParse(
    rawBody && typeof rawBody === 'object' ? rawBody : { userId: urlUserId }
  );

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid memory delete request contract.',
        issues: formatZodIssues(parsedBody.error)
      },
      { status: 400 }
    );
  }

  try {
    const response = await deleteMemories(parsedBody.data);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Memory delete failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
