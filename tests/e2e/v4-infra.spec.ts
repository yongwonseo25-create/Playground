import { expect, test } from '@playwright/test';
import { createMaximumConcurrencyLimiter } from '../../src/server/v4/concurrency';
import { createMemoryIdempotencyStore } from '../../src/server/v4/idempotency-store';
import { getNeonHttpTransportConfig, NeonHttpOneShotClient } from '../../src/server/v4/neon-http';
import {
  NotionDirectWriteClient,
  buildNotionBody
} from '../../src/server/v4/notion-direct-write';
import { createSqsLambdaWorker } from '../../src/server/v4/sqs-lambda-worker';
import { V4_IDEMPOTENCY_TTL_HOURS, v4InfraJobSchema } from '../../src/shared/contracts/v4-infra';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

test.describe('v4 infra', () => {
  test('pins idempotency TTL to exactly 72 hours and disables Neon pooling', () => {
    expect(v4InfraJobSchema.parse({
      idempotencyKey: 'job-72h',
      scope: 'v4-infra',
      title: 'ttl',
      summary: 'ttl',
      neonSql: 'SELECT 1',
      neonParams: [],
      notionDatabaseId: 'db-1',
      notionStatus: 'Inbox',
      notionCategory: 'operations',
      ttlHours: V4_IDEMPOTENCY_TTL_HOURS
    }).ttlHours).toBe(72);

    expect(() =>
      v4InfraJobSchema.parse({
        idempotencyKey: 'job-invalid',
        scope: 'v4-infra',
        title: 'ttl',
        summary: 'ttl',
        neonSql: 'SELECT 1',
        neonParams: [],
        notionDatabaseId: 'db-1',
        notionStatus: 'Inbox',
        notionCategory: 'operations',
        ttlHours: 48
      })
    ).toThrow();

    expect(getNeonHttpTransportConfig()).toEqual({
      mode: 'http-one-shot',
      pooling: false,
      connectionReuse: 'disabled'
    });
  });

  test('maximum concurrency limiter caps active tasks and tracks peak usage', async () => {
    const limiter = createMaximumConcurrencyLimiter(2);
    const first = deferred<void>();
    const second = deferred<void>();
    const activeSnapshots: number[] = [];

    const jobs = [0, 1, 2, 3].map((index) =>
      limiter.run(async () => {
        activeSnapshots.push(limiter.snapshot().active);

        if (index === 0) {
          await first.promise;
        } else if (index === 1) {
          await second.promise;
        }

        return index;
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(limiter.snapshot().active).toBe(2);
    expect(limiter.snapshot().queued).toBe(2);

    first.resolve();
    second.resolve();

    await expect(Promise.all(jobs)).resolves.toEqual([0, 1, 2, 3]);
    expect(Math.max(...activeSnapshots)).toBe(2);
    expect(limiter.snapshot()).toMatchObject({
      active: 0,
      queued: 0,
      peakConcurrency: 2,
      maximumConcurrency: 2
    });
  });

  test('Neon HTTP one-shot client sends SQL and parses structured JSON response', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = new NeonHttpOneShotClient({
      baseUrl: 'https://neon.example/query',
      apiKey: 'secret-neon-key',
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify({ rowCount: 1, rows: [{ id: 42, label: 'ok' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    const result = await client.query({
      sql: 'SELECT * FROM demo WHERE id = $1',
      params: [42],
      timeoutMs: 1_000
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://neon.example/query');
    expect(requests[0]?.init?.method).toBe('POST');
    expect((requests[0]?.init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer secret-neon-key'
    );
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      sql: 'SELECT * FROM demo WHERE id = $1',
      params: [42]
    });
    expect(result).toEqual({
      rowCount: 1,
      rows: [{ id: 42, label: 'ok' }]
    });
  });

  test('Notion direct-write client builds database page payload with zero-retention metadata only', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = new NotionDirectWriteClient({
      apiKey: 'secret-notion-key',
      version: '2022-06-28',
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify({ id: 'page_123', url: 'https://notion.so/page_123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    const body = buildNotionBody({
      databaseId: 'db-123',
      title: 'V4 infra smoke',
      summary: 'A smoke page for infra direct write.',
      idempotencyKey: 'job-123',
      scope: 'v4-infra',
      status: 'Inbox',
      category: 'operations',
      expiresAt: '2026-03-23T00:00:00.000Z',
      createdAt: '2026-03-22T00:00:00.000Z',
      rowCount: 2,
      sqlPreview: 'SELECT * FROM voice_processing_log WHERE status = $1'
    });

    expect(body.parent.database_id).toBe('db-123');
    expect(body.properties.Title.title[0]?.text.content).toBe('V4 infra smoke');
    expect(body.properties['Idempotency Key'].rich_text[0]?.text.content).toBe('job-123');
    expect(body.properties['Neon Row Count'].number).toBe(2);

    const result = await client.writePage({
      databaseId: 'db-123',
      title: 'V4 infra smoke',
      summary: 'A smoke page for infra direct write.',
      idempotencyKey: 'job-123',
      scope: 'v4-infra',
      status: 'Inbox',
      category: 'operations',
      expiresAt: '2026-03-23T00:00:00.000Z',
      createdAt: '2026-03-22T00:00:00.000Z',
      rowCount: 2,
      sqlPreview: 'SELECT * FROM voice_processing_log WHERE status = $1'
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://api.notion.com/v1/pages');
    expect((requests[0]?.init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer secret-notion-key'
    );
    expect((requests[0]?.init?.headers as Record<string, string>)['Notion-Version']).toBe('2022-06-28');
    expect(result).toEqual({
      pageId: 'page_123',
      url: 'https://notion.so/page_123'
    });
  });

  test('memory idempotency store reserves, suppresses duplicates, and expires after 72 hours', async () => {
    const store = createMemoryIdempotencyStore();
    const firstNow = new Date('2026-03-22T00:00:00.000Z');

    const first = await store.reserve({
      idempotencyKey: 'job-1',
      scope: 'v4-infra',
      ttlHours: 72,
      now: firstNow
    });

    expect(first).toEqual({
      reserved: true,
      expiresAt: '2026-03-25T00:00:00.000Z',
      deletedExpired: 0
    });

    const duplicate = await store.reserve({
      idempotencyKey: 'job-1',
      scope: 'v4-infra',
      ttlHours: 72,
      now: firstNow
    });

    expect(duplicate.reserved).toBe(false);

    const afterExpiry = await store.deleteExpired(new Date('2026-03-25T00:00:01.000Z'));
    expect(afterExpiry).toEqual({
      deletedCount: 1
    });

    const second = await store.reserve({
      idempotencyKey: 'job-1',
      scope: 'v4-infra',
      ttlHours: 72,
      now: new Date('2026-03-25T00:00:01.000Z')
    });

    expect(second.reserved).toBe(true);
  });

  test('SQS Lambda worker deduplicates jobs, routes to Neon and Notion, and keeps zero-retention state local', async () => {
    const neonRequests: Array<Record<string, unknown>> = [];
    const notionRequests: Array<Record<string, unknown>> = [];

    const neonClient = new NeonHttpOneShotClient({
      baseUrl: 'https://neon.example/query',
      apiKey: 'secret-neon-key',
      fetchImpl: async (_url, init) => {
        neonRequests.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ rowCount: 1, rows: [{ id: 1, status: 'ok' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    const notionClient = new NotionDirectWriteClient({
      apiKey: 'secret-notion-key',
      fetchImpl: async (_url, init) => {
        notionRequests.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ id: 'page_1', url: 'https://notion.so/page_1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    const worker = createSqsLambdaWorker({
      maximumConcurrency: 2,
      neonClient,
      notionClient,
      now: () => new Date('2026-03-22T00:00:00.000Z')
    });
    expect(worker.getWorkerConfig()).toEqual({
      configKey: 'MaximumConcurrency',
      queueMode: 'sqs-standard-batch',
      maximumConcurrency: 2
    });

    const record = {
      messageId: 'msg-1',
      body: JSON.stringify({
        idempotencyKey: 'job-1',
        scope: 'v4-infra',
        title: 'V4 worker title',
        summary: 'V4 worker summary',
        neonSql: 'SELECT 1 AS ok',
        neonParams: [],
        notionDatabaseId: 'db-123',
        notionStatus: 'Inbox',
        notionCategory: 'operations',
        ttlHours: 72
      })
    };

    const result = await worker.handleBatch([record, record]);

    expect(result).toEqual({
      processed: 1,
      deduplicated: 1,
      failures: [],
      peakConcurrency: 2,
      expiredIdempotencyRowsDeleted: 0
    });
    expect(neonRequests).toHaveLength(1);
    expect(notionRequests).toHaveLength(1);
    expect(notionRequests[0]).toMatchObject({
      parent: {
        database_id: 'db-123'
      },
      properties: {
        Title: {
          title: [{ text: { content: 'V4 worker title' } }]
        },
        'Idempotency Key': {
          rich_text: [{ text: { content: 'job-1' } }]
        },
        Scope: {
          rich_text: [{ text: { content: 'v4-infra' } }]
        }
      }
    });
  });
});
