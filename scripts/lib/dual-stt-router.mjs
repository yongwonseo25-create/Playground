import { File } from 'node:buffer'
import { z } from 'zod'

const RETURN_ZERO_BASE_URL = 'https://openapi.vito.ai'
const OPENAI_TRANSCRIPT_URL = 'https://api.openai.com/v1/audio/transcriptions'
const LOCAL_APP_ENVS = new Set(['local', 'development'])
const HIGH_RISK_WORKFLOWS = new Set(['sales_call', 'medical_note'])

export const sttProviderSchema = z.enum(['whisper', 'return-zero'])
export const circuitStateSchema = z.enum(['CLOSED', 'OPEN', 'HALF_OPEN'])
export const sttWorkflowSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_:-]+$/)

export const contractIssueSchema = z
  .object({
    path: z.string().min(1),
    message: z.string().min(1),
    code: z.string().min(1)
  })
  .strict()

export const sttRouteSuccessSchema = z
  .object({
    ok: z.literal(true),
    transcriptText: z.string(),
    provider: sttProviderSchema,
    stt_provider: sttProviderSchema,
    requestedProvider: sttProviderSchema,
    language: z.string().min(2),
    fallbackUsed: z.boolean(),
    circuitState: circuitStateSchema,
    audio_duration_sec: z.number().nonnegative()
  })
  .strict()

export const sttRouteErrorSchema = z
  .object({
    ok: z.literal(false),
    error: z.string().min(1),
    code: z.string().min(1),
    provider: sttProviderSchema.optional(),
    requestedProvider: sttProviderSchema.optional(),
    fallbackProvider: sttProviderSchema.optional(),
    retryable: z.boolean(),
    circuitState: circuitStateSchema.optional(),
    issues: z.array(contractIssueSchema).default([])
  })
  .strict()

export const returnZeroAuthTokenSchema = z
  .object({
    access_token: z.string().min(1),
    expire_at: z.number().int().positive()
  })
  .strict()

export const returnZeroApiErrorSchema = z
  .object({
    code: z.string().min(1).optional(),
    msg: z.string().min(1).optional(),
    message: z.string().min(1).optional()
  })
  .passthrough()

export const returnZeroTranscribeSubmitSchema = z
  .object({
    id: z.string().min(1)
  })
  .strict()

export const returnZeroUtteranceSchema = z
  .object({
    start_at: z.number().int().nonnegative(),
    duration: z.number().int().nonnegative(),
    msg: z.string(),
    spk: z.number().int().nonnegative().optional(),
    lang: z.string().min(1).optional()
  })
  .passthrough()

export const returnZeroTranscribeResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      id: z.string().min(1),
      status: z.literal('transcribing')
    })
    .passthrough(),
  z
    .object({
      id: z.string().min(1),
      status: z.literal('completed'),
      results: z
        .object({
          utterances: z.array(returnZeroUtteranceSchema)
        })
        .passthrough()
    })
    .passthrough(),
  z
    .object({
      id: z.string().min(1),
      status: z.literal('failed'),
      error: z
        .object({
          code: z.string().min(1),
          message: z.string().min(1)
        })
        .passthrough()
    })
    .passthrough()
])

export const whisperTranscriptionResponseSchema = z
  .object({
    text: z.string()
  })
  .passthrough()

export class SttCircuitOpenError extends Error {
  constructor(retryAfterMs) {
    super(`Circuit breaker is OPEN. Retry after ${retryAfterMs}ms.`)
    this.name = 'SttCircuitOpenError'
    this.retryAfterMs = retryAfterMs
  }
}

export class SttCircuitBreaker {
  constructor(options = {}) {
    this.state = 'CLOSED'
    this.consecutiveFailures = 0
    this.openedAt = null
    this.failureThreshold = options.failureThreshold ?? 3
    this.cooldownMs = options.cooldownMs ?? 30_000
  }

  getState(now = Date.now()) {
    if (this.state === 'OPEN' && this.openedAt !== null && now - this.openedAt >= this.cooldownMs) {
      this.state = 'HALF_OPEN'
    }

    return this.state
  }

