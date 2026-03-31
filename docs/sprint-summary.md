```md
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
- Current UI shell status: premium 3-step voice capture flow implemented and Playwright-verified with Step 1 neon trace waveform restored

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
- Status: live browser runtime implemented and Playwright-verified against a local WSS harness
- Audio input approach: explicit `getUserMedia` -> `AudioWorklet` -> PCM16 frames
- Audio transport approach: env-driven websocket control events plus raw PCM frames over WS/WSS, with `session.start.language` propagated to the backend STT router
- Audio cleanup strategy: tracks, worklet graph, and audio context are torn down on stop/reset/unmount
- Secure context requirement: mandatory and runtime-enforced

### Transport
- Status: live browser-to-WSS runtime flow implemented, with Whisper-default STT routing plus conditional Return Zero overrides on the WSS server
- WSS endpoint strategy: `NEXT_PUBLIC_WSS_URL` is startup-validated and only allows `ws://` or `wss://`, with `wss://` enforced outside local
- STT routing strategy: OpenAI Whisper is the default provider for all sessions, while Return Zero is used only for Korean sessions that opt into premium accuracy or high-risk workflows such as `sales_call` and `medical_note`
- Webhook adapter strategy: `/api/voice/submit` safeParses the inbound request and outbound Make.com payload before `WebhookClient` send/queue handling
- Env validation status: public and Next server envs fail fast at startup, while the standalone WSS server loads `.env.local`, keeps Whisper available as the safe default, and warns when Return Zero premium overrides cannot be honored
- Automated routing QA status: a dedicated Playwright stack now boots Next dev plus the standalone WSS server, injects a synthetic microphone with fake media flags, and proves Whisper default versus Return Zero premium routing through captured webhook payloads

### Submission / Cost Defense
- Status: live `/api/voice/submit` fetch flow active and placeholder upload path removed
- 15-second cutoff status: reducer timer remains the source of truth and auto-stops at the hard limit
- `clientRequestId` lock status: generated synchronously before async submit begins
- Duplicate prevention strategy: reducer upload lock gates browser submit attempts and backend idempotency continues through `X-Idempotency-Key`
- Cost telemetry status: `stt_provider` and `audio_duration_sec` now flow from the WSS transcript result into `/api/voice/submit` and the downstream webhook payload
- Destination metadata status: optional `spreadsheetId`, `slackChannelId`, `notionDatabaseId`, and `notionParentPageId` can now flow from browser query params through `/api/voice/submit` into the downstream webhook payload without touching reducer truth

### SSCE Personalization Engine
- Status: Prisma-backed local persistence, HTTP route wrappers, and Oracle-style semantic feedback extraction implemented in an isolated worktree
- Core entities: `artifacts`, `style_signatures`, `style_events`, `reference_edges`
- Validation strategy: all SSCE request/response payloads are parsed through shared Zod schemas in `packages/adapter/src/validators/ssce-zod.ts`
- Storage strategy: `apps/api/src/routes/ssce-router.ts` now uses Prisma transactions against the physical SSCE tables instead of in-memory arrays
- HTTP exposure: `apps/api/src/app/api/v1/ssce/*/route.ts` owns request parsing and response mapping, while `src/app/api/v1/ssce/*/route.ts` bridges those handlers into the active Next.js app
- Feedback learning strategy: `apps/api/src/services/semantic-diff-oracle.ts` now computes lexical changes, structure changes, and tone deltas before it updates the four SSCE scope signatures
- Local migration strategy: Prisma client generation is standard, while local schema application currently uses `apps/api/src/db/run-ssce-migrations.ts` over checked-in SQL migrations because Prisma's schema engine failed in this Windows environment

### Mobile UX
- Status: premium 3-step capture flow complete with restored Step 1 neon trace waveform
- One-handed usage support: yes
- Safe-area support: baseline implemented
- Accessibility status: touch targets, labels, and Playwright test ids applied
- Error messaging status: inline Step 2 retry/cancel feedback available and transcript view now shows live runtime text only

---

## Sprint Log

---

### Sprint 16 ??Google Workspace Modal Dashboard Pivot
- Date: 2026-03-21
- Status: completed

#### Goal
Replace the failed sheet-cell dashboard imitation with a production-style Apps Script HTML modal dashboard for the Korean-first Google Workspace execution workspace.

---

### Sprint 17 ??Notion MCP Live Workspace Setup
- Date: 2026-03-22
- Status: completed with known MCP view limitation

#### Goal
Create live Notion workspace assets for Voxera using MCP instead of local mock planning only.

#### Changed Assets
- Created live databases in Notion workspace:
  - `🎙️ VOXERA 음성 수신함`
  - `📌 실행 보드`
  - `⚙️ Agent Prompt DB`
  - `📊 에이전트 실행 로그`
- Created live pages in Notion workspace:
  - `🗄️ VOXERA Backend DB`
  - `🚀 VOXERA MAIN 대시보드`
- Added `상태 보드` board view to `📌 실행 보드`
- Seeded `⚙️ Agent Prompt DB` with three agent entries and common execution-log guidance

#### Architecture Notes
- Raw databases were moved under `🗄️ VOXERA Backend DB` so the main user surface is no longer the raw table root.
- The main dashboard page was created as a workspace-level landing page with quick links and execution-flow sections.
- MCP `create-pages` validation still blocked direct insertion of linked database blocks via `data-source-url`, so the dashboard currently uses mentions/links plus the separately created board view rather than a fully embedded linked DB block.

#### Known Risks
- `🚀 VOXERA MAIN 대시보드` is production-usable as a navigation landing page, but not yet the final ideal embedded linked-database dashboard.
- `🎙️ VOXERA 음성 수신함` status property defaults to Notion native status values (`시작 전/진행 중/완료`) rather than the originally requested `NEW/DONE`.
- If a stricter embedded dashboard is required, a follow-up pass should test alternate MCP block insertion patterns or finish the last mile manually inside Notion UI.

#### Manual QA
- Open the created dashboard page and confirm the quick links resolve to all four workspace databases.
- Open `📌 실행 보드` and confirm `상태 보드` view exists and groups by `상태`.
- Open `⚙️ Agent Prompt DB` and confirm the three seeded prompt rows include the execution-log sentence.

#### Next Prerequisites
- Decide whether the current dashboard landing page is acceptable or whether a manual final polish pass in Notion UI is required.
- If needed, normalize status vocabulary for Voice Inbox and seed sample rows for demo/testing.

---

### Sprint 18 ??Master Asset Injection for Notion & Google Workspace
- Date: 2026-03-23
- Status: completed with known Google Sheets macro-binding limitation

#### Goal
Inject the supplied master brand assets into the live Notion workspace and prepare the Google Sheets control-room builder to render the same assets inside the dashboard canvas.

#### Changed Assets
- Updated live Notion assets:
  - `🚀 VOXERA MAIN 대시보드` icon -> `5.png`
  - `🚀 VOXERA MAIN 대시보드` cover -> `1.png`
  - `🎙️ VOXERA 음성 수신함` icon -> `4.png`
  - `⚙️ Agent Prompt DB` icon -> `3.png`
- Updated local script:
  - `integrations/google-workspace/dashboard-builder.gs`

