---
name: v-dd-landing-rendering
description: Create or update V-DD style landing pages from rough product or campaign ideas. Use when the user gives a landing-page concept, hero direction, marketing copy idea, or visual intent and wants Codex to reverse-design it into a S.T.R.U.C.T specification, derive an SVG visual blueprint, and then implement the page in code with fixed max-width containers and break-keep text handling.
---

# V-DD 랜딩페이지 렌더링

## Overview

Reverse-design landing pages before coding. Turn a rough idea into a 6-part S.T.R.U.C.T spec, convert that spec into an SVG blueprint, and only then implement the UI.

## Workflow

Follow this sequence every time. Do not skip or reorder it.

1. Read the user's idea and restate the intended landing-page outcome in implementation language.
2. Produce a S.T.R.U.C.T reverse-design spec before writing code.
3. Derive an SVG visual blueprint from that spec before writing code.
4. Implement the page only after the spec and blueprint are established.
5. Keep layout widths fixed with explicit max-width containers such as `max-w-md`, `max-w-5xl`, or `max-w-6xl`.
6. Apply `break-keep` to user-facing text blocks that must not split awkwardly.
7. Preserve the repository's existing design system and component patterns unless the user clearly asks for a new visual language.

## S.T.R.U.C.T Spec

Always structure the pre-code spec with all 6 sections below.

### S. Screen
- Define device bias, aspect ratio, and page scope first.
- State whether the page is mobile-first, desktop-first, or responsive across both.
- Declare the main viewport mood such as hero-first, long-scroll campaign, or single-offer splash.

### T. Tree
- Describe the DOM hierarchy as parent > child > leaf.
- Call out which wrappers own layout, which sections hold content, and which nodes are interactive.
- Prefer explicit section names such as hero, trust bar, feature grid, proof block, CTA strip, and footer.

### R. Relative
- Define the layout through relationships, not pixel coordinates.
- Use phrases such as centered stack, split hero, anchored CTA, overlapping card, or between-aligned cluster.
- State how major blocks align relative to each other across breakpoints.

### U. Units
- Define spacing rhythm, section padding, and gap intensity before styling.
- Lock content width with explicit `max-w-*` containers instead of fluid unconstrained spans.
- Prefer readable spacing language such as compact, balanced, or spacious, then map it to concrete utility classes in code.

### C. Components
- Enumerate concrete UI primitives: heading, eyebrow, CTA, badge, image frame, stats row, FAQ accordion, testimonial card, modal trigger, and footer links.
- For each component, define purpose, content type, and interaction intent.
- Reuse repository components first when equivalents already exist.

### T. Theme
- Define tone, contrast, surface treatment, typography attitude, and motion style last.
- Avoid vague style words unless they change implementation.
- Translate mood into implementation-ready direction such as warm premium gradients, restrained enterprise cards, or bold editorial type.

## SVG Blueprint Rule

After writing the S.T.R.U.C.T spec, derive an SVG blueprint that captures:

- section boundaries
- container widths
- primary alignment relationships
- major content blocks
- key CTA positions
- dominant visual masses

Use the SVG as a visual planning artifact, not as final production code. Keep labels readable and consistent with the S.T.R.U.C.T spec.

## Implementation Rules

- Use fixed-width container classes such as `max-w-md`, `max-w-4xl`, `max-w-5xl`, or `max-w-6xl` for every major page band.
- Add `break-keep` to Korean or mixed-language headlines, subheads, and CTA copy where line fragmentation would hurt readability.
- Keep the page mobile-first and ensure desktop expansion still respects fixed content bounds.
- Reuse existing tokens and shared components before inventing arbitrary values.
- If custom values are unavoidable, state why they are necessary.

## Visual Auto-Launch

After finishing any UI implementation with this skill:

1. Start the local dev server immediately with the project-appropriate command, usually `npm run dev` or the repository equivalent.
2. Keep the server running in the background long enough for visual review.
3. Open the local preview URL immediately in the OS browser without waiting for another command.
4. Prefer the exact landing route that was changed. If the landing is the marketing home page, open `http://localhost:3000`.
5. Treat browser launch as part of task completion, not as an optional follow-up.
6. If shell-level browser launch is blocked, use `node scripts/open-browser.js <target>` as the mandatory fallback launcher.

For blueprint-only work, open the generated SVG files immediately after creation with the same launcher fallback.

## Response Contract

When using this skill, present work in this order:

1. Brief implementation restatement
2. S.T.R.U.C.T spec
3. SVG blueprint or SVG blueprint summary
4. Code changes
5. Verification results
6. Remaining risks or assumptions

Do not jump directly from idea to code.

## Example Trigger Phrases

- "이 아이디어로 랜딩페이지 만들어줘"
- "랜딩을 V-DD 방식으로 먼저 구조화해줘"
- "코딩 전에 S.T.R.U.C.T 명세랑 SVG부터 뽑아줘"
- "hero, proof, CTA 흐름으로 마케팅 페이지 만들어줘"
