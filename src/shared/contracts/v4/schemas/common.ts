import { z } from 'zod';
import type {
  V4DestinationKey,
  V4ExecutionMode,
  V4StructuredField,
  V4StructuredFieldKind
} from '@/shared/contracts/v4/common';

export type V4StructuredPayload = Record<string, string>;

export interface V4SchemaFieldSpec {
  key: string;
  label: string;
  kind: V4StructuredFieldKind;
  required?: boolean;
  placeholder?: string;
}

export interface V4DestinationSchemaDefinition {
  key: V4DestinationKey;
  mode: V4ExecutionMode;
  label: string;
  instruction: string;
  schema: z.ZodType<V4StructuredPayload>;
  jsonSchema: Record<string, unknown>;
  fieldSpecs: readonly V4SchemaFieldSpec[];
  warmupTranscript: string;
  buildFallbackPayload: (transcriptText: string) => V4StructuredPayload;
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function normalizeTextarea(input: string): string {
  return input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

export function takeFirstSentence(input: string, fallback: string, maxLength: number): string {
  const normalized = collapseWhitespace(input);
  if (!normalized) {
    return fallback;
  }

  const firstSentence = normalized.split(/(?<=[.!?])\s+/u)[0] ?? normalized;
  return firstSentence.slice(0, maxLength).trim();
}

export function buildTitle(prefix: string, transcriptText: string, maxLength = 72): string {
  const normalized = collapseWhitespace(transcriptText);
  if (!normalized) {
    return prefix;
  }

  return `${prefix}: ${normalized.slice(0, Math.max(1, maxLength - prefix.length - 2)).trim()}`;
}

export function buildMultilineOutline(
  transcriptText: string,
  sections: string[],
  fallback: string
): string {
  const normalized = collapseWhitespace(transcriptText);
  if (!normalized) {
    return fallback;
  }

  return sections
    .map((section, index) => `${index + 1}. ${section}: ${normalized.slice(index * 48, index * 48 + 92)}`.trim())
    .join('\n');
}

export function buildStructuredFieldsFromPayload(
  fieldSpecs: readonly V4SchemaFieldSpec[],
  payload: V4StructuredPayload
): V4StructuredField[] {
  return fieldSpecs.map((field) => ({
    key: field.key,
    label: field.label,
    value: payload[field.key] ?? '',
    kind: field.kind,
    required: field.required ?? true,
    placeholder: field.placeholder
  }));
}

export function buildPayloadFromStructuredFields(
  definition: V4DestinationSchemaDefinition,
  fields: readonly V4StructuredField[]
): V4StructuredPayload {
  const values = new Map(fields.map((field) => [field.key, field.value]));
  const rawPayload = Object.fromEntries(
    definition.fieldSpecs.map((field) => [
      field.key,
      field.kind === 'textarea'
        ? normalizeTextarea(values.get(field.key) ?? '')
        : collapseWhitespace(values.get(field.key) ?? '')
    ])
  );

  return definition.schema.parse(rawPayload);
}

export function validateStructuredPayload(
  definition: V4DestinationSchemaDefinition,
  payload: unknown
): V4StructuredPayload {
  return definition.schema.parse(payload);
}
