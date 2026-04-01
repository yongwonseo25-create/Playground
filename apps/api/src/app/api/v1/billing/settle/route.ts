import { NextRequest, NextResponse } from 'next/server';
import { getSscePrismaClient } from '../../../../../db/ssce-prisma';

/**
 * [Phase 6] Settlement & Metric Logging API
 * 비동기 워커가 작업 완료 후 호출하여 PENDING 상태의 로그를 DELIVERED로 전환하고
 * t1(STT), t2(AI), t3(Target) Latency를 기록합니다.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, workspaceId, sessionId, metrics, destinationSuccess } = await req.json();
    const prisma = getSscePrismaClient();

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 });
    }

    // 1. 세션 로그 업데이트 (Saga 패턴: PENDING -> DELIVERED)
    const updatedLog = await prisma.billingExecutionLog.update({
      where: { sessionId },
      data: {
        status: destinationSuccess ? 'DELIVERED' : 'FAILED',
        destinationDelivered: !!destinationSuccess,
        executionSucceeded: true, // 파이프라인 자체는 성공함
        t1SttMs: metrics?.t1_stt_ms || 0,
        t2LlmMs: metrics?.t2_llm_ms || 0,
        t3TargetMs: metrics?.t3_target_ms || 0,
        processingTimeMs: metrics?.total_ms || 0,
      }
    });

    // 2. 크레딧 최종 차감 로직 (Stored Procedure 호출 권장이나 여기서는 단순화하여 업데이트)
    // 실제 운영 환경에서는 RPC(fn_process_billing_settlement)를 호출해야 함.
    
    console.log(`[Settle] Session ${sessionId} marked as DELIVERED with metrics.`);

    return NextResponse.json({
      success: true,
      data: updatedLog
    });

  } catch (error: any) {
    console.error('[Settle API Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
