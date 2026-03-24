type SsceScopeType = 'global' | 'destination' | 'recipient' | 'task';
type ArtifactKind = 'reference' | 'generated_draft' | 'final_artifact';
type ContentFormat = 'plain_text' | 'markdown' | 'html' | 'json';
type StyleEventType = 'harvest' | 'generate' | 'feedback';
type ReferenceEdgeType = 'references' | 'derived_from' | 'context_for' | 'finalized_from';

type TableName = 'artifacts' | 'style_signatures' | 'style_events' | 'reference_edges';
type ColumnType = 'uuid' | 'text' | 'enum' | 'integer' | 'json' | 'timestamp';

interface ForeignKeyDefinition {
  table: TableName;
  column: string;
  onDelete: 'cascade' | 'restrict' | 'set null';
}

interface ColumnDefinition {
  type: ColumnType;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  description: string;
  references?: ForeignKeyDefinition;
}

interface TableDefinition<TColumns extends Record<string, ColumnDefinition>> {
  name: TableName;
  description: string;
  columns: TColumns;
  compositeUniques?: readonly (readonly string[])[];
  indexes?: readonly (readonly string[])[];
}

export interface ArtifactRecord {
  id: string;
  workspaceId: string;
  externalId: string | null;
  title: string | null;
  content: string;
  contentFormat: ContentFormat;
  artifactKind: ArtifactKind;
  destinationKey: string | null;
  recipientKey: string | null;
  taskKey: string | null;
  structureOutline: string[];
  metadata: Record<string, string | number | boolean | string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface StyleSignatureRecord {
  id: string;
  workspaceId: string;
  scopeType: SsceScopeType;
  scopeKey: string;
  destinationKey: string | null;
  recipientKey: string | null;
  taskKey: string | null;
  signatureVersion: number;
  signalCount: number;
  confidenceScore: number;
  traitsJson: Record<string, string | number | boolean | string[]>;
  sourceArtifactId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StyleEventRecord {
  id: string;
  workspaceId: string;
  eventType: StyleEventType;
  artifactId: string | null;
  generatedDraftArtifactId: string | null;
  finalArtifactId: string | null;
  signatureId: string | null;
  diffSummary: string | null;
  payloadSnapshot: string;
  createdAt: string;
}

export interface ReferenceEdgeRecord {
  id: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  edgeType: ReferenceEdgeType;
  weight: number;
  rationale: string | null;
  createdAt: string;
}

function defineTable<TColumns extends Record<string, ColumnDefinition>>(
  definition: TableDefinition<TColumns>
): TableDefinition<TColumns> {
  return definition;
}

export const artifactsTable = defineTable({
  name: 'artifacts',
  description: 'Canonical artifact rows for reference, generated draft, and final output material.',
  columns: {
    id: { type: 'uuid', primaryKey: true, description: 'Artifact primary key.' },
    workspace_id: { type: 'text', description: 'Workspace tenant key.' },
    external_id: {
      type: 'text',
      unique: true,
      nullable: true,
      description: 'Caller supplied id used when wiring reference edges during harvest.'
    },
    title: { type: 'text', nullable: true, description: 'Optional artifact title.' },
    content: { type: 'text', description: 'Artifact body.' },
    content_format: { type: 'enum', description: 'Artifact serialization format.' },
    artifact_kind: { type: 'enum', description: 'Reference, generated draft, or final artifact.' },
    destination_key: { type: 'text', nullable: true, description: 'Destination scope partition.' },
    recipient_key: { type: 'text', nullable: true, description: 'Recipient scope partition.' },
    task_key: { type: 'text', nullable: true, description: 'Task scope partition.' },
    structure_outline: { type: 'json', description: 'Normalized structural outline for diffing.' },
    metadata: { type: 'json', description: 'Opaque metadata bag.' },
    created_at: { type: 'timestamp', description: 'Creation timestamp.' },
    updated_at: { type: 'timestamp', description: 'Update timestamp.' }
  },
  indexes: [['workspace_id'], ['workspace_id', 'artifact_kind']]
} as const);

export const styleSignaturesTable = defineTable({
  name: 'style_signatures',
  description: 'Four-layer style signatures that compound across global, destination, recipient, and task scopes.',
  columns: {
    id: { type: 'uuid', primaryKey: true, description: 'Style signature primary key.' },
    workspace_id: { type: 'text', description: 'Workspace tenant key.' },
    scope_type: { type: 'enum', description: 'One of the four SSCE scope layers.' },
    scope_key: { type: 'text', description: 'Deterministic lookup key for the scope.' },
    destination_key: { type: 'text', nullable: true, description: 'Destination discriminator.' },
    recipient_key: { type: 'text', nullable: true, description: 'Recipient discriminator.' },
    task_key: { type: 'text', nullable: true, description: 'Task discriminator.' },
    signature_version: { type: 'integer', description: 'Monotonic signature version.' },
    signal_count: { type: 'integer', description: 'Number of weighted signals currently folded in.' },
    confidence_score: { type: 'integer', description: 'Scaled score in application code.' },
    traits_json: { type: 'json', description: 'Flattened style traits and counters.' },
    source_artifact_id: {
      type: 'uuid',
      nullable: true,
      description: 'Latest artifact that materially changed the signature.',
      references: { table: 'artifacts', column: 'id', onDelete: 'set null' }
    },
    created_at: { type: 'timestamp', description: 'Creation timestamp.' },
    updated_at: { type: 'timestamp', description: 'Update timestamp.' }
  },
  compositeUniques: [['workspace_id', 'scope_type', 'scope_key']],
  indexes: [['workspace_id', 'scope_type'], ['destination_key'], ['recipient_key'], ['task_key']]
} as const);

export const styleEventsTable = defineTable({
  name: 'style_events',
  description: 'Event log for harvest, generate, and feedback operations.',
  columns: {
    id: { type: 'uuid', primaryKey: true, description: 'Style event primary key.' },
    workspace_id: { type: 'text', description: 'Workspace tenant key.' },
    event_type: { type: 'enum', description: 'Harvest, generate, or feedback.' },
    artifact_id: {
      type: 'uuid',
      nullable: true,
      description: 'Primary artifact associated with the event.',
      references: { table: 'artifacts', column: 'id', onDelete: 'set null' }
    },
    generated_draft_artifact_id: {
      type: 'uuid',
      nullable: true,
      description: 'Generated draft artifact pointer.',
      references: { table: 'artifacts', column: 'id', onDelete: 'set null' }
    },
    final_artifact_id: {
      type: 'uuid',
      nullable: true,
      description: 'Final artifact pointer.',
      references: { table: 'artifacts', column: 'id', onDelete: 'set null' }
    },
    signature_id: {
      type: 'uuid',
      nullable: true,
      description: 'Most relevant signature touched by the event.',
      references: { table: 'style_signatures', column: 'id', onDelete: 'set null' }
    },
    diff_summary: {
      type: 'text',
      nullable: true,
      description: 'Human-readable diff summary for feedback events.'
    },
    payload_snapshot: { type: 'json', description: 'Serialized request/response snapshot.' },
    created_at: { type: 'timestamp', description: 'Creation timestamp.' }
  },
  indexes: [['workspace_id', 'event_type'], ['artifact_id'], ['signature_id']]
} as const);

export const referenceEdgesTable = defineTable({
  name: 'reference_edges',
  description: 'Directed graph edges between artifacts used during harvest and feedback compounding.',
  columns: {
    id: { type: 'uuid', primaryKey: true, description: 'Reference edge primary key.' },
    source_artifact_id: {
      type: 'uuid',
      description: 'Edge source artifact.',
      references: { table: 'artifacts', column: 'id', onDelete: 'cascade' }
    },
    target_artifact_id: {
      type: 'uuid',
      description: 'Edge target artifact.',
      references: { table: 'artifacts', column: 'id', onDelete: 'cascade' }
    },
    edge_type: { type: 'enum', description: 'Reference graph relationship type.' },
    weight: { type: 'integer', description: 'Scaled relationship weight stored in application code.' },
    rationale: { type: 'text', nullable: true, description: 'Operator rationale or harvested explanation.' },
    created_at: { type: 'timestamp', description: 'Creation timestamp.' }
  },
  indexes: [['source_artifact_id'], ['target_artifact_id']]
} as const);

export const ssceSchema = {
  tables: {
    artifacts: artifactsTable,
    style_signatures: styleSignaturesTable,
    style_events: styleEventsTable,
    reference_edges: referenceEdgesTable
  },
  relationships: [
    'style_signatures.source_artifact_id -> artifacts.id',
    'style_events.artifact_id -> artifacts.id',
    'style_events.generated_draft_artifact_id -> artifacts.id',
    'style_events.final_artifact_id -> artifacts.id',
    'style_events.signature_id -> style_signatures.id',
    'reference_edges.source_artifact_id -> artifacts.id',
    'reference_edges.target_artifact_id -> artifacts.id'
  ] as const
};

export function assertSsceForeignKeys(
  schema: typeof ssceSchema = ssceSchema
): asserts schema is typeof ssceSchema {
  const tableEntries = Object.entries(schema.tables) as Array<
    [keyof typeof schema.tables, (typeof schema.tables)[keyof typeof schema.tables]]
  >;

  for (const [tableName, table] of tableEntries) {
    for (const [columnName, column] of Object.entries(table.columns) as Array<
      [string, ColumnDefinition]
    >) {
      if (!column.references) {
        continue;
      }

      const targetTable = schema.tables[column.references.table];
      if (!targetTable) {
        throw new Error(
          `SSCE schema FK error: ${tableName}.${columnName} references missing table ${column.references.table}.`
        );
      }

      if (!(column.references.column in targetTable.columns)) {
        throw new Error(
          `SSCE schema FK error: ${tableName}.${columnName} references missing column ${column.references.table}.${column.references.column}.`
        );
      }
    }
  }
}

assertSsceForeignKeys();