#### Architecture Notes
- Local master assets were uploaded to temporary public URLs so Notion could consume them as external cover/icon resources.
- `dashboard-builder.gs` now uses those asset URLs and `sheet.insertImage(blob, ...)` to render over-grid images on the control-room canvas while preserving `#f8fafc` background and hidden gridlines.
- Existing drawing rebinding logic remains in place for users who manually replace the over-grid images with Drawings and want true Apps Script macro binding.

#### Known Risks
- Google Sheets Apps Script still does not expose a supported API to create brand-new Drawing buttons with assigned scripts entirely from code. Over-grid images can be rendered automatically, but fully clickable macro assignment still requires manual Drawing insertion or later UI interaction.
- The temporary external URLs used for Notion asset injection should be treated as replaceable delivery URLs, not permanent CDN infrastructure.

#### Manual QA
- Open `🚀 VOXERA MAIN 대시보드` in Notion and confirm icon/cover changed to the supplied assets.
- Open `🎙️ VOXERA 음성 수신함` and `⚙️ Agent Prompt DB` and confirm their icons changed.
- Paste `integrations/google-workspace/dashboard-builder.gs` into Apps Script and run `buildVoxeraMainDashboard()`.
- Confirm the main sheet keeps gridlines hidden, background `#f8fafc`, and renders the icon assets over the action zones.

---

### Sprint 19 ??GitHub Raw Asset Delivery Rule
- Date: 2026-03-23
- Status: completed

#### Goal
Replace temporary image hosting with a durable GitHub Raw CDN pipeline for Notion and Google Workspace asset injection.

#### Changed Files
- `assets/voxera/1.png`
- `assets/voxera/2.png`
- `assets/voxera/3.png`
- `assets/voxera/4.png`
- `assets/voxera/5.png`
- `integrations/google-workspace/dashboard-builder.gs`
- `docs/UI_CONSTITUTION.md`

#### Architecture Notes
- All UI assets are now expected to live in-repo and be referenced via `raw.githubusercontent.com`.
- `dashboard-builder.gs` now points to GitHub Raw URLs rather than temporary third-party hosting.
- Temporary hosts are considered invalid for future Notion or Google Workspace rendering work.

#### Known Risks
- Raw asset URLs depend on the pushed branch existing remotely.
- If `main` is unavailable on the remote, the asset delivery branch must be created before Notion/GAS can consume the URLs.

#### Files Created
- `integrations/google-workspace/Dashboard.html`

#### Files Modified
- `integrations/google-workspace/Code.simple.ko.gs`
- `docs/google-workspace-install-step-by-step.md`
- `docs/sprint-summary.md`

#### Architecture Changes
- Google Workspace dashboard rendering moved from sheet-cell styling to `showModalDialog()` + `Dashboard.html`
- `Code.simple.ko.gs` now acts as a modal dashboard backend:
  - menu registration
  - data shaping
  - sheet navigation actions
  - webhook ingest
  - inbox-to-execution conversion
- first-visit UX now auto-opens the modal dashboard once per user per spreadsheet via `UserProperties`, then falls back to manual open from the `VOXERA` menu
- `Dashboard.html` now owns the visual UI and loads live data with `google.script.run`
- Spreadsheet is now treated as data/work surface only:
  - `받은 음성함`
  - `실행 보드`
  - `설정`

#### State Machine Changes
- None

#### Audio / Transport Changes
- None
- Constitutional rules preserved:
  - AudioWorklet + PCM over WSS only
  - exact 15-second cutoff remains reducer truth
  - `clientRequestId` duplicate lock remains intact
  - 8-state reducer unchanged

#### Submission / Cost Defense Changes
- None in app runtime
- Google Workspace webhook ingestion remains protected by bearer secret validation

#### Known Risks
- Apps Script modal depends on `Dashboard` HTML file existing with the exact file name in the Apps Script project
- If the spreadsheet is not refreshed after saving, the `VOXERA` menu may still reference stale code
- Existing repository baseline test failures remain unrelated to this sprint:
  - insecure `ws://` fail-fast expectation mismatch
  - non-http(s) `MAKE_WEBHOOK_URL` fail-fast expectation mismatch

#### Manual QA
- [ ] Replace Apps Script `Code.gs` with `integrations/google-workspace/Code.simple.ko.gs`
- [ ] Add HTML file named `Dashboard` and paste `integrations/google-workspace/Dashboard.html`
- [ ] Run `setupSystem()`
- [ ] Refresh the spreadsheet
- [ ] Open `VOXERA > 대시보드 열기`
- [ ] Add one inbox row with `상태=실행전환`
- [ ] Confirm `실행 보드` row creation and `문서 열기` / `일정 보기` buttons

#### Next Sprint Prerequisites
- Capture a real Apps Script modal screenshot after user applies both files
- Build the equivalent Notion visual blueprint and implementation pass

---

### Sprint 19 ??Failure Analysis + Dev Lead Handoff Report
- Date: 2026-03-22
- Status: completed

#### Goal
Document the exact failure reasons from the Notion visual dashboard attempts and the Google Workspace sheet-cell dashboard attempts, then hand off the current accepted architecture and Make.com integration path in a single developer-facing report.

#### Files Created
- `docs/2026-03-22-notion-google-workspace-failure-analysis-and-handoff.md`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- No runtime architecture changed in this sprint
- The accepted architecture was clarified and frozen in writing:
  - Notion path: `Internal DB-first + Queue + Async Worker + Notion direct-write`
  - Google Workspace path: `Sheets = main work surface`, `Docs/Calendar/Mail = conditional assets`, `Apps Script HTML Modal Dashboard = user UI`

#### State Machine Changes
- None

#### Audio / Transport Changes
- None
- Constitutional rules preserved:
  - AudioWorklet + PCM over WSS only
  - exact 15-second cutoff remains reducer truth
  - `clientRequestId` duplicate lock remains intact
  - 8-state reducer unchanged

#### Submission / Cost Defense Changes
- None in runtime
- The report explicitly preserves backend idempotency and direct-write decisions

#### Known Risks
- The handoff report reflects the actual current state, which means:
  - Notion visual implementation is still not final
  - Google Workspace production auto-copy/auto-connect flow is still not fully verified
- Existing repository baseline test failures remain unrelated:
  - insecure `ws://` fail-fast expectation mismatch
  - non-http(s) `MAKE_WEBHOOK_URL` fail-fast expectation mismatch

#### Manual QA
- [ ] Open the handoff report and verify the following are clear to the dev lead:
  - Why Notion direct-write replaced the Make.com path
  - Why the SVG-to-Google-Sheets dashboard approach failed
  - Why Sheets is the main dashboard and Docs / Calendar / Mail are conditional assets
  - How Make.com should connect to the Google Workspace stack
- [ ] Confirm KakaoTalk is explicitly deferred, not forgotten

#### Next Sprint Prerequisites
- Apply and test the Notion direct-write path end-to-end
- Validate Google template duplication and binding strategy for lower-friction production onboarding

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

---

### Sprint 2026-03-21 ??Google Workspace Visual Blueprint Refinement
- Date: 2026-03-21
- Status: in progress

#### Goal
Refine the Google Workspace visual-first blueprint until the SVG renders clean Korean text and stable alignment before any further Apps Script layout work.

#### Files Modified
- `docs/google-workspace-simple-blueprint.svg`
- `integrations/google-workspace/Code.simple.ko.gs`
- `integrations/google-workspace/Dashboard.html`
- `docs/sprint-summary.md`

