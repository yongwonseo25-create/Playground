# VOXERA ENTERPRISE BACKEND CORE
본 프로젝트는 글로벌 B2B SaaS 인프라를 지향하는 최고 수준의 백엔드 시스템입니다.

## 🏁 프로젝트 핵심 지도 (Core Map)
- **90/10 AI Pipeline**: 90%의 복잡한 로직은 백엔드에서, 10%의 유연한 처리는 LLM에서 수행.
- **Saga Billing Algorithm**: 입력(STT)과 실행(Target) 가치를 분리한 2축 하이브리드 과금 시스템.
- **OAuth Security**: 모든 써드파티 토큰은 AES-256-GCM 투명 암호화 계층을 통과함.

## 🛠 작업 원칙 (Protocol)
1. **Idempotency Mandatory**: 모든 과금 API는 `idempotency_key` 검증이 필수임.
2. **Atomic Settlement**: 크레딧 차감은 반드시 DB Stored Procedure `fn_process_billing_settlement`를 통해서만 수행.
3. **No Direct Logic Change**: 정산 로직 수정 시 반드시 이전 작업자(GLM 5.1)의 감사 로그를 최우선 참조할 것.
4. **Performance First**: 로그 집계 시 `prisma.aggregate`를 사용하고, 인덱스를 타는지 반드시 확인할 것.
