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

### Mobile UX
- Status: premium 3-step capture flow complete with restored Step 1 neon trace waveform
- One-handed usage support: yes
- Safe-area support: baseline implemented
- Accessibility status: touch targets, labels, and Playwright test ids applied
- Error messaging status: inline Step 2 retry/cancel feedback remains available, microphone-entry failures now bounce users back to Step 1 with a Korean toast, and transcript view shows live runtime text only

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

### Sprint 12 - Microphone Entry Guard and Empty Submit Lock
- Date: 2026-03-13
- Status: completed

#### Goal
Prevent microphone-access failures from trapping users in the Step 2 screen, show an explicit Korean warning, and keep the send action hard-disabled whenever no finalized transcript exists.

#### Files Created
- `tests/e2e/voice-microphone-guard.spec.ts`

#### Files Modified
- `docs/sprint-summary.md`
- `package.json`
- `src/features/voice-capture/components/voice-capture-screen.tsx`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `tests/e2e/helpers/live-voice-runtime.ts`

#### Architecture Changes
- Microphone-entry failures that happen before recording starts are now normalized in the voice machine hook, surfaced through a Korean Sonner toast, and immediately reset back to the Step 1 idle shell instead of dropping the user into the Step 2 error screen
- Step 2 send availability now depends on a finalized non-placeholder transcript so empty or partial runtime text cannot be submitted even if the UI reaches the confirmation screen
- Added E2E coverage for both no-microphone rejection and runtime-no-final-transcript behavior across desktop and mobile emulation

#### State Machine Changes
- None
- Preserved all 8 constitutional states without renaming or restructuring

#### Audio / Transport Changes
- No MediaRecorder path introduced
- AudioWorklet + PCM over WSS-only architecture preserved
- No transport contract changes; this sprint only hardened the client-side entry/error guard

#### Submission / Cost Defense Changes
- No reducer-owned 15-second cutoff change
- No `clientRequestId` locking change
- Send CTA is now disabled until `transcript.final` is present, preventing zero-byte or partial-transcript submits

#### Known Risks
- The Korean microphone toast intentionally buckets secure-context, permission, and missing-device entry failures into one operator-facing message; if finer diagnosis is needed later, that should be added without reopening the Step 2 trap
- A real physical-device smoke run is still pending even though synthetic no-mic and runtime-error paths are now automated

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test`
- [x] `corepack pnpm test:e2e`
- [x] Verified Playwright no-microphone rejection stays on Step 1 and shows `마이크를 찾을 수 없거나 권한이 없습니다. 기기를 확인해 주세요.`
- [x] Verified Step 2 send stays disabled when the WSS runtime emits `session.error` without a finalized transcript

#### Next Sprint Prerequisites
- Run one physical-device localhost smoke test to confirm the same Korean guardrail appears on actual missing/blocked microphone hardware
- Keep the pending 15-second soak and repeated-send duplicate regression work on the live backend path

---

### Sprint 13 - VIP Headed UI Demo Automation
- Date: 2026-03-13
- Status: completed

#### Goal
Provide a commander-visible headed Playwright demonstration that opens a real Chrome window, slows interactions down for observation, and walks the capture UI from recording through green success without any manual clicks.

#### Files Created
- `tests/e2e/voice-ui-live-demo.spec.ts`
- `tests/playwright.demo.config.ts`

#### Files Modified
- `docs/sprint-summary.md`
- `package.json`

#### Architecture Changes
- No product runtime architecture change
- Added a dedicated headed Playwright config that launches real Chrome with fake-media flags, a large window, and `slowMo` for operator-visible demonstrations
- Added a demo-only E2E that boots an isolated live voice harness on separate ports and walks the Step 1 -> Step 2 -> Step 3 UI path with observation pauses between stages

#### State Machine Changes
- None
- Preserved all 8 constitutional states without renaming or restructuring

#### Audio / Transport Changes
- No MediaRecorder path introduced
- AudioWorklet + PCM over WSS-only architecture preserved
- The demo path uses the same synthetic microphone helper and WSS runtime harness contracts already used by automated E2E coverage

#### Submission / Cost Defense Changes
- No reducer-owned 15-second cutoff change
- No `clientRequestId` locking change
- Demonstration coverage now visually proves the existing recording -> transcript -> upload -> success path without adding any manual test burden

#### Known Risks
- The headed demo still depends on local Chrome availability and desktop focus, so CI/headless environments should keep using the standard non-demo suites

#### Manual QA
- [x] `corepack pnpm typecheck`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm test:e2e:demo`
- [x] Verified a visible Chrome window auto-played mic start, 3-second recording view, transcript transition, send click, and green success state with no operator input

