CREATE TABLE IF NOT EXISTS v4_idempotency_keys (
  id BIGSERIAL PRIMARY KEY,
  idempotency_key VARCHAR(128) NOT NULL,
  scope VARCHAR(128) NOT NULL DEFAULT 'v4-infra',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS (created_at + INTERVAL '72 hours') STORED,
  CONSTRAINT chk_v4_idempotency_keys_exact_72h CHECK (expires_at = created_at + INTERVAL '72 hours'),
  UNIQUE (idempotency_key, scope)
);

CREATE INDEX IF NOT EXISTS idx_v4_idempotency_keys_expires_at ON v4_idempotency_keys (expires_at);
