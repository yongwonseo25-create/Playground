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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS artifacts_external_id_key ON artifacts(external_id);
CREATE INDEX IF NOT EXISTS artifacts_workspace_id_idx ON artifacts(workspace_id);
CREATE INDEX IF NOT EXISTS artifacts_workspace_id_artifact_kind_idx ON artifacts(workspace_id, artifact_kind);

CREATE TABLE IF NOT EXISTS style_signatures (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  destination_key TEXT,
  recipient_key TEXT,
  task_key TEXT,
  signature_version INTEGER NOT NULL DEFAULT 1,
  signal_count INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  traits_json TEXT NOT NULL,
  source_artifact_id TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS style_signatures_workspace_scope_key_key
  ON style_signatures(workspace_id, scope_type, scope_key);
CREATE INDEX IF NOT EXISTS style_signatures_workspace_scope_idx ON style_signatures(workspace_id, scope_type);
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
  payload_snapshot TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL,
  FOREIGN KEY (generated_draft_artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL,
  FOREIGN KEY (final_artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL,
  FOREIGN KEY (signature_id) REFERENCES style_signatures(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS style_events_workspace_event_type_idx ON style_events(workspace_id, event_type);
CREATE INDEX IF NOT EXISTS style_events_artifact_id_idx ON style_events(artifact_id);
CREATE INDEX IF NOT EXISTS style_events_signature_id_idx ON style_events(signature_id);

CREATE TABLE IF NOT EXISTS reference_edges (
  id TEXT PRIMARY KEY NOT NULL,
  source_artifact_id TEXT NOT NULL,
  target_artifact_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  weight REAL NOT NULL,
  rationale TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (target_artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS reference_edges_source_idx ON reference_edges(source_artifact_id);
CREATE INDEX IF NOT EXISTS reference_edges_target_idx ON reference_edges(target_artifact_id);