#### Next Sprint Prerequisites
- If executives want repeated live demos, keep the demo spec pinned to a stable Chrome channel and periodically verify fake-media flags still behave the same after browser upgrades

---

## Current Known Risks (Rolling Section)

- Real Make.com scenario wiring still needs one staging smoke run even though the documented contract is now local-harness verified
- The real WSS backend must match the shared websocket event schema now enforced in the browser runtime
- Return Zero polling cadence and timeout thresholds still need staging calibration for premium/high-risk override traffic
- The 1.5-second final-transcript drain window may need tuning against real backend latency
- Physical-device microphone rejection behavior is still only synthetic-E2E verified; one localhost smoke run on real blocked/missing hardware remains desirable
- A dedicated 15-second live soak and repeated-send duplicate regression are still pending

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
- [x] Missing or blocked microphone access no longer traps the user in Step 2 and instead returns to Step 1 with a Korean toast
- [x] Step 2 send stays disabled when no finalized transcript exists
- [x] A headed Chrome demo can visibly replay Step 1 recording, transcript transition, send, and green success without operator clicks
- [ ] Recording cannot exceed 15 seconds in runtime flow
- [ ] Submission locks before async upload in live flow
- [ ] Duplicate `clientRequestId` upload is blocked in live flow
- [x] 8-state reducer architecture remains intact
- [x] No insecure `ws://` remains in production code paths
- [x] No permission popup infinite loop exists in current shell logic
- [x] UI supports one-handed mobile use
- [x] Step 1 -> Step 2 -> Step 3 -> Step 1 loop is Playwright-verified
- [x] Make.com webhook signature, retry/backoff, timeout circuit breaker, duplicate block, and failure queue replay are mock-server verified

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

---

## 2026-03-14 - Permanent Railway WSS + Ready Timeout Guard

### Files Changed
- `src/features/voice-capture/services/realtime-voice-session.ts`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `src/features/voice-capture/components/voice-capture-screen.tsx`
- `src/shared/styles/globals.css`
- `tests/e2e/helpers/live-voice-runtime.ts`
- `tests/e2e/voice-microphone-guard.spec.ts`
- `tests/e2e/voice-capture-flow.spec.ts`
- `tests/e2e/voice-runtime-live.spec.ts`
- `tests/e2e/voice-transcript-interactions.spec.ts`
- `scripts/voice-wss-server.mjs`
- `package.json`
- `eslint.config.mjs`
- `Dockerfile`
- `.dockerignore`

### Architecture Changes
- Browser voice runtime now waits for `session.ready` before entering the live recording state.
- A 5-second WSS startup timeout now hard-fails to a Korean toast and returns the reducer to `idle` instead of leaving the UI stuck after microphone approval.
- Entry failures are now split into user-visible Korean messages for missing microphone, browser permission block, OS permission block, busy device, browser unsupported, and delayed server connection.
- Step 2 transcript now uses native scrollbars again, supports touch scrolling, and keeps a `최신으로 이동` affordance when the user scrolls away from the latest text.
- Send animation now performs a single light rotation before transition, Step 3 auto-returns to Step 1 after roughly 2 seconds, and duplicate submit is synchronously locked with a ref before async upload begins.
- The permanent WSS backend is now deployed on Railway at `wss://voiceguard-backend-production.up.railway.app/voice-session`.
- The Railway WSS server now listens on `PORT`, exposes `/healthz`, and emits `session.ready` only after `session.start`, matching the browser/runtime contract.
- Production deployment now uses a dedicated container image for the WSS server, with `ws` moved into runtime dependencies.
- Vercel production now points `NEXT_PUBLIC_WSS_URL` at the Railway WSS origin.

