import type { Queryable } from '@/server/db/v3-pg';

type VoiceCreditsLogRow = {
  user_id: number;
  credits_used: number | null;
  status: string;
};

type UserCreditsRow = {
  credits: number;
};

export type DeductVoiceCreditsResult =
  | { status: 'deducted'; remainingCredits: number }
  | { status: 'duplicate'; remainingCredits: number | null }
  | { status: 'insufficient_credits'; remainingCredits: number };

async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  runner: Queryable,
  text: string,
  values: readonly unknown[] = []
) {
  return runner.query<T>(text, values);
}

export async function deductVoiceCredits(
  runner: Queryable,
  input: {
    clientRequestId: string;
  }
): Promise<DeductVoiceCreditsResult> {
  await query(runner, 'BEGIN');

  try {
    await query(runner, 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    const voiceLog = await query<VoiceCreditsLogRow>(
      runner,
      `
        SELECT user_id, credits_used, status
        FROM voice_processing_log
        WHERE client_request_id = $1::uuid
        FOR UPDATE
      `,
      [input.clientRequestId]
    );

    const record = voiceLog.rows[0];
    if (!record) {
      throw new Error(`Voice processing log ${input.clientRequestId} does not exist.`);
    }

    if (
      record.status === 'charged' ||
      record.status === 'completed' ||
      record.status === 'webhook_failed' ||
      record.status === 'insufficient_credits'
    ) {
      await query(runner, 'COMMIT');
      return {
        status: 'duplicate',
        remainingCredits: null
      };
    }

    const creditsRequired = Math.max(0, record.credits_used ?? 0);
    const userRow = await query<UserCreditsRow>(
      runner,
      `
        SELECT credits
        FROM users
        WHERE id = $1
        FOR UPDATE
      `,
      [record.user_id]
    );

    const user = userRow.rows[0];
    if (!user) {
      throw new Error(`User ${record.user_id} does not exist.`);
    }

    if (user.credits < creditsRequired) {
      await query(
        runner,
        `
          UPDATE voice_processing_log
          SET status = 'insufficient_credits'
          WHERE client_request_id = $1::uuid
        `,
        [input.clientRequestId]
      );
      await query(runner, 'COMMIT');
      return {
        status: 'insufficient_credits',
        remainingCredits: user.credits
      };
    }

    const remainingCredits = user.credits - creditsRequired;

    await query(
      runner,
      `
        UPDATE users
        SET credits = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [record.user_id, remainingCredits]
    );

    await query(
      runner,
      `
        UPDATE voice_processing_log
        SET status = 'charged'
        WHERE client_request_id = $1::uuid
      `,
      [input.clientRequestId]
    );

    await query(runner, 'COMMIT');
    return {
      status: 'deducted',
      remainingCredits
    };
  } catch (error) {
    await query(runner, 'ROLLBACK');
    throw error;
  }
}