#### Architecture Changes
- No product runtime architecture change
- Visual-first process reinforced: SVG approval before spreadsheet rendering implementation
- Google Workspace simple KR script now renders the approved dashboard-first visual language into the actual `대시보드` sheet and preserves simplified execution/inbox surfaces
- Apps Script now also supports a true HTML dashboard layer via sidebar/modal, so the spreadsheet can stay the data layer while the user sees a cleaner dashboard UI

#### State Machine Changes
- None

#### Audio / Transport Changes
- None

#### Submission / Cost Defense Changes
- None

#### Known Risks
- Notion visual blueprint is still not finalized
- Google Workspace Apps Script layout still needs implementation after SVG approval

#### Manual QA
- [x] SVG XML parse validated
- [x] Edge headless PNG render generated from SVG
- [x] Korean text rendering validated in PNG output
- [x] Hero, inbox cards, transition capsule, and KPI card alignment manually checked in raster render
- [x] `Code.simple.ko.gs` syntax checked via `new Function(...)`

#### Next Sprint Prerequisites
- Get approval on `docs/google-workspace-simple-blueprint.svg`
- Mirror approved layout into `integrations/google-workspace/Code.simple.ko.gs`
- Produce Notion visual blueprint with the same dashboard-first pattern

---

### Sprint 13 ??Google Workspace Production Package
- Date: 2026-03-21
- Status: completed

#### Goal
Turn the Google Workspace automation research into an operations-ready package that cleanly separates Sheets, Docs, and Calendar responsibilities.

#### Files Created
- `docs/google-workspace-production-runbook.md`
- `integrations/google-workspace/Code.gs`
- `docs/channel-delivery-architecture.md`
- `docs/notion-direct-write-api-spec.md`
- `docs/google-workspace-install-step-by-step.md`
- `integrations/google-workspace/Code.simple.ko.gs`
- `docs/google-workspace-simple-ko.md`
- `docs/google-workspace-simple-visual-spec.md`
- `docs/google-workspace-simple-blueprint.svg`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a production-oriented Google Workspace runbook for VOXERA execution workflows.
- Defined `Google Sheets = control plane`, `Google Docs = conditional detailed asset`, `Google Calendar = conditional schedule asset`.
- Added a hardened Apps Script package with installable onEdit trigger guidance, webhook secret validation, lock-based dedupe, conditional Docs/Calendar creation, Gmail notification support, archive support, and dashboard feed rebuild logic.
- Added a channel delivery architecture doc defining `Notion direct write`, `Google Mail via MailApp`, and `KakaoTalk via 알림톡/채널` as the preferred production paths.
- Added an endpoint-level Notion direct-write backend spec.
- Added a step-by-step Google Workspace installation guide for non-technical operators.
- Added a Korean-first, simplified Google Workspace package for non-technical users with only three visible sheets and Korean labels.
- Upgraded the simplified Google Workspace package into a dashboard-first variant with clickable Doc/Calendar chips, visible Korean labels, conditional formatting, and a dedicated summary dashboard sheet.
- Added visual-first blueprint artifacts (Mermaid spec + SVG blueprint) so future Workspace changes can be reviewed visually before code changes.
- Refined the visual blueprint into a launch-quality dashboard composition with a Korean hero title, aligned KPI cards, stronger `받은 음성함` / `실행 보드` emphasis, and a more polished `실행전환` transition treatment.

#### State Machine Changes
- None

#### Audio / Transport Changes
- None
- Core front-end hard rules remain unchanged:
  - AudioWorklet + PCM over WSS only
  - exact 15-second cutoff
  - `clientRequestId` duplicate lock
  - fixed 8-state reducer

#### Submission / Cost Defense Changes
- No browser/runtime submission changes
- Google Workspace package now documents a separate Apps Script webhook secret and source-level idempotency for Workspace-side ingestion

#### Known Risks
- Apps Script Web App request headers can vary by deployment shape; bearer secret handling should be validated against the real deployment endpoint.
- Drive root-folder removal behavior can differ for shared-drive setups and may require environment-specific adjustment.
- Calendar event deep links can vary by account/calendar type and should be smoke-tested in the owner workspace.

#### Manual QA
- [x] Review runbook for role separation between Sheets, Docs, and Calendar
- [x] Review Apps Script code for secret validation and lock usage
- [x] Confirm Dashboard Feed uses rebuild strategy rather than append-only writes

#### Next Sprint Prerequisites
- Paste `integrations/google-workspace/Code.gs` into Apps Script and run `setupSystem`
- Fill `Config` sheet values in a real Google Workspace
- Deploy Apps Script Web App and validate `doPost`
- Wire Make.com or backend payload sender to the Web App endpoint
- [x] State machine base behavior manually reviewed
- [x] Secure env strategy present
- [x] No Sprint 1 defects found in manual QA

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

#### Next Sprint Prerequisites
- wire real AudioWorklet session lifecycle into the reducer
- connect WSS / webhook transport to live upload and transcript data
- regression-test live 15-second stop and duplicate-lock behavior against backend

---

### Sprint 5 - Step 1 Neon Waveform Recovery
- Date: 2026-03-11
- Status: completed

#### Goal
Restore the lost Step 1 waveform styling without touching the Step 2 / Step 3 centered transcript layout or any reducer-driven voice logic.

#### Files Created
- None

#### Files Modified
- `docs/sprint-summary.md`
- `src/features/voice-capture/components/voice-capture-screen.tsx`

#### Architecture Changes
- Replaced the old bottom-anchored bar waveform with a center-baseline neon blue vertical trace waveform in Step 1 only
- Removed the Step 1 mic-area English helper copy while keeping Step 2 / Step 3 layout structure intact

#### State Machine Changes
- None
- Preserved all 8 constitutional states without restructuring

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- None
- Exact 15-second cutoff and `clientRequestId` duplicate lock remain untouched

#### Known Risks
- Visual waveform pacing is tuned for the current premium shell and may need a design pass after real AudioWorklet data is wired in

#### Manual QA
- [x] `npm run lint`
- [x] `npm run build`

#### Next Sprint Prerequisites
- Verify the restored Step 1 waveform against live audio transport once AudioWorklet + WSS runtime lands

---

### Sprint 6 - Make.com Webhook Contract Extraction
- Date: 2026-03-13
- Status: completed

#### Goal
Extract the exact webhook payload/header/signature contract from the implemented `POST /api/voice/submit` route and publish an integration guide for Make.com verification and GPT handoff.

#### Files Created
- `references/make-webhook-contract.md`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- No runtime architecture change
- Added explicit integration reference for Make.com receiver contract and signature verification flow

#### State Machine Changes
- None
- Preserved all 8 constitutional states without restructuring

#### Audio / Transport Changes
- No audio pipeline change
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- No reducer/upload lock implementation change
- Documented webhook-side idempotency handling using `X-Idempotency-Key` for downstream duplicate prevention

#### Known Risks
- Make.com module/runtime differences may require minor mapping adjustments for raw body extraction and JS code module inputs
- End-to-end validation with real Make scenario remains pending

#### Manual QA
- [x] Contract values cross-checked against:
  - `src/app/api/voice/submit/route.ts`
  - `src/server/reliability/WebhookClient.ts`
  - `src/server/webhook/WebhookSigner.ts`

#### Next Sprint Prerequisites
- Run live Make.com scenario test with production-like secret and replay-window policy
- Add receiver-side duplicate handling to Make Data Store or equivalent

---

### Sprint 7 - Make.com Mock Reliability Verification
- Date: 2026-03-13
- Status: completed

