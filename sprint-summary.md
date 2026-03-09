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
- Status: not started / in progress / stable
- Current routing approach:
- Current feature folder approach:
- Current UI shell status:

### Voice State Machine
- Status:
- Source of truth file(s):
- Current states:
- Current selectors:
- Current known guard rules:

### Audio Engine
- Status:
- Audio input approach:
- Audio transport approach:
- Audio cleanup strategy:
- Secure context requirement:

### Transport
- Status:
- WSS endpoint strategy:
- Webhook adapter strategy:
- Env validation status:

### Submission / Cost Defense
- Status:
- 15-second cutoff status:
- `clientRequestId` lock status:
- Duplicate prevention strategy:

### Mobile UX
- Status:
- One-handed usage support:
- Safe-area support:
- Accessibility status:
- Error messaging status:

---

## Sprint Log

---

### Sprint 0 — Project Rules / Custom Skills
- Date:
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

#### Risks
- None yet / pending first implementation

#### Manual QA
- Confirm `SKILL.md` exists
- Confirm `.cursorrules` exists
- Confirm `docs/sprint-summary.md` exists
- Confirm all files are saved at repo root/docs correctly

#### Next Sprint Prerequisites
- Initialize Next.js app foundation
- Create secure env strategy
- Create state machine foundation
- Create initial mobile voice shell

---

### Sprint 1 — Project Framework and Secure Environment
- Date:
- Status: not started

#### Goal
Build the project foundation, secure environment rules, initial state machine, and voice UI shell.

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
- AudioWorklet engine
- WSS transport
- useVoiceAgent integration
- mobile lifecycle hardening

---

### Sprint 2 — AudioWorklet + WSS Audio Engine
- Date:
- Status: not started

#### Goal
Build the real-time microphone pipeline using AudioWorklet + PCM over WSS.

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
- 15-second timer
- duplicate lock
- webhook adapter
- full voice flow integration

---

### Sprint 3 — Cost Defense and Submission Integrity
- Date:
- Status: not started

#### Goal
Implement the 15-second cutoff, duplicate locking, and Make.com webhook integration.

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
- polished mobile UI
- accessibility pass
- production finalization

---

### Sprint 4 — Mobile-Optimized Voice UX
- Date:
- Status: not started

#### Goal
Polish the mobile-first UI/UX and finalize production readiness.

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
- production QA
- launch checklist
- regression verification

---

## Current Known Risks (Rolling Section)

- None yet

---

## Current Manual Regression Checklist

- [ ] No MediaRecorder exists anywhere in the codebase
- [ ] No blob/timeslice recording exists
- [ ] Audio uses AudioWorklet + PCM over WSS only
- [ ] Recording cannot exceed 15 seconds
- [ ] Submission locks before async upload
- [ ] Duplicate `clientRequestId` upload is blocked
- [ ] 8-state reducer architecture remains intact
- [ ] No insecure `ws://` remains in production code paths
- [ ] No permission popup infinite loop exists
- [ ] UI still supports one-handed mobile use

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

