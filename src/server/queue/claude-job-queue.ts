import { createHash, randomUUID } from 'node:crypto';
import IORedis from 'ioredis';
import { Job, Queue, Worker, type JobsOptions, type WorkerOptions } from 'bullmq';
import { z } from 'zod';
import type { GeminiOutput, ObjectStorage, SkillFileContent } from '@/server/skills/skill-manager';
import { SkillIntegrityError, SkillManager } from '@/server/skills/skill-manager';
import { GeminiRouter, parseGeminiOutput } from '@/server/routing/gemini-router';

export const claudeCommandRequestSchema = z
  .object({
    tenantId: z.string().trim().min(1),
    utterance: z.string().trim().min(1),
    clientRequestId: z.string().trim().min(1).optional()
  })
  .strict();

export type ClaudeCommandRequest = z.infer<typeof claudeCommandRequestSchema>;

export interface ClaudeCommandJobData {
  jobId: string;
  tenantId: string;
  utterance: string;
  clientRequestId?: string;
  requestedAt: string;
}

export interface ClaudeCommandJobResult {
  jobId: string;
  tenantId: string;
  skillId: string;
  contentChanges: GeminiOutput['contentChanges'];
  skillMetadata: SkillFileContent['metadata'];
  resolvedAt: string;
  status: 'completed';
}

export interface EnqueueClaudeCommandResponse {
  jobId: string;
  status: 'queued';
  statusUrl: string;
}

export interface ClaudeJobStatus {
  jobId: string;
  status: string;
  progress: unknown | null;
  result?: ClaudeCommandJobResult;
  error?: string;
  tenantId?: string;
  updatedAt?: string;
}

export interface ClaudeJobQueueOptions {
  redisUrl: string;
  storage: ObjectStorage;
  skillManager: SkillManager;
  geminiRouter: GeminiRouter;
  statusBasePath?: string;
  queueName?: string;
  worker?: {
    concurrency?: number;
    autorun?: boolean;
  };
}

const DEFAULT_QUEUE_NAME = 'voxera-command';
const DEFAULT_STATUS_BASE_PATH = '/api/v1/jobs';

export class IdempotencyConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export class ClaudeJobQueue {
  private readonly queueName: string;
  private readonly statusBasePath: string;
  private readonly redis: IORedis;
  private readonly queue: Queue<ClaudeCommandJobData, ClaudeCommandJobResult>;
  private worker: Worker<ClaudeCommandJobData, ClaudeCommandJobResult> | null = null;