### Known Risks
- Vercel production `MAKE_WEBHOOK_URL` is currently a temporary placeholder endpoint, so final submit delivery is production-stable but not yet wired to a real Make.com endpoint.
- Live browser smoke currently proves microphone approval no longer hangs and WSS enters recording, but it does not yet assert a non-empty final transcript against real speech input.

### Manual QA / Verification
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm build`
- Railway health check: `https://voiceguard-backend-production.up.railway.app/healthz`
- Railway websocket smoke: verified `session.ready` from `wss://voiceguard-backend-production.up.railway.app/voice-session`
- Vercel capture smoke: `https://voxera-voice-live.vercel.app/capture`
- Vercel submit smoke: `POST https://voxera-voice-live.vercel.app/api/voice/submit -> 200`
- Live browser smoke: synthetic microphone on the public capture page transitions `Start recording -> Stop recording and continue -> Step 2`
- Desktop/mobile E2E now prove transcript overflow scroll, latest-jump recovery, and duplicate submit lock in the live reducer flow

### Next Sprint Prerequisites
- Replace the temporary production webhook target with the real Make.com webhook URL and secret.
- Add one real-speech production smoke test on the public domain to validate `transcript.final` end-to-end against Whisper and Return Zero.

---

## 2026-03-14 - Repeated Microphone Prompt Suppression

### Files Changed
- `src/features/voice-capture/services/realtime-voice-session.ts`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `tests/e2e/helpers/synthetic-microphone.ts`
- `tests/e2e/voice-transcript-interactions.spec.ts`

### Architecture Changes
- The browser runtime now retains the originally granted microphone input stream after the first explicit user gesture and reuses cloned tracks for later recordings in the same open capture session.
- Repeat recordings no longer re-enter `getUserMedia()` while the capture screen remains mounted, so the browser is not asked to show another permission prompt for each new recording cycle.
- The retained microphone stream is explicitly released on capture-page unmount so the device is not held beyond the active Voxera session lifecycle.

### Known Risks
- Browser-level permission persistence across full reloads, private browsing, or host app WebView policies still depends on the browser/vendor; the app-side guarantee is that the same open Voxera capture session will not re-request microphone access after the first grant.
- Keeping the original granted input alive until page exit is the tradeoff that avoids repeat permission prompts inside the same session.

### Manual QA / Verification
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- Verified new Playwright regression: two complete record-stop cycles in the same page session still produce `window.__voxeraGetUserMediaCallCount === 1`

### Next Sprint Prerequisites
- Validate one real physical microphone session on the public production URL to confirm the target mobile browser persists site-level permission after the first grant as expected.

---

## 2026-03-14 - Make.com Production Webhook Cutover

### Files Changed
- `docs/sprint-summary.md`

### Architecture Changes
- Vercel production `MAKE_WEBHOOK_URL` now targets the live Make EU1 webhook instead of the temporary placeholder endpoint.
- Vercel production `MAKE_WEBHOOK_SECRET` remains enabled so `X-Webhook-Signature` and `X-Idempotency-Key` protection stay intact on the live Make ingress path.
- Production `/api/voice/submit` now returns a direct live send result from the real Make.com pipeline when the webhook accepts the payload.

### Known Risks
- Public production still needs one real microphone business-flow smoke on a physical device to validate the final user transcript quality after Make routing, even though the submit pipeline is now live and returning success.

### Manual QA / Verification
- Verified `GET https://voxera-voice-live.vercel.app/capture -> 200`
- Verified `POST https://voxera-voice-live.vercel.app/api/voice/submit -> {"ok":true,"acceptedForRetry":false,"stt_provider":"whisper","audio_duration_sec":1,"circuitState":"CLOSED"}`
- Verified Vercel production env now contains encrypted `MAKE_WEBHOOK_URL` and `MAKE_WEBHOOK_SECRET`
- Verified production redeploy completed and re-aliased to `https://voxera-voice-live.vercel.app`

