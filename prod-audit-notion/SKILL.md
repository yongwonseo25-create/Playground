# SKILL: NOTION INTEGRATION AUDITOR

- **Definition**: Notion/Slack 외부 API 연동 시의 복구 성능을 감사하는 특수 스킬.
- **Target**: `voxera-processor.ts` 내의 `Exponential Backoff` 설정값 및 DLQ 적재 로직.
- **Instruction**: 429 Rate Limit 발생 시 지수 백오프가 2000ms부터 정상적으로 점증하는지 추적할 것.
- **Goal**: 외부 서드파티 장애가 VOXERA 코어 과금 시스템에 영향을 주지 않도록 격리되었는지 확인.