  constructor(private readonly options: ClaudeJobQueueOptions) {
    this.queueName = options.queueName ?? DEFAULT_QUEUE_NAME;
    this.statusBasePath = options.statusBasePath ?? DEFAULT_STATUS_BASE_PATH;
    this.redis = new IORedis(options.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
    this.queue = new Queue<ClaudeCommandJobData, ClaudeCommandJobResult>(this.queueName, {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
          jitter: 0.5
        },
        removeOnComplete: {
          age: 3600,
          count: 1000
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
          count: 10000
        }
      }
    });
  }

  async enqueueCommand(input: ClaudeCommandRequest): Promise<EnqueueClaudeCommandResponse> {
    const jobId = this.createPublicJobId(input.tenantId, input.clientRequestId);
    const payload: ClaudeCommandJobData = {
      jobId,
      tenantId: input.tenantId,
      utterance: input.utterance,
      clientRequestId: input.clientRequestId,
      requestedAt: new Date().toISOString()
    };
    const base = this.jobBasePath(payload.tenantId, jobId);
    const requestArtifactKey = `${base}/00-request.json`;

    if (await this.options.storage.exists(requestArtifactKey)) {
      const existingRequest = await this.options.storage.getJson<ClaudeCommandJobData>(requestArtifactKey);
      this.assertReplaySafety(existingRequest, payload);
    } else {
      await this.options.storage.putJson(requestArtifactKey, payload);
    }
    await this.options.storage.putJson(this.jobIndexPath(jobId), {
      jobId,
      tenantId: input.tenantId,
      basePath: base,
      updatedAt: payload.requestedAt
    });

    const addOptions: JobsOptions = {
      jobId,
      deduplication: {
        id: jobId
      }
    };

    await this.queue.add('process-command', payload, addOptions);

    return {
      jobId,
      status: 'queued',
      statusUrl: `${this.statusBasePath}/${jobId}`
    };
  }

  async getJobStatus(jobId: string): Promise<ClaudeJobStatus | null> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      const state = await job.getState();
      const jobIndex = await this.readJobIndex(jobId);
      return {
        jobId,
        status: state,
        progress: job.progress ?? null,
        result: state === 'completed' ? (job.returnvalue as ClaudeCommandJobResult) : undefined,
        error: state === 'failed' ? job.failedReason : undefined,
        tenantId: jobIndex?.tenantId,
        updatedAt: jobIndex?.updatedAt
      };
    }

    const jobIndex = await this.readJobIndex(jobId);
    if (!jobIndex) {
      return null;
    }

    const statusArtifact = await this.options.storage.getJson<{
      status: string;
      updatedAt: string;
      error?: string;
      skillId?: string;
      contentChanges?: GeminiOutput['contentChanges'];
      skillMetadata?: SkillFileContent['metadata'];
      resolvedAt?: string;
      tenantId?: string;
    }>(`${jobIndex.basePath}/status.json`);

    return {
      jobId,
      status: statusArtifact.status,
      progress: null,
      result:
        statusArtifact.status === 'completed' &&
        statusArtifact.skillId &&
        statusArtifact.contentChanges &&
        statusArtifact.skillMetadata &&
        statusArtifact.resolvedAt
          ? {
              jobId,
              tenantId: statusArtifact.tenantId ?? jobIndex.tenantId,
              skillId: statusArtifact.skillId,
              contentChanges: statusArtifact.contentChanges,
              skillMetadata: statusArtifact.skillMetadata,
              resolvedAt: statusArtifact.resolvedAt,
              status: 'completed'
            }
          : undefined,
      error: statusArtifact.error,
      tenantId: jobIndex.tenantId,
      updatedAt: statusArtifact.updatedAt
    };
  }

  ensureWorker(): Worker<ClaudeCommandJobData, ClaudeCommandJobResult> {
    if (this.worker) {
      return this.worker;
    }

    const workerOptions: WorkerOptions = {
      connection: this.redis,
      concurrency: this.options.worker?.concurrency ?? 5,
      autorun: this.options.worker?.autorun ?? true
    };

    this.worker = new Worker<ClaudeCommandJobData, ClaudeCommandJobResult>(
      this.queueName,
      async (job) => this.process(job),
      workerOptions
    );

    return this.worker;
  }

  private async process(job: Job<ClaudeCommandJobData, ClaudeCommandJobResult>) {
    const jobId = job.id ?? job.data.jobId;
    const base = this.jobBasePath(job.data.tenantId, jobId);

    try {
      await this.writeStatus(base, 'running', {
        jobId,
        tenantId: job.data.tenantId
      });
      await job.updateProgress(10);

      const geminiOutput = await this.resolveGeminiOutput(job, base);
      await job.updateProgress(55);

      const skill = await this.resolveSkillSnapshot(job.data.tenantId, geminiOutput, base);
      await job.updateProgress(100);

      const result: ClaudeCommandJobResult = {
        jobId,
        tenantId: job.data.tenantId,
        skillId: geminiOutput.skillId,
        contentChanges: geminiOutput.contentChanges,
        skillMetadata: skill.metadata,
        resolvedAt: new Date().toISOString(),
        status: 'completed'
      };

      await this.writeStatus(base, 'completed', { ...result });
      return result;
    } catch (error) {
      await this.writeStatus(base, 'failed', {
        jobId,
        tenantId: job.data.tenantId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async resolveGeminiOutput(
    job: Job<ClaudeCommandJobData, ClaudeCommandJobResult>,
    base: string
  ): Promise<GeminiOutput> {
    const artifactKey = `${base}/10-gemini-output.json`;
    const availableSkills = await this.options.skillManager.getAvailableSkills(job.data.tenantId);
    if (await this.options.storage.exists(artifactKey)) {
      const storedOutput = await this.options.storage.getJson<unknown>(artifactKey);
      return parseGeminiOutput(availableSkills, storedOutput);
    }

    const geminiOutput = await this.options.geminiRouter.route({
      tenantId: job.data.tenantId,
      utterance: job.data.utterance,
      availableSkills
    });

    await this.options.storage.putJson(artifactKey, geminiOutput);
    return geminiOutput;
  }

  private async resolveSkillSnapshot(
    tenantId: string,
    geminiOutput: GeminiOutput,
    base: string
  ): Promise<SkillFileContent> {
    const artifactKey = `${base}/20-skill-snapshot.md`;
    const resolvedSkill = await this.options.skillManager.loadResolvedSkill(tenantId, geminiOutput.skillId);
    if (await this.options.storage.exists(artifactKey)) {
      const snapshot = await this.options.storage.getText(artifactKey);
      if (snapshot !== resolvedSkill.skill.template) {
        throw new SkillIntegrityError(
          `Stored skill snapshot for "${geminiOutput.skillId}" no longer matches the manifest-backed skill file.`
        );
      }

      return resolvedSkill.skill;
    }

    await this.options.storage.putText(
      artifactKey,
      resolvedSkill.skill.template,
      'text/markdown; charset=utf-8'
    );
    return resolvedSkill.skill;
  }

  private async writeStatus(base: string, status: string, extras: Record<string, unknown>) {
    await this.options.storage.putJson(`${base}/status.json`, {
      status,
      updatedAt: new Date().toISOString(),
      ...extras
    });
  }

  private jobBasePath(tenantId: string, jobId: string): string {
    return `/tenants/${tenantId}/jobs/${jobId}`;
  }

  private jobIndexPath(jobId: string): string {
    return `/job-index/${jobId}.json`;
  }

  private async readJobIndex(jobId: string): Promise<{
    jobId: string;
    tenantId: string;
    basePath: string;
    updatedAt: string;
  } | null> {
    const indexPath = this.jobIndexPath(jobId);
    if (!(await this.options.storage.exists(indexPath))) {
      return null;
    }

    return this.options.storage.getJson(indexPath);
  }

  private createPublicJobId(tenantId: string, clientRequestId?: string): string {
    if (!clientRequestId) {
      return randomUUID();
    }

    return createHash('sha256')
      .update(`${tenantId}:${clientRequestId}`)
      .digest('hex');
  }

  private assertReplaySafety(existing: ClaudeCommandJobData, incoming: ClaudeCommandJobData): void {
    const normalizedExistingUtterance = this.normalizeUtterance(existing.utterance);
    const normalizedIncomingUtterance = this.normalizeUtterance(incoming.utterance);

    if (
      existing.tenantId !== incoming.tenantId ||
      (existing.clientRequestId ?? null) !== (incoming.clientRequestId ?? null) ||
      normalizedExistingUtterance !== normalizedIncomingUtterance
    ) {
      throw new IdempotencyConflictError(
        `clientRequestId "${incoming.clientRequestId}" is already bound to a different request payload.`
      );
    }
  }

  private normalizeUtterance(utterance: string): string {
    return utterance.trim().replace(/\s+/g, ' ');
  }
}
