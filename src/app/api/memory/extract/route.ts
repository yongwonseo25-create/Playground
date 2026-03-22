import { NextResponse } from 'next/server';
import { formatZodIssues } from '@/shared/contracts/common';
import { memoryExtractionRequestSchema } from '@/shared/contracts/v4-memory';
import { extractAndStoreMemories } from '@/server/memory/v4-memory-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = memoryExtractionRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid memory extraction request contract.',
        issues: formatZodIssues(parsed.error)
      },
      { status: 400 }
    );
  }

  try {
    const response = await extractAndStoreMemories(parsed.data);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Memory extraction failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
