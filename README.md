# Voxera Front-End Foundation

Initial mobile-first front-end scaffold for **Voxera (Listen-Think-Act)** using:

- Next.js (App Router only)
- TypeScript (strict)
- Tailwind CSS
- shadcn/ui-style component setup
- pnpm

## Architecture

- `src/app/(marketing)` route group for landing and product framing.
- `src/app/(voice)` route group for voice-capture app surfaces.
- Feature-based organization under `src/features/*`.
- Shared UI primitives under `src/components/ui/*`.
- Typed backend contract placeholders under `src/shared/contracts/*`.
- Typed environment validation under `src/shared/config/*`.

## Typed Placeholder Contracts

Backend API and transport contracts are currently unknown and intentionally not invented.

- Placeholder contract type: `src/shared/contracts/voice.ts`
- Placeholder UI state wiring: `src/features/voice-capture/types/voice-types.ts`

These files are ready to replace with real AudioWorklet + WSS contracts in later sprints.

## Environment Variables (Required)

Copy `.env.local.example` to `.env.local` and set values:

- `NEXT_PUBLIC_APP_ENV` = `local | development | staging | production`
- `NEXT_PUBLIC_WSS_URL`
- `MAKE_WEBHOOK_URL`
- `MAKE_WEBHOOK_SECRET`

Validation is fail-fast at app startup/build.

## Local HTTPS Development

Voxera should be tested in HTTPS mode for mobile audio behavior parity.

1. Create `.env.local` from `.env.local.example`.
2. Start secure local dev:

```bash
pnpm dev:https
```

This uses Next.js experimental HTTPS for local secure-context testing.

## Security Headers Strategy

Configured in `next.config.ts`:

- `Content-Security-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy: camera=(), geolocation=(), microphone=(self), payment=()`

CSP `connect-src` is generated from validated env values and restricted to:

- `'self'`
- configured `NEXT_PUBLIC_WSS_URL` origin
- configured `MAKE_WEBHOOK_URL` origin

## HTTPS + WSS Architecture Note

See: `docs/security-architecture.md`

Summary:

- Secure context assumptions are mandatory for stable microphone + AudioWorklet-related behavior on mobile.
- Non-local environments reject insecure `ws://`.
- Local insecure transport exception is explicitly scoped to loopback hosts only.

## Setup

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

For secure local testing, use `pnpm dev:https`.

## Scripts

```bash
pnpm dev
pnpm dev:https
pnpm build
pnpm lint
pnpm typecheck
pnpm start
```

## Notes

- No Pages Router is used.
- No Redux is used.
- No `MediaRecorder` usage is included.
- Audio business logic is intentionally deferred.
