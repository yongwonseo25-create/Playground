import { z } from 'zod';
import type { V4DestinationSchemaDefinition } from '@/shared/contracts/v4/schemas/common';
import {
  buildTitle,
  takeFirstSentence,
  collapseWhitespace
} from '@/shared/contracts/v4/schemas/common';

const gmailSchema = z
  .object({
    to: z.string().trim().email().or(z.literal('team@example.com')),
    subject: z.string().trim().min(3).max(120),
    preview_text: z.string().trim().min(12).max(180),
    body_markdown: z.string().trim().min(24).max(2_000),
    send_window: z.enum(['now', 'today', 'tomorrow'])
  })
  .strict();

export const gmailSchemaDefinition: V4DestinationSchemaDefinition = {
  key: 'gmail',
  mode: 'hitl',
  label: 'Gmail',
  instruction:
    'Convert the transcript into an approval-ready Gmail draft with recipient, subject line, preview text, markdown body, and a send window.',
  schema: gmailSchema as z.ZodType<Record<string, string>>,
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['to', 'subject', 'preview_text', 'body_markdown', 'send_window'],
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address.'
      },
      subject: {
        type: 'string',
        minLength: 3,
        maxLength: 120,
        description: 'Email subject line.'
      },
      preview_text: {
        type: 'string',
        minLength: 12,
        maxLength: 180,
        description: 'Inbox preview text.'
      },
      body_markdown: {
        type: 'string',
        minLength: 24,
        maxLength: 2000,
        description: 'Markdown email body.'
      },
      send_window: {
        type: 'string',
        enum: ['now', 'today', 'tomorrow'],
        description: 'Recommended send timing.'
      }
    }
  },
  fieldSpecs: [
    { key: 'to', label: 'To', kind: 'text', placeholder: 'team@example.com' },
    { key: 'subject', label: 'Subject', kind: 'text', placeholder: 'Follow-up from today' },
    {
      key: 'preview_text',
      label: 'Preview Text',
      kind: 'text',
      placeholder: 'Short inbox preview'
    },
    {
      key: 'body_markdown',
      label: 'Email Body',
      kind: 'textarea',
      placeholder: 'Write the outbound email body'
    },
    {
      key: 'send_window',
      label: 'Send Window',
      kind: 'text',
      placeholder: 'now | today | tomorrow'
    }
  ],
  warmupTranscript: 'Warm up the Gmail schema with a short customer follow-up.',
  buildFallbackPayload(transcriptText) {
    const normalized = collapseWhitespace(transcriptText);
    const summary = takeFirstSentence(
      normalized,
      'Share a concise follow-up email with the next action and owner.',
      160
    );

    return gmailSchema.parse({
      to: 'team@example.com',
      subject: buildTitle('Follow-up', normalized || 'Voice task', 68),
      preview_text: summary,
      body_markdown: `Hello,\n\n${summary}\n\nNext step: ${takeFirstSentence(
        normalized,
        'Confirm the owner and send the update.',
        220
      )}\n\nThanks,\nVOXERA`,
      send_window: normalized.toLowerCase().includes('tomorrow') ? 'tomorrow' : 'today'
    });
  }
};
