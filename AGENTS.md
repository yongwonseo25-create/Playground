```md
# Voxera Front-End Constitution

## Scope
This file applies to all work in this repository.
Read this file before doing any work.

## Project Identity
- Project: Voxera (Listen-Think-Act)
- Product type: B2B voice execution agent
- Front-end stack: Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Core mode: mobile-first, voice-first, state-driven

## Non-Negotiable Rules

### 1. Audio Engine Rule
- Never use MediaRecorder.
- Never use blob/timeslice recording.
- Audio must use AudioWorklet + PCM over WSS only.
- Do not introduce fallback-to-MediaRecorder patches for “temporary testing”.

### 2. Cost Defense Rule
- Every recording session must stop at exactly 15 seconds.
- The reducer/state machine + timer logic is the source of truth.
- CSS animation, progress ring animation, or visual timer must never be the business truth.

### 3. Duplicate Lock Rule
- Every upload must create a clientRequestId before async submission starts.
- Submission must be synchronously locked before any async upload.
- Duplicate click, duplicate tap, duplicate stop, duplicate upload, and duplicate billing must be prevented.

### 4. Fixed State Machine Rule
The following 8 states are fixed and must not be arbitrarily restructured:
- idle
- permission-requesting
- ready
- recording
- stopping
- uploading
- success
- error

Do not:
- merge or rename these states casually
- replace reducer truth with scattered booleans
- bypass reducer logic with UI-only flags

## Security Rules
- Production code must not allow insecure ws:// paths.
- Use WSS for transport.
- Request microphone permission only on explicit user interaction.
- Never request microphone permission on mount.
- Prevent infinite microphone permission popup loops.
- Keep secrets out of client code.

## UI Rules
- Reuse existing design-system components first.
- Reuse existing tokens first.
- Do not invent arbitrary Tailwind values unless no token exists and you explain why.
- Keep large touch targets and one-handed mobile operation.
- Do not move business logic into presentational components.

## Testing Rules
Before finishing any meaningful task, run:
- pnpm typecheck
- pnpm lint
- pnpm test

If a task changes env validation, security headers, routing, or submission flow, also run:
- pnpm test:e2e

## Sprint Memory Rule
Before starting a sprint or major task:
1. Read docs/sprint-summary.md
2. Restate the current architecture briefly
3. Confirm the three hard rules:
   - AudioWorklet + PCM over WSS only
   - exact 15-second cutoff
   - clientRequestId duplicate lock
4. Confirm the 8-state reducer remains intact

After finishing a sprint:
1. Update docs/sprint-summary.md
2. Record changed files
3. Record architecture changes
4. Record known risks
5. Record manual QA steps
6. Record next sprint prerequisites

## Required Output After Every Task
Return:
1. files created or modified
2. commands to run
3. manual QA steps
4. known risks
5. whether docs/sprint-summary.md was updated

## Refusal Conditions
Push back if a request would:
- reintroduce MediaRecorder
- weaken the 15-second cutoff
- weaken duplicate locking
- arbitrarily restructure the 8-state reducer
- introduce insecure production transport
- move business truth into fragile UI-only behavior

If a request conflicts with these rules:
- do not comply silently
- explain the conflict
- propose a compliant alternative
```

---