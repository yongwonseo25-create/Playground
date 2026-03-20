import { z } from 'zod';
import type { V4DestinationSchemaDefinition } from '@/shared/contracts/v4/schemas/common';
import {
  buildTitle,
  takeFirstSentence,
  collapseWhitespace
} from '@/shared/contracts/v4/schemas/common';

const notionSchema = z
  .object({
    page_title: z.string().trim().min(3).max(96),
    workspace: z.string().trim().min(2).max(64),
    summary: z.string().trim().min(12).max(800),
    next_steps: z.string().trim().min(12).max(400),
    priority: z.enum(['low', 'medium', 'high'])
  })
  .strict();

export const notionSchemaDefinition: V4DestinationSchemaDefinition = {
  key: 'notion',
  mode: 'zhi',
  label: 'Notion',
  instruction:
    'Convert the transcript into a Notion-ready page draft with a clear title, concise summary, explicit next steps, and an execution priority.',
  schema: notionSchema as z.ZodType<Record<string, string>>,
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['page_title', 'workspace', 'summary', 'next_steps', 'priority'],
    properties: {
      page_title: {
        type: 'string',
        minLength: 3,
        maxLength: 96,
        description: 'Short Notion page title.'
      },
      workspace: {
        type: 'string',
        minLength: 2,
        maxLength: 64,
        description: 'Workspace or team area that should own the page.'
      },
      summary: {
        type: 'string',
        minLength: 12,
        maxLength: 800,
        description: 'Compact description of the requested action.'
      },
      next_steps: {
        type: 'string',
        minLength: 12,
        maxLength: 400,
        description: 'Single string describing the next execution step.'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Operator priority for the page.'
      }
    }
  },
  fieldSpecs: [
    { key: 'page_title', label: 'Page Title', kind: 'text', placeholder: 'Q2 Launch Ops Brief' },
    { key: 'workspace', label: 'Workspace', kind: 'text', placeholder: 'Operations' },
    { key: 'summary', label: 'Summary', kind: 'textarea', placeholder: 'Summarize the request' },
    { key: 'next_steps', label: 'Next Steps', kind: 'textarea', placeholder: 'Describe the next action' },
    { key: 'priority', label: 'Priority', kind: 'text', placeholder: 'low | medium | high' }
  ],
  warmupTranscript: 'Warm up the Notion schema with a short operating brief.',
  buildFallbackPayload(transcriptText) {
    const normalized = collapseWhitespace(transcriptText);

    return notionSchema.parse({
      page_title: buildTitle('Notion brief', normalized || 'Voice request'),
      workspace: 'Operations',
      summary: takeFirstSentence(
        normalized,
        'Capture the incoming request as a structured Notion brief.',
        220
      ),
      next_steps: takeFirstSentence(
        normalized,
        'Review the brief and assign the owner for execution.',
        220
      ),
      priority: normalized.toLowerCase().includes('urgent') ? 'high' : 'medium'
    });
  }
};
