import { createHmac, randomUUID } from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type Response } from 'express';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8788),
  APP_ORIGIN: z.string().url().default('http://127.0.0.1:3404'),
  MAKE_WEBHOOK_URL: z.string().url(),
  MAKE_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_WSS_URL: z.string().min(1).optional()
});

const env = envSchema.parse(process.env);

const destinationSchema = z.enum(['Notion', 'Docs', 'Gmail', 'KakaoTalk']);
type Destination = z.infer<typeof destinationSchema>;

const startSessionRequestSchema = z
  .object({
    destination: destinationSchema
  })
  .strict();

const uploadRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    destination: destinationSchema,
    audioByteLength: z.number().int().nonnegative().default(0)
  })
  .strict();

const executeRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    destination: destinationSchema,
    text: z.string().min(1)
  })
  .strict();

const resetRequestSchema = z
  .object({
    sessionId: z.string().min(1)
  })
  .strict();

type FusionSessionStatus = 'created' | 'processing' | 'ready' | 'executing' | 'complete' | 'error';
type FusionMode = 'zhi' | 'hitl';

type FusionSession = {
  sessionId: string;
  destination: Destination;
  mode: FusionMode;
  createdAt: string;
  audioByteLength: number;
  transcriptText: string;
  generatedText: string;
  progressStep: number;
  status: FusionSessionStatus;
  lastError?: string;
  sent: boolean;
  listeners: Set<Response>;
  processingPromise?: Promise<void>;
};

const sessions = new Map<string, FusionSession>();

const destinationConfig: Record<
  Destination,
  {
    label: string;
    mode: FusionMode;
  }
