-- 1. OAuth 외부 프로바이더 Enum 정의
CREATE TYPE integration_provider AS ENUM ('notion', 'slack', 'google', 'custom');

-- 2. user_integrations 테이블 생성 (토큰 및 연동 정보 관리)
CREATE TABLE user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- auth.users(id) 외래키가 필요할 경우: REFERENCES auth.users(id),
    provider integration_provider NOT NULL,
    
    -- Node.js 백엔드 계층에서 암호화된 토큰(AES-GCM 등)이 저장됩니다. 평문 저장을 방지.
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    
    -- 채널 ID, Database ID 등 프로바이더별 옵션
    metadata JSONB DEFAULT '{}'::JSONB,
    
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 한 유저는 같은 플랫폼에 한 종류의 연동만 가진다 (필요시 제거 가능)
    CONSTRAINT unique_user_provider UNIQUE (user_id, provider)
);

-- 3. RLS 정책: 프론트엔드/클라이언트단 접근을 완전히 차단시키거나, 연동 여부(Boolean)만 알 수 있도록 매우 제한적 설정 (여기서는 기본적으로 본인만 소유권 확인). 토큰 값 누출 방지가 최우선.
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 연동 정보 존재 여부 확인 가능" 
ON user_integrations FOR SELECT 
USING (auth.uid() = user_id);

-- 프론트엔드 삽입 방지 및 서버(Service Role) 전용 관리 유도
CREATE POLICY "수정, 삭제는 서버(Service Role) 전용" 
ON user_integrations FOR ALL
USING (auth.role() = 'service_role');


-- 4. 실패한 Job 복구를 위한 정산 환불(Rollback/Refund) 저장 프로시저
CREATE OR REPLACE FUNCTION fn_process_billing_refund(
    p_user_id UUID,
    p_session_id TEXT,
    p_refund_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_log_status execution_status;
BEGIN
    -- 0. 해당 세션의 상태 확인 (이미 REFUNDED/FAILED/DELIVERED 등으로 종결되었는지 점검)
    SELECT status INTO v_log_status
    FROM billing_execution_logs
    WHERE session_id = p_session_id FOR UPDATE;

    -- 이미 DELIVERED로 정산되었거나 REFUND 처리되었다면 거부
    IF v_log_status IN ('DELIVERED', 'REFUNDED', 'FAILED') THEN
        RETURN jsonb_build_object('success', false, 'reason', 'ALREADY_COMPLETED_OR_REFUNDED', 'current_status', v_log_status);
    END IF;

    -- 1. 환불 처리 시 크레딧을 반환할 필요가 있는가? 
    -- (우리의 Phase 2 정책상 사전에 잔액을 즉시 빼놓지는 않고 PENDING 상태로 둠. 따라서 잔액 복원 작업 대신 세션을 파기(주문 취소)만 처리.)
    -- 만약 '선 차감 후 환불' 설계였다면 여기서 아래 프로시저를 추가합니다.
    /*
    UPDATE user_profiles 
    SET credits = credits + p_refund_amount 
    WHERE id = p_user_id;
    */

    -- 2. 대상 발화 세션 로그의 상태를 최종 'FAILED'로 종결
    UPDATE billing_execution_logs 
    SET status = 'FAILED', 
        error_message = 'Max Retry Exceeded (DLQ)',
        updated_at = NOW()
    WHERE session_id = p_session_id;

    RETURN jsonb_build_object('success', true, 'action', 'CANCELED_PENDING_SESSION');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
