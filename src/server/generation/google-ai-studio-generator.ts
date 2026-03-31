import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { z } from 'zod';
import type {
  OutputGenerator,
  OutputGeneratorRequest,
  OutputGeneratorResult
} from '@/server/billing/pay-per-output-service';

const aiStudioResponseSchema = z.object({
  usageMetadata: z
    .object({
      promptTokenCount: z.number().int().nonnegative().optional(),
      candidatesTokenCount: z.number().int().nonnegative().optional(),
      totalTokenCount: z.number().int().nonnegative().optional()
    })
    .optional(),
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(
            z.object({
              text: z.string().optional()
            })
          )
        })
      })
    )
    .min(1)
});

type FetchLike = typeof fetch;

export class SecretManagerAccessor {
  constructor(private readonly client: SecretManagerServiceClient) {}

  async getSecretValue(secretVersionName: string): Promise<{ value: string; versionName: string }> {
    const [version] = await this.client.accessSecretVersion({ name: secretVersionName });
    const value = version.payload?.data?.toString('utf8').trim();

    if (!value) {
      throw new Error(`Secret Manager secret "${secretVersionName}" is empty.`);
    }

    return {
      value,
      versionName: version.name ?? secretVersionName
    };
  }
}

export interface GoogleAiStudioGeneratorOptions {
  apiKeySecretName: string;
  apiBaseUrl: string;
  model: string;
  secretAccessor: SecretManagerAccessor;
  fetchImpl?: FetchLike;
}

function buildPrompt(request: OutputGeneratorRequest): string {
  return [
    `Output type: ${request.outputType}`,
    `Client request id: ${request.clientRequestId}`,
    `User id: ${request.uid}`,
    '',
    request.prompt
  ].join('\n');
}

export class GoogleAiStudioGenerator implements OutputGenerator {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: GoogleAiStudioGeneratorOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(request: OutputGeneratorRequest): Promise<OutputGeneratorResult> {
    const { value: apiKey, versionName } = await this.options.secretAccessor.getSecretValue(
      this.options.apiKeySecretName
    );

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const url = `${this.options.apiBaseUrl}/models/${encodeURIComponent(
        this.options.model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: buildPrompt(request)
                }
              ]
            }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(`Google AI Studio responded with ${response.status}: ${bodyText}`);
      }

      const payload = aiStudioResponseSchema.parse(await response.json());
      const outputText = payload.candidates
        .flatMap((candidate) => candidate.content.parts)
        .map((part) => part.text ?? '')
        .join('\n')
        .trim();

      if (!outputText) {
        throw new Error('Google AI Studio returned an empty output.');
      }

      return {
        outputText,
        providerName: 'google-ai-studio',
        providerModel: this.options.model,
        providerLatencyMs: Date.now() - startedAt,
        secretVersion: versionName,
        providerUsage: payload.usageMetadata
          ? {
              promptTokens: payload.usageMetadata.promptTokenCount ?? 0,
              candidatesTokens: payload.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: payload.usageMetadata.totalTokenCount ?? 0
            }
          : null
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
