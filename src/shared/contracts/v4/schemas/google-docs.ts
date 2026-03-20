import { z } from 'zod';
import type { V4DestinationSchemaDefinition } from '@/shared/contracts/v4/schemas/common';
import {
  buildMultilineOutline,
  buildTitle,
  takeFirstSentence,
  collapseWhitespace
} from '@/shared/contracts/v4/schemas/common';

const googleDocsSchema = z
  .object({
    document_title: z.string().trim().min(3).max(96),
    document_type: z.enum(['brief', 'meeting_notes', 'proposal']),
    executive_summary: z.string().trim().min(12).max(800),
    outline: z.string().trim().min(12).max(1_000),
    review_status: z.enum(['draft', 'ready_for_review'])
  })
  .strict();

export const googleDocsSchemaDefinition: V4DestinationSchemaDefinition = {
  key: 'google_docs',
  mode: 'zhi',
  label: 'Google Docs',
  instruction:
    'Convert the transcript into a Google Docs draft with a document title, a concise executive summary, a multi-line outline, and a review status.',
  schema: googleDocsSchema as z.ZodType<Record<string, string>>,
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'document_title',
      'document_type',
      'executive_summary',
      'outline',
      'review_status'
    ],
    properties: {
      document_title: {
        type: 'string',
        minLength: 3,
        maxLength: 96,
        description: 'Human-readable document title.'
      },
      document_type: {
        type: 'string',
        enum: ['brief', 'meeting_notes', 'proposal'],
        description: 'Document archetype.'
      },
      executive_summary: {
        type: 'string',
        minLength: 12,
        maxLength: 800,
        description: 'Top-line summary for the document.'
      },
      outline: {
        type: 'string',
        minLength: 12,
        maxLength: 1000,
        description: 'Multi-line outline to seed the document body.'
      },
      review_status: {
        type: 'string',
        enum: ['draft', 'ready_for_review'],
        description: 'Review state for the document draft.'
      }
    }
  },
  fieldSpecs: [
    {
      key: 'document_title',
      label: 'Document Title',
      kind: 'text',
      placeholder: 'Customer Discovery Notes'
    },
    {
      key: 'document_type',
      label: 'Document Type',
      kind: 'text',
      placeholder: 'brief | meeting_notes | proposal'
    },
    {
      key: 'executive_summary',
      label: 'Executive Summary',
      kind: 'textarea',
      placeholder: 'Summarize the document intent'
    },
    { key: 'outline', label: 'Outline', kind: 'textarea', placeholder: '1. Context\n2. Action\n3. Risks' },
    {
      key: 'review_status',
      label: 'Review Status',
      kind: 'text',
      placeholder: 'draft | ready_for_review'
    }
  ],
  warmupTranscript: 'Warm up the Google Docs schema with a short meeting recap.',
  buildFallbackPayload(transcriptText) {
    const normalized = collapseWhitespace(transcriptText);

    return googleDocsSchema.parse({
      document_title: buildTitle('Google Doc', normalized || 'Voice draft'),
      document_type: normalized.toLowerCase().includes('proposal') ? 'proposal' : 'brief',
      executive_summary: takeFirstSentence(
        normalized,
        'Summarize the request into a collaborative document draft.',
        240
      ),
      outline: buildMultilineOutline(
        normalized,
        ['Context', 'Action items', 'Review notes'],
        '1. Context: Warm-up document\n2. Action items: Seed the first draft\n3. Review notes: Hold for async review'
      ),
      review_status: 'draft'
    });
  }
};
