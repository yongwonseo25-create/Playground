# Voxera Sprint Summary

## Constitutional Guardrails (Locked)

- `MediaRecorder` and blob/timeslice recording are forbidden.
- Audio architecture is `AudioWorklet + PCM over WSS` only.
- Fixed reducer states must remain exactly:
  - `idle`
  - `permission-requesting`
  - `ready`
  - `recording`
  - `stopping`
  - `uploading`
  - `success`
  - `error`
- Every recording session stops exactly at 15 seconds.
- Every submission must lock with `clientRequestId` before async upload.

## Sprint 1: Foundation + Secure Voice State Machine

### Delivered

- Next.js App Router feature-based structure (`(marketing)` + `(voice)` route groups).
- Strict TypeScript + Tailwind + shadcn-style UI primitives.
- Secure typed env validation for:
  - `NEXT_PUBLIC_WSS_URL`
  - `NEXT_PUBLIC_WEBHOOK_URL`
  - `NEXT_PUBLIC_APP_ENV`
- Security headers strategy in `next.config.ts` with dynamic CSP `connect-src`.
- Voice reducer/machine foundation with fixed 8 states.
- 15-second exact recording cutoff enforced via timed auto-stop path.
- Submission lock (`clientRequestId`) enforced before async upload placeholder.
- Mobile-first voice shell UI wired to reducer-machine state.

## Current Architecture Snapshot

- Routing:
  - `src/app/(marketing)` for landing and project framing.
  - `src/app/(voice)/capture` for mobile voice flow shell.
- Security:
  - Startup fail-fast env parser in `src/shared/config/env-core.ts`.
  - Server env helper: `src/shared/config/env.ts`.
  - Client env helper: `src/shared/config/env.client.ts`.
  - CSP, Referrer-Policy, X-Content-Type-Options, Permissions-Policy in `next.config.ts`.
- Voice state machine:
  - Types/constraints in `src/features/voice-capture/types/voice-types.ts`.
  - Reducer in `src/features/voice-capture/state/voice-capture-reducer.ts`.
  - Hook/timer orchestration in `src/features/voice-capture/state/use-voice-capture-machine.ts`.
  - Upload contract placeholder in `src/features/voice-capture/services/upload-placeholder.ts`.
- UI:
  - State-driven mobile shell in `src/features/voice-capture/components/voice-capture-screen.tsx`.

## Changed Files (Sprint 1)

- `.env.local.example`
- `.gitignore`
- `README.md`
- `next.config.ts`
- `package.json`
- `src/features/voice-capture/components/voice-capture-screen.tsx`
- `src/features/voice-capture/services/upload-placeholder.ts`
- `src/features/voice-capture/state/use-voice-capture-machine.ts`
- `src/features/voice-capture/state/voice-capture-reducer.ts`
- `src/features/voice-capture/types/voice-types.ts`
- `src/shared/config/env-core.ts`
- `src/shared/config/env.ts`
- `src/shared/config/env.client.ts`
- `docs/security-architecture.md`

## Known Risks

- AudioWorklet processor and PCM frame transport are architectural placeholders; real-time stream reliability is not yet validated.
- Upload path currently uses placeholder async service; backend contract and retry semantics are still undefined.
- CSP may need nonce/hash hardening when moving from current scaffold to production deployment.

## Manual QA Checklist

- [ ] App fails fast when any required env variable is missing.
- [ ] App fails fast in non-local env when `NEXT_PUBLIC_WSS_URL` uses `ws://`.
- [ ] Local env allows loopback `ws://` and `http://` only.
- [ ] `/capture` state flow reaches only fixed reducer states (no extras).
- [ ] Recording auto-transitions at exactly 15 seconds from `recording` to `stopping`.
- [ ] Submit is only possible after `stopping`; `clientRequestId` is assigned before upload starts.
- [ ] Security headers are present on app responses.

## Next Sprint Prerequisites

- Finalize backend WSS event contract (message schema, auth, reconnect policy).
- Define AudioWorklet PCM packet shape and buffering policy.
- Establish server acknowledgment/error model for locked submissions.
- Add reducer tests for transition invariants and timer boundary conditions.
- Add observability for dropped frames, timeout, and upload failure analytics.
