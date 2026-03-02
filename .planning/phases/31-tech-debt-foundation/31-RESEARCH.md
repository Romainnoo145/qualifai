# Phase 31: Tech Debt Foundation - Research

**Researched:** 2026-03-02
**Domain:** TypeScript / Prisma type hygiene, ESM import ordering, tRPC v11 testing, Gemini model string upgrade
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**TS2589 cleanup depth:**

- Fix only TS2589-related `as any` casts, not all `as any` usage in the codebase
- DEBT-04 (detail-view cast) is a separate requirement — fix it as its own item
- Other established `as any` patterns that aren't TS2589 remain untouched
- Use `Prisma.XGetPayload<>` utility types as the primary replacement pattern for deep inference casts — full type safety over narrow object casts
- Update MEMORY.md with the new pattern (remove tech debt note, document the replacement approach)
- If a cast is genuinely unfixable without major query restructuring, keep `as any` with a `// TODO: TS2589` comment — pragmatic, not dogmatic

**Gemini 2.5-flash upgrade:**

- String swap only across 4 files — trust Google's drop-in replacement claim
- No output comparison run needed; Phase 35 validates real output
- Extract to a shared constant (single source of truth) — Phase 33 model selection will build on this
- One constant for all 4 files (all do Gemini Flash inference for the same general purpose)
- No deadline comment in code — tracked in research docs and MEMORY.md

**Golden baseline capture:**

