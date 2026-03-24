# Zero-Touch Text-to-SVG V-DD Constitution

- Manual-first diagram drafting is deprecated for approved zero-touch design tasks.
- `docs/ideas/` is the canonical intake folder for one-line `.txt` product and UI briefs.
- `scripts/auto-design.js` watches `docs/ideas/`, uses `GEMINI_API_KEY` first and `OPENAI_API_KEY` second for remote generation, writes SVG blueprints to `docs/blueprints/`, and writes generated React components to `src/components/generated/`.
- Generated automation must remain compatible with Voxera guardrails and must never weaken AudioWorklet + PCM over WSS, the exact 15-second cutoff, the synchronous `clientRequestId` lock, or the fixed 8-state reducer.
- Secrets must stay in local environment variables such as `GEMINI_API_KEY` and `OPENAI_API_KEY`; never embed them in client code.

# Skills

## Article 9: Agent Full Access Nonstop Preference
- The default operating preference is maximum autonomous execution: when the commander gives a task, the agent should complete file creation, terminal execution, environment setup, verification, and reporting without unnecessary back-and-forth.
- The agent should assume a full-ownership posture and finish the task end-to-end whenever the active runtime permissions allow it.
- If a sandbox, approval boundary, or higher-priority runtime rule requires confirmation, the agent must request that approval as briefly as possible and continue immediately after approval.
- The agent should report outcomes, blockers, and risk only after doing the maximum safe amount of work first.

## Article 10: Git Worktree Parallel Coding Law
- If the commander assigns 4 to 5 substantial features or threads in parallel, the agent should prefer a Git Worktree strategy to prevent branch contamination and code collisions.
- Each major task should be isolated into its own worktree and branch when parallel execution meaningfully reduces merge risk.
- After the work is complete, the agent should reconcile the branches through a clean merge or PR-style integration flow while surfacing conflicts early.
- If the current runtime, repository state, or user instruction makes worktrees impractical, the agent should fall back to the safest equivalent isolation strategy and explain that choice briefly.

## Article 11: Automation Skill Application Law
- Repetitive tasks such as reports, recurring tests, monitoring checks, and error scans should be evaluated for skill or automation conversion instead of requiring repeated manual prompting.
- When the commander explicitly wants recurring execution, the agent should propose or configure an Automation-backed workflow using repository skills and the available automation system.
- Automation must remain transparent, reviewable, and aligned with active runtime permissions and safety constraints.
- The agent must not silently create recurring automations unless the commander explicitly asks for recurring or scheduled behavior.

## Article 12: Visual Auto-Launch Law
- After any frontend, UI, UX, landing-page, or visual rendering task is completed, the agent must not stop at code or tests alone.
- The agent must immediately start the local preview server with the project-appropriate dev command in the background.
- Once the local server is reachable, the agent must immediately open the preview URL in the OS browser without waiting for another user command.
- On Windows, prefer `start http://localhost:3000`. On macOS, prefer `open http://localhost:3000`.
- If the relevant page lives on a non-root route, the agent should open that exact route instead of only opening `/`.
- If the server cannot start or the page fails to load, the agent must report the blocker after attempting the maximum safe amount of recovery.
- This auto-launch behavior applies to `V-DD 랜딩페이지 렌더링` and any other frontend-facing skill in this repository.
- If shell-level browser launch is blocked by runtime policy, the agent must fall back to `node scripts/open-browser.js <target>` and use that launcher for preview URLs or local SVG files.

## Excalidraw Visual-to-Delivery Rule
- `docs/diagrams/` is the canonical intake folder for `.excalidraw`, `.png`, and `.svg` design artifacts.
- When the user references a diagram or asks Codex to use Excalidraw, Codex must scan `docs/diagrams/` first and treat the newest relevant file as an actionable brief.
- `.excalidraw` files are the highest-fidelity source of intent. Matching `.png` or `.svg` exports are supporting references.

## Visual Interpretation Absolute Rules
- Apply the diagram's product flow and information hierarchy before cosmetic details.
- Map every meaningful region of the diagram to concrete work items such as routes, components, states, copy blocks, or interactions.
- Preserve Voxera constitutional rules at all times:
  - AudioWorklet + PCM over WSS only
  - exact 15-second cutoff
  - synchronous `clientRequestId` duplicate lock
  - fixed 8-state reducer
- Do not infer architecture changes that weaken reducer ownership, timing truth, or duplicate protection.
- Reuse existing design-system components and tokens before inventing new UI primitives.
- If the diagram conflicts with repository guardrails, explain the conflict and propose the nearest compliant implementation.

## Delivery Behavior
- Summarize the interpreted intent in implementation language.
- List assumptions when the visual artifact leaves important behavior unspecified.
- Prefer updating existing files over introducing parallel UI paths.
- After completing the work, report which diagram was used as the source brief.

## Article 8: S.T.R.U.C.T. Reverse-Design And Auto-Translation Law
- When the commander drops an ambiguous idea into `docs/ideas/`, such as "대충 틱톡 스타일로 해줘", the Pre-Agent must never jump straight into SVG generation.
- The Pre-Agent must first reverse-design the vague brief into a structured Visual PRD using all 6 S.T.R.U.C.T. elements before any blueprint or code generation starts.

### S (Screen Context)
- Define the screen ratio and theme first.
- Required lens: Dark or Light, Mobile or Desktop, and the intended aspect ratio.
- Example translation targets: `Aspect Ratio 16:9`, mobile-first hero, desktop dashboard shell.

### T (Tree Hierarchy)
- Define the container nesting order as Parent > Child relationships.
- The Visual PRD must describe which wrapper owns layout, which child holds content, and which leaf nodes are interactive.
- Magic trigger keywords to consider: `Flex Column/Row`, `Grid 12-column system`.

### R (Relative Layout)
- Never start from absolute coordinates.
- Translate the layout as relationships such as Center, Between, Start, End, overlay, stack, or anchored edge alignment.
- Magic trigger keywords to consider: `Justify: Space-Between`, centered cluster, sticky edge action.

### U (Units & Spacing)
- Convert spacing intent into readable density rules before code generation.
- Specify whether spacing is Tight, Spacious, or Fixed Gap, and which blocks own that spacing rhythm.
- The Visual PRD should clearly call out gap intensity, padding strength, and section breathing room.

### C (Components)
- Identify the actual content primitives before styling.
- Break the screen into Text, Image, Icon, CTA, Input, Card, Modal, Badge, and other concrete UI units.
- Each component must include purpose, content type, and interaction intent when relevant.

### T (Theme & Style)
- Attach visual style keywords only after structure is clarified.
- Define tone, contrast, surface feel, visual hierarchy, and motion mood.
- Magic trigger keywords to consider: `Visual Hierarchy: High/Medium/Low`, `Negative Space 30%`.

### Hallucination Guard Keywords
- The following keywords must be injected into the Visual PRD whenever they fit the idea, to reduce vague layout drift and hallucinated geometry:
  - `Flex Column/Row`
  - `Justify: Space-Between`
  - `Grid 12-column system`
  - `Aspect Ratio 16:9`
  - `Visual Hierarchy: High/Medium/Low`
  - `Negative Space 30%`
  - `Max-width: 1200px, Centered`
  - `Sticky/Fixed Position`

### Operational Mandate
- The Pre-Agent must output or internally derive the Visual PRD first, then use that translated spec as the source of truth for SVG and React generation.
- If the original idea is too vague, the system should expand it with S.T.R.U.C.T. assumptions instead of hallucinating arbitrary geometry.
- If a user request conflicts with Voxera guardrails, the Visual PRD must preserve the guardrails and flag the conflict before generation proceeds.
