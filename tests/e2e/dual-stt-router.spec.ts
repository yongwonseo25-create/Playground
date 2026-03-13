import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function createPcmChunks(): Buffer[] {
  return [Buffer.alloc(3200, 4), Buffer.alloc(3200, 8)];
}

async function loadDualSttModule() {
  return await import(pathToFileURL(path.resolve(process.cwd(), 'scripts/lib/dual-stt-router.mjs')).href);
}

test.describe('dual STT router', () => {
  test('keeps Whisper as the default provider even for ko-KR when no override is set', async () => {
    const { createDualSttRouter } = await loadDualSttModule();
    const calls: FetchCall[] = [];

    const router = createDualSttRouter(
      {
        NEXT_PUBLIC_APP_ENV: 'production',
        OPENAI_API_KEY: 'openai-test-key'
      },
      {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          calls.push({ url: String(input), init });
          return jsonResponse({
            text: 'whisper default transcript'
          });
        }
      }
    );

    const result = await router.transcribe({
      chunks: createPcmChunks(),
      sampleRateHz: 16_000,
      language: 'ko-KR'
    });

    expect(result).toMatchObject({
      ok: true,
      provider: 'whisper',
      requestedProvider: 'whisper',
      fallbackUsed: false,
      transcriptText: 'whisper default transcript',
      audio_duration_sec: 0.2
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('api.openai.com');
  });

  test('routes Korean audio to Return Zero only when premium_ko_accuracy is true', async () => {
    const { createDualSttRouter } = await loadDualSttModule();
    const calls: FetchCall[] = [];
    const responses = [
      jsonResponse({
        access_token: 'rtzr-token',
        expire_at: Math.floor(Date.now() / 1000) + 3600
      }),
      jsonResponse({
        id: 'transcribe-job-premium'
      }),
      jsonResponse({
        id: 'transcribe-job-premium',
        status: 'completed',
        results: {
          utterances: [
            {
              start_at: 0,
              duration: 400,
              msg: 'premium route',
              spk: 0
            }
          ]
        }
      })
    ];

    const router = createDualSttRouter(
      {
        NEXT_PUBLIC_APP_ENV: 'production',
        OPENAI_API_KEY: 'openai-test-key',
        RETURN_ZERO_CLIENT_ID: 'rtzr-client-id',
        RETURN_ZERO_CLIENT_SECRET: 'rtzr-client-secret'
      },
      {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          calls.push({ url: String(input), init });
          const response = responses.shift();
          if (!response) {
            throw new Error(`Unexpected fetch call: ${String(input)}`);
          }

          return response;
        },
        sleep: async () => undefined,
        returnZeroPollIntervalMs: 0
      }
    );

    const result = await router.transcribe({
      chunks: createPcmChunks(),
      sampleRateHz: 16_000,
      language: 'ko-KR',
      premium_ko_accuracy: true
    });

    expect(result).toMatchObject({
      provider: 'return-zero',
      requestedProvider: 'return-zero',
      fallbackUsed: false,
      transcriptText: 'premium route',
      audio_duration_sec: 0.2
    });
    expect(calls).toHaveLength(3);
    expect(calls.some((call) => call.url.includes('api.openai.com'))).toBe(false);
  });

  test('routes Korean audio to Return Zero when workflow is high risk', async () => {
    const { createDualSttRouter } = await loadDualSttModule();
    const calls: FetchCall[] = [];
    const responses = [
      jsonResponse({
        access_token: 'rtzr-token',
        expire_at: Math.floor(Date.now() / 1000) + 3600
      }),
      jsonResponse({
        id: 'transcribe-job-medical'
      }),
      jsonResponse({
        id: 'transcribe-job-medical',
        status: 'completed',
        results: {
          utterances: [
            {
              start_at: 0,
              duration: 400,
              msg: 'medical route',
              spk: 0
            }
          ]
        }
      })
    ];

    const router = createDualSttRouter(
      {
        NEXT_PUBLIC_APP_ENV: 'production',
        OPENAI_API_KEY: 'openai-test-key',
        RETURN_ZERO_CLIENT_ID: 'rtzr-client-id',
        RETURN_ZERO_CLIENT_SECRET: 'rtzr-client-secret'
      },
      {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          calls.push({ url: String(input), init });
          const response = responses.shift();
          if (!response) {
            throw new Error(`Unexpected fetch call: ${String(input)}`);
          }

          return response;
        },
        sleep: async () => undefined,
        returnZeroPollIntervalMs: 0
      }
    );

    const result = await router.transcribe({
      chunks: createPcmChunks(),
      sampleRateHz: 16_000,
      language: 'ko-KR',
      workflow: 'medical_note'
    });

    expect(result).toMatchObject({
      provider: 'return-zero',
      requestedProvider: 'return-zero',
      fallbackUsed: false,
      transcriptText: 'medical route'
    });
    expect(calls).toHaveLength(3);
  });

  test('falls back from Return Zero to Whisper and preserves cost metrics', async () => {
    const { createDualSttRouter } = await loadDualSttModule();
    let whisperCalls = 0;

    const router = createDualSttRouter(
      {
        NEXT_PUBLIC_APP_ENV: 'production',
        OPENAI_API_KEY: 'openai-test-key',
        RETURN_ZERO_CLIENT_ID: 'rtzr-client-id',
        RETURN_ZERO_CLIENT_SECRET: 'rtzr-client-secret'
      },
      {
        fetch: async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('/v1/authenticate')) {
            return jsonResponse(
              {
                code: 'auth_failed',
                msg: 'bad credentials'
              },
              401
            );
          }

          if (url.includes('api.openai.com')) {
            whisperCalls += 1;
            return jsonResponse({
              text: 'fallback whisper transcript'
            });
          }

          throw new Error(`Unexpected fetch call: ${url}`);
        }
      }
    );

    const result = await router.transcribe({
      chunks: createPcmChunks(),
      sampleRateHz: 16_000,
      language: 'ko-KR',
      premium_ko_accuracy: true
    });

    expect(result).toMatchObject({
      provider: 'whisper',
      requestedProvider: 'return-zero',
      fallbackUsed: true,
      transcriptText: 'fallback whisper transcript',
      audio_duration_sec: 0.2
    });
    expect(whisperCalls).toBe(1);
  });

  test('retries Whisper once and then fails fast when the default route keeps failing', async () => {
    const { createDualSttRouter } = await loadDualSttModule();
    let whisperCalls = 0;

    const router = createDualSttRouter(
      {
        NEXT_PUBLIC_APP_ENV: 'production',
        OPENAI_API_KEY: 'openai-test-key'
      },
      {
        fetch: async () => {
          whisperCalls += 1;
          return jsonResponse(
            {
              error: {
                message: 'upstream outage'
              }
            },
            503
          );
        },
        sleep: async () => undefined,
        whisperRetryBaseMs: 0,
        whisperMaxAttempts: 2
      }
    );

    await expect(
      router.transcribe({
        chunks: createPcmChunks(),
        sampleRateHz: 16_000,
        language: 'ko-KR'
      })
    ).rejects.toMatchObject({
      name: 'DualSttRouterError',
      details: expect.objectContaining({
        code: 'WHISPER_HTTP_ERROR',
        provider: 'whisper',
        retryable: true
      })
    });

    expect(whisperCalls).toBe(2);
  });

  test('throws a normalized Zod validation error when Return Zero result payload is malformed', async () => {
    const { createDualSttRouter } = await loadDualSttModule();
    const responses = [
      jsonResponse({
        access_token: 'rtzr-token',
        expire_at: Math.floor(Date.now() / 1000) + 3600
      }),
      jsonResponse({
        id: 'transcribe-job-invalid'
      }),
      jsonResponse({
        id: 'transcribe-job-invalid',
        status: 'completed'
      })
    ];

    const router = createDualSttRouter(
      {
        NEXT_PUBLIC_APP_ENV: 'production',
        OPENAI_API_KEY: 'openai-test-key',
        RETURN_ZERO_CLIENT_ID: 'rtzr-client-id',
        RETURN_ZERO_CLIENT_SECRET: 'rtzr-client-secret'
      },
      {
        fetch: async () => {
          const response = responses.shift();
          if (!response) {
            throw new Error('Unexpected fetch call.');
          }

          return response;
        },
        sleep: async () => undefined,
        returnZeroPollIntervalMs: 0
      }
    );

    await expect(
      router.returnZero.transcribe({
        chunks: createPcmChunks(),
        sampleRateHz: 16_000,
        language: 'ko-KR'
      })
    ).rejects.toMatchObject({
      name: 'DualSttRouterError',
      details: expect.objectContaining({
        code: 'RTZR_RESULT_RESPONSE_VALIDATION_FAILED',
        provider: 'return-zero',
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: 'results',
            code: 'invalid_type'
          })
        ])
      })
    });
  });
});
