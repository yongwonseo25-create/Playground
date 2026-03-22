import {
  createMaximumConcurrencyLimiter,
  type MaximumConcurrencyLimiter
} from '@/server/v4/concurrency';
import { createMemoryIdempotencyStore, type IdempotencyStore } from '@/server/v4/idempotency-store';
import { createNeonHttpOneShotClient, type NeonHttpOneShotClient } from '@/server/v4/neon-http';
import {
  createNotionDirectWriteClient,
  type NotionDirectWriteClient
} from '@/server/v4/notion-direct-write';
import { v4InfraJobSchema, type V4InfraJob } from '@/shared/contracts/v4-infra';

export type SqsLambdaRecord = {
  messageId: string;
  body: string;
};

export type SqsLambdaWorkerResult = {
  processed: number;
  deduplicated: number;
  failures: Array<{ messageId: string; error: string }>;
  peakConcurrency: number;
  expiredIdempotencyRowsDeleted: number;
};

export type SqsLambdaWorkerDependencies = {
  maximumConcurrency: number;
  idempotencyStore?: IdempotencyStore;
  neonClient?: NeonHttpOneShotClient;
  notionClient?: NotionDirectWriteClient;
  now?: () => Date;
  logger?: Pick<Console, 'info' | 'warn'>;
};

export type SqsLambdaWorkerConfigSnapshot = {
  queueMode: 'sqs-standard-batch';
  maximumConcurrency: number;
};

function previewSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function parseJob(record: SqsLambdaRecord): V4InfraJob {
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(record.body);
  } catch {
    throw new Error(`[v4-worker] Record ${record.messageId} contains invalid JSON.`);
  }

  return v4InfraJobSchema.parse(parsedBody);
}

export class SqsLambdaWorker {
  private readonly limiter: MaximumConcurrencyLimiter;

  private readonly maximumConcurrency: number;

  private readonly idempotencyStore: IdempotencyStore;

  private readonly neonClient: NeonHttpOneShotClient;

  private readonly notionClient: NotionDirectWriteClient;

  private readonly now: () => Date;

  private readonly logger: Pick<Console, 'info' | 'warn'>;

  constructor(dependencies: SqsLambdaWorkerDependencies) {
    if (!Number.isInteger(dependencies.maximumConcurrency) || dependencies.maximumConcurrency <= 0) {
      throw new Error('[v4-worker] maximumConcurrency must be a positive integer.');
    }

    this.maximumConcurrency = dependencies.maximumConcurrency;
    this.limiter = createMaximumConcurrencyLimiter(dependencies.maximumConcurrency);
    this.idempotencyStore = dependencies.idempotencyStore ?? createMemoryIdempotencyStore();
    this.neonClient =
      dependencies.neonClient ??
      createNeonHttpOneShotClient({
        baseUrl: 'https://example.invalid/neon',
        apiKey: 'local-dev'
      });
    this.notionClient =
      dependencies.notionClient ??
      createNotionDirectWriteClient({
        apiKey: 'local-dev'
      });
    this.now = dependencies.now ?? (() => new Date());
    this.logger = dependencies.logger ?? console;
  }

  async handleBatch(records: SqsLambdaRecord[]): Promise<SqsLambdaWorkerResult> {
    const expiredBefore = await this.idempotencyStore.deleteExpired(this.now());
    const outcomes = await Promise.all(
      records.map((record) =>
        this.limiter.run(async () => {
          try {
            return await this.processRecord(record);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
              status: 'failed' as const,
              messageId: record.messageId,
              error: message
            };
          }
        })
      )
    );

    const failures = outcomes
      .filter((outcome) => outcome.status === 'failed')
      .map((outcome) => ({ messageId: outcome.messageId, error: outcome.error }));

    const processed = outcomes.filter((outcome) => outcome.status === 'processed').length;
    const deduplicated = outcomes.filter((outcome) => outcome.status === 'deduplicated').length;

    const expiredAfter = await this.idempotencyStore.deleteExpired(this.now());

    return {
      processed,
      deduplicated,
      failures,
      peakConcurrency: this.limiter.snapshot().peakConcurrency,
      expiredIdempotencyRowsDeleted: expiredBefore.deletedCount + expiredAfter.deletedCount
    };
  }

  getWorkerConfig(): SqsLambdaWorkerConfigSnapshot {
    return {
      queueMode: 'sqs-standard-batch',
      maximumConcurrency: this.maximumConcurrency
    };
  }

  async processRecord(
    record: SqsLambdaRecord
  ): Promise<
    | { status: 'processed'; messageId: string; pageId: string; url: string }
    | { status: 'deduplicated'; messageId: string }
  > {
    const job = parseJob(record);
    const reservation = await this.idempotencyStore.reserve({
      idempotencyKey: job.idempotencyKey,
      scope: job.scope,
      ttlHours: job.ttlHours,
      now: this.now()
    });

    if (!reservation.reserved) {
      this.logger.info(`[v4-worker] Skipping duplicate job ${job.idempotencyKey}.`);
      return { status: 'deduplicated', messageId: record.messageId };
    }

    const queryResult = await this.neonClient.query({
      sql: job.neonSql,
      params: job.neonParams
    });

    const notionResult = await this.notionClient.writePage({
      databaseId: job.notionDatabaseId,
      title: job.title,
      summary: job.summary,
      idempotencyKey: job.idempotencyKey,
      scope: job.scope,
      status: job.notionStatus,
      category: job.notionCategory,
      expiresAt: reservation.expiresAt,
      createdAt: this.now().toISOString(),
      rowCount: queryResult.rowCount,
      sqlPreview: previewSql(job.neonSql)
    });

    return {
      status: 'processed',
      messageId: record.messageId,
      pageId: notionResult.pageId,
      url: notionResult.url
    };
  }
}

export function createSqsLambdaWorker(dependencies: SqsLambdaWorkerDependencies): SqsLambdaWorker {
  return new SqsLambdaWorker(dependencies);
}
