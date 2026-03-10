---
name: voxera-component-generator
description: "Use when user says to generate, create, or update UI components. Next.js 14+ App Router, Tailwind CSS, Framer Motion 기반의 고품질 UI 컴포넌트를 생성하고 자동 렌더링 검증까지 수행하는 완벽한 프론트엔드 생성 스킬입니다."
---

# Voxera Component Generator (프론트엔드 절대 헌법)

이 스킬은 Voxera 프로젝트의 UI/UX 컴포넌트를 1픽셀의 오차 없이, 2026년 실리콘밸리 최고급 트렌드에 맞춰 자동 생성하기 위한 절대 규칙이다. 코덱스는 UI 생성 시 이 규칙을 무조건 따른다.

## 1. 기술 스택 및 구조 강제
- **Framework:** Next.js 14+ (App Router 방식 우선 적용)
- **Styling:** Tailwind CSS (인라인 스타일 금지, 유틸리티 클래스만 사용)
- **Animation:** `framer-motion` (반드시 `motion.*` 컴포넌트 활용하여 60fps 보장)

## 2. 모션 및 UI 디테일 제약조건 (Guardrails)
- **내부 스크롤 절대 방어:** 텍스트 박스 등 스크롤이 필요한 요소는 반드시 `overflow-y-auto`와 `touch-pan-y`를 조합하여 화면 전체가 아닌 **콘텐츠 내부만 스크롤**되도록 강제한다.
- **애니메이션 동기화:** 팝업 등 시간 동기화가 필요한 로직은 반드시 React의 `useEffect`와 `setTimeout`을 사용하며, 메모리 누수 방지를 위해 무조건 `cleanup(clearTimeout)`을 반환한다.
- **빛 번짐 제어:** 네온 글로우 효과 등은 `box-shadow`를 정교하게 사용하여 부모 컴포넌트의 레이아웃을 절대 깨뜨리지 않도록 한다.

## 3. 검증 및 테스트 요건
- E2E 테스트(Playwright) 및 단위 테스트를 위해 핵심 상호작용 요소(버튼, 입력창 등)에는 반드시 `data-testid` 속성을 추가한다.
- 생성된 컴포넌트는 즉시 `pnpm dev` 로컬 환경에서 렌더링 에러가 없는지 스스로 점검하고 보고해야 한다.