### Next Sprint Prerequisites
- Run one real spoken production capture on a phone to verify final transcript content and downstream Notion/Sheets/Slack/Telegram routing in the live Make scenario.

---

## 2026-03-16 - VOXERA Webhook Endpoint Rotation

### Files Changed
- `.env.local`
- `.env.local.example`
- `README.md`
- `docs/security-architecture.md`
- `references/make-webhook-contract.md`
- `docs/sprint-summary.md`
- `tests/e2e/voice-capture-flow.spec.ts`

### Architecture Changes
- The only external business webhook path remains `/api/voice/submit -> WebhookClient -> env.MAKE_WEBHOOK_URL`.
- The runtime Make webhook target has been rotated to the new VOXERA-specific Make EU1 endpoint via environment configuration.
- Stale tracked references to `NEXT_PUBLIC_WEBHOOK_URL` were removed so the webhook source of truth is now only `MAKE_WEBHOOK_URL`.
- The Make contract reference now matches the live payload shape, including `stt_provider` and `audio_duration_sec`.

### Known Risks
- Playwright/local E2E continues to use isolated local mock webhook endpoints on purpose; those test-only URLs are not production webhook addresses and should remain untouched unless the harness strategy changes.

### Manual QA / Verification
- Search audit confirmed the real outbound business webhook path is `src/server/reliability/WebhookClient.ts`
- Search audit confirmed the browser submit path remains same-origin `src/features/voice-capture/services/submit-voice-capture.ts`
- Search audit confirmed the standalone WSS server still submits internally to `/api/voice/submit`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm build`
- Verified `GET https://voxera-voice-live.vercel.app/capture -> 200`
- Verified `POST https://voxera-voice-live.vercel.app/api/voice/submit -> {"ok":true,"acceptedForRetry":false,"stt_provider":"whisper","audio_duration_sec":1,"circuitState":"CLOSED"}`
- Verified Vercel production was redeployed after rotating `MAKE_WEBHOOK_URL`

### Next Sprint Prerequisites
- Keep Vercel and any nonlocal deployment targets aligned with the same VOXERA Make webhook endpoint when rotating secrets or promoting environments.
```

---

## 2026-03-17 - V3 Local Infra Bootstrap + Stripe Payment Core

### Files Changed
- `docker-compose.yml`
- `.env.local.example`
- `package.json`
- `db/migrations/0001_v3_core.sql`
- `scripts/db/run-migrations.mjs`
- `src/server/config/v3-env.ts`
- `src/server/db/v3-pg.ts`
- `src/shared/contracts/stripe-webhook.ts`
- `src/server/payments/stripe-signature.ts`
- `src/server/payments/payment-core.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `tests/e2e/stripe-payment-core.spec.ts`
- `docs/sprint-summary.md`

### Architecture Changes
- Added a local zero-cost V3 bootstrap path with Docker Compose definitions for PostgreSQL 16 and Redis 7 using `volatile-lru` for cache eviction.
- Added a SQL migration runner and initial V3 core schema for `users`, `payment_log`, `voice_processing_log`, and `stripe_events`.
- Hotfixed the initial V3 schema to remove `stt_text` from `voice_processing_log` and keep voice-processing persistence metadata-only via `s3_key`.
- Reworked `stripe_events` to store payment-processing metadata only instead of webhook payload blobs.
- Added a Node runtime Stripe webhook route at `/api/webhooks/stripe` with raw-body HMAC signature verification, live-mode rejection outside production, supported-event filtering, and Zod contract validation.
- Added a PostgreSQL payment core that uses `SERIALIZABLE` plus `SELECT ... FOR UPDATE` on `stripe_events`, `payment_log`, and `users` to block duplicate event replay and race conditions.

### Known Risks
- Docker is not installed in the current Codex environment, so the local Postgres/Redis containers could not be started and `db:migrate` runtime verification remains blocked by `ECONNREFUSED`.
- The V3 migration now stores only metadata for voice processing and Stripe events, but the rest of the application has not yet been wired to write into these tables.
- `QUEUE_PROVIDER=local` is scaffolding only; SQS/LocalStack switching logic has not been implemented yet.

