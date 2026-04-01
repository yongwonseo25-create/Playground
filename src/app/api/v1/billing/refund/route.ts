import { NextResponse } from 'next/server';
import { getSscePrismaClient } from '../../../../../../apps/api/src/db/ssce-prisma';

const prisma = getSscePrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, sessionId, audioDurationSec } = body;

    if (!userId || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields: userId, sessionId' }, { status: 400 });
    }

    // 1. 축 A (입력 비용): 예약된 크레딧 계산 (환불 금액 명시용 - 실제 차감이 안 되었으므로 취소 처리)
    const INPUT_RATE = 0.1;
    const costInput = (audioDurationSec || 0) * INPUT_RATE;

    console.log(`[Refund] 취소 시작: Session [${sessionId}], 축 A 예약분 [${costInput}]를 반환(Cancellation) 처리합니다.`);

    // 2. Prisma를 통해 Supabase(DB) 환불/취소 저장 프로시저 호출 (Saga Rollback & FAILED marking)
    const result = await prisma.$queryRaw`
      SELECT * FROM fn_process_billing_refund(
        ${userId}::uuid, 
        ${sessionId}, 
        ${costInput}
      );
    ` as any[];

    const data = result && result.length > 0 ? result[0].fn_process_billing_refund : null;

    if (!data) {
      console.error('[Refund] DB 프로시저 실행 실패: 반환값 없음');
      return NextResponse.json({ success: false, error: 'NO_DATA_RETURNED' }, { status: 500 });
    }
    
    // 이미 완료되었거나 취소된 경우
    if (data.success === false) {
       return NextResponse.json({ success: true, warning: 'already_refunded_or_delivered', details: data }, { status: 200 });
    }
    
    return NextResponse.json({ success: true, data: data, message: 'Pending credits successfully rolled back (DLQ)' }, { status: 200 });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown Refund Error';
    console.error('[Refund] 롤백 API 에러:', errMsg);
    return NextResponse.json({ error: 'Refund rollback failed' }, { status: 500 });
  }
}
