---

# 1) 스킬 #1 — `voxera-component-generator` (React/Next 컴포넌트 생성)

## 1-A) 파일 트리 (그대로 복사해서 사용)
```text
.codex/skills/voxera-component-generator/
  SKILL.md
  agents/
    openai.yaml
  assets/
    Component.tsx.tpl
    Component.test.tsx.tpl
    index.ts.tpl
  references/
    voxera-component-conventions.md
```

---

## 1-B) `agents/openai.yaml`
자동 오발동을 막기 위해 **암시적 호출 비활성화**(필요할 때만 `$voxera-component-generator`로 호출)로 설정했습니다. (`allow_implicit_invocation` 옵션은 공식 문서 예시에 존재) [Source](https://developers.openai.com/codex/skills/)

```yaml
interface:
  display_name: "Voxera Component Generator"
  short_description: "Create a React/Next component + tests + exports using Voxera conventions."
  default_prompt: "Use this skill to generate a new UI component in the correct folder with tests and barrel exports."

policy:
  allow_implicit_invocation: false
```

---

## 1-C) `SKILL.md` (스킬 본체)
아래는 “Voxera 구조를 자동 탐지”하도록 설계했습니다(예: `apps/web/src/components`가 있으면 그쪽을 우선). 스킬은 `name`/`description`이 필수입니다. [Source](https://developers.openai.com/codex/skills/)

```md
---
name: voxera-component-generator
description: Use when you need to add a new React/Next.js UI component to Voxera with correct folder placement, exports, and tests. Do NOT use for API routes or backend-only changes.
---

## Goal
Generate a new UI component following Voxera conventions:
- Correct location (auto-detect)
- Type-safe props
- Minimal API surface
- Add barrel export
- Add tests (aligned to repo's existing test stack)

## Inputs (ask if missing)
- ComponentName (PascalCase), e.g. `CallStatusBadge`
- Component purpose (1 sentence)
- Where it will be used (page/feature), e.g. `apps/web/app/(dashboard)/calls/page.tsx`
- Variant needs (optional), e.g. `size: sm|md|lg`, `state: idle|listening|thinking|acting`

## Output files (minimum)
1) Component file
2) Test file
3) Barrel export update (index.ts)

## Repository structure detection (DO THIS FIRST)
1) Identify web app root:
   - Prefer `apps/web/` if exists.
   - Else use repo root as web root.
2) Identify components directory:
   - Prefer `{webRoot}/src/components/`
   - Else `{webRoot}/components/`
   - Else create `{webRoot}/src/components/` (only if repo clearly uses src/)
3) Identify test runner by reading package.json:
   - If `vitest` present -> vitest + @testing-library/react
   - If `jest` present -> jest + @testing-library/react
   - If neither -> create minimal test skeleton but DO NOT add dependencies without asking.

## Constraints
- Only touch UI-related files and exports.
- Do not add new dependencies unless explicitly approved.
- Avoid heavy abstractions. Keep component single-purpose.
- No secrets/PII in logs or mock data.

## Implementation steps
1) Create the component:
   - Default: named export (`export function ComponentName(...)`)
   - Use typed props; keep defaults explicit.
2) Add barrel export:
   - If a nearby `index.ts` exists (components root), add `export * from "./ComponentName"`.
   - If the project uses per-folder index files, follow existing pattern.
3) Add tests:
   - Cover: renders, main state/variant, and one edge case (e.g. unknown state fallback).
   - Use existing test utilities if present (e.g. `renderWithProviders`).
4) Run verification commands:
   - `pnpm lint` and `pnpm test` (or the repo equivalents found in package.json scripts).
   - If tests are not runnable locally, at least ensure TypeScript typecheck passes.

## Done criteria
- Component compiles (TypeScript)
- Tests exist and are consistent with repository tooling
- Exports updated so import path is stable
- No unrelated file churn
```

---

## 1-D) `assets/Component.tsx.tpl`
```tsx
import * as React from "react";

export type {{ComponentName}}Props = {
  className?: string;
  /** Short description of what this component represents */
  label?: string;
};

export function {{ComponentName}}({ className, label = "{{ComponentName}}" }: {{ComponentName}}Props) {
  return (
    <div className={className} data-testid="{{kebabName}}">
      {label}
    </div>
  );
}
```

## 1-E) `assets/Component.test.tsx.tpl`
> 테스트 러너는 스킬이 레포를 보고 `vitest/jest`에 맞춰 문법만 조정하도록 되어 있습니다.

```tsx
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { {{ComponentName}} } from "./{{ComponentName}}";

describe("{{ComponentName}}", () => {
  it("renders", () => {
    render(<{{ComponentName}} label="hello" />);
    expect(screen.getByTestId("{{kebabName}}")).toHaveTextContent("hello");
  });
});
```

## 1-F) `assets/index.ts.tpl`
```ts
export * from "./{{ComponentName}}";
```

## 1-G) `references/voxera-component-conventions.md`
```md
# Voxera UI conventions (seed)

- Prefer named exports for components.
- Keep props small and explicit.
- Avoid global side effects.
- Prefer colocated tests next to component unless repo uses /__tests__/.
- Add/maintain barrel exports for stable import paths.
```

---

# 2) 스킬 #2 — `voxera-api-route-generator` (Next.js API Route 생성: App Router/Pages Router 자동 분기)

## 2-A) 파일 트리
```text
.codex/skills/voxera-api-route-generator/
  SKILL.md
  agents/
    openai.yaml
  assets/
    route.app-router.ts.tpl
    route.pages-router.ts.tpl
    schema.zod.ts.tpl
    handler.test.tpl
  references/
    voxera-api-route-conventions.md
```

---

## 2-B) `agents/openai.yaml`
마찬가지로 암시적 호출은 끄고, 필요 시에만 명시 호출하도록 구성합니다. [Source](https://developers.openai.com/codex/skills/)

```yaml
interface:
  display_name: "Voxera API Route Generator"
  short_description: "Create Next.js API routes (App Router or Pages Router) with validation + error contract."
  default_prompt: "Use this skill to scaffold a new API route with schema validation, consistent errors, and tests."

policy:
  allow_implicit_invocation: false
```

---

## 2-C) `SKILL.md`
MVP에 바로 쓰이도록, **라우터 타입 자동 탐지** + **Zod 스키마 검증** + **일관된 에러 포맷** + **테스트 스켈레톤**까지 강제합니다.

```md
---
name: voxera-api-route-generator
description: Use when creating a new Next.js API route in Voxera (App Router route.ts OR Pages Router pages/api) with input validation, consistent error responses, and basic tests. Do NOT use for UI component work.
---

## Goal
Create a new API route scaffold that is production-ready:
- Router type auto-detected (App Router vs Pages Router)
- Request validation (Zod or existing validator in repo)
- Consistent JSON error contract
- Minimal tests aligned to repo stack
- Safe logging (no secrets/PII)

## Inputs (ask if missing)
- Route path (e.g. `/api/voxera/events/inbound`)
- Methods (GET/POST/etc)
- Auth requirement:
  - none / bearer / internal key / webhook signature (describe)
- Payload shape (example JSON) OR field list
- Side effects (db write, enqueue job, call Make webhook, etc)

## Repo detection (DO THIS FIRST)
1) Detect router style:
   - If `{webRoot}/app/api/` exists => App Router
   - Else if `{webRoot}/pages/api/` exists => Pages Router
   - Else if `{webRoot}/app/` exists => prefer App Router and create `app/api/...`
2) Detect webRoot:
   - Prefer `apps/web/` if exists, else repo root
3) Detect validation approach:
   - Prefer Zod if present in dependencies
   - Else follow existing validation utilities in repo

## Output files (minimum)
- Route handler file (route.ts or pages/api/*.ts)
- Schema file for request validation (if appropriate)
- Test skeleton (aligned with existing test tools)

## Error contract (MUST)
Return JSON with:
- `{ ok: false, error: { code: string, message: string, details?: any }, requestId?: string }`
Success:
- `{ ok: true, data: ... , requestId?: string }`

## Constraints
- Do not add new dependencies without asking.
- Do not leak secrets or full payloads to logs.
- Keep changes scoped to API route + schema + tests + exports if needed.
- Prefer small, reversible changes.

## Implementation steps
1) Create schema file from payload requirements.
2) Implement handler:
   - Enforce method allowlist (405)
   - Parse + validate (400 on invalid)
   - Auth (401/403 based on repo convention)
   - Execute side effect (wrap with try/catch)
   - Return consistent success/error JSON
3) Add tests:
   - valid request => 200 ok:true
   - invalid payload => 400 ok:false code:"invalid_request"
   - wrong method => 405 code:"method_not_allowed"
4) Verification:
   - Run repo-standard lint/test commands.

## Done criteria
- Route compiles and matches repo router style
- Validation and error contract present
- Tests exist and are consistent with repo tooling
```

---

## 2-D) `assets/schema.zod.ts.tpl`
```ts
import { z } from "zod";

export const {{SchemaName}} = z.object({
  // Fill with real fields
  // example:
  // eventType: z.enum(["listen", "think", "act"]),
  // sessionId: z.string().min(1),
});

export type {{SchemaName}}Type = z.infer<typeof {{SchemaName}}>;
```

---

## 2-E) `assets/route.app-router.ts.tpl` (Next.js App Router: `app/api/**/route.ts`)
```ts
import { NextResponse } from "next/server";
import { {{SchemaName}} } from "./schema";

function jsonOk(data: unknown, requestId?: string) {
  return NextResponse.json({ ok: true, data, requestId }, { status: 200 });
}

function jsonErr(status: number, code: string, message: string, details?: unknown, requestId?: string) {
  return NextResponse.json(
    { ok: false, error: { code, message, details }, requestId },
    { status }
  );
}

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? undefined;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(400, "invalid_json", "Request body must be valid JSON.", undefined, requestId);
  }

  const parsed = {{SchemaName}}.safeParse(body);
  if (!parsed.success) {
    return jsonErr(400, "invalid_request", "Payload validation failed.", parsed.error.flatten(), requestId);
  }

  try {
    // TODO: implement side effects here (enqueue job / call adapter / etc)
    return jsonOk({ received: true }, requestId);
  } catch (err) {
    return jsonErr(500, "internal_error", "Unexpected server error.", undefined, requestId);
  }
}
```

---

## 2-F) `assets/route.pages-router.ts.tpl` (Next.js Pages Router: `pages/api/**.ts`)
```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { {{SchemaName}} } from "./schema";

type Ok = { ok: true; data: unknown; requestId?: string };
type Err = { ok: false; error: { code: string; message: string; details?: unknown }; requestId?: string };

function requestIdOf(req: NextApiRequest) {
  const h = req.headers["x-request-id"];
  return (Array.isArray(h) ? h[0] : h) ?? undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  const requestId = requestIdOf(req);

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: { code: "method_not_allowed", message: "Only POST is supported." },
      requestId,
    });
  }

  const parsed = {{SchemaName}}.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: { code: "invalid_request", message: "Payload validation failed.", details: parsed.error.flatten() },
      requestId,
    });
  }

  try {
    // TODO: implement side effects here
    return res.status(200).json({ ok: true, data: { received: true }, requestId });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: { code: "internal_error", message: "Unexpected server error." },
      requestId,
    });
  }
}
```

---

## 2-G) `assets/handler.test.tpl`
테스트 러너/유틸은 레포마다 달라서 “스켈레톤”만 제공합니다. 스킬이 레포를 스캔해서 기존 패턴(예: supertest, next-test-api-route-handler, 직접 fetch)으로 맞추도록 지시하는 형태가 안정적입니다.

```ts
describe("{{RouteName}}", () => {
  it("valid payload returns ok", async () => {
    // TODO: call the route using the repo's preferred strategy
    // - if integration tests exist: use fetch against dev server
    // - if unit route harness exists: use it
  });

  it("invalid payload returns 400", async () => {
    // TODO
  });

  it("wrong method returns 405", async () => {
    // TODO
  });
});
```

---

## 2-H) `references/voxera-api-route-conventions.md`
```md
# Voxera API route conventions (seed)

- Always validate inputs.
- Always return consistent JSON envelope: ok/data or ok/error.
- Prefer requestId propagation via x-request-id when present.
- No secret logging; redact tokens, auth headers, and full payloads.
- Add at least 3 tests: success, invalid_request, method_not_allowed.
```
