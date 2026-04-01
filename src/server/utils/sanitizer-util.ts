/**
 * [Phase 5] Prompt Injection Defense Sanitizer
 * - 유저가 저장하는 컨텍스트 내의 악의적인 프롬프트 인젝션 패턴을 필터링합니다.
 */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?instructions/gi,
  /system\s*(prompt|instruction)?\s*:/gi,
  /assistant\s*:/gi,
  /human\s*:/gi,
  /you\s+are\s+now\s+a/gi,
  /stop\s+what\s+you\s+are\s+doing/gi
];

export const sanitizerUtil = {
  /**
   * 유저 입력 텍스트를 검사하고 위험한 패턴을 안전한 문구로 치환합니다.
   */
  sanitize(content: string): string {
    let sanitized = content;
    
    INJECTION_PATTERNS.forEach(pattern => {
      // 패턴 발견 시 [FILTERED] 로 치환하여 악의적인 명령 수행 차단
      sanitized = sanitized.replace(pattern, '[FILTERED_INJECTION_ATTEMPT]');
    });

    return sanitized;
  },

  /**
   * 위험 패턴이 포함되어 있는지 여부만 반환합니다. (검증용)
   */
  isSuspect(content: string): boolean {
    return INJECTION_PATTERNS.some(pattern => pattern.test(content));
  }
};
