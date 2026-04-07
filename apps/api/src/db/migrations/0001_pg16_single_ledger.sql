CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  external_id TEXT,
  title TEXT,
  content TEXT NOT NULL,
  content_format TEXT NOT NULL,
  artifact_kind TEXT NOT NULL,
  destination_key TEXT,
  recipient_key TEXT,
  task_key TEXT,
  structure_outline TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS artifacts_external_id_key
  ON artifacts(external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS artifacts_workspace_id_idx ON artifacts(workspace_id);
CREATE INDEX IF NOT EXISTS artifacts_workspace_id_artifact_kind_idx
  ON artifacts(workspace_id, artifact_kind);

CREATE TABLE IF NOT EXISTS style_signatures (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  destination_key TEXT,
  recipient_key TEXT,
  task_key TEXT,
  version_no INTEGER NOT NULL DEFAULT 1,
  occ_version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  signal_count INTEGER NOT NULL DEFAULT 0,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  traits_json TEXT NOT NULL,
  source_artifact_id TEXT,
  previous_signature_id TEXT,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT style_signatures_workspace_scope_version_key UNIQUE (workspace_id, scope_type, scope_key, version_no),
  CONSTRAINT style_signatures_source_artifact_fk FOREIGN KEY (source_artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL,
  CONSTRAINT style_signatures_previous_signature_fk FOREIGN KEY (previous_signature_id) REFERENCES style_signatures(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS style_signatures_workspace_scope_current_idx
  ON style_signatures(workspace_id, scope_type, scope_key, is_current);
CREATE INDEX IF NOT EXISTS style_signatures_destination_idx ON style_signatures(destination_key);
CREATE INDEX IF NOT EXISTS style_signatures_recipient_idx ON style_signatures(recipient_key);
CREATE INDEX IF NOT EXISTS style_signatures_task_idx ON style_signatures(task_key);

CREATE TABLE IF NOT EXISTS style_events (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  artifact_id TEXT,
  generated_draft_artifact_id TEXT,
  final_artifact_id TEXT,
  signature_id TEXT,
  diff_summary TEXT,
  payload_snapshot_inline TEXT,
  payload_snapshot_uri TEXT,
  payload_snapshot_sha256 TEXT NOT NULL,
  payload_snapshot_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT style_events_artifact_fk FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL,
  CONSTRAINT style_events_generated_draft_fk FOREIGN KEY (generated_draft_artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL,
  CONSTRAINT style_events_final_artifact_fk FOREIGN KEY (final_artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL,
  CONSTRAINT style_events_signature_fk FOREIGN KEY (signature_id) REFERENCES style_signatures(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS style_events_workspace_event_type_idx
  ON style_events(workspace_id, event_type);
CREATE INDEX IF NOT EXISTS style_events_artifact_id_idx ON style_events(artifact_id);
CREATE INDEX IF NOT EXISTS style_events_signature_id_idx ON style_events(signature_id);

CREATE TABLE IF NOT EXISTS reference_edges (
  id TEXT PRIMARY KEY NOT NULL,
  source_artifact_id TEXT NOT NULL,
  target_artifact_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reference_edges_source_fk FOREIGN KEY (source_artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,
  CONSTRAINT reference_edges_target_fk FOREIGN KEY (target_artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS reference_edges_source_idx ON reference_edges(source_artifact_id);
CREATE INDEX IF NOT EXISTS reference_edges_target_idx ON reference_edges(target_artifact_id);

CREATE TABLE IF NOT EXISTS billing_accounts (
  uid TEXT PRIMARY KEY NOT NULL,
  available_credits INTEGER NOT NULL DEFAULT 0,
  pending_credits INTEGER NOT NULL DEFAULT 0,
  deducted_credits INTEGER NOT NULL DEFAULT 0,
  refunded_credits INTEGER NOT NULL DEFAULT 0,
  occ_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  uid TEXT NOT NULL,
  client_request_id TEXT NOT NULL UNIQUE,
  cost_credits INTEGER NOT NULL,
  output_type TEXT NOT NULL,
  prompt_preview TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_name TEXT,
  provider_model TEXT,
  provider_latency_ms INTEGER,
  output_text TEXT,
  provider_usage_json TEXT,
  secret_version TEXT,
  last_error TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  heartbeat_at TIMESTAMPTZ,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executing_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_transactions_account_fk FOREIGN KEY (uid) REFERENCES billing_accounts(uid) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS billing_transactions_uid_status_idx ON billing_transactions(uid, status);
CREATE INDEX IF NOT EXISTS billing_transactions_status_expires_idx ON billing_transactions(status, expires_at);

CREATE TABLE IF NOT EXISTS outbox_messages (
  id TEXT PRIMARY KEY NOT NULL,
  topic TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  payload_inline TEXT,
  payload_uri TEXT,
  payload_sha256 TEXT NOT NULL,
  payload_bytes INTEGER NOT NULL,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outbox_messages_status_available_idx
  ON outbox_messages(status, available_at);
