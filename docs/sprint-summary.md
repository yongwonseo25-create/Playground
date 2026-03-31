# Voxera Sprint Summary

> This file is the persistent architecture memory for the Voxera front-end.
> Codex must read this file before starting any new sprint or major coding task.
> At the end of each sprint, Codex must update this file with the latest architecture, changed files, risks, and next prerequisites.

---

## Project Identity

- Project: Voxera (Listen-Think-Act)
- Type: B2B voice execution agent front-end
- Stack: Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Core mode: mobile-first, voice-first, state-driven

---

## Constitutional Guardrails

### 1. Audio Engine Rule
- MediaRecorder is forbidden.
- Blob/timeslice recording is forbidden.
- Audio must use **AudioWorklet + PCM over WSS** only.

### 2. Cost Defense Rule
- Every recording session must stop at **exactly 15 seconds**.
- The state machine + timer logic is the source of truth.
- UI animation must never be the source of business truth.

### 3. Duplicate Locking Rule
- Every upload must be protected by `clientRequestId`.
- Submission must be locked before async upload begins.
- Duplicate upload / duplicate charge must be prevented.

### 4. Fixed State Machine Rule
The following 8 states are fixed and must not be arbitrarily restructured:
- `idle`
- `permission-requesting`
- `ready`
- `recording`
- `stopping`
- `uploading`
- `success`
- `error`

---

## Current Architecture Snapshot

### App Structure
- Status: stable foundation complete
- Current routing approach: Next.js App Router with route groups
- Current feature folder approach: feature-first structure centered on `features/voice-capture`
- Current UI shell status: premium 3-step voice capture flow implemented and Playwright-verified

### Voice State Machine
- Status: implemented and stable
- Source of truth file(s):
  - `src/features/voice-capture/types/voice-types.ts`
  - `src/features/voice-capture/state/voice-capture-reducer.ts`
  - `src/features/voice-capture/state/use-voice-capture-machine.ts`
- Current states:
  - `idle`
  - `permission-requesting`
  - `ready`
  - `recording`
  - `stopping`
  - `uploading`
  - `success`
  - `error`
- Current selectors: UI step derivation, recording activity, upload activity, remaining time
- Current known guard rules:
  - permission request starts only from explicit user interaction
  - recording can stop early from the second mic touch while the 15-second hard stop remains reducer-driven
  - upload lock blocks duplicate submission and is created before async upload starts
  - reducer remains pure and side effects are externalized

### Audio Engine
- Status: architecture fixed, implementation not yet started in code
- Audio input approach: AudioWorklet + PCM only
- Audio transport approach: secure WSS only
- Audio cleanup strategy: planned, not yet implemented
- Secure context requirement: mandatory

### Transport
- Status: env and secure transport policy prepared
- WSS endpoint strategy: env-driven
- Webhook adapter strategy: `/api/voice/submit` remains live for transcript metadata delivery
- Additional server route: `/api/v1/generate-output` now owns authenticated pay-per-output generation with Firestore-backed billing state
- Additional integration routes: `/api/notion/oauth/callback` exchanges production Notion OAuth codes and `/api/v1/pages` writes Oracle Strict JSON into Notion databases through the official `POST /v1/pages` API
- Messaging orchestration path: `src/domain/messaging/message-dispatch.service.ts` now defines the Solapi main-pipeline glue for idempotent reserve -> primary Kakao -> fallback LMS/SMS -> atomic billing commit sequencing
- Direct-write billing status: successful Notion page writes now append Prisma-backed execution billing logs for destination-delivered settlement tracking
- Env validation status: implemented for secure endpoint handling and extended with server-side Google AI Studio / Firebase config parsing

### Submission / Cost Defense
- Status: live client submission wired to `/api/voice/submit`
- 15-second cutoff status: reducer timer remains the source of truth and auto-stops at the hard limit
- `clientRequestId` lock status: generated synchronously before async live submission begins
- Duplicate prevention strategy: upload button disables during `uploading`, reducer lock preserved for live route wiring
- Live submit payload: transcript text and lightweight routing/session metadata are posted from the client after WSS transcription completes
- Back-end billing path: `/api/v1/generate-output` now uses Firestore `reserve -> executing -> deducted/refunded` transitions so output billing is held before model execution and released on failure
- Notion delivery billing path: `src/server/notion/direct-write.ts` now records `ExecutionBillingLog` rows only after the final Notion `POST /v1/pages` call succeeds
- Solapi delivery billing path: `src/domain/messaging/message-dispatch.service.ts` stages an idempotency reservation before any send, forces `disableSms: true` on Kakao, routes 31xx/41xx failures into explicit LMS/SMS fallback, and only inserts `ExecutionBillingLog` when `markDelivered()` atomically transitions inside the shared commit transaction
- Local reviewer path: stdio JSON-RPC reviewer client can pull MCP cloud updates and return allow/deny feedback with file line diagnostics

### Mobile UX
- Status: premium 3-step capture flow complete
- One-handed usage support: yes
- Safe-area support: baseline implemented
- Accessibility status: touch targets, labels, and Playwright test ids applied
- Error messaging status: inline Step 2 retry/cancel feedback available
- Motion polish status: idle waveform silhouette preserved, mic breathing glow clarified, and footer copy now loops as a one-way marquee

### Diagram Workflow
- Status: Excalidraw intake workflow initialized
- Source folder: `docs/diagrams/`
- Intake file types:
  - `.excalidraw`
  - `.png`
  - `.svg`
- Interpretation policy: the newest relevant diagram acts as the visual brief for subsequent Codex implementation work
- Rule file: `skills.md`

---

## Sprint Log

---

### Sprint 0 ??Project Rules / Custom Skills
- Date: completed previously
- Status: completed

#### Goal
Establish project rules, Codex constitution, guardrails, and sprint memory protocol.

#### Files Created
- `SKILL.md`
- `.cursorrules`
- `docs/sprint-summary.md`

#### Files Modified
- None / N/A

#### Architecture Changes
- Project constitution established
- Guardrail block established
- Sprint memory process established

#### State Machine Changes
- None yet

#### Audio / Transport Changes
- No implementation yet
- Constitutional rule fixed:
  - AudioWorklet + PCM over WSS only
  - MediaRecorder forbidden

#### Submission / Cost Defense Changes
- No implementation yet
- Constitutional rule fixed:
  - exact 15-second cutoff required
  - `clientRequestId` lock required

#### Known Risks
- None critical

#### Manual QA
- [x] Confirm `SKILL.md` exists at repo root
- [x] Confirm `.cursorrules` exists at repo root
- [x] Confirm `docs/sprint-summary.md` exists
- [x] Confirm Guardrail Block is available for prompt use

- [x] `npm run build` with local-safe placeholder env values compiles successfully

#### Next Sprint Prerequisites
- Initialize Next.js app foundation
- Create secure environment strategy
- Create state machine foundation
- Create initial mobile voice shell

---

### Sprint 1 ??Project Framework and Secure Environment
- Date: completed
- Status: completed with no manual QA defects

#### Goal
Build the project foundation, secure environment rules, initial state machine, and voice UI shell.

#### Files Created
- App Router project foundation files
- secure env validation files
- state machine files
- selectors and initial tests
- mobile-first voice shell UI files
- initial shared UI primitives and layout files

#### Files Modified
- project config files
- Tailwind / shadcn setup files
- root layout and route files
- security header related files

#### Architecture Changes
- Established stable Next.js App Router foundation
- Established feature-first directory structure
- Established secure environment and front-end baseline policies
- Established mobile-first voice UI shell as the main interaction surface

#### State Machine Changes
- 8-state reducer foundation implemented
- transition guards introduced
- selector structure introduced
- reducer purity preserved

#### Audio / Transport Changes
- No MediaRecorder path introduced
- secure context and WSS-only policy preserved in architecture
- actual AudioWorklet/WSS runtime integration deferred to next implementation stage

#### Submission / Cost Defense Changes
- no duplicate-submit regression introduced
- no violation of 15-second architectural rule
- submission lock architecture preserved for next sprint integration

#### Known Risks
- Runtime audio pipeline is not yet implemented
- Webhook/backend integration is not yet wired
- end-to-end request flow is not yet manually verifiable
- mobile lifecycle edge cases remain to be tested after transport integration

#### Manual QA
- [x] App booted successfully
- [x] Route structure works
- [x] Initial voice shell renders correctly
- [x] No MediaRecorder usage introduced
- [x] State machine base behavior manually reviewed
- [x] Secure env strategy present
- [x] No Sprint 1 defects found in manual QA

- [x] `npm run build` with local-safe placeholder env values compiles successfully

#### Next Sprint Prerequisites
- implement backend / Make.com integration entry flow
- wire typed webhook adapter
- preserve existing reducer architecture
- preserve guardrails while adding networked submission flow

---

### Sprint 2 ??Backend / Make.com Integration
- Date:
- Status: not started

#### Goal
Integrate the front-end with the backend entrypoint and Make.com workflow safely, without breaking the fixed state machine, 15-second cutoff rule, or duplicate submission lock.

#### Files Created
- TBD

#### Files Modified
- TBD

#### Architecture Changes
- TBD

#### State Machine Changes
- TBD

#### Audio / Transport Changes
- TBD

#### Submission / Cost Defense Changes
- TBD

#### Known Risks
- TBD

#### Manual QA
- TBD

- [x] `npm run build` with local-safe placeholder env values compiles successfully

#### Next Sprint Prerequisites
- webhook submission flow verification
- duplicate-submit regression tests
- production-ready mobile feedback for upload/success/error

---

### Sprint 3 ??AudioWorklet + WSS Runtime Integration
- Date:
- Status: not started

#### Goal
Implement the real-time microphone pipeline using AudioWorklet + PCM over WSS and connect it to the existing reducer-driven voice flow.

#### Files Created
- TBD

#### Files Modified
- TBD

#### Architecture Changes
- TBD

#### State Machine Changes
- TBD

#### Audio / Transport Changes
- TBD

#### Submission / Cost Defense Changes
- TBD

#### Known Risks
- TBD

#### Manual QA
- TBD

- [x] `npm run build` with local-safe placeholder env values compiles successfully

#### Next Sprint Prerequisites
- mobile lifecycle hardening
- final integrated QA against timeout and duplicate lock

---

### Sprint 4 ??Mobile-Optimized Voice UX and Production Hardening
- Date: 2026-03-10
- Status: completed

#### Goal
Polish the mobile-first voice UI/UX and finalize production readiness.

