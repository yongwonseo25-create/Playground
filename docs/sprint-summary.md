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
- Status: architecture fixed, implementation not yet started in code
- Audio input approach: AudioWorklet + PCM only
- Audio transport approach: secure WSS only
- Audio cleanup strategy: planned, not yet implemented
- Secure context requirement: mandatory

### Transport
- Status: env and secure transport policy prepared
- WSS endpoint strategy: env-driven
- Webhook adapter strategy: planned for Sprint 2
- Env validation status: implemented for secure endpoint handling

### Submission / Cost Defense
- Status: UI-integrated placeholder flow active, live transport integration pending
- 15-second cutoff status: reducer timer remains the source of truth and auto-stops at the hard limit
- `clientRequestId` lock status: generated synchronously before placeholder upload begins
- Duplicate prevention strategy: upload button disables during `uploading`, reducer lock preserved for real transport wiring

### Mobile UX
- Status: premium 3-step capture flow complete with restored Step 1 neon trace waveform
- One-handed usage support: yes
- Safe-area support: baseline implemented
- Accessibility status: touch targets, labels, and Playwright test ids applied
- Error messaging status: inline Step 2 retry/cancel feedback available

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

## Current Known Risks (Rolling Section)

- AudioWorklet runtime path is not yet implemented
- WSS runtime path is not yet implemented
- backend / Make.com integration not yet tested end-to-end
- duplicate lock must be verified again once webhook upload is added
- timeout and upload flow must be verified together once live network flow exists
- current premium UI is validated against placeholder upload timing, not live backend latency

---

## Current Manual Regression Checklist

- [x] No MediaRecorder exists anywhere in the codebase
- [x] No blob/timeslice recording exists
- [x] Audio architecture remains AudioWorklet + PCM over WSS only
- [ ] Recording cannot exceed 15 seconds in runtime flow
- [ ] Submission locks before async upload in live flow
- [ ] Duplicate `clientRequestId` upload is blocked in live flow
- [x] 8-state reducer architecture remains intact
- [x] No insecure `ws://` remains in production code paths
- [x] No permission popup infinite loop exists in current shell logic
- [x] UI supports one-handed mobile use
- [x] Step 1 -> Step 2 -> Step 3 -> Step 1 loop is Playwright-verified

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

