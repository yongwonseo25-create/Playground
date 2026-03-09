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

## Typed Placeholder Contracts

Backend API and transport contracts are currently unknown and intentionally not invented.

- Placeholder contract type: `src/shared/contracts/voice.ts`
- Placeholder UI state wiring: `src/features/voice-capture/types/voice-types.ts`

These files are ready to replace with real AudioWorklet + WSS contracts in later sprints.

## Setup

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Scripts

```bash
pnpm dev
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
