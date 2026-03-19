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
- Status: dual-track V4 resilience worktree active with ZHI UI plus ZHI/HITL server lanes
- Current routing approach: Next.js App Router with route groups
- Current feature folder approach: shared voice runtime remains centered on `features/voice-capture`, while V4 lane-specific orchestration now splits across `server/v4/zhi`, `server/v4/hitl`, and shared resilience infrastructure in `server/v4/shared`
- Current UI shell status: destination-first ZHI capture flow is Playwright-verified against the async worker path, while HITL is exposed through API routes and direct route tests

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
- Status: live V3 `/api/voice/submit` flow remains intact while V4 mutable routes now require idempotency headers and queue work asynchronously
- 15-second cutoff status: reducer timer remains the source of truth and auto-stops at the hard limit
- `clientRequestId` lock status: generated synchronously before async submit begins
- Duplicate prevention strategy: reducer upload lock gates browser submit attempts, request-entry idempotency middleware caches repeated V4 responses in Redis, domain records still deduplicate on `clientRequestId`, and downstream webhook delivery now carries both `Idempotency-Key` and `X-Idempotency-Key`
- Cost telemetry status: `stt_provider` and `audio_duration_sec` now flow from the WSS transcript result into `/api/voice/submit` and the downstream webhook payload

### V4 Orchestration
- Status: ZHI and HITL lanes are persisted, buffered, and executed by the shared worker
- Shared contract status: `src/shared/contracts/v4/common.ts` now owns destination catalog, structured field schema, approval status, and execution-credit contract types
- Persistence strategy: V4 uses PostgreSQL tables `v4_dispatches`, `v4_approvals`, `v4_execution_credit_accounts`, and `v4_execution_credit_ledger`, with a `version` column enabling optimistic credit debits and `pg-mem` used only for local test/runtime harnesses
- Dispatch strategy: V4 route handlers write the DB record, encrypt the outbound payload into a Redis TTL buffer, enqueue the Redis Stream job, and return in queue-accept mode while the async worker handles Make.com delivery and post-success credit charging
- Buffer and retry strategy: outbound payloads are stored only as AES-256 encrypted Redis blobs with 5-10 minute TTL, deleted immediately on success, and retried with exponential backoff only while the TTL window remains valid
- Idempotency strategy: mutable V4 APIs require `Idempotency-Key` UUID headers and replay cached responses from Redis instead of re-running the route body
- UI routing strategy: `/capture` still renders the destination-first ZHI screen, but its success state now means “queued for resilient execution” rather than “synchronously sent”

### Mobile UX
- Status: premium 3-step capture flow complete with restored Step 1 neon trace waveform
- One-handed usage support: yes
- Safe-area support: baseline implemented
- Accessibility status: touch targets, labels, and Playwright test ids applied
- Error messaging status: inline Step 2 retry/cancel feedback available and transcript view now shows live runtime text only

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

### Sprint 12 - V4 ZHI Persistence, Credits, and Destination Routing
- Date: 2026-03-19
- Status: completed

#### Goal
Split shared V4 contracts, replace stubbed orchestration with PostgreSQL-backed persistence, charge one execution credit only after a successful Make.com webhook, and route the capture UI into the destination-first ZHI lane.

#### Files Created
- `agents.mmd`
- `src/app/api/v4/zhi/dispatch/route.ts`
- `src/app/api/v4/zhi/destinations/route.ts`
- `src/features/v4-zhi/components/v4-zhi-capture-screen.tsx`
- `src/features/v4-zhi/services/submit-zhi-dispatch.ts`
- `src/server/v4/shared/database.ts`
- `src/server/v4/shared/env.ts`
- `src/server/v4/shared/execution-credits.ts`
- `src/server/v4/shared/make-dispatch.ts`
- `src/server/v4/shared/migrations/001_v4_orchestration.sql`
- `src/server/v4/zhi/orchestrator.ts`
- `src/server/v4/zhi/zhi-repository.ts`
- `src/shared/contracts/v4/common.ts`
- `src/shared/contracts/v4/zhi.ts`
- `tests/e2e/v4-zhi-dispatch.spec.ts`

#### Files Modified
- `.env.local.example`
- `docs/sprint-summary.md`
- `package.json`
- `src/app/(voice)/capture/page.tsx`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `tests/e2e/helpers/live-voice-runtime.ts`
- `tests/e2e/helpers/next-dev.ts`
- `tests/e2e/voice-capture-flow.spec.ts`
- `tests/e2e/voice-cutoff-ui.spec.ts`
- `tests/e2e/voice-runtime-live.spec.ts`
- `tests/playwright.config.ts`
- `tests/playwright.routing.config.ts`

