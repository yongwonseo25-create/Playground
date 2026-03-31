import { z } from 'zod';
import { getServerEnv } from '@/server/config/server-env';
import { getStoredNotionAccessToken } from '@/server/notion/oauth-store';
import { getPrismaClient } from '@/server/prisma/client';

const notionPropertyTypeSchema = z.enum(['title', 'rich_text', 'number', 'checkbox', 'multi_select']);
const strictJsonValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.array(z.string()),
  z.null()
]);

const schemaBindingSchema = z.object({
  sourceKey: z.string().trim().min(1),
  type: notionPropertyTypeSchema
});

const executionBillingContextSchema = z.object({
  user_id: z.string().trim().min(1),
  session_id: z.string().trim().min(1),
  audio_duration: z.number().finite().nonnegative(),
  billed_transcription_unit: z.number().int().nonnegative(),
  billed_execution_unit: z.number().int().nonnegative()
});

const schemaMapSchema = z
  .object({
    titleProperty: z.string().trim().min(1),
    properties: z.record(z.string(), schemaBindingSchema)
  })
  .superRefine((value, ctx) => {
    const titleBinding = value.properties[value.titleProperty];
    if (!titleBinding) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['properties', value.titleProperty],
        message: `titleProperty "${value.titleProperty}" must exist in schemaMap.properties.`
      });
      return;
    }

    if (titleBinding.type !== 'title') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['properties', value.titleProperty, 'type'],
        message: 'titleProperty must map to a title type.'
      });
    }

    const titleBindings = Object.values(value.properties).filter((binding) => binding.type === 'title');
    if (titleBindings.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['properties'],
        message: 'schemaMap.properties must contain exactly one title binding.'
      });
    }
  });

const notionDirectWriteRequestSchema = z
  .object({
    clientRequestId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1).optional(),
    workspaceId: z.string().trim().min(1).optional(),
    databaseId: z.string().trim().min(1).optional(),
    content: z.string().trim().optional(),
    billingContext: executionBillingContextSchema,
    strictJson: z.record(z.string(), strictJsonValueSchema),
    schemaMap: schemaMapSchema
  })
  .superRefine((value, ctx) => {
    if (!value.accessToken && !value.workspaceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['workspaceId'],
        message: 'workspaceId is required when accessToken is not provided.'
      });
    }

    const mappedKeys = new Set<string>();

    for (const [propertyName, binding] of Object.entries(value.schemaMap.properties)) {
      if (mappedKeys.has(binding.sourceKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['schemaMap', 'properties', propertyName, 'sourceKey'],
          message: `sourceKey "${binding.sourceKey}" is mapped more than once.`
        });
      }
      mappedKeys.add(binding.sourceKey);

      if (!(binding.sourceKey in value.strictJson)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['strictJson', binding.sourceKey],
          message: `strictJson is missing required key "${binding.sourceKey}".`
        });
        continue;
      }

      const sourceValue = value.strictJson[binding.sourceKey];
      if (!isValidBindingValue(binding.type, sourceValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['strictJson', binding.sourceKey],
          message: `strictJson.${binding.sourceKey} is incompatible with Notion type "${binding.type}".`
        });
      }
    }

    for (const key of Object.keys(value.strictJson)) {
      if (!mappedKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['strictJson', key],
          message: `strictJson.${key} is not mapped in schemaMap.properties.`
        });
      }
    }
  });

export type StrictJsonValue = z.infer<typeof strictJsonValueSchema>;
export type NotionDirectWriteRequest = z.infer<typeof notionDirectWriteRequestSchema>;

type NotionPropertyType = z.infer<typeof notionPropertyTypeSchema>;
type SchemaBinding = z.infer<typeof schemaBindingSchema>;
type NotionPagePropertyValue =
  | { title: Array<{ type: 'text'; text: { content: string } }> }
  | { rich_text: Array<{ type: 'text'; text: { content: string } }> }
  | { number: number }
  | { checkbox: boolean }
  | { multi_select: Array<{ name: string }> };

interface NotionOAuthTokenResponse {
  access_token: string;
  bot_id?: string;
  workspace_id?: string;
  workspace_name?: string;
  workspace_icon?: string | null;
  duplicated_template_id?: string | null;
  owner?: Record<string, unknown>;
}

interface NotionClientOptions {
  accessToken: string;
  apiBaseUrl?: string;
  notionVersion?: string;
  fetchImpl?: typeof fetch;
}

const MAX_RATE_LIMIT_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

export class NotionClient {
  private readonly fetchImpl: typeof fetch;
  private readonly apiBaseUrl: string;
  private readonly notionVersion: string;

  constructor(private readonly options: NotionClientOptions) {
    const env = getServerEnv();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiBaseUrl = options.apiBaseUrl ?? env.NOTION_API_BASE_URL;
    this.notionVersion = options.notionVersion ?? env.NOTION_API_VERSION;
  }