#### Files Created
- `eslint.config.mjs`
- `tests/playwright.env-core.config.ts`
- `tests/e2e/voice-capture-flow.spec.ts`

#### Files Modified
- `package.json`
- `src/features/voice-capture/components/voice-capture-screen.tsx`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `src/features/voice-capture/state/voice-capture-reducer.ts`
- `src/features/voice-capture/types/voice-types.ts`
- `src/features/voice-capture/services/upload-placeholder.ts`
- `src/shared/styles/globals.css`
- `tests/e2e/env-core.spec.ts`
- `tests/playwright.config.ts`
- `docs/sprint-summary.md`

#### Architecture Changes
- Replaced the legacy card-based capture shell with a motion-driven 3-step capture interface tied to reducer status mapping
- Isolated Playwright smoke and UI-flow configs so env validation and capture UX can be verified independently

#### State Machine Changes
- Preserved all 8 constitutional states
- Allowed `recording -> stopping` on the second mic touch without weakening the 15-second auto-stop
- Preserved synchronous `clientRequestId` submission locking before async upload begins

#### Audio / Transport Changes
- No MediaRecorder path introduced
- AudioWorklet + PCM over WSS-only architecture preserved
- Placeholder upload delay added only for deterministic UI sending feedback

#### Submission / Cost Defense Changes
- Step 2 now appears immediately after user stop instead of waiting for 15 seconds
- Send state shows rotating neon border while reducer status is `uploading`
- Success step auto-returns to Step 1 exactly 2000ms after success text appears

#### Known Risks
- Real AudioWorklet capture and WSS transport are still not wired
- Placeholder upload success path does not exercise backend failures beyond UI retry plumbing

#### Manual QA
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run test:e2e`
- [x] Verified Step 1 -> Step 2 -> Step 3 -> Step 1 loop in Playwright

- [x] `npm run build` with local-safe placeholder env values compiles successfully

#### Next Sprint Prerequisites
- wire real AudioWorklet session lifecycle into the reducer
- connect WSS / webhook transport to live upload and transcript data
- regression-test live 15-second stop and duplicate-lock behavior against backend

---

### Sprint 5 - Voice Motion Detail Polish
- Date: 2026-03-10
- Status: completed

#### Goal
Tune only the requested visual details in the capture screen without changing reducer logic, state transitions, timing truth, or submission locking.

#### Files Created
- None

#### Files Modified
- `src/features/voice-capture/components/voice-capture-screen.tsx`
- `docs/sprint-summary.md`

#### Architecture Changes
- No architecture or routing changes
- UI polish remained isolated to the Step 1 visual layer and footer motion

#### State Machine Changes
- None
- Preserved all 8 constitutional states and existing reducer-driven timing behavior

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Reference image `8.jpg` was not present in the workspace, so tuning was implemented from the user's written spec
- Final visual fidelity should still be manually checked against the intended reference asset if it is later provided

#### Manual QA
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run test:e2e`
- [x] Verify idle waveform remains vertically sculpted before recording starts
- [x] Verify recording waveform color/glow matches the neon blue mic button
- [x] Verify mic breathing reads as brightness pulsing without messy glow spread
- [x] Verify footer copy loops left-to-right continuously with no yoyo motion

- [x] `npm run build` with local-safe placeholder env values compiles successfully

#### Next Sprint Prerequisites
- Validate motion polish against the missing visual reference asset
- Continue preserving reducer/state-machine ownership as live audio transport is added

---

### Sprint 6 - Excalidraw Intake Workflow
- Date: 2026-03-12
- Status: completed

#### Goal
Establish a repository-level workflow so Excalidraw and exported design assets can be dropped into a shared folder and interpreted as the visual brief for Codex implementation work.

#### Files Created
- `docs/diagrams/README.md`
- `skills.md`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a diagram intake layer centered on `docs/diagrams/` for `.excalidraw`, `.png`, and `.svg` design sources
- Added repository-level interpretation rules so diagram-driven work remains aligned with Voxera guardrails

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Diagram intake is workflow-based and depends on the user placing files in `docs/diagrams/`
- Image exports may omit behavioral nuance that exists only in the original `.excalidraw` annotations

#### Manual QA
- [ ] Place a sample `.excalidraw`, `.png`, or `.svg` file in `docs/diagrams/`
- [ ] Ask Codex to implement from that file and confirm the file is treated as the source brief

#### Next Sprint Prerequisites
- Add the first real Excalidraw artifact and validate the interpretation workflow against a live implementation task

---
## Current Known Risks (Rolling Section)

- AudioWorklet runtime path is not yet implemented
- WSS runtime path is not yet implemented
- backend / Make.com integration not yet tested end-to-end
- duplicate lock must be verified again once webhook upload is added
- timeout and upload flow must be verified together once live network flow exists
- current premium UI still needs broader real-device validation against live backend latency
- queue fallback can still surface as pending-success UI when webhook delivery is deferred
- diagram intake depends on source files being added to `docs/diagrams/`
- Firestore wallet collections, Firebase Auth service credentials, and Google Secret Manager bindings must be provisioned before `/api/v1/generate-output` can be exercised against real cloud state
- The stdio reviewer currently enforces targeted static rules (Zod gate + hardcoded secret detection) but not full semantic diff review
- Notion production rollout now persists encrypted OAuth tokens through Prisma, but production still needs real `DATABASE_URL` and `NOTION_TOKEN_ENCRYPTION_KEY` provisioning
- Notion delivery billing log writes occur after the external page create succeeds, so a post-write database failure could still surface as an API error after the Notion page already exists
- Solapi messaging settlement currently assumes provider acceptance from `addMessages()` is sufficient to mark `destination_delivered = true`; webhook-backed receipt confirmation is still required if finance wants terminal recipient delivery semantics
- The new message dispatch service still needs a concrete atomic store implementation for `reserve()` and `markDelivered()` before its 2PC guarantees are real in production

---

## Current Manual Regression Checklist

- [x] No MediaRecorder exists anywhere in the codebase
- [x] No blob/timeslice recording exists
- [x] Audio architecture remains AudioWorklet + PCM over WSS only
- [ ] Recording cannot exceed 15 seconds in runtime flow
- [ ] Submission locks before async upload in live flow
- [ ] Duplicate `clientRequestId` upload is blocked in live flow
- [x] Front-end posts metadata-only payloads to `/api/voice/submit`
- [x] 8-state reducer architecture remains intact
- [x] No insecure `ws://` remains in production code paths
- [x] No permission popup infinite loop exists in current shell logic
- [x] UI supports one-handed mobile use
- [x] Step 1 -> Step 2 -> Step 3 -> Step 1 loop is Playwright-verified
- [ ] Excalidraw artifacts in `docs/diagrams/` are treated as the source brief for diagram-driven tasks
- [x] `/api/v1/generate-output` request bodies are Zod-validated before billing logic runs
- [x] Firestore billing route uses reserve then deduct/refund instead of direct charge
- [x] Local stdio MCP reviewer can pull updates and emit allow/deny diagnostics with line numbers
- [x] Solapi message dispatch service forces `disableSms: true` and withholds billing commits on failed primary/fallback attempts
- [ ] Solapi message dispatch repository implements atomic CAS semantics for `reserve()` and `markDelivered()`

---

## Instructions for Codex Before Any New Sprint

Before starting a sprint, Codex must:

1. Read this file.
2. Restate the current architecture in brief.
3. Confirm these non-negotiable rules:
   - AudioWorklet + PCM over WSS only
   - Exact 15-second cutoff
   - `clientRequestId` duplicate lock
   - 8-state reducer preserved
4. Then proceed with coding.

After finishing a sprint, Codex must:

1. Update the relevant sprint section.
2. Update Current Architecture Snapshot.
3. Update Current Known Risks.
4. Update Current Manual Regression Checklist if needed.

### Zero-Touch Design Automation Addendum
- Idea source folder: `docs/ideas/`
- Blueprint output folder: `docs/blueprints/`
- Component output folder: `src/components/generated/`
- Watch script: `scripts/auto-design.js`
- Runtime requirement: local `ANTHROPIC_API_KEY`, network access, and installed `chokidar`

### Sprint 7 - Zero-Touch Text-to-SVG Automation
- Date: 2026-03-12
- Status: completed

#### Goal
Establish a local watcher that converts one-line text briefs into an SVG blueprint and a generated React component in a single automated flow.

#### Files Created
- `docs/ideas/README.md`
- `docs/blueprints/README.md`
- `scripts/auto-design.js`

#### Files Modified
- `package.json`
- `skills.md`
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a zero-touch design intake path rooted at `docs/ideas/`
- Added automated SVG blueprint output at `docs/blueprints/`
- Added generated React component output at `src/components/generated/`
- Added a local watcher script that performs a two-stage Claude generation flow

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The watcher requires `ANTHROPIC_API_KEY` and runtime network access
- Generated code may still need manual review before being merged into production paths
- `chokidar` was declared in `package.json` but not installed in this environment

#### Manual QA
- [ ] Add a one-line `.txt` brief to `docs/ideas/`
- [ ] Run `node scripts/auto-design.js`
- [ ] Confirm a matching `.svg` file appears in `docs/blueprints/`
- [ ] Confirm a matching generated component appears in `src/components/generated/`

#### Next Sprint Prerequisites
- Install dependencies and validate the live Claude call path
- Decide when generated components should be promoted from `src/components/generated/` into feature-owned UI

### Sprint 8 - Warm Landing Zero-Touch Verification
- Date: 2026-03-12
- Status: completed

#### Goal
Self-verify the zero-touch watcher by generating a warm landing brief, producing SVG and React outputs, and wiring the generated landing into the marketing route with a Free Trial modal trigger.

#### Files Created
- `docs/ideas/warm-landing.txt`
- `docs/blueprints/warm-landing.svg`
- `docs/blueprints/warm-landing.json`
- `src/components/generated/WarmLandingGenerated.tsx`
- `src/features/marketing/components/free-trial-modal.tsx`

#### Files Modified
- `scripts/auto-design.js`
- `src/features/marketing/components/marketing-landing.tsx`
- `docs/sprint-summary.md`

#### Architecture Changes
- Verified the zero-touch watcher can ingest a local idea brief and emit blueprint plus component artifacts
- Promoted the generated warm landing into the marketing route for live browser rendering
- Added a local Free Trial modal so the warm landing mic and CTA can toggle a VIP-style modal state

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Remote Claude generation was not exercised because `ANTHROPIC_API_KEY` was unavailable in this environment
- The current warm landing uses a local fallback generator path for deterministic offline output

