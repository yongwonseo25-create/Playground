# VOXERA SECURITY & INTEGRITY CHECKLIST

Claude Code 요원은 모든 코드 수정 시 다음 체크리스트를 준수해야 합니다.

- [ ] **Data Atomicity**: `fn_process_billing_settlement`를 통한 정산 연산의 원자성 보장.
- [ ] **Injection Defense**: `ContextStorageService.sanitizeContent`를 통한 프롬프트 인젝션 방어.
- [ ] **Token Security**: OAuth 토큰이 `EncryptionService`를 통해 AES-256-GCM으로 암호화되어 저장되는지 확인.
- [ ] **Aggregate Efficiency**: Admin KPI 호출 시 인덱스 (`createdAt`, `status`) 타는지 쿼리 실행 계획 확인.
- [ ] **Lock Integrity**: Workspace Credit 업데이트 시 Deadlock 발생 가능성 차단.
- [ ] **DLQ Recovery**: BullMQ 실패 작업이 정해진 Backoff 정책에 따라 재시도되는지 검증.