> = {
  Notion: {
    label: 'Notion',
    mode: 'zhi'
  },
  Docs: {
    label: 'Google Docs',
    mode: 'zhi'
  },
  Gmail: {
    label: 'Gmail',
    mode: 'hitl'
  },
  KakaoTalk: {
    label: 'KakaoTalk',
    mode: 'hitl'
  }
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeSse(response: Response, event: string, payload: Record<string, unknown>): void {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function emitToSession(session: FusionSession, event: string, payload: Record<string, unknown>): void {
  for (const response of session.listeners) {
    writeSse(response, event, payload);
  }
}

function buildSyntheticTranscript(session: FusionSession): string {
  const label = destinationConfig[session.destination].label;
  const capturedAt = new Date(session.createdAt).toLocaleString('ko-KR', {
    hour12: false
  });

  return [
    `${label} 실행을 위한 음성 메모가 접수되었습니다.`,
    `세션 ID: ${session.sessionId}`,
    `수집 시각: ${capturedAt}`,
    `오디오 바이트: ${session.audioByteLength}`,
    '핵심 요청을 정리하고 바로 실행 가능한 상태로 다듬어 주세요.'
  ].join('\n');
}

function buildReviewText(session: FusionSession): string {
  const label = destinationConfig[session.destination].label;

  switch (session.destination) {
    case 'Notion':
      return [
        `# ${label} 실행 초안`,
        '',
        '- 목적: 방금 녹음된 메모를 노션 페이지 초안으로 정리합니다.',
        '- 핵심 메모: 요청 배경과 다음 액션을 한 페이지에 요약합니다.',
        '- 다음 단계: 담당자 확인 후 즉시 페이지 생성합니다.',
        '',
        '실행 전 최종 검토를 마쳤습니다.'
      ].join('\n');
    case 'Docs':
      return [
        `문서 제목: ${label} 회의 메모 정리`,
        '',
        '1. 오늘 음성 메모의 핵심 포인트를 문서 상단에 배치합니다.',
        '2. 후속 작업과 담당자를 분리해 문서 하단 액션 섹션에 정리합니다.',
        '3. 공유 가능한 Google Docs 초안 형식으로 다듬습니다.',
        '',
        '실행하면 즉시 초안이 생성됩니다.'
      ].join('\n');
    case 'Gmail':
      return [
        '제목: [VOXERA] 후속 정리 메일 초안',
        '수신: team@voxera.ai',
        '',
        '안녕하세요,',
        '방금 녹음한 음성 메모를 기반으로 핵심 요청과 다음 액션을 정리했습니다.',
        '오늘 안으로 확인이 필요한 항목과 담당자를 아래에 반영해 두었습니다.',
        '',
        '- 액션 1: 우선순위 항목 확인',
        '- 액션 2: 전달용 초안 검토',
        '- 액션 3: 실행 여부 최종 승인',
        '',
        '감사합니다.'
      ].join('\n');
    case 'KakaoTalk':
      return [
        '[VOXERA 카카오톡 메시지 초안]',
        '',
        '방금 음성 메모 정리해뒀어요.',
        '핵심 요청은 오늘 안에 확인이 필요하고,',
        '세부 액션은 문서 초안으로 바로 넘길 수 있는 상태입니다.',
        '',
        '확인되면 바로 실행할게요.'
      ].join('\n');
  }
}

async function processSession(session: FusionSession): Promise<void> {
  if (session.processingPromise) {
    await session.processingPromise;
    return;
  }

  session.processingPromise = (async () => {
    try {
      session.status = 'processing';
      session.transcriptText = buildSyntheticTranscript(session);

      session.progressStep = 1;
      emitToSession(session, 'progress', { step: 1 });
      await wait(850);

      session.progressStep = 2;
      emitToSession(session, 'progress', { step: 2 });
      await wait(1_050);

      session.progressStep = 3;
      emitToSession(session, 'progress', { step: 3 });
      await wait(1_150);

      session.generatedText = buildReviewText(session);
      session.status = 'ready';
      emitToSession(session, 'result', {
        text: session.generatedText,
        mode: session.mode,
        transcriptText: session.transcriptText
      });
    } catch (error) {
      session.status = 'error';
      session.lastError = error instanceof Error ? error.message : 'Processing failed.';
      emitToSession(session, 'error', { message: session.lastError });
    }
  })();

  await session.processingPromise;
}

function createWebhookSignature(timestamp: string, body: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function sendToMake(payload: { sessionId: string; destination: Destination; text: string }): Promise<void> {
  const timestamp = new Date().toISOString();
  const body = JSON.stringify(payload);
  const signature = createWebhookSignature(timestamp, body, env.MAKE_WEBHOOK_SECRET);

  const response = await fetch(env.MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': payload.sessionId,
      'X-Idempotency-Key': payload.sessionId,
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Signature': signature
    },
    body
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Make webhook failed with ${response.status}: ${message}`);
  }
}

function getSessionOrThrow(sessionId: string): FusionSession {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }

  return session;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', env.APP_ORIGIN);
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
});

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    streamStrategy: 'sse',
    wssUrl: env.NEXT_PUBLIC_WSS_URL ?? null
  });
});

app.post('/api/session', (request, response) => {
  const parsed = startSessionRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ ok: false, error: 'Invalid session request.' });
    return;
  }

  const sessionId = `fusion_${randomUUID()}`;
  const destination = parsed.data.destination;
  const session: FusionSession = {
    sessionId,
    destination,
    mode: destinationConfig[destination].mode,
    createdAt: new Date().toISOString(),
    audioByteLength: 0,
    transcriptText: '',
    generatedText: '',
    progressStep: 0,
    status: 'created',
    sent: false,
    listeners: new Set<Response>()
  };

  sessions.set(sessionId, session);

  response.status(201).json({
    ok: true,
    sessionId,
    destination,
    mode: session.mode
  });
});

app.post('/api/upload', (request, response) => {
  const parsed = uploadRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ ok: false, error: 'Invalid upload request.' });
    return;
  }

  try {
    const session = getSessionOrThrow(parsed.data.sessionId);
    if (session.destination !== parsed.data.destination) {
      throw new Error('Destination mismatch for this session.');
    }

    session.audioByteLength = parsed.data.audioByteLength;

    if (session.status === 'created' || session.status === 'error') {
      void processSession(session);
    }

    response.json({
      ok: true,
      sessionId: session.sessionId,
      status: session.status
    });
  } catch (error) {
    response.status(404).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Upload session not found.'
    });
  }
});

app.get('/api/session/:sessionId/events', (request, response) => {
  const session = sessions.get(request.params.sessionId);

  if (!session) {
    response.status(404).json({ ok: false, error: 'Session not found.' });
    return;
  }

  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders();

  session.listeners.add(response);

  writeSse(response, 'ready', {
    sessionId: session.sessionId,
    destination: session.destination,
    mode: session.mode
  });

  if (session.progressStep > 0) {
    writeSse(response, 'progress', { step: session.progressStep });
  }

  if (session.status === 'ready') {
    writeSse(response, 'result', {
      text: session.generatedText,
      mode: session.mode,
      transcriptText: session.transcriptText
    });
  }

  if (session.status === 'error') {
    writeSse(response, 'error', { message: session.lastError ?? 'Processing failed.' });
  }

  request.on('close', () => {
    session.listeners.delete(response);
    response.end();
  });
});

app.post('/api/execute', async (request, response) => {
  const parsed = executeRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ ok: false, error: 'Invalid execute request.' });
    return;
  }

  try {
    const session = getSessionOrThrow(parsed.data.sessionId);

    if (session.destination !== parsed.data.destination) {
      throw new Error('Destination mismatch for this session.');
    }

    if (session.sent) {
      response.json({
        ok: true,
        deduplicated: true,
        sessionId: session.sessionId
      });
      return;
    }

    session.status = 'executing';
    await sendToMake(parsed.data);
    session.status = 'complete';
    session.sent = true;
    emitToSession(session, 'complete', {
      sessionId: session.sessionId,
      destination: session.destination
    });

    response.json({
      ok: true,
      sent: true,
      sessionId: session.sessionId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execution failed.';
    const session = sessions.get(parsed.data.sessionId);
    if (session) {
      session.status = 'error';
      session.lastError = message;
      emitToSession(session, 'error', { message });
    }

    response.status(500).json({
      ok: false,
      error: message
    });
  }
});

app.post('/api/reset', (request, response) => {
  const parsed = resetRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ ok: false, error: 'Invalid reset request.' });
    return;
  }

  const session = sessions.get(parsed.data.sessionId);
  if (session) {
    emitToSession(session, 'reset', { sessionId: session.sessionId });
    for (const client of session.listeners) {
      client.end();
    }
    sessions.delete(parsed.data.sessionId);
  }

  response.json({ ok: true });
});

app.listen(env.PORT, () => {
  console.log(`[fusion-api] listening on http://127.0.0.1:${env.PORT}`);
});
