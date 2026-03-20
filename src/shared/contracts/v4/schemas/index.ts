import type { V4DestinationKey, V4ExecutionMode, V4StructuredField } from '@/shared/contracts/v4/common';
import {
  buildPayloadFromStructuredFields,
  buildStructuredFieldsFromPayload,
  type V4DestinationSchemaDefinition,
  type V4StructuredPayload,
  validateStructuredPayload
} from '@/shared/contracts/v4/schemas/common';
import { gmailSchemaDefinition } from '@/shared/contracts/v4/schemas/gmail';
import { googleDocsSchemaDefinition } from '@/shared/contracts/v4/schemas/google-docs';
import { kakaoTalkSchemaDefinition } from '@/shared/contracts/v4/schemas/kakaotalk';
import { notionSchemaDefinition } from '@/shared/contracts/v4/schemas/notion';

const destinationSchemaRegistry: Record<V4DestinationKey, V4DestinationSchemaDefinition> = {
  notion: notionSchemaDefinition,
  google_docs: googleDocsSchemaDefinition,
  gmail: gmailSchemaDefinition,
  kakaotalk: kakaoTalkSchemaDefinition
};

export {
  gmailSchemaDefinition,
  googleDocsSchemaDefinition,
  kakaoTalkSchemaDefinition,
  notionSchemaDefinition
};
export type { V4DestinationSchemaDefinition, V4StructuredPayload };

export function getV4DestinationSchema(destinationKey: V4DestinationKey): V4DestinationSchemaDefinition {
  return destinationSchemaRegistry[destinationKey];
}

export function listV4DestinationSchemas(mode?: V4ExecutionMode): V4DestinationSchemaDefinition[] {
  const allDefinitions = Object.values(destinationSchemaRegistry);
  return mode ? allDefinitions.filter((definition) => definition.mode === mode) : allDefinitions;
}

export function buildFallbackStructuredPayload(
  destinationKey: V4DestinationKey,
  transcriptText: string
): V4StructuredPayload {
  return getV4DestinationSchema(destinationKey).buildFallbackPayload(transcriptText);
}

export function validateDestinationStructuredPayload(
  destinationKey: V4DestinationKey,
  payload: unknown
): V4StructuredPayload {
  return validateStructuredPayload(getV4DestinationSchema(destinationKey), payload);
}

export function buildStructuredFieldsForDestination(
  destinationKey: V4DestinationKey,
  payload: unknown
): V4StructuredField[] {
  const definition = getV4DestinationSchema(destinationKey);
  const validatedPayload = validateStructuredPayload(definition, payload);

  return buildStructuredFieldsFromPayload(definition.fieldSpecs, validatedPayload);
}

export function buildStructuredPayloadFromFields(
  destinationKey: V4DestinationKey,
  fields: readonly V4StructuredField[]
): V4StructuredPayload {
  return buildPayloadFromStructuredFields(getV4DestinationSchema(destinationKey), fields);
}
