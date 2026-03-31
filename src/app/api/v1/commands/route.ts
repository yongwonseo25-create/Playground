import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { getClaude9010Env } from '@/server/config/server-env';
import { ClaudeJobQueue, IdempotencyConflictError } from '@/server/queue/claude-job-queue';
import { GeminiRouter } from '@/server/routing/gemini-router';
import {
  LocalObjectStorage,
  type ObjectStorage,
  S3ObjectStorage,
  SkillManager
} from '@/server/skills/skill-manager';

export const runtime = 'nodejs';

const requestSchema = z
  .object({
    tenantId: z.string().trim().min(1),
    utterance: z.string().trim().min(1),
    clientRequestId: z.string().trim().min(1).optional()
  })
  .strict();

let sharedQueue: ClaudeJobQueue | null = null;

function buildStorage(): ObjectStorage {
  const env = getClaude9010Env();

  if (env.CLAUDE_90_10_STORAGE_TYPE === 's3') {
    if (!env.CLAUDE_90_10_S3_BUCKET || !env.AWS_REGION) {
      throw new Error('CLAUDE_90_10_S3_BUCKET and AWS_REGION are required for S3 storage.');
    }

    return new S3ObjectStorage({
      bucket: env.CLAUDE_90_10_S3_BUCKET,
      region: env.AWS_REGION,
      prefix: env.CLAUDE_90_10_S3_PREFIX,
      endpoint: env.CLAUDE_90_10_S3_ENDPOINT,
      credentials:
        env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY
            }
          : undefined
    });
  }

  return new LocalObjectStorage(env.CLAUDE_90_10_STORAGE_BASE_DIR);
}

function getQueue(): ClaudeJobQueue {
  if (sharedQueue) {
    return sharedQueue;
  }

  const env = getClaude9010Env();

  const storage = buildStorage();
  const skillManager = new SkillManager({
    storage
  });
  const geminiRouter = new GeminiRouter({
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_ROUTER_MODEL ?? env.GEMINI_MODEL
  });

  sharedQueue = new ClaudeJobQueue({
    redisUrl: env.REDIS_URL,
    storage,
    skillManager,
    geminiRouter
  });

  if (env.CLAUDE_90_10_AUTOSTART_WORKER) {
    sharedQueue.ensureWorker();
  }

  return sharedQueue;
}

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());
    const queue = getQueue();
    const response = await queue.enqueueCommand(payload);
    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid Claude 90/10 command payload.',
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message
        },
        { status: error.statusCode }
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown Claude 90/10 enqueue failure.';
    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}
