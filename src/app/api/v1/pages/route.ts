import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  parseNotionDirectWriteRequest,
  writeStrictJsonToNotion
} from '@/server/notion/direct-write';

export const runtime = 'nodejs';

function jsonError(status: number, error: string, extras: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...extras
    },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    const parsedBody = parseNotionDirectWriteRequest(await request.json());
    const result = await writeStrictJsonToNotion(parsedBody);

    return NextResponse.json({
      ok: true,
      clientRequestId: result.clientRequestId,
      databaseId: result.resolvedDatabaseId,
      notionPage: result.page
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(400, 'Invalid Notion direct write payload.', {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      });
    }

    const message = error instanceof Error ? error.message : 'Unknown Notion direct write failure.';
    return jsonError(500, message);
  }
}
