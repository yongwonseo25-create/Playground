# [Stitch MCP + Agent Browser 통합 자동화 룰]
이 프로젝트의 모든 UI 설계 및 테스트는 아래 워크플로우를 따른다.

1. **설계(PLAN)**: UI 설계 시 무조건 Stitch MCP를 호출해라. 절대 여러 화면으로 쪼개서 요청하지 말고, 프롬프트에 반드시 **"Do NOT split into multiple views. Generate ONE continuous long-landing page."** 라고 강조하여 통짜 코드를 생성해라 [1, 2].
2. **구현(BUILD)**: Stitch가 생성한 통짜 TSX/HTML을 그대로 쓰지 마라. Next.js App Router 표준에 맞춰 `/app/page.tsx`와 `/components/sections/`로 모듈화하여 분리해라 [4, 11].
3. **태깅(TAGGING)**: 추후 QA 자동화를 위해 상호작용이 일어나는 모든 핵심 UI 컴포넌트에 `data-ref` 속성을 반드시 삽입해라 [3, 11].
4. **검증(QA)**: 코딩이 끝나면 로컬 서버(`npm run dev`)를 띄우고, 터미널에서 `agent-browser open http://localhost:3000 --headed` 를 실행해 실제 창을 띄워라. 이후 `agent-browser snapshot -i --json` 스냅샷을 찍고 클릭/호버 테스트를 스스로 진행해 레이아웃을 검증해라 [6, 7].
