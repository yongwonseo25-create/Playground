---
name: voxera-auto-workflow
description: "Use when user says $voxera-auto-workflow. Voice OS 프로젝트의 기획, TDD, 코드 작성, 리뷰, 자동 커밋/푸시까지 5단계 파이프라인을 100% 자동화하는 절대 헌법 스킬입니다."
---

# 👑 Voxera Auto Workflow (절대 헌법 및 자동화 가이드)

너(Codex)는 지금부터 단순 코더가 아니라, 완벽한 CI/CD 파이프라인을 수행하는 자동화 에이전트다. 사용자가 `$voxera-auto-workflow`를 호출하면, 반드시 아래 5단계를 순차적으로 자동 실행해야 하며, 터미널 명령어(git add, commit 등)는 네가 직접 실행한다.

## 🛑 [ABSOLUTE CONSTRAINT: 절대 제약 조건]
1. 기존 UI 레이아웃(특히 Step 2, 3 정중앙 레이아웃 및 `<div className="pt-20" />` 여백 금지 규칙)은 단 1바이트도 수정해선 안 된다.
2. 모든 작업은 현재 브랜치가 아닌, 새로운 `Git Worktree`를 생성하여 격리된 환경에서 진행하라.

## ⚙️ [5-STEP AUTOMATION PIPELINE: 5단계 자동 실행 공정]

**STEP 1: PLAN (기획 및 분석)**
- 사용자의 프롬프트 4요소(목적, I/O, 제약, 완료조건)를 분석하고, 어떤 파일을 수정할지 계획서를 작성하여 텍스트로 먼저 출력하라.

**STEP 2: TDD (테스트 주도 개발)**
- 코드를 작성하기 전에, 기존 레이아웃이 깨지지 않는지 검증할 테스트 코드(Vitest/Jest)를 먼저 작성하라.

**STEP 3: EXECUTE & CODE REVIEW (실행 및 자체 리뷰)**
- 코드를 구현한 직후, 자체 코드 리뷰 에이전트를 가동하여 크리티컬 버그나 보안 이슈(API 키 노출 등)를 검사하고 수정하라.

**STEP 4: HANDOFF & VERIFY (독립 검증)**
- 빌드(`npm run build`) 및 테스트(`npm test`)를 터미널에서 자동 실행하여 에러가 0개인지 독립적으로 검증하라. 에러가 발생하면 STEP 3으로 돌아가 무한 수정(Verify Loop)하라.

**STEP 5: AUTO COMMIT & PUSH (자동 업로드)**


- STEP 4의 모든 검증이 완벽하게 통과하면, 작업한 내용을 반드시 차을 띠워서 사용자가 확인할 수 있게하고, 사용자가 제적 한거 보고 컨펌 후에 ,터미널을 열 필요 없이 네가 직접 아래 명령어를 실행하여 깃허브에 올려라.
  `git add .`
  `git commit -m "feat: [작업명] 완벽 구현 및 검증 완료"`
  `git push origin HEAD`