- Capture baseline in Phase 31 as handoff to Phase 32 (don't defer)
- Capture AFTER the Gemini 2.5 swap — Phase 32 comparisons isolate prompt changes only
- DB export only (no fresh AI run) — capture what's already stored for all 7 prospects
- Single summary file (baselines.json with all 7 prospects' hypotheses)
- Store in `.planning/baselines/` directory

**E2E test refactoring:**

- Fix just the send path (DEBT-03 scope) — no broader test coverage expansion
- Include negative case (gate rejects) to prove the quality gate works end-to-end
- Mock Resend after the quality gate — test the full tRPC path but no real email sends

### Claude's Discretion

- Exact SERP cache bug fix approach (DEBT-01 pre-read snapshot implementation)
- Import ordering fix in workflow-engine.ts (DEBT-05 — straightforward move)
- logoUrl prop removal approach (DEBT-02 — grep and remove)
- Test infrastructure setup if needed for E2E refactoring
- Baseline export script implementation details

### Deferred Ideas (OUT OF SCOPE)

- Google SDK migration (deadline June 24, 2026) — future milestone, not v3.0 scope
- Broader test coverage expansion — could be its own phase if test infrastructure warrants it
- All non-TS2589 `as any` cleanup — track but don't block Phase 31 on it
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                                  | Research Support                                                                                                                                                                                                                                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEBT-01  | SERP cache re-read after overwrite bug fixed in research-executor.ts (pre-read snapshot before overwrite in deepCrawl block) | Codebase inspection confirms the double-read at lines ~316-330 in research-executor.ts; fix is to use `useSerpFromSourceSet` (pre-computed before overwrite) as the sole isCacheValid guard                                                                                                                                               |
| DEBT-02  | Unused logoUrl prop removed from DashboardClient interface and all call sites                                                | Confirmed unused: `DashboardClient` component destructures `prospectSlug, companyName, industry, hypotheses, ...` but NOT `logoUrl`; the interface declares it at line 72; the call site at `app/discover/[slug]/page.tsx:247` passes it — both need cleanup                                                                              |
| DEBT-03  | E2E send test refactored to use tRPC quality gate instead of calling Resend directly                                         | `outreach.sendEmail` tRPC procedure contains the quality gate; project has no `createCallerFactory` exported yet — must add one; vitest is the test runner (not Playwright for this case)                                                                                                                                                 |
| DEBT-04  | Detail-view Prisma `as any` cast replaced with narrow typed cast                                                             | Concentrated in `app/admin/prospects/[id]/page.tsx` lines 95, 128, 155, 179, 194, 198, 201; root cause is `api.admin.getProspect` and `api.research.listRuns` returning types too deep for TS to infer; fix is helper interface typed via `Prisma.ResearchRunGetPayload<{include:{...}}>`                                                 |
| DEBT-05  | Import ordering anomaly fixed in workflow-engine.ts (move import block to top)                                               | Confirmed: lines 540-544 have `import { MIN_AVERAGE_CONFIDENCE, PAIN_CONFIRMATION_MIN_SOURCES }` and `import type { TrafficLight }` AFTER the re-export statement at line 539 — ESM hoisting makes this work but ESLint/tsc may flag it; fix is move both imports to the top of the file                                                  |
| DEBT-06  | TS2589 deep Prisma `as any` casts cleaned up — categorized into 3 types                                                      | Three categories confirmed: (1) deep inference on `listRuns` result in `quality-chip.tsx`, (2) tRPC mutation casts in admin pages, (3) JSON field access in `outreach.ts:297`; fix each with `Prisma.ResearchRunGetPayload` or narrow typed interfaces                                                                                    |
| MODEL-02 | Gemini model string upgraded from `gemini-2.0-flash` to `gemini-2.5-flash` across all files                                  | Confirmed 7 occurrences across 7 files (4 targeted + 3 non-targeted); the 4 in scope: `workflow-engine.ts:723`, `workflow-engine.ts:1422`, `evidence-scorer.ts:141`, plus shared constant extraction; the other 3 (generate-wizard.ts, generate-outreach.ts, vault-reader.ts, codebase-analyzer.ts) are outside the 4-file scope decision |

</phase_requirements>

## Summary

Phase 31 is a pure cleanup phase with zero functional changes. It fixes six categorized tech debt items and upgrades one model string, establishing a clean `npm run check` baseline before Phase 32 touches hypothesis prompt logic. All issues have been inspected in the actual codebase — this is verified code surgery, not speculative cleanup.

The work decomposes cleanly into seven independent tasks: (1) SERP cache double-read removal, (2) logoUrl prop deletion, (3) E2E send test tRPC refactor, (4) detail-view `as any` replacement in the prospect detail page, (5) import ordering fix in workflow-engine.ts, (6) TS2589 `as any` categorization and fix across quality-chip and outreach router, (7) Gemini model string extraction to shared constant + upgrade. The golden baseline capture is the eighth and final step — runs after all fixes and `npm run check` passes, confirming clean state before Phase 32.

The project has no `npm run check` script. The equivalent is `npx tsc --noEmit` (currently passes with zero errors) plus `npm run lint` (currently 29 warnings, all `@typescript-eslint/no-explicit-any`). Phase 31 will reduce the warning count by fixing targeted `as any` casts, but the goal is zero errors (TypeScript), not zero lint warnings — the remaining non-TS2589 `as any` patterns stay per locked decision.

**Primary recommendation:** Fix the 7 debt items in the order listed (DEBT-01 through DEBT-06 + MODEL-02), run `npx tsc --noEmit` after each fix, then capture baselines.json as the final step.

## Standard Stack

### Core

| Library                 | Version | Purpose                                     | Why Standard                                                                                            |
| ----------------------- | ------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| TypeScript              | ^5.x    | Type checking                               | Already installed; `npx tsc --noEmit` is the check command                                              |
| `@prisma/client`        | ^7.3.0  | Prisma utility types (`Prisma.XGetPayload`) | Already installed; `Prisma.ResearchRunGetPayload<{include:{...}}>` replaces `as any` for deep inference |
| `@google/generative-ai` | ^0.24.1 | Gemini model access                         | Already installed; model string is in `getGenerativeModel({model: 'gemini-2.5-flash'})`                 |
| vitest                  | ^4.0.18 | Unit/integration test runner                | Already installed; DEBT-03 test goes in `lib/outreach/` alongside existing `.test.ts` files             |

### Supporting

| Library        | Version | Purpose                                               | When to Use                             |
| -------------- | ------- | ----------------------------------------------------- | --------------------------------------- |
| `@trpc/server` | 11.9.0  | `createCallerFactory` for server-side test invocation | DEBT-03: tRPC caller setup in test file |

### Alternatives Considered

| Instead of                               | Could Use               | Tradeoff                                                                           |
| ---------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `Prisma.XGetPayload<>`                   | Narrow manual interface | GetPayload is safer — stays in sync when schema changes; manual interface drifts   |
| Shared constant in `lib/ai/constants.ts` | Inline string per file  | Constant wins: Phase 33 model selection extends this file without touching callers |

**Installation:** No new packages required. All tools are already in `package.json`.

## Architecture Patterns

### Recommended Project Structure

No new files needed except:

```
lib/ai/
├── constants.ts        # NEW — GEMINI_MODEL_FLASH = 'gemini-2.5-flash' (shared constant)
lib/outreach/
├── send-email.test.ts  # NEW — DEBT-03 tRPC quality gate test
.planning/baselines/
├── baselines.json      # NEW — golden baseline capture (last step)
scripts/
├── export-baselines.ts # NEW — one-shot DB export script for baselines
```

### Pattern 1: Prisma.XGetPayload for Deep Inference

**What:** Use the utility type `Prisma.ResearchRunGetPayload<{include:{...}}>` to give a precise type to Prisma query results that TS cannot infer deeply.

**When to use:** Any place where `researchRuns.data[0] as any` is used to access fields that exist on the Prisma model but TS doesn't surface them due to TS2589.

**Example (DEBT-04 and DEBT-06):**

```typescript
// Source: Prisma docs + research-executor.ts:856 (existing usage in this codebase)
import type { Prisma } from '@prisma/client';

type ResearchRunWithCounts = Prisma.ResearchRunGetPayload<{
  include: {
    _count: { select: { evidenceItems: true; workflowHypotheses: true } };
  };
}>;

// Usage — no as any needed:
const run: ResearchRunWithCounts = researchRuns.data[0];
const count = run._count.evidenceItems; // typed
const approved = run.qualityApproved; // typed (Boolean | null)
const reviewed = run.qualityReviewedAt; // typed (Date | null)
const summary = run.summary; // typed (Prisma.JsonValue | null)
```

**Existing usage:** `lib/research-executor.ts:856` already uses `Prisma.EvidenceItemGetPayload<{select:{sourceType:true}}>` — same pattern, proven in this codebase.

### Pattern 2: Shared Gemini Constant

**What:** Extract the model string to `lib/ai/constants.ts` as a named export. All 4 callers import from this file.

**When to use:** MODEL-02 requires a single source of truth so Phase 33 model selection can override cleanly.

**Example:**

```typescript
// lib/ai/constants.ts (NEW FILE)
// Gemini Flash model identifier. Phase 33 will extend this with GEMINI_MODEL_PRO
// and a runtime model selector. gemini-2.0-flash retired June 1, 2026.
export const GEMINI_MODEL_FLASH = 'gemini-2.5-flash' as const;

// In callers (workflow-engine.ts, evidence-scorer.ts, etc.):
import { GEMINI_MODEL_FLASH } from '@/lib/ai/constants';
const model = getGenAI().getGenerativeModel({ model: GEMINI_MODEL_FLASH });
```

### Pattern 3: tRPC Server-Side Caller for Unit Tests

**What:** Use `t.createCallerFactory(router)` to create a type-safe server-side caller in tests. This bypasses HTTP transport and tests the full procedure logic including middleware.

**When to use:** DEBT-03 — testing `outreach.sendEmail` quality gate without real HTTP or real email sends.

**Example:**

```typescript
// Source: tRPC v11 docs — createCallerFactory is the v11 pattern
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@/server/routers/_app';
import { vi, describe, it, expect } from 'vitest';

const createCaller = appRouter.createCaller;
// OR: export createCallerFactory from server/trpc.ts and import here

const caller = createCaller({
  db: mockDb, // mock PrismaClient
  adminToken: env.ADMIN_SECRET, // pass auth context
});

// Mock Resend BEFORE the call — gate is checked inside the procedure
vi.mock('@/lib/outreach/send-email', () => ({
  sendOutreachEmail: vi.fn().mockResolvedValue({ id: 'mock-send-id' }),
}));

// Happy path: green gate passes and send is called
// Negative path: red gate throws PRECONDITION_FAILED
```

**Note:** `appRouter.createCaller` is the tRPC v11 shorthand. No separate `createCallerFactory` export needed if calling directly on `appRouter`.

### Pattern 4: SERP Cache Pre-Read Fix

**What:** Remove the second DB read inside `deepCrawl` block; use `useSerpFromSourceSet` (computed from pre-overwrite snapshot) as the sole cache validity guard.

**When to use:** DEBT-01 — the deepCrawl branch currently does a redundant `db.researchRun.findUnique` after the run was created/updated (which overwrote `inputSnapshot`).

**Current broken flow:**

```
1. priorSnapshot = findUnique (existingRunId) — CORRECT pre-read
2. useSerpFromSourceSet = computed from priorSourceSet — CORRECT
3. run.update(inputSnapshot: newData) — OVERWRITES the snapshot
4. [deepCrawl block]
   existingSnapshot = findUnique(existingRunId) — WRONG: reads newly-written data
   serpCache = extractSerpCache(existingSnapshot) — may be null if new format
   isCacheValid = useSerpFromSourceSet || serpCache check — double guard
```

**Fixed flow:**

```typescript
// Inside deepCrawl block — remove the re-read entirely:
// isCacheValid uses only useSerpFromSourceSet (computed before overwrite)
const isCacheValid = useSerpFromSourceSet;

// If isCacheValid, reconstruct serpResult from priorSourceSet (already in memory):
const serpResult: SerpDiscoveryResult = isCacheValid
  ? {
      reviewUrls:
        priorSourceSet?.urls
          .filter((u) => u.provenance === 'serp')
          .map((u) => u.url) ?? [],
      jobUrls: [],
      discoveredAt:
        priorSourceSet?.serpDiscoveredAt ?? new Date().toISOString(),
    }
  : await discoverSerpUrls({
      companyName: prospect.companyName,
      domain: prospect.domain,
    });
```

**Data availability:** `priorSourceSet` is extracted from `priorSnapshot` before the overwrite at lines 146-150. It is already in scope when `deepCrawl` block runs.

### Pattern 5: Import Ordering Fix (DEBT-05)

**What:** Move the misplaced import block in `workflow-engine.ts` from after an `export` statement to the top of the file with all other imports.

**Location:** Lines 540-544 have two `import` statements after the `export { computeTrafficLight }` re-export at line 539.

**Fix:** Move both imports to the top import block (after line 11):

```typescript
import {
  MIN_AVERAGE_CONFIDENCE,
  PAIN_CONFIRMATION_MIN_SOURCES,
} from '@/lib/quality-config';
import type { TrafficLight } from '@/lib/quality-config';
```

Then remove lines 540-544. The re-export at line 539 stays in place.

**Risk:** ESM hoisting makes this currently work. The fix is cosmetic but eliminates the anomaly that confuses static analysis tools and linters.

### Anti-Patterns to Avoid

- **Don't fix ALL `as any` casts:** The scope is TS2589-related casts and DEBT-04. The tRPC mutation casts like `(api.search.companies as any).useMutation()` are a tRPC v11 type inference limitation — not TS2589. Leave those unless they have a clean typed solution.
- **Don't write new model string literals:** After extracting `GEMINI_MODEL_FLASH`, import it everywhere. No new literal strings.
- **Don't run a fresh AI research pass for baselines:** DB export only — capture what's stored. No new network calls.
- **Don't remove serpCache legacy backward-compat:** The `serpCache` field in stored snapshots is legacy but harmless. Remove the re-read logic only; leave the field in the snapshot write.

## Don't Hand-Roll

| Problem                    | Don't Build                          | Use Instead                           | Why                                                                  |
| -------------------------- | ------------------------------------ | ------------------------------------- | -------------------------------------------------------------------- |
| Typed Prisma query results | Manual interface that mirrors schema | `Prisma.XGetPayload<{include:{...}}>` | GetPayload auto-updates when schema changes; manual interfaces drift |
| tRPC test caller           | Custom fetch-based HTTP client       | `appRouter.createCaller(ctx)`         | Type-safe, no HTTP transport, no port required                       |
| Model string catalog       | Ad-hoc config object                 | Single named export constant          | Simplest SSOT; Phase 33 extends by adding sibling constants          |

**Key insight:** All required tooling exists in already-installed packages. Zero new dependencies.

## Common Pitfalls

### Pitfall 1: Scope creep on `as any` cleanup

**What goes wrong:** Fixer sees 29 `as any` warnings from ESLint and fixes them all. Pulls in non-TS2589 patterns (tRPC mutation casts, script-level casts) that require major restructuring.

**Why it happens:** ESLint output lists all `as any` locations without categorizing them.

**How to avoid:** Fix only what DEBT-04 and DEBT-06 specify. Category guide:

- `(api.xxx as any).useMutation()` — tRPC v11 inference gap, NOT TS2589. Leave untouched.
- `researchRuns.data[0] as any` — TS2589 deep Prisma inference. FIX with GetPayload.
- `latestRun.summary as any` — Json field access. FIX with typed guard (`typeof x === 'object'`).

**Warning signs:** If fixing a cast requires touching the router definition or changing the Prisma query shape.

### Pitfall 2: Gemini 2.5-flash scope (7 files vs 4 files)

**What goes wrong:** Developer upgrades all 7 occurrences across all 7 files, including `generate-wizard.ts`, `generate-outreach.ts`, `vault-reader.ts`, `codebase-analyzer.ts`.

**Why it happens:** A global find-replace hits all 7 occurrences.

**How to avoid:** The 4 in-scope files per CONTEXT.md decisions: `workflow-engine.ts`, `evidence-scorer.ts`, and the two that share the same Gemini inference purpose. Specifically:

- `lib/workflow-engine.ts` (lines 723, 1422) — IN SCOPE
- `lib/evidence-scorer.ts` (line 141) — IN SCOPE
- `lib/enrichment/serp.ts` — check if it uses `gemini-2.0-flash` (grep shows it does NOT; no matches found)
- `lib/review-adapters.ts` — check if it uses `gemini-2.0-flash` (grep shows it does NOT)

**Actual finding:** The ROADMAP cites 4 files (workflow-engine.ts, evidence-scorer.ts, serp.ts, review-adapters.ts) but the grep shows `serp.ts` and `review-adapters.ts` have NO gemini model strings. The actual occurrences are in `workflow-engine.ts` (2 calls) and `evidence-scorer.ts` (1 call). The shared constant handles all 3. The other 4 files (generate-wizard, generate-outreach, vault-reader, codebase-analyzer) are out of scope per the "4 files for the same general purpose" decision.

**Warning signs:** If the constant import count exceeds 3 files.

### Pitfall 3: logoUrl removal breaks the discover page

**What goes wrong:** Removing `logoUrl` from the DashboardClient interface but forgetting the call site in `app/discover/[slug]/page.tsx:247`.

**Why it happens:** The prop is in two places — the interface definition and the JSX usage.

**How to avoid:** Two-step fix:

1. Remove `logoUrl: string | null` from `DashboardClientProps` interface (`components/public/prospect-dashboard-client.tsx:72`)
2. Remove `logoUrl={prospect.logoUrl}` from the JSX call site (`app/discover/[slug]/page.tsx:247`)

Run `npx tsc --noEmit` after step 2 — TypeScript will catch any remaining call sites.

**Note:** `logoUrl` IS used in other parts of the codebase (`app/admin/*`, `server/routers/*`) — those are correct usages on the Prisma `Prospect` model, not tech debt. Only the DashboardClient prop is unused.

### Pitfall 4: SERP cache fix breaks cache reuse

**What goes wrong:** Removing the backward-compat `serpCache` branch makes runs that stored data in `serpCache` (legacy format, predates sourceSet) always re-fetch SERP.

**Why it happens:** The fix removes the serpCache fallback check.

**How to avoid:** After the fix, `isCacheValid` is purely `useSerpFromSourceSet`. This guard checks `priorSourceSet?.serpDiscoveredAt` (set when a sourceSet with SERP URLs exists, age < 24h). For runs that used the legacy `serpCache` format (Phase 8-era runs), the `priorSourceSet` will not have `serpDiscoveredAt` → `useSerpFromSourceSet = false` → re-fetch. This is acceptable: the 7 existing prospects all have recent runs with sourceSet (v2.2 used sourceSet). The legacy backward-compat was only needed during v2.1 migration.

### Pitfall 5: tRPC caller in test requires auth context

**What goes wrong:** Creating a caller without passing `adminToken` causes every procedure call to throw `UNAUTHORIZED`.

**Why it happens:** `adminProcedure` checks `ctx.adminToken !== env.ADMIN_SECRET`.

**How to avoid:** In the test context, set `adminToken` equal to a test secret and mock `env.ADMIN_SECRET` to match. Or bypass the middleware by testing the outreach router directly with a mock context that has the right token.

```typescript
const caller = appRouter.createCaller({
  db: mockDb,
  adminToken: 'test-secret',
});
// And mock env.ADMIN_SECRET = 'test-secret' via vi.mock('@/env.mjs', ...)
```

### Pitfall 6: Import move in workflow-engine.ts causes circular export

**What goes wrong:** Moving the `import` statements for `quality-config` to the top causes a circular dependency warning if ESLint import/order or TypeScript picks it up differently.

**Why it happens:** The re-export `export { computeTrafficLight, type TrafficLight } from '@/lib/quality-config'` is at line 539, and the imports of other symbols from the same module are currently after it.

**How to avoid:** The fix is simple — imports go to top, re-export stays at line 539. Both reference the same module, no circularity. ESM hoisting already handles this; the fix just makes it explicit.

## Code Examples

Verified patterns from codebase inspection:

### Prisma.EvidenceItemGetPayload (existing usage in this codebase)

```typescript
// Source: lib/research-executor.ts:856 — existing proven pattern
const evidenceRecords: Array<{
  id: string;
  sourceType: Prisma.EvidenceItemGetPayload<{
    select: { sourceType: true };
  }>['sourceType'];
  // ...
}> = [];
```

### ResearchRunGetPayload for detail-view (DEBT-04)

```typescript
// New pattern — mirrors the existing GetPayload usage above
import type { Prisma } from '@prisma/client';

type ResearchRunRow = Prisma.ResearchRunGetPayload<{
  include: {
    prospect: { select: { id: true; companyName: true; domain: true } };
    campaign: {
      select: { id: true; name: true; nicheKey: true; strictGate: true };
    };
    _count: {
      select: {
        evidenceItems: true;
        workflowHypotheses: true;
        automationOpportunities: true;
        workflowLossMaps: true;
      };
    };
  };
}>;

// In the component:
const runs = researchRuns.data as ResearchRunRow[] | undefined;
const latestRun = runs?.[0] ?? null;
// Now latestRun.qualityApproved, latestRun.qualityReviewedAt, latestRun.summary are typed
```

### Json field access (no as any needed, DEBT-06)

```typescript
// outreach.ts:297 — current:
const gate = (latestRun.summary as any)?.gate;

// Fix — Prisma.JsonValue is typed as object|array|string|number|bool|null
// Already has a pattern in research.ts:300-309:
const summary =
  latestRun.summary &&
  typeof latestRun.summary === 'object' &&
  !Array.isArray(latestRun.summary)
    ? (latestRun.summary as Record<string, unknown>)
    : null;
const gate =
  summary?.gate &&
  typeof summary.gate === 'object' &&
  !Array.isArray(summary.gate)
    ? (summary.gate as Record<string, unknown>)
    : null;
```

### tRPC v11 server-side caller

```typescript
// Source: tRPC v11 — appRouter.createCaller is available directly
import { appRouter } from '@/server/routers/_app';
import { vi } from 'vitest';

vi.mock('@/env.mjs', () => ({
  env: { ADMIN_SECRET: 'test-secret', /* ... */ },
}));

vi.mock('@/lib/outreach/send-email', () => ({
  sendOutreachEmail: vi.fn().mockResolvedValue({ id: 'mock-id' }),
}));

const caller = appRouter.createCaller({
  db: createMockDb(),
  adminToken: 'test-secret',
});

// Test: green gate allows send
it('sends email when gate is green', async () => {
  await expect(caller.outreach.sendEmail({ contactId: '...', ... })).resolves.toBeDefined();
});

// Test: red gate rejects (PRECONDITION_FAILED)
it('rejects when gate is red', async () => {
  await expect(caller.outreach.sendEmail({ contactId: 'no-research', ... }))
    .rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
});
```

### Baseline export script pattern

```typescript
// scripts/export-baselines.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { writeFile } from 'node:fs/promises';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const prospects = await db.prospect.findMany({
  select: {
    id: true,
    companyName: true,
    domain: true,
    researchRuns: {
      take: 1,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        workflowHypotheses: {
          select: {
            id: true,
            title: true,
            problemStatement: true,
            confidenceScore: true,
            evidenceRefs: true,
          },
          orderBy: { confidenceScore: 'desc' },
        },
      },
    },
  },
});

await writeFile(
  '.planning/baselines/baselines.json',
  JSON.stringify(prospects, null, 2),
);
```

## State of the Art

| Old Approach                              | Current Approach                     | When Changed        | Impact                                                                                    |
| ----------------------------------------- | ------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------- |
| `gemini-2.0-flash` model string           | `gemini-2.5-flash`                   | MODEL-02 / Phase 31 | Drop-in replacement — same API, improved output quality, retirement deadline June 1, 2026 |
| Import after export in workflow-engine.ts | Imports at top of file               | Phase 31            | ESM hoisting made it work but it's non-standard                                           |
| `as any` for Prisma deep inference        | `Prisma.XGetPayload<>` utility types | Phase 31            | Type-safe, schema-change-resilient                                                        |
| Double DB read in deepCrawl (SERP cache)  | Single pre-read, use flag            | Phase 31            | Removes race condition and stale-read risk                                                |
| `logoUrl` prop passed but never rendered  | Prop removed                         | Phase 31            | Dead code eliminated                                                                      |

**Deprecated/outdated:**

- `gemini-2.0-flash`: Retired June 1, 2026 — replace now
- Import-after-export pattern in workflow-engine.ts: ESLint anomaly, safe to move

## Open Questions

1. **Exact files in MODEL-02 scope**
   - What we know: ROADMAP says 4 files (workflow-engine.ts, evidence-scorer.ts, serp.ts, review-adapters.ts). Grep found zero occurrences in serp.ts and review-adapters.ts.
   - What's unclear: Was the ROADMAP written before or after serp.ts/review-adapters.ts were last refactored?
   - Recommendation: Trust the grep. The shared constant covers `workflow-engine.ts` (2 occurrences) and `evidence-scorer.ts` (1 occurrence). Run `grep -r "gemini-2\." lib/` at implementation time to confirm no new occurrences were added. The out-of-scope files (generate-wizard.ts, generate-outreach.ts, vault-reader.ts, codebase-analyzer.ts) also use `gemini-2.0-flash` — they can be updated opportunistically if the constant is extracted to a shared location accessible to them.

2. **tRPC caller mock DB shape for DEBT-03**
   - What we know: `outreach.sendEmail` calls `db.contact.findUniqueOrThrow` and `db.researchRun.findFirst`. The quality gate reads `summary` and `qualityApproved` from the run.
   - What's unclear: Whether a minimal mock covering only those two DB methods is sufficient or whether `createCallerFactory` needs the full PrismaClient mock.
   - Recommendation: Mock only the two methods used. Vitest `vi.fn()` on a partial object cast as `PrismaClient` is the established pattern in this codebase (see `workflow-engine.test.ts:20-24`).

3. **TS2589 cast in quality-chip.tsx vs admin page casts**
   - What we know: `quality-chip.tsx:124` has an explicit comment "Cast as any to avoid TS2589 deep inference from Prisma". The admin page has multiple casts that may or may not be TS2589.
   - What's unclear: Which of the admin page casts (lines 95, 128, 155, 179, 194, 198, 201) are truly TS2589 vs the tRPC mutation pattern.
   - Recommendation: Lines 155, 179, 194, 198, 201 access `researchRuns.data[0]` — these are TS2589 from the deep `listRuns` include. Lines 95 and 128 access `prospect.data as any` — this is from `admin.getProspect` query, may also be TS2589 or may be tRPC inference. Apply `ResearchRunRow` type to fix lines 155-201 first; check if 95/128 resolve naturally from the tRPC query return type.

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `lib/research-executor.ts` — DEBT-01 double-read confirmed at lines 316-324
- Codebase inspection: `components/public/prospect-dashboard-client.tsx` — `logoUrl` prop at line 72, not in destructure at line 100-115
- Codebase inspection: `app/discover/[slug]/page.tsx:247` — logoUrl call site confirmed
- Codebase inspection: `lib/workflow-engine.ts:539-544` — import after export confirmed
- Codebase inspection: `lib/workflow-engine.ts:723,1422` + `lib/evidence-scorer.ts:141` — gemini-2.0-flash occurrences
- Codebase inspection: `app/admin/prospects/[id]/page.tsx:95,128,155,179,194,198,201` — as any cast locations
- Codebase inspection: `server/routers/outreach.ts:297` — Json field as any cast location
- Codebase inspection: `lib/research-executor.ts:856` — existing `Prisma.EvidenceItemGetPayload` usage (proven pattern)
- `npx tsc --noEmit` result: zero errors on current codebase
- `npm run lint` result: 29 warnings, all `@typescript-eslint/no-explicit-any`
- `vitest.config.ts`: test runner confirmed as vitest v4.0.18, include pattern `**/*.test.{ts,tsx}`
- `.planning/config.json`: `workflow.nyquist_validation` not present → Validation Architecture section omitted

### Secondary (MEDIUM confidence)

- tRPC v11 docs (from MEMORY.md notes): `async getRawInput()` is the v11 pattern; `appRouter.createCaller(ctx)` is the server-side test caller pattern
- `@google/generative-ai` ^0.24.1 changelog: `gemini-2.5-flash` is drop-in replacement for `gemini-2.0-flash` with same API surface

### Tertiary (LOW confidence)

- None — all claims are verified by direct codebase inspection or established project patterns

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — inspected package.json, verified versions in use
- Architecture: HIGH — inspected actual files, confirmed exact line numbers and fix approaches
- Pitfalls: HIGH — derived from direct code reading and established project patterns in MEMORY.md

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable — no external APIs changing; gemini-2.5-flash retirement deadline June 1, 2026 is well outside this window)