#### Manual QA
- [x] Confirmed `docs/ideas/`, `docs/blueprints/`, and `src/components/` exist
- [x] Ran `node scripts/auto-design.js` and generated `warm-landing` blueprint and component artifacts
- [x] Verified `npm run typecheck`
- [x] Verified `npm run lint`
- [x] Verified `npm run test`
- [ ] Open the local marketing route in a browser and confirm mic click opens the VIP modal

#### Next Sprint Prerequisites
- Add `ANTHROPIC_API_KEY` and re-run the watcher to validate the remote Claude path
- Decide whether the warm landing becomes the default marketing page or a campaign-specific route

### Sprint 9 - OpenAI-Keyed S.T.R.U.C.T. Warm Landing Regeneration
- Date: 2026-03-12
- Status: completed

#### Goal
Load a live API key from `.env`, run the S.T.R.U.C.T. translation path for `warm-landing`, and regenerate the Visual PRD, SVG, and TSX outputs.

#### Files Created
- `.env`

#### Files Modified
- `.gitignore`
- `scripts/auto-design.js`
- `docs/blueprints/warm-landing.visual-prd.md`
- `docs/blueprints/warm-landing.svg`
- `src/components/generated/WarmLandingGenerated.tsx`
- `docs/sprint-summary.md`

#### Architecture Changes
- Added local `.env` loading to the zero-touch watcher
- Added a Visual PRD generation stage ahead of SVG and TSX generation
- Verified remote provider metadata can record `openai / gpt-4o` generation for warm landing artifacts

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The remote model response introduced mojibake in Korean copy, so final render artifacts were normalized against the original brief after the remote translation stage
- `.env` now contains a live secret and must remain uncommitted

#### Manual QA
- [x] Loaded API credentials from `.env`
- [x] Generated a remote `openai / gpt-4o` Visual PRD for `warm-landing`
- [x] Rewrote the final SVG and TSX artifacts to preserve exact Korean copy from the brief
- [x] Verified `npm run typecheck`
- [x] Verified `npm run lint`
- [x] Verified `npm run test`

#### Next Sprint Prerequisites
- Decide whether to automate post-generation Unicode normalization for multilingual briefs
- Consider adding a one-shot CLI mode to `auto-design.js` so remote generation can complete without watcher timeouts

### Sprint 10 - V-DD Landing Skill Authoring
- Date: 2026-03-12
- Status: completed

#### Goal
Add a reusable local skill that forces V-DD landing-page work to flow through S.T.R.U.C.T reverse-design and SVG blueprinting before implementation.

#### Files Created
- `.agents/skills/v-dd-landing-rendering/SKILL.md`
- `.agents/skills/v-dd-landing-rendering/agents/openai.yaml`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a repository-local skill for landing-page generation workflow guidance
- Formalized a pre-code sequence of S.T.R.U.C.T spec -> SVG blueprint -> implementation for V-DD landing work
- Standardized fixed `max-w-*` container usage and `break-keep` text handling in the new skill rules

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The new skill governs future agent behavior but does not retroactively rewrite existing generated landing assets
- The skill does not yet bundle helper scripts for automatic SVG emission, so blueprint generation still depends on the active agent following the instructions

#### Manual QA
- [x] Initialized the skill with `init_skill.py`
- [x] Rewrote `SKILL.md` with the required workflow and constraints
- [x] Validated the skill folder with `quick_validate.py`

#### Next Sprint Prerequisites
- Use the new skill on a live landing-page brief and confirm the output order remains S.T.R.U.C.T -> SVG -> code

### Sprint 11 - Visual Auto-Launch Rule
- Date: 2026-03-12
- Status: completed

#### Goal
Persist an automatic visual preview rule so frontend work ends with a running local server and an opened browser, not just code completion.

#### Files Created
- None

#### Files Modified
- `skills.md`
- `.agents/skills/v-dd-landing-rendering/SKILL.md`
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a repository-level Visual Auto-Launch rule for frontend and UI tasks
- Extended the V-DD landing skill so local preview boot and browser popup are part of completion behavior

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Automatic browser launch assumes port `3000` remains the active local preview target
- Background dev servers can linger if they are not intentionally shut down after review

#### Manual QA
- [x] Added repository rule text for automatic visual launch
- [x] Added matching behavior to the V-DD landing skill
- [ ] Start the dev server and confirm the browser opens to the warm landing automatically

#### Next Sprint Prerequisites
- If multiple frontend apps are added later, define route-aware preview selection rules per app

### Sprint 12 - Node Browser Launcher And V-DD Blueprint Delivery
- Date: 2026-03-12
- Status: completed

#### Goal
Add a Node-based browser launcher that bypasses shell popup limits and use the V-DD workflow to deliver blueprint-only SVG visuals for new landing concepts without writing TSX.

#### Files Created
- `scripts/open-browser.js`
- `docs/blueprints/warm-landing-revival.visual-prd.md`
- `docs/blueprints/warm-landing-revival.svg`
- `docs/blueprints/b2b-cold-bento.visual-prd.md`
- `docs/blueprints/b2b-cold-bento.svg`

#### Files Modified
- `skills.md`
- `.agents/skills/v-dd-landing-rendering/SKILL.md`
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a Node fallback launcher for visual QA targets such as local preview URLs and generated SVG blueprint files
- Extended the V-DD skill and repository rules so blueprint-only work can auto-open SVGs even when shell popup commands are blocked
- Added two new blueprint artifacts that stop at S.T.R.U.C.T spec plus SVG planning output

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Browser opening still depends on the local OS honoring child-process launch behavior from Node
- The generated SVGs are planning blueprints and not pixel-perfect final UI renders

#### Manual QA
- [x] Created `scripts/open-browser.js`
- [x] Generated warm and B2B Visual PRDs
- [x] Generated warm and B2B SVG blueprint files
- [ ] Confirm both SVG files open in the local browser/windowing environment

#### Next Sprint Prerequisites
- Convert the approved SVG blueprint into production landing code only after visual sign-off

### Sprint 13 - Open Package Browser Launcher Rewrite
- Date: 2026-03-12
- Status: completed

#### Goal
Replace the brittle child-process browser launcher with an `open` package-based launcher that resolves paths absolutely and opens multiple visual QA targets reliably.

#### Files Created
- None

#### Files Modified
- `package.json`
- `package-lock.json`
- `scripts/open-browser.js`
- `docs/sprint-summary.md`

#### Architecture Changes
- Swapped the visual QA launcher from manual OS process spawning to the `open` library
- Standardized absolute-path conversion with `path.resolve()` and `pathToFileURL()` before browser dispatch
- Added Promise-based multi-target opening so one command can launch multiple SVG tabs

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Successful process launch still does not let the agent introspect the user's desktop to visually prove the tabs are frontmost
- `npm install` updated lockfile state in a repository that otherwise prefers `pnpm`

#### Manual QA
- [x] Installed `open`
- [x] Rewrote `scripts/open-browser.js` to use `open`
- [x] Re-ran the launcher on both SVG blueprint files without shell errors

#### Next Sprint Prerequisites
- If visual QA expands further, add a tiny launcher self-test that records opened targets to a local log

### Sprint 14 - Native Final B2B SVG Delivery
- Date: 2026-03-12
- Status: completed

#### Goal
Deliver a final B2B cold landing SVG blueprint aligned to the approved hybrid Hero + Vercel Bento concept and open it with the VS Code native tab workflow.

#### Files Created
- `docs/blueprints/final-b2b-landing.svg`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a final single-file B2B blueprint artifact tuned for VS Code native SVG review
- Adopted the VS Code CLI file-open path as the approved visual QA mechanism for SVG blueprint review

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Native VS Code tab opening confirms editor delivery, but final visual polish still depends on human review of the rendered SVG

#### Manual QA
- [x] Generated `docs/blueprints/final-b2b-landing.svg`
- [x] Opened the SVG via `code docs/blueprints/final-b2b-landing.svg`

#### Next Sprint Prerequisites
- Convert the approved final B2B SVG into implementation work only after visual sign-off

### Sprint 15 - Final B2B SVG Detail Correction
- Date: 2026-03-12
- Status: completed

#### Goal
Correct the final B2B blueprint's CTA fit, hero spacing, motion annotation, and bento lighting details before any implementation work begins.

#### Files Created
- None

#### Files Modified
- `docs/blueprints/final-b2b-landing.svg`
- `docs/sprint-summary.md`

#### Architecture Changes
- Refined the SVG-only final B2B blueprint with explicit motion comments and stronger spacing/spec fidelity
- Kept review flow on VS Code native SVG tabs with no React or TSX work introduced

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The SVG now better documents intended motion, but actual animation timing still needs implementation after sign-off

#### Manual QA
- [x] Expanded CTA geometry so the text sits fully inside each button
- [x] Increased the copy-to-mic vertical separation past the requested 96px gap
- [x] Added implementation comment text for staggered EQ and pulse/glow mic motion
- [x] Reworked bento cards to 1px / 5% white borders with spotlight-style radial fills
- [x] Re-opened `final-b2b-landing.svg` in VS Code

#### Next Sprint Prerequisites
- Translate the approved SVG motion annotations into production animation only after final visual approval

### Sprint 16 - Final B2B SVG Centering Revision
- Date: 2026-03-12
- Status: completed

#### Goal
Rework the final B2B SVG so the hero copy becomes a strict centered 2-line statement, the CTA pair shares a unified filled tone, and the mic/EQ cluster expands to a perfectly centered 7-by-7 arrangement with stronger spacing separation.

#### Files Created
- None

#### Files Modified
- `docs/blueprints/final-b2b-landing.svg`
- `docs/sprint-summary.md`

#### Architecture Changes
- Tightened the SVG blueprint's hero alignment and spacing rules without introducing any code implementation work
- Switched Korean SVG labels to numeric character references to avoid shell mojibake during review workflows

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Character references improve file stability in tooling, but visual approval is still required inside the editor render surface

#### Manual QA
- [x] Replaced the hero line with a forced 2-line centered copy block
- [x] Unified both CTA buttons with a single filled gradient tone
- [x] Preserved more than 120px of safe space between the CTA group and the mic plate
- [x] Expanded EQ bars to 7 left + 7 right and aligned them to the mic center axis
- [x] Re-opened `final-b2b-landing.svg` in VS Code

#### Next Sprint Prerequisites
- Wait for final visual sign-off before any production implementation work