#### Goal
Replace manual Make.com validation risk with automated mock-receiver verification for HMAC signature handling, retry/backoff, circuit breaker behavior, duplicate blocking, and failure queue recovery.

#### Files Created
- `tests/e2e/helpers/make-webhook-mock-server.ts`

#### Files Modified
- `docs/sprint-summary.md`
- `package.json`
- `tests/e2e/backend-reliability.spec.ts`
- `tests/e2e/voice-capture-flow.spec.ts`

#### Architecture Changes
- Added a reusable Make.com mock receiver that validates `X-Webhook-Signature` against the raw JSON body and can emit `200`, `500`, or timeout behavior per request
- Promoted backend reliability verification into the default `pnpm test` path so webhook contract regressions fail CI-level local verification immediately

#### State Machine Changes
- None
- Preserved all 8 constitutional states without restructuring

#### Audio / Transport Changes
- No audio pipeline change
- AudioWorklet + PCM over WSS-only architecture preserved
- Webhook sender contract is now exercised against a real HTTP mock instead of transport stubs

#### Submission / Cost Defense Changes
- No reducer or upload-lock runtime behavior changed
- Added automated proof that duplicate webhook sends are blocked by idempotency key before a second outbound request is made
- Added automated proof that failure queue items persist, back off, and flush after receiver recovery

#### Known Risks
- Real Make.com module wiring can still differ from the mock in raw-body access or scenario configuration despite matching the documented contract
- Front-end live upload flow is still backed by placeholder transport, so browser-to-backend submission remains separately pending

#### Manual QA
- [x] `corepack pnpm install`
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`

#### Next Sprint Prerequisites
- Run one staging smoke test against a real Make.com scenario using the documented raw-body and HMAC mapping
- Replace placeholder upload transport with live backend submission while preserving the reducer-owned 15-second cutoff and duplicate lock

---

### Sprint 8 - Live WSS Runtime and Zod Contract Hardening
- Date: 2026-03-13
- Status: completed

#### Goal
Replace the placeholder browser submission path with a real AudioWorklet + PCM over WSS runtime, harden env startup validation, and unify `/api/voice/submit` plus Make.com payload handling behind shared Zod contracts.

#### Files Created
- `public/audio/voxera-pcm16-capture.worklet.js`
- `src/features/voice-capture/services/realtime-voice-session.ts`
- `src/features/voice-capture/services/submit-voice-capture.ts`
- `src/shared/contracts/common.ts`
- `src/shared/contracts/voice-submit.ts`
- `tests/e2e/helpers/live-voice-runtime.ts`
- `tests/e2e/helpers/synthetic-microphone.ts`
- `tests/e2e/voice-runtime-live.spec.ts`

#### Files Modified
- `docs/sprint-summary.md`
- `next.config.ts`
- `package.json`
- `src/app/api/voice/submit/route.ts`
- `src/features/voice-capture/components/voice-capture-screen.tsx`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `src/features/voice-capture/state/voice-capture-reducer.ts`
- `src/features/voice-capture/types/voice-types.ts`
- `src/shared/config/env-core.ts`
- `src/shared/config/env.client.ts`
- `src/shared/config/env.ts`
- `src/shared/contracts/voice.ts`
- `tests/e2e/env-core.spec.ts`
- `tests/e2e/voice-capture-flow.spec.ts`
- `tests/playwright.config.ts`
- `src/features/voice-capture/services/upload-placeholder.ts` (removed)

#### Architecture Changes
- Added shared Zod contracts for submit request/response, Make.com payloads, websocket control events, websocket transcript events, and standard error issue formatting
- Split env parsing into public/server fail-fast paths so invalid `NEXT_PUBLIC_WSS_URL`, `MAKE_WEBHOOK_URL`, or missing webhook secret stop startup immediately
- Replaced the browser placeholder path with a real `AudioWorklet` capture service that opens the configured websocket, streams PCM16 frames, receives transcript events, and posts the final transcript through `/api/voice/submit`

#### State Machine Changes
- Preserved all 8 constitutional states without renaming or merging
- Added reducer-managed runtime metadata (`connection`, `sessionId`, `pcmFrameCount`, `transcriptFinalized`) without bypassing the reducer with UI-only flags
- Kept reducer-driven 15-second stop truth while runtime shutdown remains an externalized side effect

#### Audio / Transport Changes
- Added the production code path for `AudioWorklet` capture and PCM16 websocket streaming
- Added validated `session.start` / `session.stop` control events and validated `session.ready` / transcript server events
- Added a live Playwright harness that accepts websocket audio and webhook submit traffic end-to-end

#### Submission / Cost Defense Changes
- Removed the fake upload delay placeholder service
- `/api/voice/submit` now rejects invalid JSON/request bodies with Zod issue details and validates the outbound Make.com payload before send/queue
- `clientRequestId` is still created synchronously before async submit and the webhook idempotency key remains intact

#### Known Risks
- The production/staging WSS backend must implement the same JSON control and transcript event schema as the local harness
- The current stop flow waits up to 1.5 seconds for a final transcript event; slower runtimes may need an explicit backend ack or longer drain policy
- A dedicated 15-second full-duration soak test against the real backend is still pending

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`
- [x] Verified a live browser session connects to the local WSS harness, streams PCM frames, receives `transcript.final`, and submits the Make.com payload through `/api/voice/submit`

#### Next Sprint Prerequisites
- Run a staging smoke test against the real WSS backend and confirm transcript finalization latency
- Add a dedicated live duplicate-submit regression around repeated Step 2 send taps
- Add a 15-second full-duration soak that proves no capture leaks past the reducer cutoff

---

### Sprint 9 - Dual STT Routing Fortress
- Date: 2026-03-13
- Status: completed

#### Goal
Route live WSS PCM sessions to Return Zero for Korean traffic and OpenAI Whisper for other languages, while hardening the WSS server with Return Zero Zod contracts, startup fail-fast rules, and timeout-driven circuit breaking.

#### Files Created
- `.env.local`
- `scripts/lib/dual-stt-router.mjs`
- `tests/e2e/dual-stt-router.spec.ts`

#### Files Modified
- `.env.local.example`
- `docs/sprint-summary.md`
- `package.json`
- `scripts/voice-wss-server.mjs`
- `src/features/voice-capture/services/realtime-voice-session.ts`
- `src/shared/contracts/voice.ts`

#### Architecture Changes
- Added a standalone dual STT router module for the WSS server that prefers Return Zero for `ko-KR`/`ko-*` traffic and falls back to Whisper on provider failure
- Added Zod validation for Return Zero JWT auth responses, job submission responses, and transcription result payloads, plus normalized router error formatting
- Added `.env.local` loading in the WSS server so local Return Zero credentials are available without extra boot flags

#### State Machine Changes
- None
- Preserved all 8 constitutional states without renaming or restructuring

#### Audio / Transport Changes
- `session.start` now carries a validated `language` field from the browser runtime to the WSS backend
- The standalone WSS server now emits `session.ready` with `acceptedAt` plus schema-aligned `transcript.final` and `session.error` events
- Return Zero timeouts now feed a dedicated circuit breaker so repeated upstream failures fall back to Whisper instead of hammering the Korean STT provider

#### Submission / Cost Defense Changes
- No reducer or submission-lock behavior changed
- Exact 15-second cutoff and synchronous `clientRequestId` locking remain reducer-owned and untouched