### Manual QA / Verification
- `corepack pnpm install`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm build`
- `node --check scripts/db/run-migrations.mjs`
- Attempted `corepack pnpm db:migrate` and confirmed the current environment lacks Docker/Postgres, resulting in `ECONNREFUSED`

### Next Sprint Prerequisites
- Install Docker locally and verify `corepack pnpm docker:v3:up` plus `corepack pnpm db:migrate`.
- Implement `/api/payment/checkout`, user credit lookup, and payment-side database writes against the new V3 schema.
- Add queue provider abstraction for local development versus future AWS SQS production wiring without changing payment semantics.

---

## 2026-03-17 - V3 Checkout, Queue, and Redis Cache

### Files Changed
- `.env.local.example`
- `package.json`
- `src/server/config/v3-env.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/shared/contracts/payment-checkout.ts`
- `src/shared/contracts/v3-user-credits.ts`
- `src/shared/contracts/v3-voice-job.ts`
- `src/server/payments/stripe-checkout.ts`
- `src/server/cache/v3-redis.ts`
- `src/server/cache/credit-cache.ts`
- `src/server/cache/stt-dedupe-cache.ts`
- `src/server/queue/v3/types.ts`
- `src/server/queue/v3/local-voice-job-queue.ts`
- `src/server/queue/v3/sqs-voice-job-queue.ts`
- `src/server/queue/v3/index.ts`
- `src/server/voice/voice-processing-core.ts`
- `src/app/api/payment/checkout/route.ts`
- `src/app/api/user/credits/route.ts`
- `src/app/api/voice/process/route.ts`
- `tests/e2e/v3-checkout-queue-cache.spec.ts`
- `docs/sprint-summary.md`

### Architecture Changes
- Added `/api/payment/checkout` as a Node runtime Stripe Checkout Session endpoint that refuses non-`sk_test_` secret keys and generates test-mode credit purchases only.
- Added a Redis-backed cache layer for user credit lookups plus STT duplicate request reservation, with TTL-only keys that align with the local `volatile-lru` eviction policy.
- Added `/api/user/credits` to read credits via cache-first lookup and `/api/voice/process` to persist metadata-only voice jobs and enqueue them without storing transcript payloads.
- Added a queue provider abstraction that defaults to an in-memory local queue for zero-cost development and can switch to an AWS SQS Standard scaffold when `QUEUE_PROVIDER=sqs`.
- Synced Stripe webhook processing with the credit cache so successful payment events immediately refresh cached credit totals after the pessimistic-locking transaction completes.

### Known Risks
- Docker is still unavailable in the current Codex environment, so the new Postgres/Redis-backed routes were validated only through static checks and mocked tests, not with live local containers.
- The local queue provider is intentionally in-memory only; it will reset on process restart until LocalStack or real SQS is wired during a later step.
- `/api/payment/checkout` is implemented server-side but not yet connected to a production billing screen in the front-end.
- `QUEUE_PROVIDER=sqs` is scaffolding only; no real AWS queue was called or runtime-tested in this zero-cost step.

### Manual QA / Verification
- `corepack pnpm install`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm build`
- With Docker available: `corepack pnpm docker:v3:up`
- With Docker available: `corepack pnpm db:migrate`
- POST a test body to `/api/payment/checkout` and confirm the response contains a Stripe test checkout URL
- GET `/api/user/credits?userId=<id>` twice and confirm the second response reports `source: "cache"`
- POST `/api/voice/process` twice with the same `clientRequestId` and confirm the second response returns `deduplicated: true`

### Next Sprint Prerequisites
- Wire the checkout endpoint into an actual billing UI and success/cancel flow.
- Replace the local in-memory queue with LocalStack-backed integration testing before any AWS promotion.
- Add worker-side dequeue/ack processing that consumes `voice_processing_log` jobs and updates status transitions beyond `queued`.

---

## 2026-03-17 - V3 Checkout UI and Local Dequeue Worker

