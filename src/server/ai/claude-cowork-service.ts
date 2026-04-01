/**
 * VOXERA Claude 90/10 Personalized Automation Pipeline
 * 
 * 90%: VOXERA 코어 구조화(의도 파악, 추임새 제거, 카테고리화) 프롬프트
 * 10%: 사용자의 사설 스타일 프롬프트 (존댓말, 이모지 유무, 특정 포맷 등)
 */

export interface ClaudeResponse {
  resultText: string;
  t2_llm_ms: number; // LLM 처리 소요 시간 (Latency Optimization 용도)
}

export class ClaudeCoworkService {
  /**
   * STT 텍스트를 구조화하고 개인화 포맷팅을 적용합니다.
   * @param sttText 원시 STT 발화 내용
   * @param userStylePrompt 유저 커스텀 스타일 프롬프트 (10%)
   * @returns 조립된 최종 텍스트와 소요시간 측정값
   */
  public async process90_10Pipeline(
    sttText: string, 
    userStylePrompt: string = '',
    personalizedContext: string = ''
  ): Promise<ClaudeResponse> {
    const startTime = performance.now();

    const systemPrompt90 = `당신은 VOXERA의 핵심 지능입니다. 다음을 수행하십시오.
1. 불필요한 추임새 제거
2. 의도(Intent) 추출
3. 완벽한 구조화(Markdown/JSON 등 상황에 맞는 포맷)`;

    const mergedSystemPrompt = `${systemPrompt90}\n\n${personalizedContext}\n\n[사용자 맞춤 지시사항 10%]:\n${userStylePrompt}`;

    const userPayload = `입력된 STT 데이터:\n"${sttText}"`;

    // -------------------------------------------------------------
    // 실제 Anthropic Claude API 호출부 구현 (Fetch or SDK)
    // 환경에 따라 SDK 또는 직접 Fetch 구성. 
    // 예시에서는 지연시간 측정을 위해 Delay 기반의 Mock 처리로 안정성을 확보합니다.
    // -------------------------------------------------------------
    
    // Simulate API HTTP delay (~1.5s - 2.5s)
    const simulatedDelay = Math.random() * 1000 + 1500;
    await new Promise(resolve => setTimeout(resolve, simulatedDelay));

    // Simulated Result based on 90/10 Prompting
    const simulatedResponse = `[90/10 Pipeline 거친 결과]
분석: 의도 파악 완료
내용: ${sttText} (정제됨)
가이드: ${userStylePrompt ? '사용자 맞춤 포맷이 적용되었습니다.' : '기본 포맷으로 제공됩니다.'}`;

    const endTime = performance.now();
    const t2_llm_ms = Math.round(endTime - startTime);

    console.log(`[Claude Pipeline] 90/10 파싱 완료 (${t2_llm_ms}ms)`);

    return {
      resultText: simulatedResponse,
      t2_llm_ms
    };
  }
}

export const claudeCoworkService = new ClaudeCoworkService();
