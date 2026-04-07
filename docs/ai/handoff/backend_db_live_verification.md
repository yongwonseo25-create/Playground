# Backend DB Live Verification

- Date: 2026-04-07
- Worktree: `C:\Users\Master\Documents\Playground-worktree1-backend`
- Branch: `codex/backend-worktree1-pg16-ledger`
- Runtime: PostgreSQL 16.13 on Windows service `postgresql-x64-16-voxera`
- Verification scope:
  - live PostgreSQL 16+ migration replay
  - partial unique index materialization
  - timeout sweeper concurrency smoke test with `FOR UPDATE SKIP LOCKED`
  - serializable conflict and retry behavior under concurrent workers

## Path Mapping

The user-provided input paths do not exactly match the current repository layout. The live verification used these actual files:

- Requested `apps/api/prisma/schema.prisma`
  - Actual: `apps/api/src/db/schema.prisma`
- Requested `apps/api/src/services/billing-timeout-sweeper.ts`
  - Actual: `apps/api/src/workers/billing-timeout-sweeper.ts`
- Requested `apps/api/prisma/migrations/0001_pg16_single_ledger.sql`
  - Actual: `apps/api/src/db/migrations/0001_pg16_single_ledger.sql`

## Runtime Provisioning

Installed PostgreSQL 16 via `winget` and verified the server process and client tooling:

```powershell
winget install --id PostgreSQL.PostgreSQL.16 --exact --accept-package-agreements --accept-source-agreements --silent --override "--mode unattended --unattendedmodeui minimal --superpassword VoxeraPg16!2026 --servicename postgresql-x64-16-voxera --serverport 5432 --prefix C:\PostgreSQL\16 --datadir C:\PostgreSQL\16\data --enable-components server,commandlinetools --disable-components pgAdmin,stackbuilder --enable_acledit 1"
Get-Service -Name 'postgresql-x64-16-voxera'
& 'C:\PostgreSQL\16\bin\psql.exe' --version
```

Observed:

- service status: `Running`
- client version: `psql (PostgreSQL) 16.13`
- TCP 5432 reachable on `127.0.0.1`

## Live Database Bootstrap

Created an app-specific role and database:

```sql
CREATE ROLE voxera LOGIN PASSWORD 'voxera';
CREATE DATABASE voxera OWNER voxera;
```

Effective live app URL used for verification:

```text
postgresql://voxera:voxera@127.0.0.1:5432/voxera?schema=public
```

## Migration Verification

Executed:

```powershell
$env:DATABASE_URL='postgresql://voxera:voxera@127.0.0.1:5432/voxera?schema=public'
corepack pnpm db:ssce:migrate
```

Observed result:

- command completed successfully against the live PostgreSQL 16.13 instance
- both checked-in SQL migrations were registered in `__ssce_migrations`

Verification query:

```sql
SELECT name, applied_at FROM __ssce_migrations ORDER BY name;
```

Observed rows:

```text
0001_pg16_single_ledger.sql
0002_postgres_constraints.sql
```

Materialized tables:

```text
__ssce_migrations
artifacts
billing_accounts
billing_transactions
outbox_messages
reference_edges
style_events
style_signatures
```

Materialized partial unique index for Risk B:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND tablename='style_signatures'
ORDER BY indexname;
```

Relevant observed index:

```text
style_signatures_current_active_row_idx
CREATE UNIQUE INDEX style_signatures_current_active_row_idx
ON public.style_signatures (workspace_id, scope_type, scope_key)
WHERE (is_current = true)
```

## Sweeper Smoke Test

### Seed State

Reset the live tables and inserted:

- 1 `billing_accounts` row:
  - `uid=live-user`
  - `available_credits=2`
  - `pending_credits=8`
- 4 expired `billing_transactions` rows:
  - `req-live-1`
  - `req-live-2`
  - `req-live-3`
  - `req-live-4`

Each transaction had `cost_credits=2` and `expires_at < NOW()`.

### Concurrency Method

Spawned 2 virtual workers from the same worktree, both using the exact same claim pattern as `apps/api/src/workers/billing-timeout-sweeper.ts`:

```sql
SELECT ...
FROM billing_transactions
WHERE status IN ('reserved', 'executing')
  AND finalized_at IS NULL
  AND expires_at <= $now
ORDER BY expires_at ASC
FOR UPDATE SKIP LOCKED
LIMIT $batchSize
```

The smoke runner intentionally held row locks with `pg_sleep(2)` after claim to force overlap between workers.

### First Concurrent Run

Observed:

- `worker-a` claimed `req-live-1`, `req-live-2`
- `worker-b` hit `P2034` on `billing_accounts` write conflict

This confirmed live serializable contention exists under real overlap.

### Retry-Enabled Concurrent Run

Re-ran the smoke test with the same serializable retry policy used by the production sweeper helper.

Worker outputs:

```json
{"workerId":"worker-a","claimedClientRequestIds":["req-live-1","req-live-2"],"attempt":0}
{"workerId":"worker-b","claimedClientRequestIds":["req-live-3","req-live-4"],"attempt":1}
```

Interpretation:

- `worker-a` succeeded on first attempt
- `worker-b` retried once after `P2034`
- after retry, `worker-b` claimed only the remaining rows
- no duplicate row finalization occurred

### Final Live State

Final `billing_transactions`:

```text
req-live-1 refunded  Timed out and finalized by worker-a
req-live-2 refunded  Timed out and finalized by worker-a
req-live-3 refunded  Timed out and finalized by worker-b
req-live-4 refunded  Timed out and finalized by worker-b
```

Final `billing_accounts`:

```text
uid=live-user
available_credits=10
pending_credits=0
refunded_credits=8
occ_version=5
```

Final `outbox_messages`:

```text
billing:req-live-1:timed-out
billing:req-live-2:timed-out
billing:req-live-3:timed-out
billing:req-live-4:timed-out
```

## Conclusion

Definition of Done status:

- [x] actual PostgreSQL 16+ instance connected
- [x] `corepack pnpm db:ssce:migrate` completed successfully against the live DB
- [x] concurrent sweeper smoke test verified `FOR UPDATE SKIP LOCKED` batch partitioning
- [x] concurrent overlap produced a real `P2034`, and retry logic allowed the second worker to complete the remaining batch without duplicate settlement
- [x] live verification recorded in this handoff document

## Out of Scope

The following were not touched in this step by instruction:

- Turbopack worktree symlink build issue
- `tests/e2e` syntax error outside the backend DB verification scope

