# Retry Break Handler Template

## Objective
- Prevent data loss when Make.com or webhook calls fail.
- Combine retry, circuit breaker, and failure queue for resilient delivery.

## Core Rules
1. Retry Rule
- Use exponential backoff for 3 retries: `250ms`, `500ms`, `1000ms`.
- Every outbound request must have a timeout. No infinite wait.

2. Circuit Breaker Rule
- Trip to `OPEN` after 5 consecutive failures.
- In `OPEN`, fail fast and do not call external providers.
- After cooldown, move to `HALF_OPEN`; close circuit only on successful probe.

3. failureQueue Rule
- If synchronous send fails, enqueue immediately.
- Queue worker polls every `1-2s`.
- Queue retry updates `nextAttemptAt` with backoff.
- If enqueue succeeds, API should return `acceptedForRetry: true`.

4. Idempotency Rule
- Use `clientRequestId` as idempotency key.
- Duplicate keys must not trigger duplicate webhook sends.

5. Security Rule
- Sign outgoing webhook with HMAC-SHA256 (`X-Webhook-Signature`).
- Read secret from server env (`MAKE_WEBHOOK_SECRET`) only.

## Verification
- Track retry/circuit/queue outcomes via logs or metrics.
- Required tests:
  - HMAC value verification
  - 3-step retry backoff verification
  - circuit `OPEN` after 5 failures
  - idempotency duplicate prevention
