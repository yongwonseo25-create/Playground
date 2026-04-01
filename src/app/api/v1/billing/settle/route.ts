import { NextResponse } from 'next/server';

// 보안(RLS 및 Stored Procedure 통과)을 위한 Supabase 클라이언트 임포트
// import { createClient } from '@supabase/supabase-js';
// const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, sessionId, audioDurationSec, destinationSuccess } = body;

    if (!userId || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields: userId, sessionId' }, { status: 400 });
    }

    // 1. 축 A (입력 비용): 음성 길이 기반 요금 계산
    const INPUT_RATE = 0.1; // 초당 0.1 크레딧
    const costInput = (audioDurationSec || 0) * INPUT_RATE;

    // 2. 축 B (실행 가치): 목적지 도달 성공 횟수 기반 요금 계산
    const SUCCESS_REWARD = 5; // 성공 시 부과할 크레딧
    const costExecution = destinationSuccess === true ? SUCCESS_REWARD : 0;

    const totalAmountToDeduct = costInput + costExecution;

    console.log(`[Settle] 시작: Session [${sessionId}], 축 A [${costInput}], 축 B [${costExecution}], 총 차감 [${totalAmountToDeduct}]`);

    // 3. Supabase 원자적 정산 시작 (Saga Pattern)
    /* 
    const { data: result, error } = await supabase.rpc('fn_process_billing_settlement', {
      p_user_id: userId,
      p_session_id: sessionId,
      p_amount: totalAmountToDeduct
    });

    if (error) {
      // INSUFFICIENT_CREDITS, ALREADY_DELIVERED 처리
      console.error('[Settle] DB 프로시저 실행 에러:', error);
      
      const errorMessage = error.message || 'Stored procedure error';

      if (errorMessage.includes('INSUFFICIENT_CREDITS')) {
         return NextResponse.json({ success: false, reason: 'unfunded' }, { status: 402 });
      }

      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
    
    // 이미 완료된(DELIVERED) 세션 요청이 재시도 될 경우
    if (result && result.success === false) {
       return NextResponse.json({ success: true, warning: 'already_processed', details: result }, { status: 200 });
    }
    
    return NextResponse.json({ success: true, data: result }, { status: 200 });
    */

    return NextResponse.json({ 
      success: true, 
      simulated: true, 
      deducted: totalAmountToDeduct,
      axisA: costInput,
      axisB: costExecution
    }, { status: 200 });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown Settle Error';
    console.error('[Settle] 정산 API 에러:', errMsg);
    return NextResponse.json({ error: 'Settlement process failed' }, { status: 500 });
  }
}