#### Known Risks
- Return Zero staging behavior still needs one live smoke run to tune polling cadence and confirm no 429 pressure under real latency
- The production WSS server must keep honoring the `session.start.language` contract or Korean traffic will drop to Whisper fallback
- Dedicated live duplicate-submit and 15-second full-duration soak coverage are still pending against the real backend

#### Manual QA
- [x] `corepack pnpm install`
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`
- [x] `node --check scripts/lib/dual-stt-router.mjs`
- [x] `node --check scripts/voice-wss-server.mjs`

#### Next Sprint Prerequisites
- Run one staging smoke test against the real Return Zero credentials and confirm Korean transcripts complete without repeated fallback
- Add a live regression that hits the standalone WSS server directly instead of only the local harness
- Add the pending 15-second soak and repeated-send duplicate regression in the live runtime path

---

### Sprint 10 - Whisper Default Cost Rollback
- Date: 2026-03-13
- Status: completed

#### Goal
Rollback the always-Korean Return Zero policy to a Whisper-default router, keep Return Zero as an opt-in premium override, and add provider/duration cost metrics without disturbing the reducer-owned runtime rules.

#### Files Created
- None

#### Files Modified
- `docs/sprint-summary.md`
- `scripts/lib/dual-stt-router.mjs`
- `scripts/voice-wss-server.mjs`
- `src/app/api/voice/submit/route.ts`
- `src/features/voice-capture/services/realtime-voice-session.ts`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `src/shared/contracts/voice.ts`
- `src/shared/contracts/voice-submit.ts`
- `tests/e2e/dual-stt-router.spec.ts`
- `tests/e2e/helpers/live-voice-runtime.ts`
- `tests/e2e/voice-runtime-live.spec.ts`

#### Architecture Changes
- Inserted a provider-interface layer plus a single router decision point in the standalone STT module so Whisper remains the default and Return Zero is only selected for Korean premium/high-risk overrides
- Added WSS routing hints (`premium_ko_accuracy`, `workflow`) and downstream cost telemetry (`stt_provider`, `audio_duration_sec`) across transcript events and `/api/voice/submit`
- Added Whisper retry-once behavior before fail-fast, while Return Zero override failures now fall back safely to Whisper

#### State Machine Changes
- None
- Preserved all 8 constitutional states without renaming or restructuring

#### Audio / Transport Changes
- Browser `session.start` events now optionally carry premium-accuracy and workflow hints sourced from URL query params
- `transcript.final` now carries provider and duration telemetry so the browser submit path can forward cost metrics without moving business truth into the UI
- Return Zero no longer owns Korean traffic by default; only explicit premium/high-risk Korean sessions route there

#### Submission / Cost Defense Changes
- No reducer or duplicate-lock behavior changed
- `/api/voice/submit` and the Make.com payload now persist `stt_provider` and `audio_duration_sec` for downstream cost analysis

#### Known Risks
- Premium/high-risk override inputs currently come from WSS payload/query hints and still need a dedicated product-surface control if operators should toggle them from the UI
- Return Zero premium routing still needs one staging smoke test with real credentials to confirm polling cadence under real load
- Dedicated live duplicate-submit and 15-second full-duration soak coverage remain pending against the real backend

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`
- [x] `corepack pnpm exec playwright test tests/e2e/dual-stt-router.spec.ts tests/e2e/env-core.spec.ts -c tests/playwright.env-core.config.ts` in an isolated Git worktree
- [x] `corepack pnpm exec playwright test tests/e2e/voice-runtime-live.spec.ts tests/e2e/voice-capture-flow.spec.ts -c tests/playwright.config.ts` in an isolated Git worktree

#### Next Sprint Prerequisites
- Decide where premium/high-risk override controls should live in the operator UX
- Run one staging smoke test on a real premium Korean session and confirm `stt_provider` / `audio_duration_sec` persistence downstream
- Add the pending 15-second soak and repeated-send duplicate regression in the live runtime path

---

### Sprint 11 - Synthetic Microphone Routing Automation
- Date: 2026-03-13
- Status: completed

#### Goal
Automate the dual-STT routing proof without any physical microphone or manual operator input by booting a local dev stack, injecting a synthetic microphone, and verifying Whisper-default versus Return Zero premium routing end-to-end.

#### Files Created
- `tests/fixtures/fake-mic.wav`
- `tests/e2e/voice-cutoff-ui.spec.ts`
- `tests/e2e/helpers/live-stt-routing-stack.ts`
- `tests/e2e/helpers/mock-stt-wss-server.mjs`
- `tests/e2e/voice-stt-routing-live.spec.ts`
- `tests/playwright.routing.config.ts`

#### Files Modified
- `docs/sprint-summary.md`
- `package.json`
- `tests/e2e/helpers/synthetic-microphone.ts`

#### Architecture Changes
- Added a test-only runtime stack that starts the real standalone WSS server behind mocked upstream STT fetches and captures downstream webhook payloads for assertion
- Added a dedicated Playwright routing config that boots Next dev, enables Chrome fake-media flags, feeds a deterministic WAV file through `--use-file-for-fake-audio-capture`, and points the browser runtime at the standalone `/voice-session` WSS server
- Extended the synthetic microphone helper so tests can also force browser locale/language and exercise Korean premium routing without physical hardware
- Added desktop plus Pixel 5 projects so routing and UI delivery can be proven under touch/mobile viewport conditions as well as desktop
- Added a separate harness-backed UI cutoff test that uses the stable `/voice` runtime harness to prove the reducer-owned 15-second stop and Make.com delivery on both desktop and mobile

#### State Machine Changes
- None
- Preserved all 8 constitutional states without renaming or restructuring

#### Audio / Transport Changes
- No MediaRecorder path introduced
- AudioWorklet + PCM over WSS-only architecture preserved during automated testing
- Synthetic browser audio now feeds the real WSS control/audio protocol while mocked upstream STT providers emit deterministic Whisper and Return Zero transcripts

#### Submission / Cost Defense Changes
- No reducer or duplicate-lock behavior changed
- Automated routing verification now asserts `stt_provider`, `audio_duration_sec`, and full dummy transcript text in the real `/api/voice/submit` response and downstream webhook payload
- Added a mobile-capable UI test that waits for the reducer-owned 15-second auto-stop before sending and verifies the Make.com webhook still receives the transcript without UI collapse

#### Known Risks
- The new routing automation still uses mocked upstream Whisper/Return Zero HTTP responses, so one final staging smoke test against real providers remains necessary
- The dedicated 15-second full-duration soak and repeated-send duplicate regression are still pending against the live backend

#### Manual QA
- [x] `corepack pnpm test:e2e:routing`
- [x] Verified desktop and Pixel 5 logs plus webhook payloads preserve dummy transcript text and show `stt_provider=whisper` / `return-zero`
- [x] Verified the UI automation path auto-stops after the 15-second cutoff window and still reaches the Make.com webhook

#### Next Sprint Prerequisites
- Replace the upstream HTTP mocks with a staging smoke test when provider credentials and quota windows are ready
- Add the pending 15-second soak and repeated-send duplicate regression in the live runtime path

---

### Sprint 12 - Notion Submit Cleanroom
- Date: 2026-03-21
- Status: completed

#### Goal
Add a cleanroom-safe Notion destination path to the existing submit contract so a connected Notion automation can receive browser-origin metadata without disturbing the fixed reducer, duplicate lock, or audio runtime.

#### Files Created
- None

