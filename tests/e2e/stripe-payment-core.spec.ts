import { expect, test } from '@playwright/test';
import { createHmac } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { DbQueryResult, Queryable } from '../../src/server/db/v3-pg';
import { processStripePayment } from '../../src/server/payments/payment-core';
import { verifyStripeSignature } from '../../src/server/payments/stripe-signature';

function signStripePayload(payload: string, secret: string, timestamp: number) {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

test.describe('stripe payment core', () => {
  test('verifies a valid Stripe webhook signature', () => {
    const payload = JSON.stringify({ id: 'evt_test' });
    const secret = 'whsec_test_voxera';
    const now = 1_700_000_000_000;
    const timestamp = Math.floor(now / 1000);

    expect(
      verifyStripeSignature({
        payload,
        header: signStripePayload(payload, secret, timestamp),
        secret,
        toleranceSeconds: 300,
        now: () => now
      })
    ).toEqual({ timestamp });
  });

  test('rejects Stripe signatures outside the tolerance window', () => {
    const payload = JSON.stringify({ id: 'evt_test' });
    const secret = 'whsec_test_voxera';
    const now = 1_700_000_000_000;
    const timestamp = Math.floor(now / 1000) - 301;

    expect(() =>
      verifyStripeSignature({
        payload,
        header: signStripePayload(payload, secret, timestamp),
        secret,
        toleranceSeconds: 300,
        now: () => now
      })
    ).toThrow('outside the tolerance window');
  });

  test('uses SERIALIZABLE and FOR UPDATE to process a Stripe event once', async () => {
    const executed: string[] = [];

    const runner: Queryable = {
      async query<T extends QueryResultRow>(text: string, _values?: readonly unknown[]) {
        const normalized = text.replace(/\s+/g, ' ').trim();
        executed.push(normalized);

        if (normalized.includes('FROM stripe_events')) {
          return { rowCount: 0, rows: [] } as unknown as DbQueryResult<T>;
        }

        if (normalized.includes('FROM payment_log')) {
          return { rowCount: 0, rows: [] } as unknown as DbQueryResult<T>;
        }

        if (normalized.includes('FROM users')) {
          return { rowCount: 1, rows: [{ credits: 100 }] } as unknown as DbQueryResult<T>;
        }

        return { rowCount: 0, rows: [] } as unknown as DbQueryResult<T>;
      }
    };

    const result = await processStripePayment(runner, {
      eventId: 'evt_123',
      eventType: 'checkout.session.completed',
      userId: 7,
      requestId: '2b133c4f-8502-4d6d-9ffd-3387b29a6020',
      amount: 5000,
      currency: 'usd',
      creditsDelta: 100,
      stripeObjectId: 'cs_test_123',
      stripeChargeId: 'pi_test_123',
      livemode: false
    });

    expect(result).toMatchObject({
      status: 'processed',
      eventId: 'evt_123',
      requestId: '2b133c4f-8502-4d6d-9ffd-3387b29a6020',
      newCredits: 200
    });
    expect(executed[0]).toBe('BEGIN');
    expect(executed[1]).toBe('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    expect(executed.some((sql) => sql.includes('FROM stripe_events') && sql.includes('FOR UPDATE'))).toBe(true);
    expect(executed.some((sql) => sql.includes('FROM payment_log') && sql.includes('FOR UPDATE'))).toBe(true);
    expect(executed.some((sql) => sql.includes('FROM users') && sql.includes('FOR UPDATE'))).toBe(true);
    expect(executed.at(-1)).toBe('COMMIT');
  });

  test('returns duplicate when the Stripe event was already processed', async () => {
    const executed: string[] = [];

    const runner: Queryable = {
      async query<T extends QueryResultRow>(text: string, _values?: readonly unknown[]) {
        executed.push(text.replace(/\s+/g, ' ').trim());
        if (executed.length === 3) {
          return { rowCount: 1, rows: [{ id: 1, processed: true }] } as unknown as DbQueryResult<T>;
        }
        return { rowCount: 0, rows: [] } as unknown as DbQueryResult<T>;
      }
    };

    const result = await processStripePayment(runner, {
      eventId: 'evt_dup',
      eventType: 'checkout.session.completed',
      userId: 9,
      requestId: '6d8e8f5e-17f8-4058-a4dc-87b8c985a47f',
      amount: 2000,
      currency: 'usd',
      creditsDelta: 20,
      stripeObjectId: 'cs_dup',
      stripeChargeId: 'pi_dup',
      livemode: false
    });

    expect(result).toEqual({
      status: 'duplicate',
      eventId: 'evt_dup',
      requestId: '6d8e8f5e-17f8-4058-a4dc-87b8c985a47f'
    });
    expect(executed.at(-1)).toBe('COMMIT');
  });
});
