const originalFetch = globalThis.fetch.bind(globalThis)
const OPENAI_TRANSCRIPT_URL = 'https://api.openai.com/v1/audio/transcriptions'
const RETURN_ZERO_BASE_URL = 'https://openapi.vito.ai'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

globalThis.fetch = async (input, init) => {
  const url = String(input)

  if (url === OPENAI_TRANSCRIPT_URL) {
    console.log('[mock-stt] provider=whisper')
    return jsonResponse({
      text: 'Whisper default route verified.'
    })
  }

  if (url === `${RETURN_ZERO_BASE_URL}/v1/authenticate`) {
    console.log('[mock-stt] provider=return-zero auth')
    return jsonResponse({
      access_token: 'mock-return-zero-token',
      expire_at: Math.floor(Date.now() / 1000) + 3600
    })
  }

  if (url === `${RETURN_ZERO_BASE_URL}/v1/transcribe`) {
    console.log('[mock-stt] provider=return-zero submit')
    return jsonResponse({
      id: 'mock-return-zero-job'
    })
  }

  if (url === `${RETURN_ZERO_BASE_URL}/v1/transcribe/mock-return-zero-job`) {
    console.log('[mock-stt] provider=return-zero result')
    return jsonResponse({
      id: 'mock-return-zero-job',
      status: 'completed',
      results: {
        utterances: [
          {
            start_at: 0,
            duration: 400,
            msg: 'Return Zero premium route verified.',
            spk: 0
          }
        ]
      }
    })
  }

  return originalFetch(input, init)
}

process.env.NEXT_PUBLIC_APP_ENV ??= 'local'
process.env.NEXT_PUBLIC_WSS_URL ??= 'ws://127.0.0.1:8787/voice-session'
process.env.INTERNAL_APP_BASE_URL ??= 'http://127.0.0.1:3400'
process.env.OPENAI_API_KEY ??= 'openai-test-key'
process.env.RETURN_ZERO_CLIENT_ID ??= 'return-zero-client-id'
process.env.RETURN_ZERO_CLIENT_SECRET ??= 'return-zero-client-secret'

await import('../../../scripts/voice-wss-server.mjs')