### Files Changed
- `.env.local.example`
- `package.json`
- `src/features/marketing/components/marketing-landing.tsx`
- `src/features/billing/services/billing-client.ts`
- `src/features/billing/components/billing-checkout-panel.tsx`
- `src/app/(marketing)/billing/page.tsx`
- `src/app/(marketing)/billing/success/page.tsx`
- `src/app/(marketing)/billing/cancel/page.tsx`
- `src/app/api/voice/process/route.ts`
- `src/server/voice/mock-payload-store.ts`
- `src/server/voice/mock-stt-processor.ts`
- `src/server/voice/local-dequeue-worker.ts`
- `tests/e2e/helpers/v3-memory-store.ts`
- `tests/e2e/v3-ui-worker.spec.ts`
- `docs/sprint-summary.md`

### Architecture Changes
- Added a dedicated `/billing` sandbox UI that calls `/api/payment/checkout`, validates `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` against `pk_test_`, and redirects into Stripe Hosted Checkout in test mode only.
- Added `/billing/success` and `/billing/cancel` return pages so the new checkout flow has explicit completion and rollback landing states.
- Added a local dequeue worker that consumes the in-memory V3 queue in-process, updates `voice_processing_log` from `queued -> processing -> completed`, and uses a 3-second mock STT processor instead of real Whisper or n8n.
- Added a staged in-memory mock payload store so local queue jobs can simulate temporary audio objects, then drop them immediately after processing to preserve the zero-retention rule in local development.
- Updated `/api/voice/process` to stage mock payloads, enqueue metadata-only jobs, auto-start the local worker for `QUEUE_PROVIDER=local`, and purge staged payloads immediately on dedupe or enqueue failure.

### Known Risks
- The billing UI is wired to Stripe Hosted Checkout test mode, but it is not yet connected to authenticated user context; the sandbox still relies on manually entered `userId`.
- The local dequeue worker only runs inside the same Next.js process, so it will not simulate multi-process worker behavior until LocalStack/SQS-based worker integration is added.
- The mock STT worker intentionally discards the generated transcript after processing to honor zero retention, so no transcript artifact is persisted for post-run inspection.
- Docker remains unavailable in the current Codex environment, so the worker and billing APIs were validated with mocked stores and static builds rather than live Postgres/Redis containers.

