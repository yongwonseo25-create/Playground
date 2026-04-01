# VOXERA Backend Implementation Status

- Updated: 2026-03-31
- Source of truth: [VOXERA_BACKEND_ARCHITECTURE.md](C:/Users/Master/Documents/Playground-ssce-main/VOXERA_BACKEND_ARCHITECTURE.md)

## 완료된 항목

| 영역 | 항목 | 현재 상태 | 근거 파일 |
| --- | --- | --- | --- |
| Voice Backend | WSS 기반 음성 제출 백엔드 | 구현 완료 | [route.ts](C:/Users/Master/Documents/Playground-ssce-main/src/app/api/voice/submit/route.ts) |
| Voice Reliability | `WebhookClient` + `CircuitBreaker` + `FailureQueue` | 구현 완료 | [WebhookClient.ts](C:/Users/Master/Documents/Playground-ssce-main/src/server/reliability/WebhookClient.ts), [circuitBreaker.ts](C:/Users/Master/Documents/Playground-ssce-main/src/server/reliability/circuitBreaker.ts), [failureQueue.ts](C:/Users/Master/Documents/Playground-ssce-main/src/server/queue/failureQueue.ts) |
| Billing | Firestore 2단계 커밋 기반 pay-per-output 과금 | 구현 완료 | [pay-per-output-service.ts](C:/Users/Master/Documents/Playground-ssce-main/src/server/billing/pay-per-output-service.ts), [firestore-billing-store.ts](C:/Users/Master/Documents/Playground-ssce-main/src/server/billing/firestore-billing-store.ts) |
| Paid Output API | `/api/v1/generate-output` | 구현 완료 | [route.ts](C:/Users/Master/Documents/Playground-ssce-main/src/app/api/v1/generate-output/route.ts) |
| Auth | Firebase Auth 검증 | 구현 완료 | [verify-firebase-user.ts](C:/Users/Master/Documents/Playground-ssce-main/src/server/auth/verify-firebase-user.ts) |
| Gemini Output | Secret Manager 기반 Google AI Studio 호출 | 구현 완료 | [google-ai-studio-generator.ts](C:/Users/Master/Documents/Playground-ssce-main/src/server/generation/google-ai-studio-generator.ts) |
| SSCE DB | `artifacts`, `style_signatures`, `style_events`, `reference_edges` 물리 스키마 | 구현 완료 | [schema.prisma](C:/Users/Master/Documents/Playground-ssce-main/apps/api/src/db/schema.prisma) |
| SSCE API | `harvest`, `generate`, `feedback` 라우트 | 구현 완료 | [ssce-router.ts](C:/Users/Master/Documents/Playground-ssce-main/apps/api/src/routes/ssce-router.ts), [route-helpers.ts](C:/Users/Master/Documents/Playground-ssce-main/apps/api/src/app/api/v1/ssce/route-helpers.ts) |
| SSCE Validation | 모든 SSCE 입출력 Zod 검증 | 구현 완료 | [ssce-zod.ts](C:/Users/Master/Documents/Playground-ssce-main/packages/adapter/src/validators/ssce-zod.ts) |
| SSCE Oracle | Gemini strict JSON mode 기반 semantic diff oracle | 구현 완료 | [semantic-diff-oracle.ts](C:/Users/Master/Documents/Playground-ssce-main/apps/api/src/services/semantic-diff-oracle.ts) |
| SSCE Tests | Vitest 기반 API 테스트 스켈레톤 및 live oracle 검증 | 구현 완료 | [ssce-api.spec.ts](C:/Users/Master/Documents/Playground-ssce-main/apps/api/src/routes/ssce-api.spec.ts), [vitest.config.ts](C:/Users/Master/Documents/Playground-ssce-main/vitest.config.ts) |
| MCP Reviewer | stdio JSON-RPC 클라이언트, contracts, static analysis | 구현 완료 | [contracts.ts](C:/Users/Master/Documents/Playground-ssce-main/src/server/mcp/contracts.ts), [stdio-json-rpc-client.ts](C:/Users/Master/Documents/Playground-ssce-main/src/server/mcp/stdio-json-rpc-client.ts), [reviewer-static-analysis.ts](C:/Users/Master/Documents/Playground-ssce-main/src/server/mcp/reviewer-static-analysis.ts) |
| Architecture Docs | 백엔드 아키텍처 명세서 | 작성 완료 | [VOXERA_BACKEND_ARCHITECTURE.md](C:/Users/Master/Documents/Playground-ssce-main/VOXERA_BACKEND_ARCHITECTURE.md) |

## 부분 완료

| 영역 | 항목 | 현재 상태 | 남은 일 |
| --- | --- | --- | --- |
| SSCE Oracle 운영 안정성 | strict JSON mode는 적용됐고 `repair-baseline`은 제거됨 | 부분 완료 | Gemini structured output 회귀를 잡는 운영용 canary 또는 timeout/abort 정책 추가 필요 |
| SSCE Persistence | Prisma + SQLite 개발 경로는 동작 | 부분 완료 | 운영 DB 전략 확정 필요 |
| SSCE Concurrency | 단일 요청 흐름은 동작 | 부분 완료 | reviewer 지적대로 scope upsert 경쟁 상태를 `upsert` 또는 재시도 정책으로 보강 필요 |
| SSCE Audit Storage | 이벤트/스냅샷 저장은 동작 | 부분 완료 | 큰 payload에 대한 상한 또는 snapshot trimming 필요 |
| Google Workspace 연동 | 구조와 운영 방향은 문서화됨 | 부분 완료 | 실제 백엔드 direct integration 코드가 이 저장소에 완결되어 있지는 않음 |
| Notion direct-write | 아키텍처 방향과 정책은 정리됨 | 부분 완료 | 실제 production write flow와 OAuth 운영 경로를 코드로 마무리해야 함 |
| Reviewer Quality Gate | 로컬 reviewer 인프라와 self-inspection 절차는 동작 | 부분 완료 | reviewer가 지적한 3개 리스크를 실제로 닫아야 완전 종료 가능 |

## 아직 미구현

| 영역 | 항목 | 현재 상태 | 비고 |
| --- | --- | --- | --- |
| KakaoTalk | 비즈니스 계정 기반 실연동 | 미구현 | 문서상 보류 상태 |
| Notion Production Direct Write | 실제 운영용 Notion write 백엔드 완결 | 미구현 | 현재는 방향/정책 문서화 중심 |
| Google Workspace Production Backend | Sheets/Docs/Calendar를 묶는 최종 백엔드 오케스트레이션 | 미구현 | 현재는 Apps Script/연동 방향 문서화 중심 |
| SSCE Risk Remediation | Gemini timeout/abort, concurrent upsert 보호, snapshot size cap | 미구현 | reviewer 리포트 기준 후속 작업 필요 |
| Production DB Migration Path | SQLite 외 운영 DB 이행 | 미구현 | 결정 및 이행 필요 |

## 해석 규칙

- `완료된 항목`은 현재 저장소 안에 코드 또는 명세가 실제로 존재하고, 해당 기능의 핵심 경로가 동작하는 상태를 뜻한다.
- `부분 완료`는 동작은 하지만 운영 안정성, 확장성, 또는 외부 연동 마감이 남아 있는 상태를 뜻한다.
- `아직 미구현`은 방향만 있거나 아예 코드가 없는 항목을 뜻한다.
