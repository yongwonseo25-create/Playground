import { z } from 'zod';
import type { V4DestinationSchemaDefinition } from '@/shared/contracts/v4/schemas/common';
import {
  takeFirstSentence,
  collapseWhitespace
} from '@/shared/contracts/v4/schemas/common';

const kakaoTalkSchema = z
  .object({
    recipient_label: z.string().trim().min(2).max(64),
    message_text: z.string().trim().min(12).max(800),
    tone: z.enum(['friendly', 'neutral', 'urgent']),
    cta: z.string().trim().min(6).max(160),
    handoff_note: z.string().trim().min(6).max(240)
  })
  .strict();

export const kakaoTalkSchemaDefinition: V4DestinationSchemaDefinition = {
  key: 'kakaotalk',
  mode: 'hitl',
  label: 'KakaoTalk',
  instruction:
    'Convert the transcript into an approval-ready KakaoTalk message card with recipient label, final message text, tone, CTA, and a short operator handoff note.',
  schema: kakaoTalkSchema as z.ZodType<Record<string, string>>,
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['recipient_label', 'message_text', 'tone', 'cta', 'handoff_note'],
    properties: {
      recipient_label: {
        type: 'string',
        minLength: 2,
        maxLength: 64,
        description: 'Name or channel label for the KakaoTalk recipient.'
      },
      message_text: {
        type: 'string',
        minLength: 12,
        maxLength: 800,
        description: 'Final outbound message.'
      },
      tone: {
        type: 'string',
        enum: ['friendly', 'neutral', 'urgent'],
        description: 'Delivery tone.'
      },
      cta: {
        type: 'string',
        minLength: 6,
        maxLength: 160,
        description: 'Call to action.'
      },
      handoff_note: {
        type: 'string',
        minLength: 6,
        maxLength: 240,
        description: 'Internal note for the approving operator.'
      }
    }
  },
  fieldSpecs: [
    {
      key: 'recipient_label',
      label: 'Recipient',
      kind: 'text',
      placeholder: 'Customer Channel'
    },
    {
      key: 'message_text',
      label: 'Message Text',
      kind: 'textarea',
      placeholder: 'Write the KakaoTalk message'
    },
    {
      key: 'tone',
      label: 'Tone',
      kind: 'text',
      placeholder: 'friendly | neutral | urgent'
    },
    {
      key: 'cta',
      label: 'CTA',
      kind: 'text',
      placeholder: 'Reply by 4 PM'
    },
    {
      key: 'handoff_note',
      label: 'Handoff Note',
      kind: 'textarea',
      placeholder: 'Internal operator note'
    }
  ],
  warmupTranscript: 'Warm up the KakaoTalk schema with a short customer outreach prompt.',
  buildFallbackPayload(transcriptText) {
    const normalized = collapseWhitespace(transcriptText);
    const message = takeFirstSentence(
      normalized,
      'Share a concise KakaoTalk update and request confirmation.',
      220
    );

    return kakaoTalkSchema.parse({
      recipient_label: 'Customer Channel',
      message_text: message,
      tone: normalized.toLowerCase().includes('urgent') ? 'urgent' : 'friendly',
      cta: 'Please confirm the preferred next step.',
      handoff_note: 'Operator should review tone and customer context before sending.'
    });
  }
};
