import { notionDirectWriteRequestSchema, notionDirectWriteResponseSchema } from '@/shared/contracts/v4-infra';
import type { NotionDirectWriteRequest } from '@/shared/contracts/v4-infra';

export type NotionDirectWriteClientOptions = {
  apiKey: string;
  version?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type NotionDirectWriteInput = {
  databaseId: string;
  title: string;
  summary: string;
  idempotencyKey: string;
  scope: string;
  status: string;
  category: string;
  expiresAt: string;
  createdAt: string;
  rowCount: number;
  sqlPreview: string;
};

export type NotionDirectWriteResult = {
  pageId: string;
  url: string;
};

function buildNotionBody(input: NotionDirectWriteRequest) {
  return {
    parent: {
      database_id: input.databaseId
    },
    properties: {
      Title: {
        title: [
          {
            text: {
              content: input.title
            }
          }
        ]
      },
      Status: {
        select: {
          name: input.status
        }
      },
      Category: {
        select: {
          name: input.category
        }
      },
      Summary: {
        rich_text: [
          {
            text: {
              content: input.summary
            }
          }
        ]
      },
      'Idempotency Key': {
        rich_text: [
          {
            text: {
              content: input.idempotencyKey
            }
          }
        ]
      },
      Scope: {
        rich_text: [
          {
            text: {
              content: input.scope
            }
          }
        ]
      },
      'Expires At': {
        date: {
          start: input.expiresAt
        }
      },
      'Created At': {
        date: {
          start: input.createdAt
        }
      },
      'Neon Row Count': {
        number: input.rowCount
      },
      'Neon SQL Preview': {
        rich_text: [
          {
            text: {
              content: input.sqlPreview
            }
          }
        ]
      }
    }
  };
}

export class NotionDirectWriteClient {
  private readonly apiKey: string;

  private readonly version: string;

  private readonly fetchImpl: typeof fetch;

  private readonly timeoutMs: number;

  constructor(options: NotionDirectWriteClientOptions) {
    this.apiKey = options.apiKey.trim();
    this.version = (options.version ?? '2022-06-28').trim();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;

    if (!this.apiKey) {
      throw new Error('[v4-notion] apiKey is required.');
    }
  }

  async writePage(input: NotionDirectWriteInput): Promise<NotionDirectWriteResult> {
    const parsed = notionDirectWriteRequestSchema.parse(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': this.version
        },
        body: JSON.stringify(buildNotionBody(parsed)),
        signal: controller.signal
      });

      const rawBody = await response.text();
      if (!response.ok) {
        throw new Error(
          `[v4-notion] HTTP ${response.status} from Notion page creation endpoint: ${rawBody || 'empty body'}`
        );
      }

      let json: unknown;
      try {
        json = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        throw new Error('[v4-notion] Notion endpoint returned invalid JSON.');
      }

      const parsedResponse = notionDirectWriteResponseSchema.parse({
        pageId: typeof (json as Record<string, unknown>).id === 'string' ? (json as Record<string, unknown>).id : '',
        url: typeof (json as Record<string, unknown>).url === 'string' ? (json as Record<string, unknown>).url : ''
      });

      return parsedResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createNotionDirectWriteClient(options: NotionDirectWriteClientOptions): NotionDirectWriteClient {
  return new NotionDirectWriteClient(options);
}

export { buildNotionBody };