### Sprint 17 - Final B2B Real Image Embedding
- Date: 2026-03-12
- Status: completed

#### Goal
Replace the synthetic mic drawing in the final B2B SVG with the user-provided local mic image and hard-align the top and bottom groups to a shared center axis.

#### Files Created
- None

#### Files Modified
- `docs/blueprints/final-b2b-landing.svg`
- `docs/sprint-summary.md`

#### Architecture Changes
- Swapped the blueprint's center mic from vector stand-in geometry to a real local raster asset embedded with SVG `<image>`
- Tightened the hero and mic/EQ groups around a single `center x = 800` alignment rule

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The SVG now depends on the local image file `docs/blueprints/unnamed (2).jpg` remaining present beside the blueprint

#### Manual QA
- [x] Confirmed the local mic reference file exists in `docs/blueprints/`
- [x] Embedded the reference image in `final-b2b-landing.svg` with `<image>`
- [x] Re-aligned the top copy/CTA group and bottom mic/EQ group to `center x = 800`
- [x] Split EQ gradients to mint-left and purple-right

#### Next Sprint Prerequisites
- Lock the final approved asset filename if the user wants to remove spaces from the current image path

### Sprint 18 - Final B2B Base64 Embedding
- Date: 2026-03-12
- Status: completed

#### Goal
Eliminate local-path fragility by embedding the approved mic reference JPG directly into the final B2B SVG as a Base64 data URI while preserving the shared center axis.

#### Files Created
- None

#### Files Modified
- `docs/blueprints/final-b2b-landing.svg`
- `docs/sprint-summary.md`

#### Architecture Changes
- Replaced the relative file reference inside the final B2B SVG with an inline `data:image/jpeg;base64,...` payload
- Preserved the `center x = 800` alignment rule for both the top content group and the bottom mic/EQ group

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The final SVG file is now much larger because it carries the full raster asset inline

#### Manual QA
- [x] Read the local JPG from `docs/blueprints/unnamed (2).jpg`
- [x] Encoded the JPG to Base64 and embedded it directly in `final-b2b-landing.svg`
- [x] Re-opened the SVG via VS Code native file opening

#### Next Sprint Prerequisites
- Proceed only after visual sign-off on the fully self-contained final SVG artifact

### Sprint 19 - Final B2B Center Axis Correction
- Date: 2026-03-12
- Status: completed

#### Goal
Correct the final B2B SVG center-axis math so the top copy/CTA group and the bottom mic/EQ group share the same vertical center line with the mic image placed by `center - width / 2`.

#### Files Created
- None

#### Files Modified
- `docs/blueprints/final-b2b-landing.svg`
- `docs/sprint-summary.md`

#### Architecture Changes
- Kept the final B2B artifact as a self-contained SVG with embedded Base64 JPG
- Re-centered the CTA pair around `center x = 800`
- Preserved the mic image at `x = 600` for a `400px`-wide asset, matching `800 - 400 / 2`
- Repositioned the left/right 7-bar EQ groups to remain symmetric around the same center axis

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- None

#### Manual QA
- [x] Verified the mic image remains embedded as Base64
- [x] Verified the mic image origin is `x=600` for a `400px` width asset on an `x=800` center line
- [x] Verified the CTA pair and EQ bars were repositioned to align with the shared center axis
- [x] Re-opened the SVG via VS Code native file opening

#### Next Sprint Prerequisites
- Proceed only after visual sign-off on the corrected center-axis layout

### Sprint 20 - Final B2B Mike Image And Copy Refresh
- Date: 2026-03-12
- Status: completed

#### Goal
Swap the final B2B mic asset to the newly provided `MIKE_IMAGE.jpg` via inline Base64 and replace the upper headline/subcopy with the approved Korean launch copy while preserving the existing center axis and EQ layout.

#### Files Created
- None

#### Files Modified
- `docs/blueprints/final-b2b-landing.svg`
- `docs/sprint-summary.md`

#### Architecture Changes
- Replaced the embedded JPG payload inside the central `<image>` tag with the new `MIKE_IMAGE.jpg` Base64 data URI
- Kept the mic placement, center axis, CTA positions, and 7+7 EQ bar coordinates unchanged
- Replaced the upper content copy with a 2-line headline and 2-line subcopy centered at `x = 800`

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- None

#### Manual QA
- [x] Verified `docs/blueprints/MIKE_IMAGE.jpg` exists and was read locally
- [x] Replaced the existing SVG `<image>` payload with a new `data:image/jpeg;base64,...` string
- [x] Replaced the upper text block with the approved 2-line headline and 2-line subcopy
- [x] Re-opened the SVG through VS Code native file opening

#### Next Sprint Prerequisites
- Proceed only after visual sign-off on the updated mic branding and approved launch copy

### Sprint 21 - Final B2B Copy Reduction And Aurora EQ Rollback
- Date: 2026-03-12
- Status: completed

#### Goal
Reduce visual noise in the final B2B SVG by removing the subcopy block and restoring the 14 EQ bars to a shared multi-color aurora gradient without changing the approved image placement or layout.

#### Files Created
- None

#### Files Modified
- `docs/blueprints/final-b2b-landing.svg`
- `docs/sprint-summary.md`

#### Architecture Changes
- Removed the 2-line subcopy block entirely from the hero area
- Replaced the split mint/purple EQ gradients with a single multi-color aurora gradient applied to all 14 bars
- Preserved the mic Base64 asset, center axis, CTA placement, and EQ geometry

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- None

#### Manual QA
- [x] Verified the subcopy `<text>` block was removed from the hero area
- [x] Verified all 14 EQ bars now use the same multi-color aurora gradient
- [x] Re-opened the SVG through VS Code native file opening

#### Next Sprint Prerequisites
- Proceed only after visual sign-off on the simplified hero and aurora EQ color treatment

### Sprint 22 - Final B2B Headline Box Tightening And EQ Reference Restore
- Date: 2026-03-12
- Status: completed

#### Goal
Tighten the headline box to the actual copy width and restore the original short multi-color EQ cluster using the provided waveform reference image.

#### Files Created
- None

#### Files Modified
- `docs/blueprints/final-b2b-landing.svg`
- `docs/sprint-summary.md`

#### Architecture Changes
- Reduced the headline card width and kept the headline text centered on `x = 800`
- Replaced the wide 14-bar aurora treatment with a compact reference-style left/right EQ cluster positioned around the mic
- Preserved the embedded mic image, overall hero frame, CTA placement, and center-axis rule

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- None

#### Manual QA
- [x] Opened `docs/blueprints/?뚰삎 ?덊띁?곗뒪.jpg` and restored the short multi-color EQ cluster based on it
- [x] Reduced the headline box width and kept its text centered on the mic axis
- [x] Re-opened the SVG through VS Code native file opening

#### Next Sprint Prerequisites
- Proceed only after visual sign-off on the tightened headline box and restored EQ reference look

### Sprint 23 - One-Page Landing Code Dump
- Date: 2026-03-12
- Status: completed

#### Goal
Render the approved final B2B blueprint into a single continuous TSX landing file for production implementation prep.

#### Files Created
- `temp/stitch_dump.tsx`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a one-page landing TSX dump that mirrors the approved hero, trust rail, and bento layout in a single continuous view
- Embedded the approved mic JPG as a Base64 data URI inside the dump component to avoid file-path fragility
- Preserved repository constitutional rules by keeping voice/audio state architecture untouched

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- `stitch-mcp` was not available in this session, so the dump was generated locally instead of through `generate_ui_v3`
- The dump file is not yet wired into the app route tree

#### Manual QA
- [x] Generated a single long-page TSX component in `temp/stitch_dump.tsx`
- [x] Embedded the approved mic image as Base64 inside the dump
- [x] Preserved the approved center-aligned hero, trust rail, and bento composition in one continuous page

#### Next Sprint Prerequisites
- Decide whether to replace the current marketing entry component with the new dump or refactor it into reusable sections

### Sprint 24 - Stitch MCP Remote Connection Verification
- Date: 2026-03-12
- Status: completed

#### Goal
Verify the local Google auth state against Stitch, register the remote Stitch MCP endpoint in Codex config, and produce a real Stitch-generated landing artifact.

#### Files Created
- `temp/stitch-create-response.json`
- `temp/stitch-generate-response.json`
- `temp/stitch-real.html`
- `temp/stitch-real.png`

#### Files Modified
- `docs/sprint-summary.md`

#### External Config Modified
- `C:\Users\Master\.codex\config.toml`

#### Architecture Changes
- Confirmed the local machine already had Stitch setup metadata at `C:\Users\Master\.stitch-mcp-auto\config.json` pointing to project `upbeat-aura-484502-r2`
- Verified the remote Stitch MCP endpoint at `https://stitch.googleapis.com/mcp` responds to authenticated MCP initialization and tool discovery
- Registered the Stitch MCP endpoint in Codex config and generated a real Stitch screen artifact via the remote MCP HTTP interface

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The currently exposed Stitch MCP tools are `create_project`, `generate_screen_from_text`, `edit_screens`, etc.; `generate_ui_v3` is not exposed on this endpoint
- The current Codex session did not hot-inject a new `stitch-mcp` tool after config update, so the real generation was executed by direct authenticated MCP HTTP calls instead of an in-session tool binding
- Stitch's generated copy diverged from the approved Korean blueprint in parts, so the artifact should be treated as a real vendor render baseline, not a final approved production implementation

#### Manual QA
- [x] Confirmed ADC token auth works with `https://stitch.googleapis.com/mcp`
- [x] Confirmed `tools/list` exposes live Stitch tools for the authenticated project
- [x] Created a real Stitch project and generated a desktop landing screen
- [x] Downloaded the Stitch HTML and screenshot artifacts locally and opened them in VS Code

#### Next Sprint Prerequisites
- Decide whether to iterate inside Stitch using `edit_screens` or to port the approved SVG spec directly into production React/Next code

### Sprint 25 - Marketing Landing Layout Correction
- Date: 2026-03-12
- Status: completed

#### Goal
Replace the generated placeholder marketing page with a sectioned production landing and correct hero alignment, waveform rendering, and bento grid ordering against the approved B2B blueprint.

#### Files Created
- `public/images/mike-image.jpg`
- `src/components/sections/HeroSection.tsx`
- `src/components/sections/TrustRailSection.tsx`
- `src/components/sections/BentoGridSection.tsx`

#### Files Modified
- `src/features/marketing/components/marketing-landing.tsx`
- `docs/sprint-summary.md`

