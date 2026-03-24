import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { OutputGenerationRefundedError, PayPerOutputService } from '../../src/server/billing/pay-per-output-service';
import type {
  BillingReservationResult,
  BillingSettlementResult
} from '../../src/server/billing/firestore-billing-store';
import { analyzeCloudUpdate } from '../../src/server/mcp/reviewer-static-analysis';
import {
  reviewsSubmitParamsSchema,
  updatesPullResultSchema
} from '../../src/server/mcp/contracts';
import { runReviewerCycle } from '../../src/server/mcp/reviewer-agent';
import { StdioJsonRpcClient } from '../../src/server/mcp/stdio-json-rpc-client';

class InMemoryBillingStore {
  availableCredits = 25;
  pendingCredits = 0;
  deductedCredits = 0;
  refundedCredits = 0;
  phase: 'idle' | 'reserved' | 'executing' | 'deducted' | 'refunded' = 'idle';
  outputText = '';

  async reserve(input: {
    uid: string;
    clientRequestId: string;
    costCredits: number;
  }): Promise<BillingReservationResult> {
    if (this.availableCredits < input.costCredits) {
      throw new Error('insufficient credits');
    }

    this.availableCredits -= input.costCredits;
    this.pendingCredits += input.costCredits;
    this.phase = 'reserved';

    return {
      kind: 'reserved',
      transactionId: input.clientRequestId,
      costCredits: input.costCredits,
      revalidateKeys: [`wallet:${input.uid}`, `billing:${input.uid}`]
    };
  }

  async markExecuting(): Promise<void> {
    this.phase = 'executing';
  }

  async deduct(input: {
    uid: string;
    clientRequestId: string;
    outputText: string;
  }): Promise<BillingSettlementResult> {
    this.pendingCredits -= 10;
    this.deductedCredits += 10;
    this.phase = 'deducted';
    this.outputText = input.outputText;

    return {
      transactionId: input.clientRequestId,
      billingStatus: 'deducted',
      availableCredits: this.availableCredits,
      pendingCredits: this.pendingCredits,
      revalidateKeys: [`wallet:${input.uid}`, `billing:${input.uid}`]
    };
  }

  async refund(input: {
    uid: string;
    clientRequestId: string;
  }): Promise<BillingSettlementResult> {
    this.availableCredits += 10;
    this.pendingCredits -= 10;
    this.refundedCredits += 10;
    this.phase = 'refunded';

    return {
      transactionId: input.clientRequestId,
      billingStatus: 'refunded',
      availableCredits: this.availableCredits,
      pendingCredits: this.pendingCredits,
      revalidateKeys: [`wallet:${input.uid}`, `billing:${input.uid}`]
    };
  }
}

async function readJsonWithRetry(filePath: string, attempts = 20): Promise<unknown> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const raw = await readFile(filePath, 'utf8').catch(() => '');
    if (raw.trim()) {
      return JSON.parse(raw);
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out waiting for JSON output: ${filePath}`);
}

test('pay-per-output service reserves then deducts credits on success', async () => {
  const store = new InMemoryBillingStore();
  const service = new PayPerOutputService(store, {
    generate: async () => ({
      outputText: 'Generated output',
      providerName: 'fake',
      providerModel: 'fake-model',
      providerLatencyMs: 12,
      secretVersion: null,
      providerUsage: null
    })
  });

  const result = await service.execute({
    uid: 'user-1',
    clientRequestId: 'req-success-1',
    prompt: 'Summarize this.',
    outputType: 'summary',
    costCredits: 10,
    timeoutMs: 500
  });

  expect(result.outputText).toBe('Generated output');
  expect(store.phase).toBe('deducted');
  expect(store.availableCredits).toBe(15);
  expect(store.pendingCredits).toBe(0);
  expect(store.deductedCredits).toBe(10);
});

test('pay-per-output service refunds credits on generation failure', async () => {
  const store = new InMemoryBillingStore();
  const service = new PayPerOutputService(store, {
    generate: async () => {
      throw new Error('provider timeout');
    }
  });

  await expect(
    service.execute({
      uid: 'user-1',
      clientRequestId: 'req-fail-1',
      prompt: 'Summarize this.',
      outputType: 'summary',
      costCredits: 10,
      timeoutMs: 500
    })
  ).rejects.toBeInstanceOf(OutputGenerationRefundedError);

  expect(store.phase).toBe('refunded');
  expect(store.availableCredits).toBe(25);
  expect(store.pendingCredits).toBe(0);
  expect(store.refundedCredits).toBe(10);
});

test('reviewer static analysis denies missing zod validation and hardcoded secrets', async () => {
  const feedback = analyzeCloudUpdate({
    updateId: 'update-1',
    files: [
      {
        path: 'src/app/api/demo/route.ts',
        content: [
          "import { NextResponse } from 'next/server';",
          'export async function POST(request: Request) {',
          '  const body = await request.json();',
          "  const apiKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyz';",
          '  return NextResponse.json(body);',
          '}'
        ].join('\n')
      }
    ]
  });

  expect(feedback.verdict).toBe('deny');
  expect(feedback.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ruleId: 'missing-zod-validation',
        line: 3
      }),
      expect.objectContaining({
        ruleId: 'hardcoded-secret',
        line: 4
      })
    ])
  );
});

test('mcp bridge payload contracts accept pull and submit shapes', async () => {
  const pullResult = updatesPullResultSchema.parse({
    cursor: 'cursor-1',
    updates: [
      {
        updateId: 'update-1',
        files: [
          {
            path: 'src/app/api/demo/route.ts',
            content: 'export async function POST() { return Response.json({ ok: true }); }'
          }
        ]
      }
    ]
  });

  const submitResult = reviewsSubmitParamsSchema.parse({
    updateId: 'update-1',
    verdict: 'allow',
    diagnostics: [],
    reviewedAt: new Date().toISOString()
  });

  expect(pullResult.cursor).toBe('cursor-1');
  expect(submitResult.verdict).toBe('allow');
});

test('stdio reviewer client pulls updates and submits allow-deny feedback', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'voxera-mcp-'));
  const captureFile = path.join(tempDir, 'submitted-review.json');
  const mockUpdate = {
    updateId: 'update-stdio-1',
    files: [
      {
        path: 'src/app/api/demo/route.ts',
        content:
          'export async function POST(request: Request) { const body = await request.json(); return Response.json(body); }'
      }
    ]
  };

  const client = new StdioJsonRpcClient({
    command: process.execPath,
    args: ['--experimental-strip-types', 'scripts/mock-mcp-bridge.ts'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      MOCK_BRIDGE_CAPTURE_FILE: captureFile,
      MOCK_BRIDGE_UPDATE_JSON: JSON.stringify(mockUpdate)
    }
  });

  await client.request('initialize', {
    clientInfo: {
      name: 'billing-mcp-test'
    }
  });
  const result = await runReviewerCycle(client, null);
  await new Promise((resolve) => setTimeout(resolve, 200));
  client.close();

  expect(result.feedback).toHaveLength(1);
  expect(result.feedback[0]?.verdict).toBe('deny');

  const submitted = (await readJsonWithRetry(captureFile)) as Array<{
    verdict: string;
    diagnostics: Array<{ line: number }>;
  }>;
  expect(submitted).toHaveLength(1);
  expect(submitted[0]?.verdict).toBe('deny');
  expect(submitted[0]?.diagnostics[0]?.line).toBe(1);

  await rm(tempDir, { recursive: true, force: true });
});
