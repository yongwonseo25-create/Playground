import type { Queryable } from '@/server/db/v3-pg';

export type StripePaymentInput = {
  eventId: string;
  eventType: string;
  userId: number;
  requestId: string;
  amount: number;
  currency: string;
  creditsDelta: number;
  stripeObjectId: string;
  stripeChargeId?: string;
  livemode: boolean;
  sourceCreatedAt?: Date;
};

export type StripePaymentResult =
  | { status: 'duplicate'; eventId: string; requestId: string }
  | { status: 'processed'; eventId: string; requestId: string; newCredits: number };

type RowWithProcessed = {
  id: number;
  processed: boolean;
};

type UserCreditsRow = {
  credits: number;
};

type PaymentLogRow = {
  id: number;
  status: string;
};

type QueryFn = Queryable['query'];

async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  runner: QueryFn,
  text: string,
  values: readonly unknown[] = []
) {
  return runner<T>(text, values);
}

export async function processStripePayment(
  runner: Queryable,
  input: StripePaymentInput
): Promise<StripePaymentResult> {
  await query(runner.query.bind(runner), 'BEGIN');

  try {
    await query(runner.query.bind(runner), 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    const existingEvent = await query<RowWithProcessed>(
      runner.query.bind(runner),
      `
        SELECT id, processed
        FROM stripe_events
        WHERE event_id = $1
        FOR UPDATE
      `,
      [input.eventId]
    );

    if (existingEvent.rowCount && existingEvent.rows[0]?.processed) {
      await query(runner.query.bind(runner), 'COMMIT');
      return {
        status: 'duplicate',
        eventId: input.eventId,
        requestId: input.requestId
      };
    }

    if (!existingEvent.rowCount) {
      await query(
        runner.query.bind(runner),
        `
          INSERT INTO stripe_events (
            event_id,
            event_type,
            user_id,
            request_id,
            amount,
            currency,
            credits_delta,
            stripe_object_id,
            stripe_charge_id,
            livemode,
            processed,
            source_created_at
          )
          VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8, $9, $10, FALSE, $11)
        `,
        [
          input.eventId,
          input.eventType,
          input.userId,
          input.requestId,
          input.amount,
          input.currency,
          input.creditsDelta,
          input.stripeObjectId,
          input.stripeChargeId ?? null,
          input.livemode,
          input.sourceCreatedAt?.toISOString() ?? null
        ]
      );
    }

    const existingPayment = await query<PaymentLogRow>(
      runner.query.bind(runner),
      `
        SELECT id, status
        FROM payment_log
        WHERE request_id = $1::uuid
        FOR UPDATE
      `,
      [input.requestId]
    );

    if (existingPayment.rowCount) {
      await query(
        runner.query.bind(runner),
        `
          UPDATE stripe_events
          SET processed = TRUE,
              processed_at = NOW()
          WHERE event_id = $1
        `,
        [input.eventId]
      );
      await query(runner.query.bind(runner), 'COMMIT');
      return {
        status: 'duplicate',
        eventId: input.eventId,
        requestId: input.requestId
      };
    }

    const userRow = await query<UserCreditsRow>(
      runner.query.bind(runner),
      `
        SELECT credits
        FROM users
        WHERE id = $1
        FOR UPDATE
      `,
      [input.userId]
    );

    const currentUser = userRow.rows[0];
    if (!currentUser) {
      throw new Error(`User ${input.userId} does not exist.`);
    }

    const newCredits = currentUser.credits + input.creditsDelta;

    await query(
      runner.query.bind(runner),
      `
        UPDATE users
        SET credits = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.userId, newCredits]
    );

    await query(
      runner.query.bind(runner),
      `
        INSERT INTO payment_log (
          user_id,
          amount,
          currency,
          credits_delta,
          request_id,
          stripe_charge_id,
          status
        )
        VALUES ($1, $2, $3, $4, $5::uuid, $6, 'completed')
      `,
      [
        input.userId,
        input.amount,
        input.currency,
        input.creditsDelta,
        input.requestId,
        input.stripeChargeId ?? null
      ]
    );

    await query(
      runner.query.bind(runner),
      `
        UPDATE stripe_events
        SET processed = TRUE,
            processed_at = NOW()
        WHERE event_id = $1
      `,
      [input.eventId]
    );

    await query(runner.query.bind(runner), 'COMMIT');

    return {
      status: 'processed',
      eventId: input.eventId,
      requestId: input.requestId,
      newCredits
    };
  } catch (error) {
    await query(runner.query.bind(runner), 'ROLLBACK');
    throw error;
  }
}