  async createPage(input: {
    databaseId: string;
    properties: Record<string, NotionPagePropertyValue>;
    content?: string;
  }) {
    const response = await this.fetchWithExponentialBackoff(() =>
      this.fetchImpl(`${this.apiBaseUrl}/pages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.accessToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': this.notionVersion
        },
        body: JSON.stringify({
          parent: {
            database_id: input.databaseId
          },
          properties: input.properties,
          children: input.content ? buildParagraphBlocks(input.content) : undefined
        })
      })
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`Notion create page failed with ${response.status}: ${bodyText}`);
    }

    return response.json() as Promise<Record<string, unknown>>;
  }

  private async fetchWithExponentialBackoff(requestFactory: () => Promise<Response>) {
    let retryCount = 0;

    while (true) {
      const response = await requestFactory();
      if (response.status !== 429 || retryCount >= MAX_RATE_LIMIT_RETRIES) {
        return response;
      }

      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) * 1_000 : NaN;
      const backoffMs = Number.isFinite(retryAfterMs)
        ? retryAfterMs
        : BASE_RETRY_DELAY_MS * 2 ** retryCount;

      retryCount += 1;
      await sleep(backoffMs);
    }
  }
}

export async function exchangeNotionOAuthCode(params: {
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<NotionOAuthTokenResponse> {
  const env = getServerEnv();
  if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET || !env.NOTION_REDIRECT_URI) {
    throw new Error(
      'Missing Notion OAuth environment. Set NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, and NOTION_REDIRECT_URI.'
    );
  }

  const fetchImpl = params.fetchImpl ?? fetch;
  const basicAuth = Buffer.from(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`).toString(
    'base64'
  );

  const response = await fetchImpl(env.NOTION_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: env.NOTION_REDIRECT_URI
    })
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Notion OAuth token exchange failed with ${response.status}: ${bodyText}`);
  }

  return response.json() as Promise<NotionOAuthTokenResponse>;
}

export function parseNotionDirectWriteRequest(input: unknown): NotionDirectWriteRequest {
  return notionDirectWriteRequestSchema.parse(input);
}

export async function writeStrictJsonToNotion(input: NotionDirectWriteRequest) {
  const env = getServerEnv();
  const accessToken =
    input.accessToken ??
    (input.workspaceId ? await getStoredNotionAccessToken({ workspaceId: input.workspaceId }) : null) ??
    process.env.NOTION_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error(
      'Missing Notion access token. Provide accessToken, workspaceId, or NOTION_ACCESS_TOKEN.'
    );
  }

  const databaseId = input.databaseId ?? env.NOTION_DATABASE_ID;
  if (!databaseId) {
    throw new Error('Missing Notion database id. Provide databaseId or NOTION_DATABASE_ID.');
  }

  const client = new NotionClient({ accessToken });
  const page = await client.createPage({
    databaseId,
    properties: buildNotionProperties(input.strictJson, input.schemaMap.properties),
    content: input.content
  });

  await insertExecutionBillingLog(input.billingContext);

  return {
    page,
    resolvedDatabaseId: databaseId,
    clientRequestId: input.clientRequestId
  };
}

async function insertExecutionBillingLog(
  billingContext: z.infer<typeof executionBillingContextSchema>
) {
  const prisma = getPrismaClient();

  await prisma.executionBillingLog.create({
    data: {
      user_id: billingContext.user_id,
      session_id: billingContext.session_id,
      audio_duration: billingContext.audio_duration,
      destination_type: 'notion',
      execution_attempted: true,
      destination_delivered: true,
      billed_transcription_unit: billingContext.billed_transcription_unit,
      billed_execution_unit: billingContext.billed_execution_unit
    }
  });
}

function buildNotionProperties(
  strictJson: Record<string, StrictJsonValue>,
  bindings: Record<string, SchemaBinding>
) {
  const properties: Record<string, NotionPagePropertyValue> = {};

  for (const [propertyName, binding] of Object.entries(bindings)) {
    properties[propertyName] = mapBindingToNotionProperty(binding.type, strictJson[binding.sourceKey]);
  }

  return properties;
}

function mapBindingToNotionProperty(type: NotionPropertyType, value: StrictJsonValue): NotionPagePropertyValue {
  switch (type) {
    case 'title':
      return {
        title: [{ type: 'text', text: { content: truncateText(value as string) } }]
      };
    case 'rich_text':
      return {
        rich_text: [{ type: 'text', text: { content: truncateText(value as string) } }]
      };
    case 'number':
      return { number: value as number };
    case 'checkbox':
      return { checkbox: value as boolean };
    case 'multi_select':
      return {
        multi_select: (value as string[]).slice(0, 100).map((name) => ({ name: truncateText(name, 100) }))
      };
  }
}

function isValidBindingValue(type: NotionPropertyType, value: StrictJsonValue) {
  switch (type) {
    case 'title':
    case 'rich_text':
      return typeof value === 'string' && value.trim().length > 0;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'checkbox':
      return typeof value === 'boolean';
    case 'multi_select':
      return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
  }
}

function buildParagraphBlocks(content: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 100)
    .map((line) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: truncateText(line, 2_000) } }]
      }
    }));
}

function truncateText(value: string, maxLength = 2_000) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
