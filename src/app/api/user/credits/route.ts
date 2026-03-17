import { NextResponse } from 'next/server';
import { getCachedUserCredits, setCachedUserCredits } from '@/server/cache/credit-cache';
import { V3LocalStateStore } from '@/server/db/v3-local-state';
import { query } from '@/server/db/v3-pg';
import { isMemoryDatabaseRuntime } from '@/server/db/v3-runtime';
import { userCreditsQuerySchema, userCreditsResponseSchema } from '@/shared/contracts/v3-user-credits';

export const runtime = 'nodejs';

type CreditsRow = {
  credits: number;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const parsedQuery = userCreditsQuerySchema.safeParse({
    userId: requestUrl.searchParams.get('userId')
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ ok: false, error: 'Invalid user credits query.' }, { status: 400 });
  }

  const cached = await getCachedUserCredits(parsedQuery.data.userId);
  if (cached !== null) {
    return NextResponse.json(
      userCreditsResponseSchema.parse({
        ok: true,
        userId: parsedQuery.data.userId,
        credits: cached,
        source: 'cache'
      })
    );
  }

  if (isMemoryDatabaseRuntime()) {
    const localState = new V3LocalStateStore();
    const credits = localState.getUserCredits(parsedQuery.data.userId);
    await setCachedUserCredits(parsedQuery.data.userId, credits);

    return NextResponse.json(
      userCreditsResponseSchema.parse({
        ok: true,
        userId: parsedQuery.data.userId,
        credits,
        source: 'database'
      })
    );
  }

  const result = await query<CreditsRow>(
    `
      SELECT credits
      FROM users
      WHERE id = $1
    `,
    [parsedQuery.data.userId]
  );

  const row = result.rows[0];
  if (!row) {
    return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });
  }

  await setCachedUserCredits(parsedQuery.data.userId, row.credits);

  return NextResponse.json(
    userCreditsResponseSchema.parse({
      ok: true,
      userId: parsedQuery.data.userId,
      credits: row.credits,
      source: 'database'
    })
  );
}
