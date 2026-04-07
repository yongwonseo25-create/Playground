CREATE UNIQUE INDEX IF NOT EXISTS style_signatures_current_active_row_idx
  ON style_signatures(workspace_id, scope_type, scope_key)
  WHERE is_current = TRUE;

ALTER TABLE style_signatures
  ADD CONSTRAINT style_signatures_version_positive_chk
  CHECK (version_no > 0 AND occ_version > 0);

ALTER TABLE style_events
  ADD CONSTRAINT style_events_payload_xor_chk
  CHECK (
    (payload_snapshot_inline IS NOT NULL AND payload_snapshot_uri IS NULL)
    OR (payload_snapshot_inline IS NULL AND payload_snapshot_uri IS NOT NULL)
  );

ALTER TABLE outbox_messages
  ADD CONSTRAINT outbox_messages_payload_xor_chk
  CHECK (
    (payload_inline IS NOT NULL AND payload_uri IS NULL)
    OR (payload_inline IS NULL AND payload_uri IS NOT NULL)
  );

ALTER TABLE billing_accounts
  ADD CONSTRAINT billing_accounts_credit_floor_chk
  CHECK (
    available_credits >= 0
    AND pending_credits >= 0
    AND deducted_credits >= 0
    AND refunded_credits >= 0
    AND occ_version > 0
  );

ALTER TABLE billing_transactions
  ADD CONSTRAINT billing_transactions_credit_positive_chk
  CHECK (cost_credits > 0);

CREATE INDEX IF NOT EXISTS billing_transactions_timeout_sweeper_idx
  ON billing_transactions(expires_at, heartbeat_at)
  WHERE status IN ('reserved', 'executing') AND finalized_at IS NULL;
