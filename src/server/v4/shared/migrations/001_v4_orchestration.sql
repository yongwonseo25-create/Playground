CREATE TABLE IF NOT EXISTS v4_dispatches (
  execution_id TEXT PRIMARY KEY,
  client_request_id TEXT NOT NULL UNIQUE,
  destination_key TEXT NOT NULL,
  transcript_text TEXT NOT NULL,
  structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  job_id TEXT NOT NULL,
  buffer_key TEXT NOT NULL,
  webhook_idempotency_key TEXT NOT NULL,
  credit_transaction_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  account_key TEXT NOT NULL,
  webhook_delivered_at TIMESTAMPTZ,
  credit_consumed_at TIMESTAMPTZ,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v4_approvals (
  approval_id TEXT PRIMARY KEY,
  client_request_id TEXT NOT NULL UNIQUE,
  destination_key TEXT NOT NULL,
  transcript_text TEXT NOT NULL,
  structured_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  job_id TEXT,
  buffer_key TEXT,
  webhook_idempotency_key TEXT,
  credit_transaction_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  actor TEXT,
  account_key TEXT NOT NULL,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v4_approvals_status_created_at
  ON v4_approvals (status, created_at DESC);

CREATE TABLE IF NOT EXISTS v4_execution_credit_accounts (
  account_key TEXT PRIMARY KEY,
  balance INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v4_execution_credit_transactions (
  transaction_id TEXT PRIMARY KEY,
  reference_id TEXT NOT NULL UNIQUE,
  account_key TEXT NOT NULL REFERENCES v4_execution_credit_accounts(account_key),
  destination_key TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_v4_execution_credit_transactions_account_status
  ON v4_execution_credit_transactions (account_key, status, created_at DESC);

CREATE TABLE IF NOT EXISTS v4_execution_credit_ledger (
  entry_id TEXT PRIMARY KEY,
  reference_id TEXT NOT NULL,
  account_key TEXT NOT NULL REFERENCES v4_execution_credit_accounts(account_key),
  transaction_id TEXT,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'legacy',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE v4_dispatches
  ADD COLUMN IF NOT EXISTS credit_transaction_id TEXT;

ALTER TABLE v4_approvals
  ADD COLUMN IF NOT EXISTS credit_transaction_id TEXT;

ALTER TABLE v4_execution_credit_ledger
  DROP CONSTRAINT IF EXISTS v4_execution_credit_ledger_reference_id_key;

ALTER TABLE v4_execution_credit_ledger
  ADD COLUMN IF NOT EXISTS transaction_id TEXT;

ALTER TABLE v4_execution_credit_ledger
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE v4_execution_credit_ledger
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