#### Architecture Changes
- Added a shared V4 contract layer so destination metadata, structured fields, approval status, and execution-credit response types are no longer duplicated between lanes
- Replaced the stub ZHI orchestrator with a PostgreSQL-backed dispatch repository and shared migration bootstrap
- Added a V4 execution-credit service that records deductions in a ledger and charges only after the Make.com webhook reports success
- Switched `/capture` in this worktree to the destination-first ZHI screen so Slack and Jira execute through `POST /api/v4/zhi/dispatch`
- Added `agents.mmd` to document the relationship between the router, ZHI/HITL agents, webhook permissions, and the shared credit/persistence services

#### State Machine Changes
- Preserved all 8 constitutional states without renaming or restructuring
- Extended `use-voice-capture-machine` with an injectable submit adapter so V4 routes can reuse the reducer-owned recording, stop, upload, and success transitions without UI-only business flags

#### Audio / Transport Changes
- No MediaRecorder path introduced
- AudioWorklet + PCM over WSS-only architecture preserved
- Live transcript finalization is still required before ZHI auto-submission fires, so partial transcript text is not dispatched downstream

#### Submission / Cost Defense Changes
- ZHI dispatch now deduplicates on `clientRequestId` before issuing a second webhook or a second credit deduction
- Exactly one execution credit is deducted only after the Make.com webhook returns success
- The reducer-owned 15-second cutoff remains the source of truth for capture stop timing

#### Known Risks
- Production rollout still needs the PostgreSQL migration applied before V4 traffic is enabled
- The execution-credit service currently assumes a single configured account key and will need tenant/account mapping for multi-operator billing
- Slack and Jira payload shaping is intentionally minimal and may need richer field mapping once real Make.com scenarios are finalized

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`
- [x] Verified the destination-first capture screen auto-dispatches Slack and Jira requests through `/api/v4/zhi/dispatch`
- [x] Verified duplicate `clientRequestId` requests reuse the stored execution record instead of charging twice

#### Next Sprint Prerequisites
- Run one staging smoke test against real PostgreSQL plus the real Make.com scenario for Slack/Jira namespaces
- Decide whether the lane chooser should live on `/capture` permanently or move to a higher-level router screen shared with the HITL branch
- Add tenant-aware execution-credit account resolution before multi-customer rollout

---

### Sprint 13 - V4 Resilience Worker, Encrypted Buffer, and Exactly-Once Middleware
- Date: 2026-03-19
- Status: completed

#### Goal
Replace synchronous V4 delivery with an async worker architecture, move credit debits to optimistic locking, introduce AES-256 Redis buffering plus idempotent route middleware, and document the nightly worker-log automation path.

#### Files Created
- `src/app/api/v4/hitl/cards/route.ts`
- `src/app/api/v4/hitl/queue/route.ts`
- `src/app/api/v4/hitl/approvals/[approvalId]/route.ts`
- `src/server/v4/hitl/processor.ts`
- `src/server/v4/shared/execution-buffer.ts`
- `src/server/v4/shared/idempotency.ts`
- `src/server/v4/shared/queue.ts`
- `src/server/v4/shared/runtime-store.ts`
- `src/server/v4/shared/worker-log.ts`
- `src/server/v4/shared/worker.ts`
- `src/server/v4/zhi/processor.ts`
- `tests/e2e/v4-hitl-approval.spec.ts`

#### Files Modified
- `.env.local.example`
- `AGENTS.md`
- `agents.mmd`
- `docs/sprint-summary.md`
- `package.json`
- `src/app/(voice)/capture/page.tsx`
- `src/app/api/v4/zhi/destinations/route.ts`
- `src/app/api/v4/zhi/dispatch/route.ts`
- `src/features/v4-zhi/components/v4-zhi-capture-screen.tsx`
- `src/features/v4-zhi/services/submit-zhi-dispatch.ts`
- `src/server/reliability/WebhookClient.ts`
- `src/server/v4/hitl/approval-store.ts`
- `src/server/v4/hitl/hitl-service.ts`
- `src/server/v4/shared/env.ts`
- `src/server/v4/shared/execution-credits.ts`
- `src/server/v4/shared/migrations/001_v4_orchestration.sql`
- `src/server/v4/zhi/orchestrator.ts`
- `src/server/v4/zhi/zhi-repository.ts`
- `src/shared/contracts/v4/common.ts`
- `src/shared/contracts/v4/hitl.ts`
- `src/shared/contracts/v4/zhi.ts`
- `tests/e2e/v4-zhi-dispatch.spec.ts`
- `tests/e2e/voice-capture-flow.spec.ts`
- `tests/e2e/voice-cutoff-ui.spec.ts`
- `tests/e2e/voice-runtime-live.spec.ts`
- `tests/playwright.config.ts`
- `tests/playwright.routing.config.ts`

#### Architecture Changes
- Added a shared runtime store that uses Redis in production and `memory://` only for local test harnesses
- Added AES-256 encrypted Redis buffering so webhook payloads exist only in short-lived encrypted storage before external delivery
- Added a Redis Stream-backed async worker path for both ZHI and HITL execution, with `.runtime/v4-worker.log` as the nightly automation analysis target
- Added route-entry idempotency middleware that caches prior responses in Redis and replays them for identical `Idempotency-Key` requests
- Added HITL route coverage to the resilience branch so approval queue creation and approve-after-queue flows now share the same worker path

