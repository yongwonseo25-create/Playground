import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildContractError } from '@/shared/contracts/common';
import { v4DestinationKeySchema } from '@/shared/contracts/v4/common';
import { handleV4IdempotentJsonRequest } from '@/server/v4/shared/idempotency';
import { dispatchZhiCommand } from '@/server/v4/zhi/orchestrator';
import { createHitlApprovalCard, resolveHitlApproval } from '@/server/v4/hitl/hitl-service';

const textInjectRequestSchema = z
  .object({
    mode: z.enum(['zhi', 'hitl']).default('zhi'),
    destinationKey: v4DestinationKeySchema,
    transcriptText: z.string().trim().min(1).max(20_000),
    clientRequestId: z.string().uuid().optional(),
    accountKey: z.string().trim().min(1).max(128).optional(),
    actor: z.string().trim().min(1).max(128).default('terminal-e2e'),
    autoApprove: z.boolean().default(true)
  })
  .strict();

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid JSON body.',
        issues: []
      },
      { status: 400 }
    );
  }

  const parsedBody = textInjectRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(buildContractError('Invalid V4 text inject request.', parsedBody.error), {
      status: 400
    });
  }

  try {
    return handleV4IdempotentJsonRequest(request, 'v4:e2e:text-inject', async ({ idempotencyKey }) => {
      const clientRequestId = parsedBody.data.clientRequestId ?? idempotencyKey;

      if (parsedBody.data.mode === 'zhi') {
        const result = await dispatchZhiCommand({
          clientRequestId,
          transcriptText: parsedBody.data.transcriptText,
          destinationKey: parsedBody.data.destinationKey,
          accountKey: parsedBody.data.accountKey,
          sttProvider: 'whisper',
          audioDurationSec: 0
        });

        return {
          status: 202,
          body: {
            ok: true,
            mode: 'zhi',
            result
          }
        };
      }

      const card = await createHitlApprovalCard({
        clientRequestId,
        transcriptText: parsedBody.data.transcriptText,
        destinationKey: parsedBody.data.destinationKey,
        accountKey: parsedBody.data.accountKey
      });

      if (!parsedBody.data.autoApprove) {
        return {
          status: 201,
          body: {
            ok: true,
            mode: 'hitl',
            approval: card.approval
          }
        };
      }

      const result = await resolveHitlApproval(card.approval.approvalId, {
        decision: 'approve',
        actor: parsedBody.data.actor,
        fields: card.approval.fields
      });

      return {
        status: result.status === 'approved' ? 202 : 200,
        body: {
          ok: true,
          mode: 'hitl',
          result
        }
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'V4 text injection failed.';

    return NextResponse.json(
      {
        ok: false,
        error: message,
        issues: []
      },
      { status: 500 }
    );
  }
}