#### Architecture Changes
- Replaced the old generated warm landing entry with a section-based B2B marketing page
- Added a centered hero section with the approved mic image, compact multi-color EQ clusters, and unified CTA styling
- Rebuilt the lower bento area so the four workflow cards share the same width and height and the KPI card renders visibly without empty placeholder space
- Preserved voice capture architecture by limiting changes to the marketing route only

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The current QA loop verified the landing at `localhost:3000` with Agent Browser desktop viewport; additional mobile-specific visual polish may still be desirable
- `src/components/generated/WarmLandingGenerated.tsx` still exists on disk but is no longer wired into the marketing route

#### Manual QA
- [x] Ran `agent-browser --headed open http://localhost:3000`
- [x] Captured multiple headed screenshots after each correction pass
- [x] Verified card box parity with Agent Browser: all four feature cards reported `227.5 x 214`
- [x] Verified hero and mic center alignment with Agent Browser boxes: hero center `640`, mic center `640`, delta `0`

#### Next Sprint Prerequisites
- Decide whether to keep refining this landing as the main marketing entry or fold the remaining proof/support sections from the approved SVG into separate reusable sections

### Sprint 26 - Marketing Polish Cleanup
- Date: 2026-03-12
- Status: completed

#### Goal
Remove blueprint instruction leakage from the marketing UI and polish the hero CTA, trust marquee, mic frame, and closing strip for production presentation quality.

#### Files Created
- None

#### Files Modified
- `src/components/sections/HeroSection.tsx`
- `src/components/sections/TrustRailSection.tsx`
- `src/components/sections/BentoGridSection.tsx`
- `src/shared/styles/globals.css`
- `docs/sprint-summary.md`

#### Architecture Changes
- Removed the temporary hero badge and workflow instruction copy from the rendered UI
- Added a rotating glow border treatment to the primary CTA via global CSS
- Smoothed the trust marquee by extending the repeated content set and adjusting the animation distance
- Masked the embedded mic image corner watermark and removed the closing strip badge

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Agent Browser screenshots in this environment occasionally pad the unused viewport with white canvas, so DOM inspection was used alongside screenshots for confirmation

#### Manual QA
- [x] Confirmed the hero badge was removed and the subcopy now renders as two intentional lines
- [x] Confirmed the workflow instruction text was replaced with `Voice OS ?듭떖 湲곕뒫`
- [x] Confirmed the closing strip badge was removed and the closing line is forced onto one line
- [x] Re-verified the page in the headed local browser session at `http://localhost:3000`

#### Next Sprint Prerequisites
- If needed, tighten the remaining typography and section density after stakeholder sign-off on the current production-facing copy

### Sprint 27 - Marketing Copy Overhaul And EQ Motion Upgrade
- Date: 2026-03-12
- Status: completed

#### Goal
Execute the second-round UI surgery by replacing blueprint-like text with production copy, enforcing exact hero subcopy line breaks, and increasing EQ visual motion intensity.

#### Files Created
- None

#### Files Modified
- `src/components/sections/HeroSection.tsx`
- `src/components/sections/BentoGridSection.tsx`
- `src/shared/styles/globals.css`
- `docs/sprint-summary.md`

#### Architecture Changes
- Updated hero subcopy into two intentional lines split after `?뚯꽦 ?ㅽ뻾 ?뚮옯?쇱쓣,`
- Upgraded EQ bars from mild motion to stronger CSS keyframe rhythm with per-bar duration and delay variance
- Replaced bento top label/headline with production copy: `VOICE-FIRST WORKFLOW` and `蹂듭옟???낅젰 怨쇱젙?? ??踰덉쓽 ?뚯꽦?쇰줈`
- Replaced all four workflow card title/body pairs with the approved killer copy set
- Removed residual instructional workflow heading text from the right bento block

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Agent Browser viewport screenshots in this environment continue to include gray padded areas outside the rendered page; DOM inspection and text assertions were used alongside screenshots

#### Manual QA
- [x] Confirmed hero subcopy line break appears exactly after `?뚯꽦 ?ㅽ뻾 ?뚮옯?쇱쓣,`
- [x] Confirmed old bento texts (`6-Column Bento Grid`, `?ㅽ뻾 吏?쒖? ?댁쁺 ?ㅺ퀎瑜?..`, workflow instruction copy) are removed
- [x] Confirmed new killer-copy card titles and bodies are rendered
- [x] Confirmed EQ bars now render with per-bar animation duration/delay and dynamic height variance in browser inspection

#### Next Sprint Prerequisites
- Tune card typography density at smaller desktop widths if stakeholders request stronger readability at 1366x768

### Sprint 28 - Third Surgery Cleanup (Mask Removal + Motion Smoothing)
- Date: 2026-03-12
- Status: completed

#### Goal
Remove the fake black watermark mask, replace it with real image crop behavior, smooth EQ motion for premium B2B tone, and eliminate the last two blueprint-instruction texts from the rendered landing.

#### Files Created
- `temp/sprint28-after-fix.png`

#### Files Modified
- `src/components/sections/HeroSection.tsx`
- `src/components/sections/BentoGridSection.tsx`
- `src/shared/styles/globals.css`
- `docs/sprint-summary.md`

#### Architecture Changes
- Hero mic container now uses `overflow-hidden` + scaled image crop (`scale-105`) instead of an overlaid dark circle mask
- EQ bars keep the existing structure while switching to slower `1.6s~2.45s` animation durations with `ease-in-out`
- Removed residual instruction labels from production UI: `1. KPI Card` and `Closing Proof Strip`

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Hero/KPI/body copy appears mojibake in this terminal code page, but browser-rendered Korean text is validated through Agent Browser snapshot output
- Current EQ cluster count remains `5 + 5`; if product direction still requires `7 + 7`, apply as a follow-up visual task

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `agent-browser open http://localhost:3000 --headed`
- [x] `agent-browser screenshot temp/sprint28-after-fix.png --full`
- [x] `agent-browser eval` confirmed:
  - black mask element absent
  - `1. KPI Card` text absent
  - `Closing Proof Strip` text absent
  - EQ animation durations within `1.6s~2.45s` and timing function `ease-in-out`

#### Next Sprint Prerequisites
- If needed, re-run final visual sign-off on mobile viewport with Agent Browser and tune typography scale only

### Sprint 29 - Bento Removal And Z-Pattern Rebuild
- Date: 2026-03-12
- Status: completed

#### Goal
Keep the approved hero and trust bar unchanged, remove the dense bento grid, and rebuild the lower body as four wide alternating Z-pattern sections with premium dark glassmorphism mock panels.

#### Files Created
- `temp/sprint29-z-pattern.png`

#### Files Modified
- `src/components/sections/BentoGridSection.tsx`
- `docs/sprint-summary.md`

#### Architecture Changes
- Replaced the prior bento-kpi/workflow layout with four vertical `grid-cols-2` zigzag sections
- Enforced alternating composition per section: text-left/mock-right then mock-left/text-right
- Introduced deep-dark glassmorphism mock containers with thin mint/purple neon borders and internal metric visualization
- Preserved top-of-page structure by leaving `HeroSection` and `TrustRailSection` wiring unchanged in `marketing-landing.tsx`

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The new section-copy and mock density are tuned for desktop first; additional mobile typography tightening may be requested after visual sign-off
- Terminal code page can still display Korean as mojibake while browser rendering remains correct

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `agent-browser open http://localhost:3000 --headed`
- [x] `agent-browser snapshot --json` confirmed all 4 requested section headlines are rendered
- [x] `agent-browser get count "[data-testid='kpi-card']" --json` returned `0`
- [x] `agent-browser get count "[data-testid='z-pattern-mock']" --json` returned `4`
- [x] `agent-browser screenshot temp/sprint29-z-pattern.png --full`

#### Next Sprint Prerequisites
- If stakeholders request stronger visual hierarchy, tune per-section spacing/typography without reintroducing dense card clustering

### Sprint 30 - Watermark Crop Hardening And Z-Pattern Infographic Upgrade
- Date: 2026-03-12
- Status: completed

#### Goal
Keep approved hero/trust behavior intact while applying strict watermark crop rules on the mic image and upgrading the 4-section Z-pattern area with fixed Korean line breaks and infographic visuals.

#### Files Created
- `temp/sprint30-zpattern-infographic.png`

#### Files Modified
- `src/components/sections/HeroSection.tsx`
- `src/components/sections/BentoGridSection.tsx`
- `src/shared/styles/globals.css`
- `docs/sprint-summary.md`

#### Architecture Changes
- Applied top-left anchored mic crop using `origin-top-left` + `scale-[1.15]` while preserving parent `overflow-hidden`
- Converted all four body sections to fixed 2-line title + fixed 2-line paragraph copy with explicit `<br />` placement
- Preserved responsive Z-pattern structure with mobile `flex-col` and desktop `md:grid-cols-2` alternation
- Replaced generic mock blocks with four dedicated infographic renderers:
  - multi-color waveform + typing line
  - dummy text to neon-mint bullet conversion
  - neon wire links from mic core to Kakao/Notion/Google pills
  - speech bubbles stacking into a lower grid block
- Added dedicated animation classes/keyframes in global styles for infographic motion

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The CLI terminal still shows occasional mojibake for Korean literals, but browser rendering/snapshot output confirms the copy is correct
- Additional micro-polish (animation pacing, icon detail) may be requested after visual stakeholder pass

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `agent-browser open http://localhost:3000 --headed`
- [x] `agent-browser snapshot --json` verified all four updated section headlines and bodies
- [x] `agent-browser get count "[data-testid='z-pattern-mock']" --json` returned `4`
- [x] `agent-browser get count "[data-testid='kpi-card']" --json` returned `0`
- [x] `agent-browser screenshot temp/sprint30-zpattern-infographic.png --full`

#### Next Sprint Prerequisites
- If requested, tune only infographic detail polish without changing approved text breaks or hero/trust alignment

### Sprint 31 - Pure-Code Hero Mic And Reference-Matched Z-Pattern Refinement
- Date: 2026-03-13
- Status: completed

#### Goal
Match the provided `1.jpg` direction by replacing image-based mic rendering with a pure-code hologram component, tightening hero CTA/trust details, and enforcing fixed copy line breaks plus responsive Z-pattern section behavior.

#### Files Created
- `src/components/sections/VoiceHologramMic.tsx`
- `temp/sprint31-hero-zpattern-final.png`

