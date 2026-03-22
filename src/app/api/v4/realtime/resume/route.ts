import { NextResponse } from 'next/server';
import { parseResumeToken } from '@/server/v4/realtime/resume-token';
import { InMemoryRedisStreamResumeStore } from '@/server/v4/realtime/redis-streams-resume';

const sharedResumeStore = new InMemoryRedisStreamResumeStore();

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { resumeToken?: string; lastSeq?: number }
    | null;

  const lastSeq = body?.lastSeq;
  if (
    !body?.resumeToken ||
    typeof lastSeq !== 'number' ||
    !Number.isInteger(lastSeq) ||
    lastSeq < 0
  ) {
    return NextResponse.json({ ok: false, error: 'Invalid resume request.' }, { status: 400 });
  }

  const payload = parseResumeToken(body.resumeToken);
  const events = sharedResumeStore.resume({
    resumeToken: body.resumeToken,
    lastSeq
  });

  return NextResponse.json({
    ok: true,
    streamKey: payload.streamKey,
    connectionId: payload.connectionId,
    events
  });
}