### Manual QA / Verification
- `corepack pnpm install`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm build`
- Open `/billing`, enter a valid numeric `userId`, verify the balance card loads, and tap `Stripe 테스트 결제`
- Confirm an invalid or missing `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` disables the checkout CTA with a visible error state
- With Docker available, POST to `/api/voice/process` and confirm the worker advances the job to `completed` while the staged mock payload disappears from local memory after processing

### Next Sprint Prerequisites
- Replace the manual `userId` sandbox field with authenticated account context and a real billing entry point.
- Promote the local dequeue worker to a LocalStack-backed worker process so queue semantics match future SQS deployment more closely.
- Connect the worker result path to downstream V3 orchestration without ever persisting transcripts or raw payloads.

---

## 2026-03-17 - V3 E2E Lifecycle, Credit Deduction, and Destination Routing

### Files Changed
- `.env.local.example`
- `docs/sprint-summary.md`
- `src/app/api/user/credits/route.ts`
- `src/app/api/voice/process/route.ts`
- `src/features/voice-capture/services/submit-voice-capture.ts`
- `src/features/voice-capture/services/v3-voice-process.ts`
- `src/server/cache/memory-cache-store.ts`
- `src/server/cache/v3-redis.ts`
- `src/server/db/v3-local-state.ts`
- `src/server/db/v3-runtime.ts`
- `src/server/voice/destination-webhook.ts`
- `src/server/voice/local-dequeue-worker.ts`
- `src/server/voice/mock-payload-store.ts`
- `src/server/voice/mock-stt-processor.ts`
- `src/server/voice/voice-credit-core.ts`
- `src/server/voice/voice-processing-core.ts`
- `src/shared/contracts/v3-voice-job.ts`
- `tests/e2e/v3-ui-worker.spec.ts`
- `tests/e2e/voice-capture-flow.spec.ts`
- `tests/e2e/voice-credit-core.spec.ts`
- `tests/e2e/voice-cutoff-ui.spec.ts`
- `tests/e2e/voice-runtime-live.spec.ts`
- `tests/playwright.config.ts`

### Architecture Changes
- Repointed the existing Voice Capture submit path to `/api/voice/process`, so the unchanged `AudioWorklet + PCM over WSS` client now enqueues a V3 voice job without weakening the 15-second reducer cutoff or `clientRequestId` duplicate lock.
- Added a memory-runtime branch for local V3 development that mirrors the future Postgres/Redis credit and queue lifecycle closely enough for zero-cost static and E2E validation.
- Added worker-side credit deduction using the same pessimistic locking contract as payments: SQL runtime uses `SERIALIZABLE` plus `SELECT ... FOR UPDATE`, while the local memory runtime uses a per-user serialized lock to preserve the same one-writer semantics during tests.
- Added destination webhook routing right before zero-retention cleanup. The worker now POSTs the final transcript payload to `DESTINATION_WEBHOOK_URL` with `X-Webhook-Timestamp`, `X-Webhook-Signature`, and `X-Idempotency-Key`, then drops the staged payload from memory immediately after the send attempt regardless of success or failure.
- Tightened the success-screen lifecycle E2E to measure the 2-second completion dwell from the moment the success UI is actually visible, matching the UI contract instead of overcounting pre-success upload latency.

### Known Risks
- Docker is still unavailable in the current Codex environment, so the V3 local runtime continued to use `memory://` stores for queues, Redis, and Postgres semantics. Static validation and browser E2E passed, but live container-backed verification still needs to happen on the representative local machine.
- The local dequeue worker still runs in-process with Next.js and is not yet a separate worker executable, so multi-process failure semantics are not represented until the LocalStack/SQS phase lands.
- `DESTINATION_WEBHOOK_SECRET` currently falls back to `MAKE_WEBHOOK_SECRET` if the dedicated destination secret is unset. That preserves existing test infrastructure, but production should set a dedicated destination secret explicitly.

### Manual QA / Verification
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `corepack pnpm build`
- Open `/capture?userId=<id>` and verify a normal capture session still follows `idle -> recording -> stopping -> uploading -> success -> idle`
- Confirm the Step 2 transcript still scrolls on touch devices and that a duplicate send click cannot enqueue a second V3 job
- With Docker available, seed a user credit balance, POST to `/api/voice/process`, and verify the corresponding `voice_processing_log` row transitions through `queued -> processing -> charged -> completed`
- Point `DESTINATION_WEBHOOK_URL` at a local inspection endpoint and confirm the routed payload includes `clientRequestId`, `transcriptText`, `sessionId`, `pcmFrameCount`, `stt_provider`, `audio_duration_sec`, `createdAt`, and the webhook signature/idempotency headers before the staged payload disappears from memory

### Next Sprint Prerequisites
- Replace the in-process local worker with a standalone LocalStack/SQS dequeue worker that preserves the same zero-retention cleanup contract.
- Promote the memory-runtime fallback paths to real Postgres/Redis validation on a Docker-enabled machine before wiring AWS-backed environments.
- Connect the destination webhook path to the final V3 orchestration target and add observability around `charged`, `completed`, `webhook_failed`, and `insufficient_credits` transitions without ever persisting transcript payloads.

---

## 2026-03-22 - V4 Parallel Architecture Slices (Infra, Realtime, Memory)