#### Files Modified
- `src/components/sections/HeroSection.tsx`
- `src/components/sections/TrustRailSection.tsx`
- `src/components/sections/BentoGridSection.tsx`
- `src/shared/styles/globals.css`
- `docs/sprint-summary.md`

#### Architecture Changes
- Replaced hero mic image usage with a pure SVG/CSS `VoiceHologramMic` component including neon `VOICE` hologram text and bilateral EQ bars
- Preserved solid-gradient primary CTA and converted secondary CTA to transparent outline style
- Refined trust rail into a thin white rounded outline marquee with evenly spaced `KAKAO / NOTION / GOOGLE / NAVER MEMO`
- Rebuilt lower body sections with fixed line-break copy and responsive behavior:
  - mobile: `flex-col-reverse` (`?대?吏 -> ?띿뒪??)
  - desktop: `md:grid-cols-2` zigzag alternation
- Kept four infographic motifs and upgraded animation primitives in global CSS (`voxera-mic-eq`, wire flow, stacking glow, typing, waveform)

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Visual parity is tuned to the provided static screenshot direction; additional pixel tweaks may still be requested per device viewport
- Terminal output may still show Korean mojibake while browser-rendered copy remains correct

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `agent-browser open http://localhost:3000 --headed`
- [x] `agent-browser snapshot --json` verified updated hero/CTA/trust/section copy rendering
- [x] `agent-browser get count "[data-testid='z-pattern-mock']" --json` returned `4`
- [x] `agent-browser get count "img[alt='Voxera microphone core']" --json` returned `0`
- [x] `agent-browser screenshot temp/sprint31-hero-zpattern-final.png --full`

#### Next Sprint Prerequisites
- If requested, run one more contrast/spacing pass at target viewport(s) while preserving fixed copy breaks and pure-code mic architecture

### Sprint 32 - 3.jpg Blueprint-Only SVG Draft And File Popup
- Date: 2026-03-13
- Status: completed

#### Goal
Pause production UI coding and generate a single SVG blueprint artifact that captures the requested hero/mic/trust/Z-pattern card details from the latest reference, then force-open it for visual confirmation.

#### Files Created
- `docs/blueprints/landing_blueprint.svg`
- `temp/landing_blueprint-svg-popup.png`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a blueprint-only SVG artifact (no Next.js component wiring) with:
  - two-line hero headline and fixed subcopy line break
  - gradient primary CTA + outlined secondary CTA
  - rounded mic container with internal mic + side waveform depiction
  - rounded trust rail with spaced brand sequence
  - four large horizontal neon-stroked cards arranged in alternating Z-pattern composition
  - card-internal mock text/diagram details for waveform, checklist conversion, network wireframe, and tag-stack UI

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- This sprint intentionally stops at static SVG blueprint output; production motion/interaction parity still requires later React implementation
- Agent Browser full-page screenshot on local SVG timed out once; non-full screenshot succeeded

#### Manual QA
- [x] Created `docs/blueprints/landing_blueprint.svg`
- [x] Opened `file:///C:/Users/Master/Documents/Playground/docs/blueprints/landing_blueprint.svg` with Agent Browser
- [x] `agent-browser snapshot --json` confirmed `file://` origin and expected blueprint text coverage
- [x] Captured popup proof screenshot at `temp/landing_blueprint-svg-popup.png`

#### Next Sprint Prerequisites
- Await visual sign-off on the blueprint before converting to production TSX/Next.js code

### Sprint 33 - Separate 2D Diagram Landing Route
- Date: 2026-03-13
- Status: completed

#### Goal
Create a brand-new landing page from the provided 2D diagram brief in a separate file/route so it is isolated from the existing marketing landing work and immediately previewable.

#### Files Created
- `src/features/marketing/components/landing-2d-diagram.tsx`
- `src/app/(marketing)/landing-2d/page.tsx`
- `temp/landing-2d-preview.png`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added an isolated marketing route at `/landing-2d`
- Implemented a dedicated 2D-diagram-styled landing component containing:
  - Hero container + mic center visual + dual CTA
  - Problems 2x2 grid cards
  - How-It-Works 3-step flow with arrows
  - Impact metric split cards + partner block + footer
- Left existing landing implementations untouched

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- The source diagram text file showed mojibake in this shell, so Korean copy was normalized from readable intent where necessary
- This route is an isolated draft surface and is not yet linked from the main landing entry

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `agent-browser open http://localhost:3000/landing-2d --headed`
- [x] `agent-browser snapshot --json` confirmed expected section/heading content
- [x] Captured preview screenshot at `temp/landing-2d-preview.png`

#### Next Sprint Prerequisites
- After stakeholder review, either keep `/landing-2d` as standalone campaign route or promote selected sections into reusable shared components

### Sprint 34 - Fixed Blueprint Reset (Wireframe Mic + Zero Overflow)
- Date: 2026-03-13
- Status: completed

#### Goal
Stop production coding, reset the previous broken visual layout direction, and deliver a corrected single SVG blueprint focused on high-end wireframe mic rendering and strict text overflow control.

#### Files Created
- `docs/blueprints/landing_fixed_blueprint.svg`
- `temp/landing_fixed_blueprint-popup.png`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a blueprint-only SVG with:
  - Minimal wireframe microphone replacing bulky 3D style
  - Neon mint/cyber-purple EQ cluster around mic
  - Four large rounded Z-pattern cards with explicit inner safe padding and overflow-safe text layout intent
  - Reset notes block codifying `overflow-hidden`, `p-8/p-10`, `flex-col`, `justify-center`, `break-keep`, `text-balance`, `leading-relaxed`

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- This output is static SVG blueprint only; motion and runtime behavior still require later implementation in real UI code

#### Manual QA
- [x] Opened `file:///C:/Users/Master/Documents/Playground/docs/blueprints/landing_fixed_blueprint.svg` in Agent Browser
- [x] Verified file-origin snapshot content with hero/trust/mic/Z-pattern/reset notes present
- [x] Captured popup proof screenshot at `temp/landing_fixed_blueprint-popup.png`

#### Next Sprint Prerequisites
- Await visual sign-off on `landing_fixed_blueprint.svg` before converting to production React/Next implementation

### Sprint 3A - AudioWorklet + WSS + Server STT Bridge
- Date: 2026-03-13
- Status: completed

#### Goal
Implement constitutional audio path (AudioWorklet PCM over WSS), then bridge transcript + routing ids to Make.com via Next.js API route.

#### Files Created
- `public/audio/pcm-worklet-processor.js`
- `src/app/api/voice/submit/route.ts`
- `scripts/voice-wss-server.mjs`
- `scripts/dev-test-server.mjs`

#### Files Modified
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `src/features/voice-capture/state/voice-capture-reducer.ts`
- `src/features/voice-capture/types/voice-types.ts`
- `tests/playwright.config.ts`
- `.env.local`
- `package.json`
- `package-lock.json`

#### Architecture Changes
- Client now captures microphone PCM frames via AudioWorklet and streams them to WSS in real time.
- Added WS server ingestion + Whisper transcription step.
- Added Next API route `/api/voice/submit` for server-side webhook forwarding.

#### State Machine Changes
- Fixed 8-state model preserved.
- Added reducer events for transcript and routing metadata updates.

#### Submission / Cost Defense Changes
- 15-second stop remains reducer/timer source of truth.
- Submit still uses synchronous lock (`clientRequestId`) before async request.

#### Known Risks
- In local/development mode, webhook and STT include mocked fallback behavior when keys/endpoints are unavailable.
- Production requires valid `OPENAI_API_KEY` and reachable `MAKE_WEBHOOK_URL`.

#### Manual QA
- [x] Step1 start/stop triggers live WSS session commands
- [x] Transcript lands in Step2 preview via server message
- [x] Submit button waits for server ACK and transitions to success
- [x] E2E voice flow passes with WSS test stack

---

### Sprint 3B - HMAC + Circuit Breaker + Failure Queue Hardening
- Date: 2026-03-13
- Status: completed

#### Goal
Add webhook signing, retry/circuit protections, and durable failure queueing without touching voice UI components.

#### Files Created
- `.agents/skills/retry-break-handler-template/SKILL.md`
- `src/server/webhook/WebhookSigner.ts`
- `src/server/reliability/circuitBreaker.ts`
- `src/server/reliability/WebhookClient.ts`
- `src/server/queue/failureQueue.ts`
- `tests/e2e/backend-reliability.spec.ts`

#### Files Modified
- `src/app/api/voice/submit/route.ts`
- `.env.local`
- `.env.local.example`
- `docs/sprint-summary.md`

#### Architecture Changes
- Added server-side HMAC-SHA256 generation for webhook calls (`X-Webhook-Signature` + timestamp header).
- Added retry client with exponential backoff and circuit breaker integration.
- Added file-durable JSONL failure queue with 1s polling worker.
- Refactored `/api/voice/submit` to:
  - try immediate webhook send first
  - enqueue on failure
  - return `acceptedForRetry: true` when queued

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- Submission flow now includes backend reliability fallback (queue) while retaining existing client-side duplicate lock (`clientRequestId`).

#### Known Risks
- Queue durability currently uses local filesystem JSONL; distributed/multi-instance production requires shared durable store (e.g., DB/Redis).
- In local/dev, missing webhook secret/url still returns mocked success path by existing route policy.
- Existing unrelated lint warning remains in `use-voice-capture-machine.ts` (missing hook dependency).

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm exec playwright test tests/e2e/backend-reliability.spec.ts -c tests/playwright.env-core.config.ts`
- [x] `corepack pnpm test:e2e`

#### Next Sprint Prerequisites
- Promote queue storage from local JSONL to centralized persistent store for horizontal scale.
- Add replay protection window validation on receiver side for timestamp/signature.

---

### Sprint 3C - Mobile Feedback Compatibility Hardening
- Date: 2026-03-13
- Status: completed

#### Goal
Guarantee backend-response feedback UI safety on mobile and desktop while preserving the backend reliability stack.

#### Files Created
- `tests/e2e/mobile-feedback-ui.spec.ts`

#### Files Modified
- `.agents/skills/retry-break-handler-template/SKILL.md`
- `scripts/voice-wss-server.mjs`
- `src/app/layout.tsx`
- `src/features/voice-capture/components/voice-capture-screen.tsx`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `tests/e2e/backend-reliability.spec.ts`
- `tests/e2e/voice-capture-flow.spec.ts`
- `tests/playwright.config.ts`
- `docs/sprint-summary.md`

#### Architecture Changes
- WS submit ack now carries `acceptedForRetry` and `reason` from `/api/voice/submit`.
- Client now shows a background-processing toast when queue fallback is used.
- Added bounded/balanced feedback UI classes for alert/notice containers:
  - `max-w-md`
  - `break-keep`
  - `text-balance`

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- Queue fallback metadata is now propagated to UX feedback without weakening duplicate lock behavior.

#### Known Risks
- Mobile full-mic flow remains intentionally scoped to desktop test project; mobile projects validate feedback container safety path.
- Existing unrelated lint warning remains in `use-voice-capture-machine.ts` (`react-hooks/exhaustive-deps`).

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm exec playwright test tests/e2e/backend-reliability.spec.ts -c tests/playwright.env-core.config.ts`
- [x] `corepack pnpm exec playwright test tests/e2e/mobile-feedback-ui.spec.ts -c tests/playwright.config.ts`
- [x] `corepack pnpm test:e2e`

#### Next Sprint Prerequisites
- If required, add a dedicated mobile real-microphone hardware runbook for non-fake-device environments.

### Sprint 3D - Front-End Live Submission Transport
- Date: 2026-03-13
- Status: completed

#### Goal
Remove the placeholder front-end upload path and weld the voice capture UI to the real `POST /api/voice/submit` route without weakening the 15-second cutoff, duplicate lock, or fixed 8-state reducer.

#### Files Created
- None

#### Files Modified
- `src/features/voice-capture/components/voice-capture-screen.tsx`
- `src/features/voice-capture/services/upload-placeholder.ts`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `src/features/voice-capture/state/voice-capture-reducer.ts`
- `src/features/voice-capture/types/voice-types.ts`
- `docs/sprint-summary.md`

#### Architecture Changes
- Replaced the placeholder submit service with a live client-side transport that posts to `/api/voice/submit`
- Kept AudioWorklet + PCM over WSS for capture/transcript generation while moving final submission ownership to the browser
- HTTP submit is now limited to transcript text and lightweight metadata while audio remains on the WSS path

#### State Machine Changes
- Preserved all 8 constitutional states
- Added success metadata fields so queued backend delivery can render as a pending-success outcome without adding new reducer states

#### Audio / Transport Changes
- No MediaRecorder path introduced
- AudioWorklet + PCM over WSS-only architecture preserved
- Final submit no longer waits for a WSS `session.submit` ack; it now calls `/api/voice/submit` directly after transcript readiness

#### Submission / Cost Defense Changes
- `clientRequestId` is still created synchronously before async submission begins
- Added front-end guards for three failure modes:
  - transcript-not-ready race after stop
  - empty PCM payload submission
  - queued backend retry response (`acceptedForRetry: true`) without breaking success UI

#### Known Risks
- Browser/network verification used fake-device microphone input; a physical-device microphone pass is still recommended before production rollout

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`
- [x] Temporary Playwright verification confirmed one real browser `POST /api/voice/submit` request with:
  - `clientRequestId`
  - transcript text
  - `pcmFrameCount`
  - routing/session metadata only

### Sprint 3E - Metadata-Only Submit Correction
- Date: 2026-03-13
- Status: completed

#### Goal
Remove the unconstitutional Base64 PCM HTTP payload and restore strict transport separation: audio over WSS only, text and metadata over `POST /api/voice/submit`.

#### Files Created
- None

#### Files Modified
- `src/features/voice-capture/components/voice-capture-screen.tsx`
- `src/features/voice-capture/services/upload-placeholder.ts`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `docs/sprint-summary.md`

#### Architecture Changes
- Removed client-side PCM chunk buffering for HTTP submission
- Kept WSS as the sole audio path and reduced `/api/voice/submit` to transcript plus lightweight metadata

#### State Machine Changes
- None
- Preserved all 8 constitutional states

#### Audio / Transport Changes
- Audio continues to stream only through AudioWorklet + PCM over WSS
- HTTP submit now carries only:
  - `clientRequestId`
  - `transcriptText`
  - `spreadsheetId`
  - `slackChannelId`
  - `sessionId`
  - `pcmFrameCount`

#### Submission / Cost Defense Changes
- Preserved synchronous `clientRequestId` locking before async submit
- Preserved queue-fallback success/pending UI behavior without sending any audio bytes over HTTP

#### Known Risks
- Browser/network verification still uses fake-device microphone input; one physical-device manual pass remains recommended
- `docs/backend-architecture.md` was referenced in the task brief but is not present in this workspace

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`
- [x] Temporary browser verification confirmed `POST /api/voice/submit` payload keys are exactly:
  - `clientRequestId`
  - `pcmFrameCount`
  - `sessionId`
  - `slackChannelId`
  - `spreadsheetId`
  - `transcriptText`
- [x] Temporary browser verification confirmed `pcmPayloadBase64` is absent

#### Next Sprint Prerequisites
- Run one real hardware microphone pass and visually confirm the same metadata-only payload in DevTools Network

#### Next Sprint Prerequisites
- Run one hardware-backed microphone pass on mobile and desktop browsers against the live stack
- Decide whether PCM payload should remain client-posted JSON or move to a more compact binary submission contract later

### Sprint 3F - Firestore Billing Commit Engine And Stdio MCP Reviewer
- Date: 2026-03-24
- Status: completed

#### Goal
Add a back-end pay-per-output billing route with Firestore reserve/execute/deduct-refund transitions, then add a local stdio JSON-RPC reviewer client that can pull MCP update batches and return allow/deny feedback with line diagnostics.

#### Files Created
- `src/app/api/v1/generate-output/route.ts`
- `src/server/auth/verify-firebase-user.ts`
- `src/server/billing/firestore-billing-store.ts`
- `src/server/billing/generate-output-contract.ts`
- `src/server/billing/pay-per-output-service.ts`
- `src/server/config/server-env.ts`
- `src/server/firebase/admin.ts`
- `src/server/generation/google-ai-studio-generator.ts`
- `src/server/mcp/json-rpc.ts`
- `src/server/mcp/reviewer-agent.ts`
- `src/server/mcp/reviewer-static-analysis.ts`
- `src/server/mcp/stdio-json-rpc-client.ts`
- `scripts/mcp-reviewer-client.ts`
- `scripts/mock-mcp-bridge.ts`
- `tests/e2e/billing-mcp.spec.ts`

#### Files Modified
- `.env.local.example`
- `package.json`
- `package-lock.json`
- `tests/e2e/helpers/next-dev.ts`
- `docs/sprint-summary.md`

#### Architecture Changes
- Added `POST /api/v1/generate-output` as a node-runtime server route for authenticated output generation and wallet settlement
- Added Firebase Admin bootstrap helpers for Auth + Firestore and a Google Secret Manager accessor for pulling the model API key at execution time
- Added a local stdio JSON-RPC client and reviewer loop that polls `updates.pull` and posts `reviews.submit` results back to a bridge server

#### State Machine Changes
- None
- Preserved all 8 constitutional voice states unchanged

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved
- The new MCP reviewer transport uses local stdio only and does not affect production audio transport

#### Submission / Cost Defense Changes
- Added Firestore billing phases:
  - reserve: move credits from `availableCredits` to `pendingCredits`
  - executing: mark the transaction as in-flight before the model call
  - deducted/refunded: commit charge on success or rollback credits on failure/timeout
- Added idempotent `clientRequestId` transaction ownership checks so repeated output calls do not double-charge
- Added response revalidation hints (`wallet:{uid}`, `billing:{uid}`) for cache/SWR refresh wiring

#### Known Risks
- Real cloud validation still requires live Firebase credentials, wallet seed data, and a Secret Manager secret version populated with a valid Google AI Studio key
- The reviewer rules are intentionally narrow and should be expanded if the bridge starts sending broader diff shapes or non-TypeScript assets

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:billing-mcp`
- [x] `corepack pnpm test:e2e`
- [x] `corepack pnpm mcp:reviewer -- --once` with the local mock bridge returned a `deny` review payload and line diagnostic

#### Next Sprint Prerequisites
- Provision Firestore `wallets/{uid}` documents and service credentials, then run one end-to-end authenticated call against `/api/v1/generate-output`
- Decide whether the MCP bridge contract should stay polling-based or move to server-pushed notifications once the cloud side stabilizes

### Sprint 3G - Notion Production Direct Write Skeleton
- Date: 2026-03-31
- Status: completed

#### Goal
Add the first back-end-only Notion production auth callback and direct database write route without touching UI, voice capture reducer flow, or transport guardrails.

#### Files Created
- `src/app/api/notion/oauth/callback/route.ts`
- `src/app/api/v1/pages/route.ts`
- `src/server/notion/direct-write.ts`

#### Files Modified
- `src/server/config/server-env.ts`
- `.env.local.example`
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a production-oriented Notion OAuth callback route that exchanges the authorization code and stores the returned access token in an HttpOnly cookie
- Added a node-runtime `POST /api/v1/pages` route that validates a Strict JSON payload and forwards it to Notion's `POST /v1/pages`
- Added a Strict JSON -> Notion property adapter that maps primitive Oracle payload fields into title, rich_text, number, checkbox, and multi_select page properties

#### State Machine Changes
- None
- Preserved all 8 constitutional voice states unchanged

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Oracle SSCE schema metadata was not present in this workspace, so the first adapter release uses safe Strict JSON inference plus optional property type overrides instead of live schema introspection
- OAuth callback currently persists the Notion access token only in an HttpOnly cookie; long-term production storage/rotation still needs a durable server-side secret path

#### Manual QA
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm build`

#### Next Sprint Prerequisites
- Replace the temporary cookie-only OAuth token handling with durable encrypted persistence in the real back-end data store
- Wire actual Oracle schema metadata so property types can be derived from SSCE definitions instead of inferred heuristics

### Sprint 3H - Notion Production Hardening
- Date: 2026-03-31
- Status: completed

#### Goal
Remove the remaining Notion backend risks by adding durable encrypted OAuth persistence, 429 retry protection, and explicit schema-safe Strict JSON mapping.

#### Files Created
- `src/server/notion/oauth-store.ts`
- `src/server/prisma/client.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260331000000_add_notion_oauth_connection/migration.sql`
- `prisma.config.ts`

#### Files Modified
- `src/app/api/notion/oauth/callback/route.ts`
- `src/app/api/v1/pages/route.ts`
- `src/server/notion/direct-write.ts`
- `.env.local.example`
- `package.json`
- `pnpm-lock.yaml`
- `docs/sprint-summary.md`

#### Architecture Changes
- Replaced the temporary HttpOnly-cookie Notion token flow with Prisma-backed encrypted persistent storage keyed by workspace
- Added Prisma client bootstrap and migration-ready schema for `NotionOAuthConnection`
- Upgraded `/api/v1/pages` to require explicit `schemaMap` bindings so Oracle Strict JSON keys are fully validated before Notion writes
- Added bounded 429 retry handling with exponential backoff in the Notion page writer

#### State Machine Changes
- None
- Preserved all 8 constitutional voice states unchanged

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and synchronous `clientRequestId` lock behavior preserved unchanged

#### Known Risks
- Real production rollout still requires provisioning the database connection and encryption key in the target environment
- The current Notion schema layer is intentionally strict: unsupported Oracle payload shapes are now rejected instead of implicitly coerced

#### Manual QA
- [x] `corepack pnpm exec prisma generate`
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm build`

#### Next Sprint Prerequisites
- Apply the prepared Prisma migration against the production database
- Bind the real Oracle SSCE exporter to the explicit `schemaMap` contract now enforced by `/api/v1/pages`

### Sprint 3I - Notion Destination-Delivered Billing Log Integration
- Date: 2026-03-31
- Status: completed

#### Goal
Integrate destination-aware billing log persistence into the Notion direct-write backend so settlement rows are written only when the final Notion page creation succeeds.

#### Files Created
- `prisma/migrations/20260331110000_add_execution_billing_log/migration.sql`

#### Files Modified
- `prisma/schema.prisma`
- `src/server/notion/direct-write.ts`
- `docs/sprint-summary.md`

#### Architecture Changes
- Added Prisma model `ExecutionBillingLog` for execution settlement storage
- Extended the Notion direct-write contract with required billing context fields for settlement logging
- Successful Notion `POST /v1/pages` responses now trigger an `ExecutionBillingLog` insert with `destination_type = notion` and `destination_delivered = true`

#### State Machine Changes
- None
- Preserved all 8 constitutional voice states unchanged

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- Added destination-aware settlement logging that only records delivered execution rows after final Notion success
- No failed internal path or exhausted 429 retry path can mark `destination_delivered = true`

#### Known Risks
- The direct-write API now requires billing context fields from the caller; upstream services must send them or the request will fail validation
- Notion page creation and billing log insertion are not cross-system transactional, so a database failure after Notion success can still require manual reconciliation

#### Manual QA
- [x] `corepack pnpm exec prisma generate`
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm build`

#### Next Sprint Prerequisites
- Apply the new execution billing migration to every deployed database before enabling the updated Notion direct-write caller in production

### Sprint 3J - Solapi Main Orchestrator And Billing Glue
- Date: 2026-03-31
- Status: completed

#### Goal
Glue the Solapi adapter into the main messaging pipeline so Kakao primary send, 31xx/41xx fallback routing, and `ExecutionBillingLog` settlement all follow a 2PC-safe orchestration boundary.

#### Files Created
- `src/domain/messaging/message-dispatch.service.ts`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a back-end-only `MessageDispatchService` contract that reserves an idempotency record before any external send
- Added a shared commit-transaction interface so dispatch delivery state and `ExecutionBillingLog` insertion can run inside the same DB transaction context
- Added a Prisma-backed `PrismaExecutionBillingLogWriter` for messaging settlement rows keyed by the final Solapi channel in `destination_type`

#### State Machine Changes
- None
- Preserved all 8 constitutional voice states unchanged

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- Primary Kakao payloads now hard-require `disableSms: true` so Solapi internal SMS fallback cannot bypass VOXERA billing control
- 31xx / 41xx failures now route through explicit service-level fallback decisions before any billing commit is attempted
- Billing rows are now fenced behind `markDelivered() === 'transitioned'` so a re-entry into the commit path can skip duplicate `ExecutionBillingLog` inserts when the store enforces CAS semantics
- External-send success now goes straight into the protected commit boundary instead of writing a separate success record first, reducing the resend window before billing settlement

#### Known Risks
- The service currently treats Solapi `addMessages()` success as the billing success signal; if production requires terminal handset/Kakao receipt confirmation, webhook or receipt-based confirmation still needs to replace that assumption
- Exact-once billing still depends on the concrete dispatch store implementation making `reserve()` and `markDelivered()` atomic on the idempotency record
- If the reconcile marker write also fails after an externally successful send, manual recovery is still required before retrying that idempotency key

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] Reviewer subagent re-audited the final service shape and approved it conditionally for provider-accepted delivery semantics plus atomic store CAS enforcement