#### State Machine Changes
- Preserved all 8 constitutional states without renaming or restructuring
- Preserved the reducer-owned synchronous submit lock while the network path behind that lock changed from direct delivery to queue acceptance

#### Audio / Transport Changes
- No MediaRecorder path introduced
- AudioWorklet + PCM over WSS-only architecture preserved
- Startup fail-fast for invalid public WSS envs remains active by importing `env.client` from the capture entrypoint

#### Submission / Cost Defense Changes
- Replaced pessimistic credit locking with optimistic compare-and-swap updates on `v4_execution_credit_accounts.version`
- ZHI dispatch now returns queue acceptance within the request path while the worker performs delivery and post-success credit deduction asynchronously
- HITL approval execution now enqueues the approved card and deducts the execution credit only after the worker receives a successful Make.com response
- Duplicate V4 requests now short-circuit through Redis idempotency result replay before route logic runs again

#### Known Risks
- Production rollout still needs real Redis connectivity plus staging validation for the shared worker cursor behavior under multi-instance load
- The current worker is process-hosted inside the app runtime for local and single-instance operation; a separate deployable worker process is still advisable before heavy production traffic
- Nightly automation is now log-ready, but the actual external cron registration still needs to be created in the deployment environment

#### Manual QA
- [x] `corepack pnpm install --lockfile=false`
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`
- [x] Verified `POST /api/v4/zhi/dispatch` returns `202 queued`, stays under 200ms in the direct route spec, and delivers the webhook asynchronously
- [x] Verified `POST /api/v4/hitl/approvals/[approvalId]` returns `202 approved`, executes asynchronously, and replays duplicate approval responses from Redis

#### Next Sprint Prerequisites
- Provision a staging Redis instance and run the worker/TTL/idempotency path against real infrastructure
- Split the process-hosted worker into a separately deployable worker service if horizontal web scaling is planned
- Decide whether the HITL structured-card UI should be reintroduced into `/capture` or live behind a dedicated operator route in this combined resilience branch

---

## Current Known Risks (Rolling Section)

- Real Make.com scenario wiring still needs one staging smoke run even though the documented contract is now local-harness verified
- The real WSS backend must match the shared websocket event schema now enforced in the browser runtime
- Return Zero polling cadence and timeout thresholds still need staging calibration for premium/high-risk override traffic
- The 1.5-second final-transcript drain window may need tuning against real backend latency
- The PostgreSQL migration, Redis buffer, and worker-cursor paths still need one staging smoke run against non-`pg-mem` infrastructure
- Multi-tenant execution-credit account mapping is not implemented yet for V4
- The current worker runs in-process and should be separated before heavy multi-instance production traffic

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
- [x] Recording cannot exceed 15 seconds in runtime flow
- [x] Submission locks before async upload in live flow
- [x] Duplicate `clientRequestId` upload is blocked in live flow
- [x] 8-state reducer architecture remains intact
- [x] No insecure `ws://` remains in production code paths
- [x] No permission popup infinite loop exists in current shell logic
- [x] UI supports one-handed mobile use
- [x] Step 1 -> Step 2 -> Step 3 -> Step 1 loop is Playwright-verified
- [x] Make.com webhook signature, retry/backoff, timeout circuit breaker, duplicate block, and failure queue replay are mock-server verified
- [x] V4 shared contracts are centralized under `src/shared/contracts/v4/common.ts`
- [x] ZHI dispatch deducts one execution credit only after a successful Make.com webhook
- [x] V4 mutable routes require `Idempotency-Key` and replay cached responses for duplicate requests
- [x] V4 payloads are buffered only inside the AES-256 Redis TTL layer before delivery
- [x] HITL approval execution uses the same async worker and encrypted buffer architecture as ZHI

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

