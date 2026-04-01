-- 1. Enum 타입 정의
CREATE TYPE execution_status AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'DELIVERED', 'FAILED', 'REFUNDED');

-- (임시) user_profiles 테이블이 없을 경우를 대비하여 생성 (테스트 목적 또는 검증 완료 후 기존 구조에 맞게 수정 가능)
-- CREATE TABLE IF NOT EXISTS user_profiles (
--    id UUID PRIMARY KEY REFERENCES auth.users(id),
--    credits NUMERIC(15, 2) DEFAULT 0 NOT NULL,
--    updated_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- 2. 테이블 생성 (13개 핵심 필드 포함)
CREATE TABLE billing_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- auth.users(id) 외래키가 필요할 경우: REFERENCES auth.users(id),
    session_id TEXT NOT NULL UNIQUE,
    idempotency_key TEXT UNIQUE, -- 중복 권한/결제 처리 방지
    
    -- 과금 데이터 (2축)
    audio_duration NUMERIC(10, 2) DEFAULT 0, -- 축 A: 입력 비용 기반
    cost_input NUMERIC(10, 2) DEFAULT 0,
    cost_execution NUMERIC(10, 2) DEFAULT 0, -- 축 B: 실행 가치 기반
    total_cost NUMERIC(10, 2) GENERATED ALWAYS AS (cost_input + cost_execution) STORED,
    
    -- 상태 추적 (TIMESTAMPTZ 기반)
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    succeeded_at TIMESTAMPTZ, -- AI 처리 완료 시간
    delivered_at TIMESTAMPTZ, -- 목적지 전송 성공 시간
    
    -- 로그 및 메타데이터
    status execution_status DEFAULT 'PENDING',
    metadata JSONB DEFAULT '{}'::JSONB,
    error_message TEXT,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS(Row Level Security) 설정
ALTER TABLE billing_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "유저는 자신의 로그만 조회 가능" 
ON billing_execution_logs FOR SELECT 
USING (auth.uid() = user_id);

-- 4. 인덱스 설정
CREATE INDEX idx_billing_logs_user_session ON billing_execution_logs(user_id, session_id);
CREATE INDEX idx_billing_logs_idempotency ON billing_execution_logs(idempotency_key);


-- 5. 원자적 크레딧 차감 저장 프로시저 (Stored Procedure - Auditor Optimized)
CREATE OR REPLACE FUNCTION fn_process_billing_settlement(
    p_user_id UUID,
    p_session_id TEXT,
    p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_current_credits NUMERIC;
    v_log_status execution_status;
BEGIN
    -- 1. 세션 로그 잠금 및 멱등성 검사 (Idempotency Guard)
    SELECT status INTO v_log_status
    FROM billing_execution_logs
    WHERE session_id = p_session_id FOR UPDATE;

    -- 이미 정산된 정보라면 작업을 건너뛰고 성공 반환 (중복 과금 원천 차단)
    IF v_log_status = 'DELIVERED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'ALREADY_SETTLED');
    END IF;

    -- 2. 유저 크레딧 잠금 및 조회 (Atomic Read-Before-Write)
    -- 실제 user_profiles 혹은 크레딧을 저장하는 user 테이블명으로 수정 필요
    SELECT credits INTO v_current_credits 
    FROM user_profiles 
    WHERE id = p_user_id FOR UPDATE;

    -- 3. 잔액 검증 (Overdraft Protection)
    IF v_current_credits < p_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_FUNDS: Required %, Available %', p_amount, v_current_credits;
    END IF;

    -- 4. 원자적 차감 및 상태 확정 (One-Shot Update)
    UPDATE user_profiles 
    SET credits = credits - p_amount 
    WHERE id = p_user_id;

    UPDATE billing_execution_logs 
    SET status = 'DELIVERED', 
        delivered_at = NOW(),
        cost_execution = p_amount,
        updated_at = NOW()
    WHERE session_id = p_session_id;

    RETURN jsonb_build_object('success', true, 'remaining_credits', v_current_credits - p_amount);
EXCEPTION
    WHEN OTHERS THEN
        -- 모든 예외 발생 시 자동 롤백 및 에러 반환
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
