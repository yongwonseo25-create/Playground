import { z } from 'zod';

export const backendConnectionStateSchema = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'error'
]);

export type BackendConnectionState = z.infer<typeof backendConnectionStateSchema>;

export const voiceTransportProtocolSchema = z.enum(['ws', 'wss']);
export const voiceInputFormatSchema = z.literal('pcm16');
export const voiceClientEventNameSchema = z.enum(['session.start', 'session.stop']);
export const voiceServerEventNameSchema = z.enum([
  'session.ready',
  'transcript.partial',
  'transcript.final',
  'session.error'
]);

export const voiceSessionContractSchema = z
  .object({
    transport: z
      .object({
        protocol: voiceTransportProtocolSchema,
        endpoint: z.string().min(1),
        auth: z.enum(['jwt', 'cookie', 'none'])
      })
      .strict(),
    audio: z
      .object({
        inputFormat: voiceInputFormatSchema,
        sampleRateHz: z.number().int().positive().nullable(),
        channelCount: z.number().int().positive().nullable()
      })
      .strict(),
    events: z
      .object({
        clientToServer: z.array(voiceClientEventNameSchema).min(1),
        serverToClient: z.array(voiceServerEventNameSchema).min(1)
      })
      .strict()
  })
  .strict();

export type VoiceSessionContract = z.infer<typeof voiceSessionContractSchema>;

export const voiceSessionContract = voiceSessionContractSchema.parse({
  transport: {
    protocol: 'wss',
    endpoint: 'env:NEXT_PUBLIC_WSS_URL',
    auth: 'none'
  },
  audio: {
    inputFormat: 'pcm16',
    sampleRateHz: null,
    channelCount: 1
  },
  events: {
    clientToServer: ['session.start', 'session.stop'],
    serverToClient: ['session.ready', 'transcript.partial', 'transcript.final', 'session.error']
  }
});

export const voiceSessionStartEventSchema = z
  .object({
    type: z.literal('session.start'),
    sessionId: z.string().trim().min(1).max(128),
    sentAt: z.string().datetime({ offset: true }),
    audio: z
      .object({
        format: voiceInputFormatSchema,
        sampleRateHz: z.number().int().positive(),
        channelCount: z.literal(1)
      })
      .strict()
  })
  .strict();

export const voiceSessionStopEventSchema = z
  .object({
    type: z.literal('session.stop'),
    sessionId: z.string().trim().min(1).max(128),
    sentAt: z.string().datetime({ offset: true }),
    totalFrames: z.number().int().nonnegative()
  })
  .strict();

export const voiceClientEventSchema = z.discriminatedUnion('type', [
  voiceSessionStartEventSchema,
  voiceSessionStopEventSchema
]);

export type VoiceClientEvent = z.infer<typeof voiceClientEventSchema>;

export const voiceSessionReadyEventSchema = z
  .object({
    type: z.literal('session.ready'),
    sessionId: z.string().trim().min(1).max(128),
    acceptedAt: z.string().datetime({ offset: true })
  })
  .strict();

export const voiceTranscriptPartialEventSchema = z
  .object({
    type: z.literal('transcript.partial'),
    sessionId: z.string().trim().min(1).max(128),
    text: z.string().trim().min(1),
    isFinal: z.literal(false).optional()
  })
  .strict();

export const voiceTranscriptFinalEventSchema = z
  .object({
    type: z.literal('transcript.final'),
    sessionId: z.string().trim().min(1).max(128),
    text: z.string().trim().min(1),
    isFinal: z.literal(true),
    pcmFrameCount: z.number().int().nonnegative().optional()
  })
  .strict();

export const voiceSessionErrorEventSchema = z
  .object({
    type: z.literal('session.error'),
    sessionId: z.string().trim().min(1).max(128).optional(),
    error: z.string().trim().min(1),
    retryable: z.boolean().default(false)
  })
  .strict();

export const voiceServerEventSchema = z.discriminatedUnion('type', [
  voiceSessionReadyEventSchema,
  voiceTranscriptPartialEventSchema,
  voiceTranscriptFinalEventSchema,
  voiceSessionErrorEventSchema
]);

export type VoiceServerEvent = z.infer<typeof voiceServerEventSchema>;