  assertCanRequest(now = Date.now()) {
    const state = this.getState(now)
    if (state !== 'OPEN') {
      return
    }

    const retryAfterMs = Math.max(0, this.cooldownMs - (now - (this.openedAt ?? now)))
    throw new SttCircuitOpenError(retryAfterMs)
  }

  recordSuccess() {
    this.consecutiveFailures = 0
    this.state = 'CLOSED'
    this.openedAt = null
  }

  recordFailure(now = Date.now()) {
    this.consecutiveFailures += 1

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN'
      this.openedAt = now
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN'
      this.openedAt = now
    }
  }

  snapshot(now = Date.now()) {
    return {
      state: this.getState(now),
      consecutiveFailures: this.consecutiveFailures,
      failureThreshold: this.failureThreshold,
      cooldownMs: this.cooldownMs,
      openedAt: this.openedAt
    }
  }
}

export class DualSttRouterError extends Error {
  constructor(details, cause) {
    const parsed = sttRouteErrorSchema.parse(details)
    super(parsed.error, cause ? { cause } : undefined)
    this.name = 'DualSttRouterError'
    this.details = parsed
  }
}

function isLocalAppEnv(appEnv) {
  return LOCAL_APP_ENVS.has(appEnv)
}

function trimString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const nextValue = trimString(value)
    if (nextValue) {
      return nextValue
    }
  }

  return null
}

function extractPrimaryLanguage(language) {
  const normalizedLanguage = trimString(language) ?? 'en-US'
  return normalizedLanguage.split('-')[0].toLowerCase()
}

function isKoreanLanguage(language) {
  const normalizedLanguage = (trimString(language) ?? '').toLowerCase()
  return normalizedLanguage === 'ko-kr' || normalizedLanguage.startsWith('ko-')
}

function roundDuration(value) {
  return Math.round(value * 1000) / 1000
}

function calculateAudioDurationSec(chunks, sampleRateHz) {
  if (!Array.isArray(chunks) || chunks.length === 0 || !Number.isFinite(sampleRateHz) || sampleRateHz <= 0) {
    return 0
  }

  const pcmFrameCount = chunks.reduce((sum, chunk) => sum + Buffer.byteLength(chunk) / 2, 0)
  return roundDuration(pcmFrameCount / sampleRateHz)
}

function buildZodIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
    code: issue.code
  }))
}

function createRouterError(details, cause) {
  return new DualSttRouterError(details, cause)
}

function ensureNonEmptyTranscript(text, details) {
  const normalizedText = typeof text === 'string' ? text.trim() : ''
  if (normalizedText.length > 0) {
    return normalizedText
  }

  throw createRouterError(
    {
      ok: false,
      error: 'STT provider returned an empty transcript.',
      code: 'EMPTY_TRANSCRIPT',
      retryable: true,
      ...details
    }
  )
}

function encodeWavFromPcm16(chunks, sampleRateHz = 16000) {
  const pcmBuffer = Buffer.concat(chunks)
  const dataSize = pcmBuffer.length
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRateHz, 24)
  header.writeUInt32LE(sampleRateHz * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmBuffer])
}

function buildReturnZeroConfig(language) {
  return {
    domain: 'GENERAL',
    language: extractPrimaryLanguage(language),
    model_name: 'sommers'
  }
}

function parseJsonText(rawText) {
  if (!rawText) {
    return null
  }

  try {
    return JSON.parse(rawText)
  } catch {
    return null
  }
}