#### Files Modified
- `docs/sprint-summary.md`
- `references/make-webhook-contract.md`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `src/shared/contracts/voice-submit.ts`
- `tests/e2e/backend-reliability.spec.ts`
- `tests/e2e/voice-runtime-live.spec.ts`
- `tests/e2e/voice-stt-routing-live.spec.ts`

#### Architecture Changes
- Extended the voice submit contract and downstream webhook payload with optional `notionDatabaseId` and `notionParentPageId`
- Added a browser-side submit-target resolver that reads destination metadata from URL query params and forwards it only at submit time
- Kept Notion routing outside reducer business truth so the 8-state machine remains unchanged

#### State Machine Changes
- None
- Preserved all 8 constitutional states without renaming or restructuring

#### Audio / Transport Changes
- No audio pipeline change
- AudioWorklet + PCM over WSS-only architecture preserved

#### Submission / Cost Defense Changes
- No reducer or duplicate-lock behavior changed
- `clientRequestId` is still created synchronously before async submit begins
- Live/runtime tests now prove Notion destination metadata survives through the webhook payload

#### Known Risks
- Notion identifiers are currently supplied through URL query params, so any operator-facing control for selecting a Notion destination still needs a product surface
- Real Make.com to Notion mapping still depends on the external scenario using the new payload fields

#### Manual QA
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm test:e2e`

#### Next Sprint Prerequisites
- Decide whether Notion destination selection should live in UI controls, operator presets, or server-side routing
- Run one end-to-end Make.com to Notion smoke test with the new payload fields populated

---

## Current Known Risks (Rolling Section)

- Real Make.com scenario wiring still needs one staging smoke run even though the documented contract is now local-harness verified
- The real WSS backend must match the shared websocket event schema now enforced in the browser runtime
- Return Zero polling cadence and timeout thresholds still need staging calibration for premium/high-risk override traffic
- The 1.5-second final-transcript drain window may need tuning against real backend latency
- A dedicated 15-second live soak and repeated-send duplicate regression are still pending
- The SSCE local database path currently depends on the custom SQL migration runner because Prisma's schema engine errored on this Windows setup despite a valid Prisma schema
- The SSCE Oracle is currently heuristic and contract-ready for a future Gemini/OpenAI backend, but it does not yet call a live model provider

---

## Current Manual Regression Checklist

- [x] No MediaRecorder exists anywhere in the codebase
- [x] No blob/timeslice recording exists
- [x] Audio architecture remains AudioWorklet + PCM over WSS only
- [x] Browser runtime streams PCM to a live WSS harness and receives `transcript.final`
- [x] `/api/voice/submit` and Make.com payloads are Zod `safeParse`-guarded in the live path
- [x] Whisper is the default STT provider and Korean traffic uses Return Zero only for premium/high-risk overrides
- [x] Return Zero auth/result payloads remain Zod-validated before transcript use
- [x] Return Zero override failures fall back to Whisper and Whisper retries once before fail-fast
- [x] `stt_provider` and `audio_duration_sec` persist through `/api/voice/submit` and the downstream webhook payload
- [x] Synthetic microphone automation can prove Whisper default and Return Zero premium routing without physical microphone hardware
- [x] Desktop and mobile automation both prove the dummy transcript reaches the Make.com webhook without field loss
- [ ] Recording cannot exceed 15 seconds in runtime flow
- [ ] Submission locks before async upload in live flow
- [ ] Duplicate `clientRequestId` upload is blocked in live flow
- [x] 8-state reducer architecture remains intact
- [x] No insecure `ws://` remains in production code paths
- [x] No permission popup infinite loop exists in current shell logic
- [x] UI supports one-handed mobile use
- [x] Step 1 -> Step 2 -> Step 3 -> Step 1 loop is Playwright-verified
- [x] Make.com webhook signature, retry/backoff, timeout circuit breaker, duplicate block, and failure queue replay are mock-server verified
- [x] SSCE `harvest`, `generate`, and `feedback` route handlers safe-parse request and response payloads through shared Zod contracts
- [x] SSCE local migration scripts create the four physical tables before the Prisma-backed route tests run
- [x] SSCE feedback updates now flow through the Oracle semantic-diff pipeline rather than a hardcoded diff skeleton

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
```

---

### Sprint Workspace Ops ??Google Main Dashboard Builder
- Date: 2026-03-22
- Status: partial completion

#### Goal
Prepare a production-ready Apps Script builder for a Google Sheets main dashboard while verifying whether Notion MCP can be used to create real workspace databases.

#### Files Created
- `integrations/google-workspace/dashboard-builder.gs`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a dedicated `dashboard-builder.gs` script that renames the first sheet to `🚀 VOXERA MAIN 통제실`, hides gridlines, paints `A1:Z100` with `#f8fafc`, and creates three large merged-cell action surfaces.
- Added an optional binding helper for already-existing Google Sheets drawings using `Drawing.setOnAction()`.
- Confirmed that the current session still cannot initialize the Notion MCP server because it returns `Auth required`.

#### Known Risks
- Google Apps Script can modify existing spreadsheet drawings but this flow still cannot programmatically create brand-new Drawing objects from code alone.
- Notion physical DB creation remains blocked until MCP authentication is actually recognized by this running session.

#### Manual QA
- [x] Verify `dashboard-builder.gs` contains `🚀 VOXERA MAIN 통제실`
- [x] Verify `setHiddenGridlines(true)` and `A1:Z100` background `#f8fafc`
- [x] Verify three action handlers exist
- [ ] Re-run Notion MCP after session-level auth is recognized

#### Next Sprint Prerequisites
- Restore Notion MCP availability in this session before attempting workspace DB creation.
- Wire `dashboard-builder.gs` into the target spreadsheet Apps Script project and run `buildVoxeraMainDashboard()`.

---

### Sprint 17 - Notion Home Dashboard Blueprint 2nd Pass
- Date: 2026-03-21
- Status: completed

#### Goal
Redesign the Notion dashboard as an always-open home page rather than a modal-like surface, aligned with how Notion pages are actually used.

#### Files Created
- `docs/notion-home-dashboard-visual-spec.md`
- `docs/notion-home-dashboard-blueprint.svg`
- `docs/notion-home-dashboard-blueprint-render.png`

#### Architecture Changes
- Notion is now documented as an always-visible home dashboard, not a pop-up or modal interaction model
- The visual model is:
  - page title
  - 4 KPI cards
  - left `받은 음성함` linked database
  - center `실행 전환` flow badge
  - right `실행 보드` linked database
  - bottom quick links

#### Known Risks
- This is still a visual blueprint only; actual Notion block placement and linked database arrangement are not yet applied
- KPI cards may need to be approximated with callout/synced blocks depending on the final Notion page composition

#### Manual QA
- Open `docs/notion-home-dashboard-blueprint-render.png`
- Confirm the page feels like a Notion home dashboard rather than a modal
- Confirm `받은 음성함` and `실행 보드` are clearly separated
- Confirm the bottom quick links are appropriate for a main page

#### Next Sprint Prerequisites
- Get approval on the 2nd Notion visual blueprint
- Translate the approved blueprint into actual Notion page block placement

---

### Sprint 18 - Notion Direct-Write + Google Workspace Handoff Doc
- Date: 2026-03-21
- Status: completed

#### Goal
Create a developer handoff document that explains the Notion direct-write pivot and the Google Workspace integration model for next-day implementation/testing.

