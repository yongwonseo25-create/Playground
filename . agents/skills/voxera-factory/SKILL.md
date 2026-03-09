````md
---
name: voxera-factory
description: Use when building or modifying Voxera front-end UI components, typed adapters, fetch modules, validation layers, route handlers, or integration code that must follow strict TypeScript contracts, zod validation, normalized error formatting, minimal file changes, and Voxera architectural guardrails.
---

# Voxera Factory Skill

## Mission
Generate production-ready Voxera code with:
- strict TypeScript
- zod validation
- normalized error formatting
- deterministic contracts
- minimal safe file changes
- reusable UI primitives
- test skeletons

## Always do this first
1. Read AGENTS.md
2. Read docs/sprint-summary.md
3. Inspect existing local patterns before creating anything new
4. Reuse existing components, hooks, utilities, tokens, and adapters first
5. Lock contracts before implementation

## Constitutional Rules
You must preserve:
- AudioWorklet + PCM over WSS only
- exact 15-second cutoff
- clientRequestId lock before async upload
- fixed 8-state reducer architecture

You must never:
- use MediaRecorder
- use blob/timeslice recording
- weaken secure transport rules
- weaken duplicate submission rules
- bypass reducer truth with UI-only state

## Factory Output Protocol
For every task, return:
1. file plan
2. types/contracts
3. zod schemas
4. implementation
5. normalized error formatting
6. test skeleton
7. commands to run
8. manual QA steps
9. known risks

## UI Factory Rules
When building UI:
- reuse local design-system components first
- reuse local tokens first
- preserve semantic HTML
- preserve accessibility defaults
- keep props minimal
- do not invent arbitrary Tailwind values unless no token exists and you explicitly justify each one
- keep business logic out of presentational components

## API / Adapter Factory Rules
When building transport or adapter code:
- define request/response types first
- define zod schemas for external payloads
- normalize transport errors with one formatter
- support timeout and typed failure cases
- keep secrets out of the client
- keep UI concerns out of transport code

## Standard Error Shape
Use this shape unless the repo already has a stricter equivalent:

```ts
export type AppError = {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};
````

## Zod Rules

Every externally shaped payload must have:

* input schema
* output schema where practical
* parse-safe path or explicit parse failure handling

## Test Skeleton Minimum

Always create:

* one happy-path test
* one validation failure test
* one edge-case test
* one error-format expectation

## Minimal Change Discipline

Do not rewrite stable architecture-owned files unless:

* there is a clear defect
* a sprint explicitly requires it
* the existing file violates a hard rule

Prefer:

* additive change
* surgical refactor
* selector extension
* helper extraction

## Completion Checklist

Before finishing:

* types are defined
* zod schemas exist
* error formatting exists
* tests are scaffolded
* AGENTS.md rules remain intact
* docs/sprint-summary.md is updated if the sprint boundary changed

````

---