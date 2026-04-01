# APPS/API CORE RULES

- **Locking Strategy**: `user_profiles` 업데이트 시 반드시 `SELECT ... FOR UPDATE`를 사용하여 레이스 컨디션을 방어할 것.
- **Aggregation Optimization**: 로그 집계 시 `findMany`를 절대 사용하지 말고, `prisma.aggregate`를 통해 DB 레벨에서 연산할 것. OOM 방지를 위해 기간 필터링(`createdAt`)은 필수임.
- **Error Handling**: `202 Accepted` 응답 이후 발생하는 비동기 에러는 반드시 `BillingExecutionLog`의 `status: FAILED`로 기록할 것.
- **Idempotency**: 과금 관련 POST/PATCH 요청은 반드시 `idempotency_key`를 포함하고 중복 처리를 방지할 것.