#### Next Sprint Prerequisites
- Implement the concrete message dispatch store/repository so `reserve()` and `markDelivered()` enforce the CAS contract in the real database
- Decide whether messaging settlement means Solapi acceptance or terminal recipient delivery, then wire webhook/receipt confirmation if true delivery semantics are required

### Sprint 3K - Kakao Retry Queue SQS Hardening
- Date: 2026-03-31
- Status: completed

#### Goal
Remove the audited local filesystem failure queue and replace Kakao retry scheduling with a Standard SQS adapter that enforces zero-retention payloads.

#### Files Created
- `src/server/queue/sqs-queue.service.ts`

#### Files Modified
- `.env.local.example`
- `docs/sprint-summary.md`
- `package.json`
- `pnpm-lock.yaml`
- `src/app/api/voice/submit/route.ts`
- `src/domain/messaging/message-dispatch.service.ts`
- `src/server/config/server-env.ts`
- `tests/e2e/backend-reliability.spec.ts`

#### Files Deleted
- `src/server/queue/failureQueue.ts`
- `.runtime/failure-queue.jsonl`

#### Architecture Changes
- Added a reusable `SqsQueueService` backed by AWS SDK v3 `SQSClient` + `SendMessageCommand` for Standard SQS enqueue operations
- Bound `MessageDispatchService` retry scheduling to SQS so retryable Kakao transport failures now emit queue jobs instead of relying on local-disk persistence
- Removed local JSONL retry persistence from `/api/voice/submit`; failed webhook sends no longer write transcript-bearing payloads to disk

