import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { fileURLToPath, URL } from 'node:url'
import { WebSocketServer } from 'ws'
import { createDualSttRouter, normalizeSttError } from './lib/dual-stt-router.mjs'

const localEnvPath = fileURLToPath(new URL('../.env.local', import.meta.url))
if (typeof process.loadEnvFile === 'function' && existsSync(localEnvPath)) {
  process.loadEnvFile(localEnvPath)
}

const wssUrl = new URL(process.env.NEXT_PUBLIC_WSS_URL ?? 'ws://127.0.0.1:8787/voice-session')
const port = Number(process.env.PORT ?? (wssUrl.port || '8787'))
const path = wssUrl.pathname || '/voice-session'
const internalApiBase = process.env.INTERNAL_APP_BASE_URL ?? 'http://127.0.0.1:3000'
const sttRouter = createDualSttRouter(process.env, { logger: console })

function parseBooleanFlag(value) {
  return value === true || value === 'true'
}

async function submitToNextRoute(payload) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`${internalApiBase}/api/voice/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new Error(`API route submit failed (${response.status}): ${details}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function transcribeSession(session) {
  const result = await sttRouter.transcribe({
    chunks: session.chunks,
    sampleRateHz: session.sampleRateHz,
    language: session.language,
    premium_ko_accuracy: session.premiumKoAccuracy,
    workflow: session.workflow
  })

  session.transcriptText = result.transcriptText
  session.sttProvider = result.provider
  session.audioDurationSec = result.audio_duration_sec
  return result
}

const server = createServer((request, response) => {
  if (request.url === '/' || request.url === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    response.end(
      JSON.stringify({
        ok: true,
        service: 'voice-wss-server',
        websocketPath: path
      })
    )
    return
  }

  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify({ ok: false, error: 'Not Found' }))
})
const wss = new WebSocketServer({ server, path })

wss.on('connection', (socket, request) => {
  const requestUrl = new URL(request.url ?? path, `http://${request.headers.host ?? '127.0.0.1'}`)

  const session = {
    sessionId: requestUrl.searchParams.get('sessionId') || randomUUID(),
    sampleRateHz: 16000,
    chunks: [],
    transcriptText: '',
    pcmFrameCount: 0,
    spreadsheetId: '',
    slackChannelId: '',
    language: requestUrl.searchParams.get('language') || 'en-US',
    premiumKoAccuracy: parseBooleanFlag(requestUrl.searchParams.get('premium_ko_accuracy')),
    workflow: requestUrl.searchParams.get('workflow') || '',
    sttProvider: 'whisper',
    audioDurationSec: 0
  }

  socket.on('message', async (message, isBinary) => {
    try {
      if (isBinary) {
        session.chunks.push(Buffer.from(message))
        session.pcmFrameCount += Buffer.byteLength(message) / 2
        return
      }

      const payload = JSON.parse(message.toString())
      switch (payload.type) {
        case 'session.start': {
          session.sessionId = payload.sessionId || session.sessionId
          session.sampleRateHz = Number(payload.audio?.sampleRateHz ?? payload.sampleRateHz) || 16000
          session.spreadsheetId = payload.spreadsheetId || ''
          session.slackChannelId = payload.slackChannelId || ''
          session.language = typeof payload.language === 'string' ? payload.language : session.language
          session.premiumKoAccuracy = parseBooleanFlag(payload.premium_ko_accuracy)
          session.workflow = typeof payload.workflow === 'string' ? payload.workflow : session.workflow
          session.chunks = []
          session.transcriptText = ''
          session.pcmFrameCount = 0
          session.sttProvider = 'whisper'
          session.audioDurationSec = 0
          socket.send(
            JSON.stringify({
              type: 'session.ready',
              sessionId: session.sessionId,
              acceptedAt: new Date().toISOString()
            })
          )
          break
        }
        case 'session.stop': {
          const result = await transcribeSession(session)
          socket.send(
            JSON.stringify({
              type: 'transcript.final',
              sessionId: session.sessionId,
              text: result.transcriptText,
              isFinal: true,
              pcmFrameCount: session.pcmFrameCount,
              stt_provider: session.sttProvider,
              audio_duration_sec: session.audioDurationSec
            })
          )
          break
        }
        case 'session.submit': {
          if (!session.transcriptText && session.chunks.length > 0) {
            await transcribeSession(session)
          }

          const submitResult = await submitToNextRoute({
            clientRequestId: payload.clientRequestId,
            transcriptText: session.transcriptText,
            spreadsheetId: payload.spreadsheetId || session.spreadsheetId,
            slackChannelId: payload.slackChannelId || session.slackChannelId,
            sessionId: session.sessionId,
            pcmFrameCount: session.pcmFrameCount,
            stt_provider: session.sttProvider,
            audio_duration_sec: session.audioDurationSec
          })

          socket.send(
            JSON.stringify({
              type: 'session.submitted',
              clientRequestId: payload.clientRequestId,
              acceptedForRetry: Boolean(submitResult?.acceptedForRetry),
              reason: typeof submitResult?.reason === 'string' ? submitResult.reason : ''
            })
          )
          break
        }
        case 'session.cancel': {
          session.chunks = []
          session.transcriptText = ''
          session.pcmFrameCount = 0
          session.sttProvider = 'whisper'
          session.audioDurationSec = 0
          break
        }
        default:
          break
      }
    } catch (error) {
      const normalizedError = normalizeSttError(error, {
        requestedProvider: sttRouter.route({
          language: session.language,
          premium_ko_accuracy: session.premiumKoAccuracy,
          workflow: session.workflow
        }).id
      })

      socket.send(
        JSON.stringify({
          type: 'session.error',
          sessionId: session.sessionId,
          error: normalizedError.error,
          retryable: normalizedError.retryable
        })
      )
    }
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`[voice-wss] listening on 0.0.0.0:${port}${path}`)
})