### Files Changed
- `.env.local.example`
- `eslint.config.mjs`
- `package.json`
- `tsconfig.json`
- `db/migrations/0002_v4_infra.sql`
- `src/server/config/v4-env.ts`
- `src/server/config/v4-memory-env.ts`
- `src/shared/contracts/v4-infra.ts`
- `src/shared/contracts/v4-realtime.ts`
- `src/shared/contracts/v4-memory.ts`
- `src/server/v4/concurrency.ts`
- `src/server/v4/idempotency-store.ts`
- `src/server/v4/neon-http.ts`
- `src/server/v4/notion-direct-write.ts`
- `src/server/v4/sqs-lambda-worker.ts`
- `src/server/v4/realtime/mongo-outbox.ts`
- `src/server/v4/realtime/redis-streams-resume.ts`
- `src/server/v4/realtime/resume-token.ts`
- `src/server/v4/realtime/session-resume-service.ts`
- `src/server/v4/memory/memory-store.ts`
- `src/server/v4/memory/structured-output.ts`
- `src/server/memory/v4-memory-extractor.ts`
- `src/server/memory/v4-memory-service.ts`
- `src/server/memory/v4-memory-store.ts`
- `src/app/api/memory/extract/route.ts`
- `src/app/api/memory/route.ts`
- `src/app/api/v4/memory/delete/route.ts`
- `src/app/api/v4/realtime/resume/route.ts`
- `tests/e2e/v4-infra.spec.ts`
- `tests/e2e/v4-realtime.spec.ts`
- `tests/e2e/v4-memory.spec.ts`
- `docs/sprint-summary.md`

### Architecture Changes
- Added a V4 infra slice that models SQS Lambda batch handling with maximum concurrency limits, hard-locks idempotency TTL to exactly 72 hours, uses Neon HTTP one-shot query execution with pooling disabled, and generates Notion direct-write payloads without persisting transcript payloads.
- Added a V4 realtime slice with `resume_token` plus `last_seq` replay semantics, Redis Streams-style append/resume behavior, and a Mongo-style one-way outbox that now exports an explicit 24-hour TTL index definition alongside its in-memory adapter.
- Added a V4 memory slice that forces OpenAI Structured Outputs through a strict JSON schema, hard-locks short-term memory to 14 days and preference memory to 90 days, exports physical Mongo TTL index definitions, and exposes a GDPR delete endpoint that hard-deletes a user memory set.
- Kept the existing front-end constitution intact: `AudioWorklet + PCM over WSS` remains the only audio engine, the exact 15-second cutoff stays reducer-driven, `clientRequestId` duplicate locking remains synchronous, and the 8-state reducer was not restructured.
- Replaced the placeholder `docs/V4_CONSTITUTION.md` scaffold with an actual written V4 constitution so the physical TTL, direct-write, zero-retention, and queue rules are documented in-repo.
- Tightened repo-level verification boundaries so imported external UI experiments under `_IMPORTED_UI` do not poison repository lint/typecheck gates during V4 backend work.

### Known Risks
- The V4 infra, realtime, and memory slices are validated with in-memory/local-safe abstractions in this Codex environment. Real Neon, Redis Streams, Mongo TTL indexes, and OpenAI runtime behavior still need infrastructure-level verification on a machine with Docker and the intended backing services.
- The repo now contains both richer `src/server/memory/*` services and the focused `src/server/v4/memory/*` primitives used by the strict V4 tests. They are consistent today, but future changes should avoid drifting the two memory surfaces apart.
- Untracked reference folders such as `_IMPORTED_UI/` remain in the workspace; they are intentionally excluded from validation but should not be treated as production source.

### Manual QA / Verification
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e`
- `NEXT_PUBLIC_WSS_URL=ws://localhost:8787/voice-session NEXT_PUBLIC_APP_ENV=local MAKE_WEBHOOK_URL=http://127.0.0.1:8788/webhook MAKE_WEBHOOK_SECRET=voxera-local-secret corepack pnpm build`
- With Docker and service stubs available, validate that a V4 infra worker batch writes only metadata to Notion, a realtime resume request replays only events after `last_seq`, and a memory delete request removes all records for the target user immediately.

### Next Sprint Prerequisites
- Replace the in-memory V4 infra/realtime adapters with LocalStack/Redis/Mongo-backed runtime verification while keeping the same contracts and zero-cost development posture.
- Collapse or clearly separate the duplicated V4 memory service layers so the strict structured-output path and the route-layer memory service cannot drift.
- Promote the physical TTL/index definitions into real deployment migrations or collection bootstrap scripts on the Docker-enabled machine so runtime storage matches the now-coded contract.