#### State Machine Changes
- None
- Preserved all 8 constitutional voice states unchanged

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- Kakao retry jobs are now zero-retention by construction: only `sessionId`, idempotency identifiers, dispatch identifiers, and routing/provider failure metadata are queued
- Queue job construction explicitly excludes primary message text, fallback LMS/SMS body text, arbitrary caller metadata, and any `transcriptText` field
- Local/development `/api/voice/submit` fallback still returns a mocked success path, but production no longer stores transcript-bearing retries on the filesystem

#### Known Risks
- This sprint adds the SQS producer side only; the deployed worker that drains `KAKAO_RETRY_SQS_QUEUE_URL` must consume the queued `message-dispatch-retry` jobs for end-to-end retry execution
- Exact-once billing still depends on the concrete dispatch store implementation making `reserve()` and `markDelivered()` atomic on the idempotency record

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm exec playwright test tests/e2e/backend-reliability.spec.ts -c tests/playwright.env-core.config.ts`
- [x] Verified the retry queue payload excludes message body text and `transcriptText`

#### Next Sprint Prerequisites
- Wire the production Kakao retry worker/consumer to `KAKAO_RETRY_SQS_QUEUE_URL`
- Provision AWS credentials, `AWS_REGION`, and the target Standard SQS queue URL in the server runtime

### Sprint 3L - Claude 90/10 Storage And Queue Foundation
- Date: 2026-03-31
- Status: completed with one unrelated env-core regression still present in the existing suite

#### Goal
Implement the first Claude 90/10 back-end lane: file/S3-backed skill storage, a TTL 30-minute LRU `SkillManager`, Gemini strict-JSON routing for `skillId` + `contentChanges`, and a BullMQ queue that returns `202 Accepted` plus `jobId` immediately.

#### Files Created
- `src/server/skills/skill-manager.ts`
- `src/server/routing/gemini-router.ts`
- `src/server/queue/claude-job-queue.ts`
- `src/app/api/v1/commands/route.ts`
- `src/app/api/v1/jobs/[jobId]/route.ts`

#### Files Modified
- `.env.local.example`
- `package.json`
- `pnpm-lock.yaml`
- `src/server/config/server-env.ts`
- `docs/sprint-summary.md`

#### Architecture Changes
- Added an `ObjectStorage` abstraction with local filesystem and S3 adapters so Claude 90/10 skill assets and job artifacts can stay file-backed without introducing a DB
- Added a `SkillManager` that reads manifest-driven skill metadata, validates SHA-256 integrity, and caches resolved skill files in-process with LRU eviction and a fixed 30-minute TTL
- Added a Gemini router that constrains `skillId` to the tenant's allowed skill catalog and runtime-validates the returned JSON shape before the queue worker accepts it
- Added a BullMQ command queue that persists `00-request.json`, `10-gemini-output.json`, `20-skill-snapshot.md`, and `status.json` under `/tenants/{tenantId}/jobs/{jobId}/`
- Added `/api/v1/commands` and `/api/v1/jobs/[jobId]` so the HTTP layer now returns `202` immediately and exposes job status polling

#### State Machine Changes
- None
- Preserved all 8 constitutional voice states unchanged

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None in the voice capture lane
- Existing 15-second cutoff and synchronous `clientRequestId` lock behavior remain unchanged

#### Known Risks
- The queue foundation currently resolves routing and skill snapshot artifacts only; Claude rendering and destination sinks still need the next pipeline stage to complete the full 90/10 execution path
- The worker is auto-started from the API route for local convenience, but production should still run a dedicated worker process for stronger isolation
- `corepack pnpm test` still has one failing pre-existing loopback env-core Playwright case unrelated to the new Claude 90/10 modules

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [ ] `corepack pnpm test` currently fails on `tests/e2e/env-core.spec.ts` "accepts local loopback ws/http exceptions"
- [x] `corepack pnpm test:e2e`
- [x] Git worktree QA review approved BullMQ idempotency/artifact reuse and Gemini Zod runtime validation after the replay-conflict guard was added
- [ ] Manual API check: `POST /api/v1/commands` with a real `tenantId`, `utterance`, Redis, and Gemini key should return `202` with `jobId` and create the job artifact folder
- [ ] Manual API check: `GET /api/v1/jobs/{jobId}` should advance from `waiting/active` to `completed` and surface the routed `skillId`

#### Next Sprint Prerequisites
- Add the Claude renderer and destination sink stage on top of the new BullMQ worker so `30-claude-request.json`, `40-rendered-output.md`, and `50-destination-result.json` are produced
- Move the Claude 90/10 worker into an explicit standalone process entrypoint before production rollout
