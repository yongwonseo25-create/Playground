CREATE TABLE IF NOT EXISTS v4_dispatches (
  execution_id TEXT PRIMARY KEY,
  client_request_id TEXT NOT NULL UNIQUE,
  destination_key TEXT NOT NULL,
  transcript_text TEXT NOT NULL,
  structured_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  account_key TEXT NOT NULL,
  webhook_delivered_at TIMESTAMPTZ,
  credit_consumed_at TIMESTAMPTZ,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v4_execution_credit_ledger (
  entry_id TEXT PRIMARY KEY,
  reference_id TEXT NOT NULL UNIQUE,
  account_key TEXT NOT NULL REFERENCES v4_execution_credit_accounts(account_key),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
