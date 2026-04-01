# VOXERA BACKEND HANDOFF INDEX (FROM GLM 5.1)

본 문서는 Claude Code 요원이 반드시 숙지해야 할 감사 우선순위 가이드입니다.

1. **[Scope]**: 현재 감사 범위는 `apps/api/src/db` 및 `src/server`로 한정함.
2. **[Reading Sequence]**:
   - `docs/ai/handoff/01-saga-transaction.md` (과금 원자성)
   - `docs/ai/handoff/02-queue-backoff.md` (비동기 복구망)
   - `docs/ai/handoff/03-encryption-layer.md` (보안 암호화)
   - `REVIEW.md` (최종 보안 체크리스트)
   - `docs/ai/handoff/04-threat-model.md` (임계적 위협 모델 - 최우선 숙지 요망)
3. **[Validation]**: 모든 수정 사항은 `npm run typecheck`를 통과해야 함.