async function readResponseText(response) {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeSttErrorDetails(error, fallback = {}) {
  if (error instanceof DualSttRouterError) {
    return error.details
  }

  if (error instanceof SttCircuitOpenError) {
    return sttRouteErrorSchema.parse({
      ok: false,
      error: error.message,
      code: 'RTZR_CIRCUIT_OPEN',
      retryable: true,
      ...fallback
    })
  }

  if (error instanceof z.ZodError) {
    return sttRouteErrorSchema.parse({
      ok: false,
      error: 'External STT contract validation failed.',
      code: 'STT_CONTRACT_VALIDATION_FAILED',
      retryable: false,
      issues: buildZodIssues(error),
      ...fallback
    })
  }

  return sttRouteErrorSchema.parse({
    ok: false,
    error: error instanceof Error ? error.message : 'Unknown STT router error.',
    code: 'UNKNOWN_STT_ROUTER_ERROR',
    retryable: false,
    ...fallback
  })
}

function shouldPreferReturnZero({ language, premium_ko_accuracy, workflow }) {
  if (!isKoreanLanguage(language)) {
    return false
  }

  if (premium_ko_accuracy === true) {
    return true
  }

  const normalizedWorkflow = trimString(workflow)?.toLowerCase()
  return normalizedWorkflow ? HIGH_RISK_WORKFLOWS.has(normalizedWorkflow) : false
}

export function normalizeSttError(error, fallback = {}) {
  return normalizeSttErrorDetails(error, fallback)
}

export function resolveDualSttEnv(input, options = {}) {
  const logger = options.logger ?? console
  const appEnv = firstNonEmpty(input.NEXT_PUBLIC_APP_ENV, 'local')
  const openAiKey = trimString(input.OPENAI_API_KEY)
  const returnZeroClientId = trimString(input.RETURN_ZERO_CLIENT_ID)
  const returnZeroClientSecret = firstNonEmpty(
    input.RETURN_ZERO_CLIENT_SECRET,
    input.RETURN_ZERO_API_KEY,
    input.RETURN_ZEORO_API_KEY
  )

  if (!['local', 'development', 'staging', 'production'].includes(appEnv)) {
    throw new Error(`[dual-stt] Invalid NEXT_PUBLIC_APP_ENV: "${appEnv}"`)
  }

  if (!openAiKey && !isLocalAppEnv(appEnv)) {
    throw new Error('[dual-stt] Missing OPENAI_API_KEY for non-local STT routing.')
  }

  const returnZeroEnabled = Boolean(returnZeroClientId && returnZeroClientSecret)
  if (!returnZeroEnabled) {
    logger.warn?.(
      '[dual-stt] Return Zero credentials are missing. Whisper will remain the default and premium RTZR overrides will fall back safely.'
    )
  }

  return {
    appEnv,
    openAiKey,
    returnZeroClientId,
    returnZeroClientSecret,
    returnZeroEnabled
  }
}

export function createDualSttRouter(input = process.env, options = {}) {
  const config = resolveDualSttEnv(input, options)
  const logger = options.logger ?? console
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
  const now = options.now ?? (() => Date.now())
  const sleep =
    options.sleep ??
    ((ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      }))

  const returnZeroTimeoutMs = options.returnZeroTimeoutMs ?? 8_000
  const returnZeroPollIntervalMs = options.returnZeroPollIntervalMs ?? 2_000
  const returnZeroPollTimeoutMs = options.returnZeroPollTimeoutMs ?? 15_000
  const whisperTimeoutMs = options.whisperTimeoutMs ?? 15_000
  const whisperRetryBaseMs = options.whisperRetryBaseMs ?? 250
  const whisperMaxAttempts = options.whisperMaxAttempts ?? 2
  const returnZeroBreaker = new SttCircuitBreaker(options.returnZeroBreakerOptions)
  let cachedToken = null

  async function requestReturnZeroAccessToken() {
    if (cachedToken && cachedToken.expireAtEpochSeconds - Math.floor(now() / 1000) > 60) {
      return cachedToken.accessToken
    }

    const body = new URLSearchParams()
    body.set('client_id', config.returnZeroClientId ?? '')
    body.set('client_secret', config.returnZeroClientSecret ?? '')

    let response
    try {
      response = await fetchWithTimeout(
        fetchImpl,
        `${RETURN_ZERO_BASE_URL}/v1/authenticate`,
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body
        },
        returnZeroTimeoutMs
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw createRouterError(
          {
            ok: false,
            error: 'Return Zero authentication timed out.',
            code: 'RTZR_AUTH_TIMEOUT',
            provider: 'return-zero',
            retryable: true,
            circuitState: returnZeroBreaker.snapshot(now()).state
          },
          error
        )
      }

      throw createRouterError(
        {
          ok: false,
          error: 'Return Zero authentication request failed.',
          code: 'RTZR_AUTH_REQUEST_FAILED',
          provider: 'return-zero',
          retryable: true,
          circuitState: returnZeroBreaker.snapshot(now()).state
        },
        error
      )
    }

    const rawText = await readResponseText(response)
    const rawJson = parseJsonText(rawText)

    if (!response.ok) {
      const parsedError = returnZeroApiErrorSchema.safeParse(rawJson)
      const message = parsedError.success
        ? parsedError.data.msg ?? parsedError.data.message ?? 'Return Zero authentication failed.'
        : rawText || 'Return Zero authentication failed.'

      throw createRouterError({
        ok: false,
        error: `Return Zero authentication failed (${response.status}): ${message}`,
        code: 'RTZR_AUTH_HTTP_ERROR',
        provider: 'return-zero',
        retryable: response.status >= 500 || response.status === 429,
        circuitState: returnZeroBreaker.snapshot(now()).state
      })
    }

    const parsedToken = returnZeroAuthTokenSchema.safeParse(rawJson)
    if (!parsedToken.success) {
      throw createRouterError({
        ok: false,
        error: 'Return Zero authentication response contract mismatch.',
        code: 'RTZR_AUTH_RESPONSE_VALIDATION_FAILED',
        provider: 'return-zero',
        retryable: false,
        circuitState: returnZeroBreaker.snapshot(now()).state,
        issues: buildZodIssues(parsedToken.error)
      })
    }

    cachedToken = {
      accessToken: parsedToken.data.access_token,
      expireAtEpochSeconds: parsedToken.data.expire_at
    }

    return cachedToken.accessToken
  }

  async function transcribeWithReturnZero({ chunks, sampleRateHz, language }) {
    returnZeroBreaker.assertCanRequest(now())

    if (!config.returnZeroEnabled) {
      throw createRouterError({
        ok: false,
        error: 'Return Zero credentials are not configured.',
        code: 'RTZR_ENV_MISSING',
        provider: 'return-zero',
        retryable: false,
        circuitState: returnZeroBreaker.snapshot(now()).state
      })
    }

    try {
      const accessToken = await requestReturnZeroAccessToken()
      const wavBuffer = encodeWavFromPcm16(chunks, sampleRateHz)
      const file = new File([wavBuffer], 'voice.wav', { type: 'audio/wav' })
      const form = new FormData()
      form.append('file', file)
      form.append('config', JSON.stringify(buildReturnZeroConfig(language)))

      let submitResponse
      try {
        submitResponse = await fetchWithTimeout(
          fetchImpl,
          `${RETURN_ZERO_BASE_URL}/v1/transcribe`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              Authorization: `Bearer ${accessToken}`
            },
            body: form
          },
          returnZeroTimeoutMs
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw createRouterError(
            {
              ok: false,
              error: 'Return Zero transcription submission timed out.',
              code: 'RTZR_SUBMIT_TIMEOUT',
              provider: 'return-zero',
              retryable: true,
              circuitState: returnZeroBreaker.snapshot(now()).state
            },
            error
          )
        }

        throw createRouterError(
          {
            ok: false,
            error: 'Return Zero transcription submission failed.',
            code: 'RTZR_SUBMIT_REQUEST_FAILED',
            provider: 'return-zero',
            retryable: true,
            circuitState: returnZeroBreaker.snapshot(now()).state
          },
          error
        )
      }

      const rawSubmitText = await readResponseText(submitResponse)
      const rawSubmitJson = parseJsonText(rawSubmitText)

      if (!submitResponse.ok) {
        const parsedError = returnZeroApiErrorSchema.safeParse(rawSubmitJson)
        const message = parsedError.success
          ? parsedError.data.msg ?? parsedError.data.message ?? 'Return Zero transcription failed.'
          : rawSubmitText || 'Return Zero transcription failed.'

        throw createRouterError({
          ok: false,
          error: `Return Zero transcription failed (${submitResponse.status}): ${message}`,
          code: 'RTZR_SUBMIT_HTTP_ERROR',
          provider: 'return-zero',
          retryable: submitResponse.status >= 500 || submitResponse.status === 429,
          circuitState: returnZeroBreaker.snapshot(now()).state
        })
      }

      const parsedSubmit = returnZeroTranscribeSubmitSchema.safeParse(rawSubmitJson)
      if (!parsedSubmit.success) {
        throw createRouterError({
          ok: false,
          error: 'Return Zero submission response contract mismatch.',
          code: 'RTZR_SUBMIT_RESPONSE_VALIDATION_FAILED',
          provider: 'return-zero',
          retryable: false,
          circuitState: returnZeroBreaker.snapshot(now()).state,
          issues: buildZodIssues(parsedSubmit.error)
        })
      }

      const deadline = now() + returnZeroPollTimeoutMs

      while (true) {
        let pollResponse
        try {
          pollResponse = await fetchWithTimeout(
            fetchImpl,
            `${RETURN_ZERO_BASE_URL}/v1/transcribe/${parsedSubmit.data.id}`,
            {
              method: 'GET',
              headers: {
                accept: 'application/json',
                Authorization: `Bearer ${accessToken}`
              }
            },
            returnZeroTimeoutMs
          )
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw createRouterError(
              {
                ok: false,
                error: 'Return Zero transcription polling timed out.',
                code: 'RTZR_POLL_TIMEOUT',
                provider: 'return-zero',
                retryable: true,
                circuitState: returnZeroBreaker.snapshot(now()).state
              },
              error
            )
          }

          throw createRouterError(
            {
              ok: false,
              error: 'Return Zero transcription polling failed.',
              code: 'RTZR_POLL_REQUEST_FAILED',
              provider: 'return-zero',
              retryable: true,
              circuitState: returnZeroBreaker.snapshot(now()).state
            },
            error
          )
        }

        const rawPollText = await readResponseText(pollResponse)
        const rawPollJson = parseJsonText(rawPollText)

        if (!pollResponse.ok) {
          const parsedError = returnZeroApiErrorSchema.safeParse(rawPollJson)
          const message = parsedError.success
            ? parsedError.data.msg ?? parsedError.data.message ?? 'Return Zero polling failed.'
            : rawPollText || 'Return Zero polling failed.'

          throw createRouterError({
            ok: false,
            error: `Return Zero polling failed (${pollResponse.status}): ${message}`,
            code: 'RTZR_POLL_HTTP_ERROR',
            provider: 'return-zero',
            retryable: pollResponse.status >= 500 || pollResponse.status === 429,
            circuitState: returnZeroBreaker.snapshot(now()).state
          })
        }

        const parsedPoll = returnZeroTranscribeResultSchema.safeParse(rawPollJson)
        if (!parsedPoll.success) {
          throw createRouterError({
            ok: false,
            error: 'Return Zero result response contract mismatch.',
            code: 'RTZR_RESULT_RESPONSE_VALIDATION_FAILED',
            provider: 'return-zero',
            retryable: false,
            circuitState: returnZeroBreaker.snapshot(now()).state,
            issues: buildZodIssues(parsedPoll.error)
          })
        }

        if (parsedPoll.data.status === 'completed') {
          const transcriptText = ensureNonEmptyTranscript(
            parsedPoll.data.results.utterances
              .map((utterance) => utterance.msg.trim())
              .filter(Boolean)
              .join(' '),
            {
              provider: 'return-zero',
              requestedProvider: 'return-zero',
              circuitState: returnZeroBreaker.snapshot(now()).state
            }
          )

          returnZeroBreaker.recordSuccess()
          return transcriptText
        }

        if (parsedPoll.data.status === 'failed') {
          throw createRouterError({
            ok: false,
            error: `Return Zero transcription failed: ${parsedPoll.data.error.message}`,
            code: parsedPoll.data.error.code,
            provider: 'return-zero',
            retryable: false,
            circuitState: returnZeroBreaker.snapshot(now()).state
          })
        }

        if (now() >= deadline) {
          throw createRouterError({
            ok: false,
            error: 'Return Zero transcription exceeded the polling deadline.',
            code: 'RTZR_POLL_DEADLINE_EXCEEDED',
            provider: 'return-zero',
            retryable: true,
            circuitState: returnZeroBreaker.snapshot(now()).state
          })
        }

        await sleep(returnZeroPollIntervalMs)
      }
    } catch (error) {
      returnZeroBreaker.recordFailure(now())
      throw error
    }
  }

  async function transcribeWithWhisperOnce({ chunks, sampleRateHz, language }) {
    if (!config.openAiKey) {
      if (isLocalAppEnv(config.appEnv)) {
        return '[local] transcript fallback (OPENAI_API_KEY missing).'
      }

      throw createRouterError({
        ok: false,
        error: 'OPENAI_API_KEY is missing on the STT router runtime.',
        code: 'WHISPER_ENV_MISSING',
        provider: 'whisper',
        retryable: false
      })
    }

    const wavBuffer = encodeWavFromPcm16(chunks, sampleRateHz)
    const file = new File([wavBuffer], 'voice.wav', { type: 'audio/wav' })
    const form = new FormData()
    form.append('model', 'whisper-1')
    form.append('file', file)
    form.append('response_format', 'json')
    form.append('language', extractPrimaryLanguage(language))

    let response
    try {
      response = await fetchWithTimeout(
        fetchImpl,
        OPENAI_TRANSCRIPT_URL,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.openAiKey}`
          },
          body: form
        },
        whisperTimeoutMs
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw createRouterError(
          {
            ok: false,
            error: 'Whisper transcription timed out.',
            code: 'WHISPER_TIMEOUT',
            provider: 'whisper',
            retryable: true
          },
          error
        )
      }

      throw createRouterError(
        {
          ok: false,
          error: 'Whisper transcription request failed.',
          code: 'WHISPER_REQUEST_FAILED',
          provider: 'whisper',
          retryable: true
        },
        error
      )
    }

    if (!response.ok) {
      const details = await readResponseText(response)
      if (isLocalAppEnv(config.appEnv)) {
        return `[local] transcript fallback (whisper ${response.status}).`
      }

      throw createRouterError({
        ok: false,
        error: `Whisper transcription failed (${response.status}): ${details || 'Unknown response body.'}`,
        code: 'WHISPER_HTTP_ERROR',
        provider: 'whisper',
        retryable: response.status >= 500 || response.status === 429
      })
    }

    const rawJson = parseJsonText(await readResponseText(response))
    const parsedResponse = whisperTranscriptionResponseSchema.safeParse(rawJson)
    if (!parsedResponse.success) {
      throw createRouterError({
        ok: false,
        error: 'Whisper response contract mismatch.',
        code: 'WHISPER_RESPONSE_VALIDATION_FAILED',
        provider: 'whisper',
        retryable: false,
        issues: buildZodIssues(parsedResponse.error)
      })
    }

    return ensureNonEmptyTranscript(parsedResponse.data.text, {
      provider: 'whisper',
      requestedProvider: 'whisper'
    })
  }

  async function transcribeWithWhisperRetry(payload) {
    let lastError = null

    for (let attempt = 1; attempt <= whisperMaxAttempts; attempt += 1) {
      try {
        return await transcribeWithWhisperOnce(payload)
      } catch (error) {
        lastError = error
        if (attempt >= whisperMaxAttempts) {
          break
        }

        logger.warn?.(
          `[dual-stt] Whisper attempt ${attempt} failed. Retrying once before fail-fast. ${normalizeSttErrorDetails(error, { provider: 'whisper' }).code}`
        )
        await sleep(whisperRetryBaseMs * attempt)
      }
    }

    throw lastError ?? new Error('Whisper transcription failed.')
  }

  const providers = {
    whisper: {
      id: 'whisper',
      transcribe: transcribeWithWhisperRetry
    },
    'return-zero': {
      id: 'return-zero',
      transcribe: transcribeWithReturnZero
    }
  }

  function routeSttProvider(inputPayload = {}) {
    return shouldPreferReturnZero(inputPayload) ? providers['return-zero'] : providers.whisper
  }

  async function transcribe(inputPayload) {
    const chunks = Array.isArray(inputPayload?.chunks) ? inputPayload.chunks : []
    const sampleRateHz = Number(inputPayload?.sampleRateHz) > 0 ? Number(inputPayload.sampleRateHz) : 16000
    const language = trimString(inputPayload?.language) ?? 'en-US'
    const requestedProvider = routeSttProvider(inputPayload).id
    const audioDurationSec = calculateAudioDurationSec(chunks, sampleRateHz)

    if (chunks.length === 0) {
      return sttRouteSuccessSchema.parse({
        ok: true,
        transcriptText: '',
        provider: requestedProvider,
        stt_provider: requestedProvider,
        requestedProvider,
        language,
        fallbackUsed: false,
        circuitState: returnZeroBreaker.snapshot(now()).state,
        audio_duration_sec: audioDurationSec
      })
    }

    if (requestedProvider === 'whisper') {
      const transcriptText = await providers.whisper.transcribe({ chunks, sampleRateHz, language })
      return sttRouteSuccessSchema.parse({
        ok: true,
        transcriptText,
        provider: 'whisper',
        stt_provider: 'whisper',
        requestedProvider,
        language,
        fallbackUsed: false,
        circuitState: returnZeroBreaker.snapshot(now()).state,
        audio_duration_sec: audioDurationSec
      })
    }

    try {
      const transcriptText = await providers['return-zero'].transcribe({ chunks, sampleRateHz, language })
      return sttRouteSuccessSchema.parse({
        ok: true,
        transcriptText,
        provider: 'return-zero',
        stt_provider: 'return-zero',
        requestedProvider,
        language,
        fallbackUsed: false,
        circuitState: returnZeroBreaker.snapshot(now()).state,
        audio_duration_sec: audioDurationSec
      })
    } catch (error) {
      const normalizedReturnZeroError = normalizeSttErrorDetails(error, {
        provider: 'return-zero',
        requestedProvider,
        circuitState: returnZeroBreaker.snapshot(now()).state
      })

      logger.warn?.(
        `[dual-stt] Return Zero override failed for ${language}. Falling back to Whisper. ${normalizedReturnZeroError.code}: ${normalizedReturnZeroError.error}`
      )

      try {
        const transcriptText = await providers.whisper.transcribe({ chunks, sampleRateHz, language })
        return sttRouteSuccessSchema.parse({
          ok: true,
          transcriptText,
          provider: 'whisper',
          stt_provider: 'whisper',
          requestedProvider,
          language,
          fallbackUsed: true,
          circuitState: returnZeroBreaker.snapshot(now()).state,
          audio_duration_sec: audioDurationSec
        })
      } catch (fallbackError) {
        const normalizedFallbackError = normalizeSttErrorDetails(fallbackError, {
          provider: 'whisper',
          requestedProvider,
          fallbackProvider: 'whisper',
          circuitState: returnZeroBreaker.snapshot(now()).state
        })

        throw createRouterError(
          {
            ok: false,
            error: `Return Zero failed and Whisper fallback also failed. ${normalizedFallbackError.error}`,
            code: 'DUAL_STT_FALLBACK_FAILED',
            provider: 'whisper',
            requestedProvider,
            fallbackProvider: 'whisper',
            retryable: normalizedReturnZeroError.retryable || normalizedFallbackError.retryable,
            circuitState: returnZeroBreaker.snapshot(now()).state,
            issues: normalizedReturnZeroError.issues.length
              ? normalizedReturnZeroError.issues
              : normalizedFallbackError.issues
          },
          fallbackError
        )
      }
    }
  }

  return {
    config,
    returnZero: {
      breaker: returnZeroBreaker,
      transcribe: transcribeWithReturnZero
    },
    whisper: {
      transcribe: transcribeWithWhisperRetry
    },
    route: routeSttProvider,
    snapshot() {
      return {
        returnZeroCircuit: returnZeroBreaker.snapshot(now())
      }
    },
    transcribe
  }
}
