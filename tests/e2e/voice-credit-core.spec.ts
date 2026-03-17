import { expect, test } from '@playwright/test';
import type { QueryResultRow } from 'pg';
import type { Queryable } from '../../src/server/db/v3-pg';
import { deductVoiceCredits } from '../../src/server/voice/voice-credit-core';

test.describe('voice credit core', () => {
  test('uses SERIALIZABLE and FOR UPDATE to deduct credits exactly once', async () => {
    const executedQueries: string[] = [];

    const runner: Queryable = {
      async query<T extends QueryResultRow = QueryResultRow>(text: string) {
        const normalized = text.replace(/\s+/g, ' ').trim();
        executedQueries.push(normalized);

        if (normalized.startsWith('SELECT user_id, credits_used, status FROM voice_processing_log')) {
          return {
            rowCount: 1,
            rows: [{ user_id: 7, credits_used: 3, status: 'processing' } as unknown as T]
          };
        }

        if (normalized.startsWith('SELECT credits FROM users')) {
          return {
            rowCount: 1,
            rows: [{ credits: 12 } as unknown as T]
          };
        }

        return {
          rowCount: 1,
          rows: [] as T[]
        };
      }
    };

    const result = await deductVoiceCredits(runner, {
      clientRequestId: '66666666-6666-4666-8666-666666666666'
    });

    expect(result).toEqual({
      status: 'deducted',
      remainingCredits: 9
    });
    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    expect(
      executedQueries.some((queryText) =>
        queryText.includes('FROM voice_processing_log') && queryText.includes('FOR UPDATE')
      )
    ).toBe(true);
    expect(
      executedQueries.some((queryText) => queryText.includes('FROM users') && queryText.includes('FOR UPDATE'))
    ).toBe(true);
    expect(
      executedQueries.some((queryText) => queryText.includes('UPDATE users SET credits = $2'))
    ).toBe(true);
    expect(executedQueries).toContain('COMMIT');
  });

  test('marks insufficient credits without charging the user', async () => {
    const executedQueries: string[] = [];

    const runner: Queryable = {
      async query<T extends QueryResultRow = QueryResultRow>(text: string) {
        const normalized = text.replace(/\s+/g, ' ').trim();
        executedQueries.push(normalized);

        if (normalized.startsWith('SELECT user_id, credits_used, status FROM voice_processing_log')) {
          return {
            rowCount: 1,
            rows: [{ user_id: 7, credits_used: 8, status: 'processing' } as unknown as T]
          };
        }

        if (normalized.startsWith('SELECT credits FROM users')) {
          return {
            rowCount: 1,
            rows: [{ credits: 2 } as unknown as T]
          };
        }

        return {
          rowCount: 1,
          rows: [] as T[]
        };
      }
    };

    const result = await deductVoiceCredits(runner, {
      clientRequestId: '77777777-7777-4777-8777-777777777777'
    });

    expect(result).toEqual({
      status: 'insufficient_credits',
      remainingCredits: 2
    });
    expect(
      executedQueries.some((queryText) => queryText.includes("SET status = 'insufficient_credits'"))
    ).toBe(true);
    expect(
      executedQueries.some((queryText) => queryText.includes('UPDATE users SET credits = $2'))
    ).toBe(false);
  });
});