#### Files Created
- `docs/2026-03-21-notion-direct-write-google-workspace-handoff.md`

#### Architecture Changes
- None in runtime code
- Documentation now clearly records:
  - Notion direct-write as the preferred path over Make.com for Notion delivery
  - Google Workspace as a Sheets-centered execution system with Docs/Calendar/Mail as attached assets

#### Known Risks
- The handoff document reflects the agreed target architecture; Notion direct-write runtime implementation still needs to be built/tested
- KakaoTalk remains intentionally deferred pending business account approval

#### Manual QA
- Open the handoff doc
- Verify the Notion decision rationale is clear enough for the engineering lead
- Verify the Google Workspace setup/test sequence is clear enough to run tomorrow

#### Next Sprint Prerequisites
- Apply and test Notion direct-write flow
- Apply and test Google Workspace flow end-to-end

---

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
- `src/server/mcp/contracts.ts`
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

---

### Sprint 3G - Real Cloud Verification And Safe Handoff
- Date: 2026-03-24
- Status: completed

#### Goal
Run the new billing route against real Firebase Admin + Firestore + Secret Manager + Gemini infrastructure, lock the MCP bridge payload contract with Zod schemas, and hand the change off from an isolated worktree without polluting active front-end work.

#### Files Created
- `scripts/verify-generate-output-real.ts`

#### Files Modified
- `docs/sprint-summary.md`
- `package-lock.json`
- `package.json`

#### Architecture Changes
- Added an executable real-cloud verification path that seeds a Firestore wallet, mints a Firebase custom token, boots Next locally, and exercises `POST /api/v1/generate-output` against live Google infrastructure
- Locked the `updates.pull` and `reviews.submit` payload shapes behind shared Zod schemas so the reviewer loop and its tests now validate the same contract
- Preserved the existing voice runtime untouched by keeping all Phase 2 work in server-only billing and MCP modules plus an isolated handoff worktree

#### State Machine Changes
- None
- Preserved all 8 constitutional voice states unchanged

#### Audio / Transport Changes
- None
- AudioWorklet + PCM over WSS-only architecture preserved
- The local reviewer continues to use stdio JSON-RPC and does not affect production transport

#### Submission / Cost Defense Changes
- Verified a real reserve -> execute -> deduct cycle on project `gen-lang-client-0767607744`, Firestore database `voxera-e2e`, and Gemini model `gemini-2.5-pro`
- Verified real provider usage capture now persists token counts and secret version metadata alongside the finalized billing transaction
- Previously observed a real reserve -> refund path when Secret Manager access was denied, confirming rollback behavior under live infrastructure failure

