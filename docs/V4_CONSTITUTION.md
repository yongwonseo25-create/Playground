# VOXERA V4 Constitution

## Mission
- VOXERA V4 is a zero-retention, direct-write, high-availability backend.
- The system must persist metadata only and must physically enforce TTL and idempotency constraints.

## Non-Negotiable Rules

### 1. Zero Retention
- Transcript payloads must not be stored in PostgreSQL.
- Transcript payloads must not be written to local queue files.
- Temporary payloads must be dropped immediately after the downstream send/write attempt.
- Persisted rows may keep only status, scope, idempotency keys, timestamps, and other non-payload metadata.

### 2. Physical TTL Enforcement
- `clientRequestId` idempotency records must expire at exactly 72 hours.
- Realtime outbox records must expire at exactly 24 hours.
- Short-term memory must expire at exactly 14 days.
- Preference memory must expire at exactly 90 days.
- TTL rules must be physically encoded in schema or index definitions, not only simulated in tests.

### 3. Neon Direct-Write
- Neon access must use HTTP one-shot queries only.
- Connection pooling is forbidden in the V4 direct-write path.
- Long-lived SQL sockets or websocket database sessions are forbidden in the V4 direct-write path.

### 4. Queue Concurrency
- SQS workers must enforce a hard maximum concurrency value.
- Duplicate jobs must be suppressed before any downstream side effect occurs.
- Worker concurrency must be observable from the worker configuration itself.

### 5. Realtime Resume
- Realtime reconnection must use `resume_token` and `last_seq`.
- Resume replay must return only events after the acknowledged sequence.
- Outbox transitions are one-way only.

### 6. Memory Extraction
- OpenAI memory extraction must use strict structured outputs.
- Short-term and preference TTL classes are fixed and may not drift.
- GDPR delete must hard-delete a user memory set immediately.

## Verification Gate
- A V4 slice is not complete until `typecheck`, `lint`, `test`, and `build` pass.
- If Docker or cloud infrastructure is unavailable, the physical schema and index contracts must still exist in code and be covered by tests.
