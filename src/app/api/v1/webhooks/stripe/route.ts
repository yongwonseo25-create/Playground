import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Supabase Client 관련 임포트 (실제 환경에 맞게 조정 필요)
// import { createClient } from '@supabase/supabase-js';
// const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('stripe-signature');
    const bodyText = await req.text();

    // 1. Stripe Webhook 서명 검증 (환경변수가 필요하지만 여기서는 구조만 구현)
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      // 실제 환경에서는 stripe.webhooks.constructEvent() 호출
      // return NextResponse.json({ error: 'Webhook signature verification failed.' }, { status: 400 });
      console.warn('[Webhook] Stripe 서명 검증을 우회합니다 (테스트/개발 모드 방어 로직 필요)');
    }

    const event = JSON.parse(bodyText);

    // 2. 결제 완료 이벤트 필터링
    if (event.type !== 'checkout.session.completed' && event.type !== 'payment_intent.succeeded') {
      return NextResponse.json({ received: true, status: 'ignored_event_type' });
    }

    const paymentData = event.data.object;
    // Stripe에서 온 고유 식별자 (멱등성 키로 사용)
    const idempotencyKey = event.id; 
    const userId = paymentData.metadata?.userId || paymentData.client_reference_id;
    const amountPaid = paymentData.amount_received || paymentData.amount_total;
    
    // 단순 변환 예시: 100센트 = 1크레딧 (비즈니스 로직에 맞게 수정)
    const creditsToAdd = amountPaid / 100;

    if (!userId) {
      console.error('[Webhook] User ID가 존재하지 않는 결제 내역입니다.', paymentData);
      return NextResponse.json({ error: 'User ID missing in payment metadata' }, { status: 400 });
    }

    // 3. Supabase DB: Webhook 멱등성 검증 및 크레딧 충전 (Atomic Transaction 유사 처리)
    // 참고: 멱등성 보장을 위해 별도의 stripe_events 테이블에 insert 처리를 하거나 RPC(저장 프로시저)를 사용하는 것이 안전합니다.
    /*
    const { data: result, error } = await supabase.rpc('fn_process_stripe_webhook', {
      p_idempotency_key: idempotencyKey,
      p_user_id: userId,
      p_credits_to_add: creditsToAdd,
      p_event_type: event.type
    });

    if (error) {
       console.error('[Webhook] DB 처리 실패:', error);
       // 중복 키 에러 (이미 처리된 경우)라면 200 반환해야 Stripe가 재시도하지 않음
       if (error.code === '23505') { 
         return NextResponse.json({ received: true, message: 'Already processed (Idempotency)' }, { status: 200 });
       }
       return NextResponse.json({ error: 'Database transaction failed' }, { status: 500 });
    }
    */
    
    // 임시 로직 (Supabase 클라이언트 연동 전)
    console.log(`[Webhook] 충전 처리 완료 시뮬레이션: User ${userId}, Credits: ${creditsToAdd}, Key: ${idempotencyKey}`);

    return NextResponse.json({ success: true, received: true });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown Error';
    console.error('[Webhook] Stripe 에러:', errMsg);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 400 });
  }
}
