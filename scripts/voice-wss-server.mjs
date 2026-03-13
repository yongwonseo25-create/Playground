import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { WebSocketServer } from 'ws';

const wssUrl = new URL(process.env.NEXT_PUBLIC_WSS_URL ?? 'ws://127.0.0.1:8787/voice-session');
const port = Number(wssUrl.port || '8787');
const path = wssUrl.pathname || '/voice-session';
const openAiKey = process.env.OPENAI_API_KEY;
const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? 'local';
const internalApiBase = process.env.INTERNAL_APP_BASE_URL ?? 'http://127.0.0.1:3000';

function encodeWavFromPcm16(chunks, sampleRateHz = 16000) {
  const pcmBuffer = Buffer.concat(chunks);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRateHz, 24);
  header.writeUInt32LE(sampleRateHz * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function transcribeWithWhisper({ chunks, sampleRateHz }) {
  if (!chunks.length) {
    return '';
  }

  if (!openAiKey) {
    if (appEnv === 'local' || appEnv === 'development') {
      return '[local] transcript fallback (OPENAI_API_KEY missing).';
    }
    throw new Error('OPENAI_API_KEY is missing on WS server runtime.');
  }

  const wavBuffer = encodeWavFromPcm16(chunks, sampleRateHz);
  const file = new File([wavBuffer], 'voice.wav', { type: 'audio/wav' });
  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('file', file);
  form.append('response_format', 'json');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`
      },
      body: form,
      signal: controller.signal
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      if (appEnv === 'local' || appEnv === 'development') {
        return `[local] transcript fallback (whisper ${response.status}).`;
      }
      throw new Error(`Whisper transcription failed (${response.status}): ${details}`);
    }

    const json = await response.json();
    if (typeof json?.text !== 'string') {
      throw new Error('Whisper response did not include text.');
    }

    return json.text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function submitToNextRoute(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${internalApiBase}/api/voice/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`API route submit failed (${response.status}): ${details}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

const server = createServer();
const wss = new WebSocketServer({ server, path });

wss.on('connection', (socket, request) => {
  const requestUrl = new URL(request.url ?? path, `http://${request.headers.host ?? '127.0.0.1'}`);

  const session = {
    sessionId: requestUrl.searchParams.get('sessionId') || randomUUID(),
    sampleRateHz: 16000,
    chunks: [],
    transcriptText: '',
    pcmFrameCount: 0,
    spreadsheetId: '',
    slackChannelId: ''
  };

  socket.send(JSON.stringify({ type: 'session.ready', sessionId: session.sessionId }));

  socket.on('message', async (message, isBinary) => {
    try {
      if (isBinary) {
        session.chunks.push(Buffer.from(message));
        session.pcmFrameCount += Buffer.byteLength(message) / 2;
        return;
      }

      const payload = JSON.parse(message.toString());
      switch (payload.type) {
        case 'session.start': {
          session.sessionId = payload.sessionId || session.sessionId;
          session.sampleRateHz = Number(payload.sampleRateHz) || 16000;
          session.spreadsheetId = payload.spreadsheetId || '';
          session.slackChannelId = payload.slackChannelId || '';
          session.chunks = [];
          session.transcriptText = '';
          session.pcmFrameCount = 0;
          break;
        }
        case 'session.stop': {
          const transcriptText = await transcribeWithWhisper({
            chunks: session.chunks,
            sampleRateHz: session.sampleRateHz
          });

          session.transcriptText = transcriptText;
          socket.send(
            JSON.stringify({
              type: 'session.transcript',
              transcriptText,
              pcmFrameCount: session.pcmFrameCount
            })
          );
          break;
        }
        case 'session.submit': {
          if (!session.transcriptText && session.chunks.length > 0) {
            session.transcriptText = await transcribeWithWhisper({
              chunks: session.chunks,
              sampleRateHz: session.sampleRateHz
            });
          }

          const submitResult = await submitToNextRoute({
            clientRequestId: payload.clientRequestId,
            transcriptText: session.transcriptText,
            spreadsheetId: payload.spreadsheetId || session.spreadsheetId,
            slackChannelId: payload.slackChannelId || session.slackChannelId,
            sessionId: session.sessionId,
            pcmFrameCount: session.pcmFrameCount
          });

          socket.send(
            JSON.stringify({
              type: 'session.submitted',
              clientRequestId: payload.clientRequestId,
              acceptedForRetry: Boolean(submitResult?.acceptedForRetry),
              reason: typeof submitResult?.reason === 'string' ? submitResult.reason : ''
            })
          );
          break;
        }
        case 'session.cancel': {
          session.chunks = [];
          session.transcriptText = '';
          session.pcmFrameCount = 0;
          break;
        }
        default:
          break;
      }
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: 'session.error',
          reason: error instanceof Error ? error.message : 'Unknown WS server error.'
        })
      );
    }
  });
});

server.listen(port, () => {
  console.log(`[voice-wss] listening on ws://127.0.0.1:${port}${path}`);
});