#### Known Risks
- The local `.env.local` and service-account JSON remain machine-local and must never be committed with the branch
- `reviews.submit` static analysis still focuses on Zod gate coverage and hardcoded-secret detection rather than broad semantic review
- Firestore and Secret Manager resources now exist in a live project, so secret rotation and cleanup should follow once the branch is merged

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:billing-mcp`
- [x] `corepack pnpm test:e2e`
- [x] `corepack pnpm verify:real-output`
- [x] Real route response returned `billing.status = deducted`, `availableCredits = 15`, `pendingCredits = 0`, and Gemini token usage from the live provider

#### Next Sprint Prerequisites
- Merge the isolated handoff branch or PR after final review
- Rotate or confirm the Google AI Studio secret version after integration if this verification key should not remain active

---

### Sprint 3H - SSCE Database Skeleton And API Contracts
- Date: 2026-03-24
- Status: completed

#### Goal
Stand up the SSCE personalization/compounding backbone with four core tables, three validated API routes, and minimum route-level test skeletons without disturbing the existing voice runtime.

#### Files Created
- `apps/api/src/db/schema/ssce-schema.ts`
- `apps/api/src/routes/ssce-router.ts`
- `apps/api/src/routes/ssce-api.spec.ts`
- `packages/adapter/src/validators/ssce-zod.ts`

#### Files Modified
- `docs/sprint-summary.md`

#### Architecture Changes
- Added a portable SSCE ERD module that models `artifacts`, `style_signatures`, `style_events`, and `reference_edges` with explicit FK metadata and runtime FK assertions
- Added an in-memory SSCE router surface for `harvest`, `generate`, and `feedback`, all of which validate input and output payloads through shared Zod contracts
- Added a feedback diff skeleton that compares generated draft content against final artifact content and feeds mock signature updates back into the scoped signature store

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
- The SSCE implementation is intentionally storage-agnostic and currently uses in-memory mock persistence rather than a live database driver
- The feedback diff logic is a deterministic mock skeleton, not a semantic AST/text-diff engine yet
- The route spec test currently requires a small temporary CommonJS compile step because the repo does not have a dedicated TS unit-test runner configured

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `.\\node_modules\\.bin\\tsc apps\\api\\src\\routes\\ssce-api.spec.ts apps\\api\\src\\routes\\ssce-router.ts apps\\api\\src\\db\\schema\\ssce-schema.ts packages\\adapter\\src\\validators\\ssce-zod.ts --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck --outDir .codex-runtime\\ssce-test-dist`
- [x] `node --test .codex-runtime\\ssce-test-dist\\apps\\api\\src\\routes\\ssce-api.spec.js`

#### Next Sprint Prerequisites
- Replace the in-memory SSCE store with the project’s eventual persistent adapter once the database package choice is finalized
- Decide whether SSCE should surface as internal service handlers only or be wrapped by actual HTTP route files in `apps/api`

---

### Sprint 3I - SSCE Prisma Adapter And HTTP Endpoints
- Date: 2026-03-24
- Status: completed

#### Goal
Replace the SSCE in-memory store with a real Prisma-backed adapter, expose the three SSCE operations through Next.js App Router HTTP endpoints, and replace the ad-hoc test compile path with a normal TypeScript test runner.

#### Files Created
- `apps/api/src/db/schema.prisma`
- `apps/api/src/db/ssce-prisma.ts`
- `apps/api/src/db/migrations/0001_init_ssce.sql`
- `apps/api/src/db/run-ssce-migrations.ts`
- `apps/api/src/app/api/v1/ssce/route-helpers.ts`
- `apps/api/src/app/api/v1/ssce/harvest/route.ts`
- `apps/api/src/app/api/v1/ssce/generate/route.ts`
- `apps/api/src/app/api/v1/ssce/feedback/route.ts`
- `src/app/api/v1/ssce/harvest/route.ts`
- `src/app/api/v1/ssce/generate/route.ts`
- `src/app/api/v1/ssce/feedback/route.ts`
- `vitest.config.ts`

#### Files Modified
- `apps/api/src/routes/ssce-router.ts`
- `apps/api/src/routes/ssce-api.spec.ts`
- `package.json`
- `tsconfig.json`
- `docs/sprint-summary.md`

#### Architecture Changes
- Replaced the in-memory SSCE store with Prisma transactions that create and relate `artifacts`, `style_signatures`, `style_events`, and `reference_edges`
- Added checked-in SQL migrations plus a small local migration runner so the SSCE schema can be materialized before tests and local HTTP smoke runs
- Added App Router wrappers for `POST /api/v1/ssce/harvest`, `POST /api/v1/ssce/generate`, and `POST /api/v1/ssce/feedback`, all of which parse inbound JSON through Zod, delegate to the SSCE router, and normalize `200/400/500` responses
- Replaced the temporary CommonJS compile workaround with a Vitest-based TypeScript test path wired through `package.json`

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
- Prisma client generation works, but this Windows environment still rejects `prisma migrate dev` / `prisma db push` with a schema engine error, so local schema application currently depends on the checked-in SQL runner
- The active Next.js app serves the root `src/app/api/v1/ssce/*` wrappers, which intentionally forward to the `apps/api` handlers so the SSCE contract can stay isolated without moving the main app structure
- The SSCE feedback diff updater remains a skeleton and should be replaced with a real semantic style extraction pass before production compounding decisions depend on it

#### Manual QA
- [x] `corepack pnpm db:ssce:generate`
- [x] `corepack pnpm db:ssce:migrate`
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:ssce`
- [x] `corepack pnpm test:e2e`
- [x] Local Next.js smoke run on port `3010` returned `200` from all three SSCE endpoints with persisted Prisma-backed records

#### Next Sprint Prerequisites
- Decide whether the Prisma datasource should remain local SQLite for development only or move to the eventual shared production database provider
- Replace the feedback diff skeleton with a semantic comparison pipeline before signature compounding is used for customer-facing personalization

---

### Sprint 3J - SSCE Oracle Semantic Feedback And Git Hygiene
- Date: 2026-03-24
- Status: completed

#### Goal
Replace the SSCE feedback dummy diff skeleton with an Oracle-style semantic analysis pipeline and stop Windows line-ending/test-cache noise from polluting the worktree.

#### Files Created
- `apps/api/src/services/semantic-diff-oracle.ts`
- `.gitattributes`

#### Files Modified
- `.gitignore`
- `apps/api/src/routes/ssce-router.ts`
- `docs/sprint-summary.md`

#### Architecture Changes
- Added `HeuristicSemanticDiffOracle` with a future-ready model adapter contract so Gemini/OpenAI-backed reasoning can later replace the local heuristic provider without changing the router contract
- The feedback route now computes lexical changes, structure changes, tone deltas, and scope-specific trait updates before it writes back to `style_signatures`
- Oracle analysis is persisted into `style_signatures.traits_json` and `style_events.payload_snapshot`, while the public response schema remains backward-compatible
- Added repository-level line-ending normalization plus ignore rules for test/cache artifacts such as `.last-run.json`, `.runtime/`, `*.tsbuildinfo`, and the local SSCE SQLite file

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
- The Oracle currently uses heuristic NLP and document-structure cues. It is semantically richer than the old sentence-count diff, but still not equivalent to a live LLM judge
- Prisma's schema engine issue on this Windows setup remains unresolved, so local schema application still depends on the checked-in SQL runner

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test:ssce`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`
- [x] Verified `git diff --name-only` no longer contains incidental `next-env.d.ts`, `.last-run.json`, or SQLite/cache noise after cleanup

#### Next Sprint Prerequisites
- Swap the heuristic Oracle provider for a live Gemini/OpenAI adapter if production-grade semantic judgment is required
- Resolve the underlying Prisma schema-engine issue so SQL migration replay is no longer needed on this Windows path

---

### Sprint 3K - Live Gemini Oracle Verification, Handoff Prep, And UI Constitution
- Date: 2026-03-24
- Status: completed

#### Goal
Replace the heuristic-only Oracle path with a live Google AI Studio Gemini integration, prove the live path under the normal test command, and write the fixed UI constitution required for the frontend handoff.

#### Files Created
- `docs/UI_CONSTITUTION.md`

#### Files Modified
- `.gitignore`
- `apps/api/src/services/semantic-diff-oracle.ts`
- `apps/api/src/routes/ssce-api.spec.ts`
- `package.json`
- `docs/sprint-summary.md`

#### Architecture Changes
- `apps/api/src/services/semantic-diff-oracle.ts` now loads `GOOGLE_AI_STUDIO_KEY` from local env files, calls the Google AI Studio `generateContent` endpoint, and records live provider metadata plus token usage in test output
- The Oracle now constrains Gemini with a dedicated JSON response contract and merges the returned semantic judgment with the deterministic baseline analyzer
- If Gemini returns malformed JSON, the live path degrades to a repair-baseline result instead of failing the feedback route, so the system stays live-first while preserving deterministic feedback output
- `apps/api/src/routes/ssce-api.spec.ts` now asserts that the feedback route uses the live Gemini provider prefix whenever a real key is present
- `docs/UI_CONSTITUTION.md` now fixes the three frontend absolutes: five-box grouping, dark theme with real brand-color icons, and zero-UI microphone transition

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
- The live Gemini path is verified, but one happy-path case still needed repair-baseline fallback because Gemini emitted malformed JSON during the test run
- `.env.local` contains the live API key only in the local worktree and must not be committed during handoff
- Prisma's Windows schema-engine issue still exists, so local SSCE schema application continues to depend on the checked-in SQL runner

#### Manual QA
- [x] Injected `GOOGLE_AI_STUDIO_KEY` into local `.env.local`
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test:ssce`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`
- [x] Verified test logs showed live Gemini provider strings and token counts from the SSCE feedback path

#### Next Sprint Prerequisites
- Replace repair-baseline fallback with stricter structured output once a more reliable Gemini schema mode or judge prompt is chosen
- Hand the merged backend state plus `docs/UI_CONSTITUTION.md` to the frontend agent before the first UI render sprint starts

---

### Sprint 3L - Zero-Waste Gemini Schema Tuning And Final Self-Inspection
- Date: 2026-03-24
- Status: completed

#### Goal
Eliminate the Gemini `repair-baseline` fallback path by tightening the structured-output contract, then run a final reviewer-driven failure-mode inspection before backend closure.

#### Files Modified
- `apps/api/src/services/semantic-diff-oracle.ts`
- `apps/api/src/routes/ssce-api.spec.ts`
- `VOXERA_BACKEND_ARCHITECTURE.md`
- `docs/sprint-summary.md`

#### Architecture Changes
- Replaced the larger freeform Gemini judgment contract with a compact wire schema that uses short keys and enum-constrained tone labels
- Removed the `repair-baseline` parse-recovery path from the live Gemini branch so malformed structured output now fails fast during development instead of silently degrading
- Added stronger Gemini request controls:
  - compact JSON prompt payload
  - strict system instruction
  - `thinkingBudget: 0`
  - deterministic sampling (`temperature: 0`, `topK: 1`, seeded request)
- Tightened the SSCE feedback spec so live-provider assertions now also reject any provider string that contains `repair-baseline`

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
- The Gemini path is now clean under repeated live tests, but the implementation still depends on the model honoring `responseJsonSchema`; future model regressions would now fail fast instead of degrading quietly
- Reviewer self-inspection still flags three non-blocking backend risks: Gemini as a live single point of failure in SSCE feedback, concurrent scope upsert races, and unbounded payload snapshot growth in SQLite
- The Node warning around `apps/api/src/db/run-ssce-migrations.ts` module typing remains and should be cleaned up separately if startup noise matters
- Prisma's Windows schema-engine issue still exists, so local SSCE schema application continues to depend on the checked-in SQL runner

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test:ssce`
- [x] `corepack pnpm test`
- [x] Verified repeated live SSCE runs no longer emitted the string `repair-baseline`

#### Next Sprint Prerequisites
- If Gemini output reliability ever regresses, add an automated canary that fails the pipeline on any structured-output parse error before runtime traffic sees it
- Decide whether to clean up the Node ESM warning in the migration runner or leave it as acceptable local-only noise
