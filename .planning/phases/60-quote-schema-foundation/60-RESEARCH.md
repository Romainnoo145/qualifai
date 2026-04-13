# Phase 60: Quote Schema Foundation - Research

**Researched:** 2026-04-13
**Domain:** Prisma schema design + tRPC v11 router patterns + Vitest state machine testing + YAML import scripts (Qualifai data layer)
**Confidence:** HIGH — Stack and patterns verified directly in the Qualifai repo; locked decisions removed all alternative-exploration burden.

---

<user_constraints>

## User Constraints (from CONTEXT.md / decisions.md / HANDOFF.md)

### Locked Decisions (MUST follow exactly)

**Q5 — PDF rendering = separate Railway worker, NOT in-process**

- `Quote.snapshotPdfUrl` is a nullable `String` (URL pointing at external storage).
- `Quote.snapshotStatus` enum: `PENDING | RENDERING | READY | FAILED`.
- **No Puppeteer dependency in Qualifai's `package.json`.** Phase 60 only models the URL/status fields; the worker itself is built later (Phase 62).

**Q8 — Import existing klarifai-core YAMLs**

- Script path: `scripts/import-klarifai-yaml.ts` in the Qualifai repo.
- Sources: `klarifai-core/data/clients/*.yaml` and `klarifai-core/data/quotes/{year}/*.yaml`.
- Idempotent: match `Prospect` on `slug`, match `Quote` on `nummer`.
- `--dry` is the default (logs intended writes only). `--apply` performs real writes.
- Must successfully import the 3 Marfa quotes with totals: **OFF001 €7.816,60 / OFF002 €11.495,00 / OFF003 €13.285,80**.

**Q9 — Snapshot-on-SENT (immutable)**

- When a Quote transitions to SENT, freeze `snapshotHtml`, `snapshotData`, `snapshotAt`, `templateVersion`. Never overwrite afterwards.
- A "new version" is a new `Quote` row with `replacesId` pointing at the archived predecessor (which moves to `ARCHIVED`).

**Q12 — Snapshot versioning**

- Two fields only: `snapshotAt: DateTime?` + `templateVersion: String?` (ISO date string OR git hash). **No counter / no `version: Int`.**
- This standard applies only to the new `Quote` model. `WorkflowLossMap.version` (Int) and `ProspectAnalysis.version` (String "analysis-v1") are NOT touched in Phase 60 — separate tech-debt cleanup.

**Q13 — Two enums, auto-sync via state machine helper**

- `QuoteStatus`: `DRAFT | SENT | VIEWED | ACCEPTED | REJECTED | EXPIRED | ARCHIVED`
- `ProspectStatus`: existing 9 values + ONE new value `QUOTE_SENT` positioned between `ENGAGED` and `CONVERTED`. Existing values are unchanged.
- Sync mapping (must live inside `transitionQuote` helper, executed as one Prisma transaction):

| Quote action      | Quote.status | Prospect.status              |
| ----------------- | ------------ | ---------------------------- |
| Admin creates     | `DRAFT`      | unchanged                    |
| Admin sends       | `SENT`       | `QUOTE_SENT`                 |
| Client opens link | `VIEWED`     | unchanged (stays QUOTE_SENT) |
| Client accepts    | `ACCEPTED`   | `CONVERTED`                  |
| Client rejects    | `REJECTED`   | `ENGAGED` (back to sales)    |
| Validity expired  | `EXPIRED`    | unchanged                    |
| Replaced by v2    | `ARCHIVED`   | unchanged                    |

**Q14 — Web is primary, PDF secondary**

- Only relevant to Phase 60 in this respect: `snapshotData` must be a **single source of truth** that can drive both a web template and a print template. Schema must therefore not bake in HTML-only or PDF-only assumptions in `snapshotData` shape.

### Claude's Discretion (research-and-recommend areas)

- Exact Zod schema shape for `snapshotData` (must accommodate Q14 dual-template needs).
- Exact `as const` constant arrays in `lib/constants/prospect-statuses.ts` (which subsets to expose).
- Internal structure of `lib/state-machines/quote.ts` and `lib/state-machines/prospect.ts` (function naming, error type shape).
- YAML parser library choice (currently no yaml lib in `package.json` — must add one).
- Test fixture organisation for the import script.

### Deferred Ideas (OUT OF SCOPE for Phase 60)

- tRPC v11 `as any` inference casts in existing components (`outreach-preview-section.tsx`, `intent-signals-section.tsx`, `quality-chip.tsx`). Phase 61 touches those files and may clean them up opportunistically.
- Cadence engine hardcoded thresholds in `lib/cadence/engine.ts`. Unrelated to Quote.
- `ResearchRun.inputSnapshot` Zod schema (separate concerns clean-up).
- Inconsistent snapshot versioning on `WorkflowLossMap` / `ProspectAnalysis` (separate clean-up).
- Admin UI for quotes (Phase 61).
- PDF Worker service (Phase 62).
- Contract Workflow (Phase 63).
- Multi-brand support, SignWell integration, bilingual quotes, monorepo umbrella (out of v9.0 entirely).
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                             | Research Support                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| DATA-01   | `Quote` model with narrative + meta fields                                                              | Field shape verified against `klarifai-core/data/quotes/2026/*.yaml` (see Marfa Quote Shape).                      |
| DATA-02   | `QuoteLine` model (fase, omschrijving, oplevering, uren, tarief)                                        | Verified 1:1 against existing YAML `regels:` arrays.                                                               |
| DATA-03   | `QuoteStatus` enum                                                                                      | Locked Q13: `DRAFT \| SENT \| VIEWED \| ACCEPTED \| REJECTED \| EXPIRED \| ARCHIVED`.                              |
| DATA-04   | `ProspectStatus` extended with `QUOTE_SENT`                                                             | Locked Q13: insert between `ENGAGED` and `CONVERTED`. See Existing Enum analysis.                                  |
| DATA-05   | Snapshot fields per Q12                                                                                 | `snapshotAt`, `templateVersion`, `snapshotHtml @db.Text`, `snapshotData Json`, `snapshotPdfUrl`, `snapshotStatus`. |
| DATA-06   | `Quote.prospectId` FK with cascade rules consistent with existing                                       | Existing pattern: `onDelete: Cascade` for prospect-owned data (Contact, ResearchRun, etc.).                        |
| DATA-07   | Migration runs cleanly on shadow DB; new columns nullable                                               | Standard `npm run db:migrate` flow exists; verify on shadow DB before staging.                                     |
| DATA-08   | tRPC `quotes` router with `create`, `list`, `get`, `update`, `transition` using `projectAdminProcedure` | Pattern from `useCasesRouter` is the reference template.                                                           |
| DATA-09   | `quotes.transition` is transactional with auto-sync                                                     | Implemented inside `lib/state-machines/quote.ts`, called from router. Single `db.$transaction`.                    |
| DATA-10   | All `quotes.*` endpoints filter by `ctx.projectId`                                                      | Quotes are accessed via `Quote.prospect.projectId` (Quote owns no direct projectId).                               |
| FOUND-01  | Typed status constants in `lib/constants/prospect-statuses.ts`; refactor scattered literals             | Comprehensive call-site inventory below (15+ files).                                                               |
| FOUND-02  | `admin.updateProspect` validates state transitions                                                      | Hooks into the new `lib/state-machines/prospect.ts` helper before the Prisma write.                                |
| FOUND-03  | `Quote.snapshotData` Zod schema in `lib/schemas/quote-snapshot.ts`                                      | Validated on every router write that touches `snapshotData`.                                                       |
| FOUND-04  | Type-safe accessor helper for snapshot fields                                                           | Pattern: `getSnapshotField(snapshot, 'fieldName', defaultValue)` returning typed values.                           |
| IMPORT-01 | Import `data/clients/*.yaml` → `Prospect`, idempotent on `slug`                                         | Verified `marfa.yaml` shape (only one client today).                                                               |
| IMPORT-02 | Import `data/quotes/{year}/*.yaml` → `Quote` + `QuoteLine`, idempotent on `nummer`                      | Verified all 3 Marfa quote YAMLs.                                                                                  |
| IMPORT-03 | `--dry` default, `--apply` for real writes                                                              | Pattern from existing scripts (`scripts/rerun-all-research.ts` etc.); use `process.argv` parsing.                  |
| IMPORT-04 | Logs all 3 Marfa quotes with totals matching klarifai-core                                              | Verified totals: OFF001 €7.816,60 / OFF002 €11.495,00 / OFF003 €13.285,80.                                         |
| TEST-01   | State transition tests for `Prospect.updateProspect` (valid + invalid)                                  | Vitest pattern from `lib/admin-token.test.ts` and `lib/outreach/send-email.test.ts`.                               |
| TEST-02   | State transition tests for `Quote.transition` including auto-sync                                       | Mock `db` per existing `send-email.test.ts` pattern; assert both updates in same `$transaction`.                   |
| TEST-03   | Multi-project isolation test for `quotes.*` endpoints                                                   | Use `appRouter.createCaller({ db, adminToken })` pattern with two project fixtures.                                |
| TEST-04   | Integration test for YAML import script — 3 Marfa quotes, record counts + totals                        | Use real YAML files as fixtures; assert dry-run output and apply output.                                           |
| TEST-05   | Snapshot validation test — Zod parsing rejects malformed, accepts valid                                 | Pure Zod test, no DB or mocks needed. Co-locate next to `lib/schemas/quote-snapshot.ts`.                           |

</phase_requirements>

---

## Summary

Phase 60 is a **schema-and-foundation phase**, not a feature phase. It introduces two new Prisma models (`Quote`, `QuoteLine`), one new enum (`QuoteStatus`), one extra value on the existing `ProspectStatus` enum, a snapshot-on-SENT pattern, two state machine helper modules, a Zod schema for typed JSON snapshots, a new tRPC router (`quotes`), and a one-shot YAML import script. Three of the four foundation fixes from the codebase audit (FOUND-01..04) are mandatory and must land in the first wave because Quote depends on them.

The Qualifai stack is fully understood and stable: Prisma 7.3.0 with the `@prisma/adapter-pg` adapter, tRPC v11.9.0 with the `projectAdminProcedure` middleware, Zod 4.3.6, Vitest 4.0.18 with co-located `*.test.ts` files (205 existing). The `useCasesRouter` is the canonical reference for new CRUD routers. The `lib/admin-token.test.ts` and `lib/outreach/send-email.test.ts` files are the canonical references for unit + tRPC integration tests. There are NO existing state machines in the codebase — this is a green-field abstraction.

The locked decisions (Q5/Q8/Q9/Q12/Q13/Q14) eliminate all major architectural alternatives. This research therefore does not explore "best library for state machines" or "should we use Drizzle instead of Prisma" — it documents the existing stack at the level of detail the planner needs to write tasks.

**Primary recommendation:** Open the phase with FOUND-01 (typed status constants) and FOUND-02 (state machine helper for Prospect) **before** adding any Quote schema. The state machine helper is reused by `transitionQuote`, so it must exist first. Then add the Prisma schema, then `lib/schemas/quote-snapshot.ts`, then the `quotes` router, then the YAML import script. Tests sit in Wave 0 alongside their target modules using the existing co-located pattern.

---

## Standard Stack

### Core (already in `package.json` — DO NOT add or upgrade)

| Library              | Version | Purpose                    | Why Standard                                                                |
| -------------------- | ------- | -------------------------- | --------------------------------------------------------------------------- |
| `prisma`             | ^7.3.0  | Migration tooling (CLI)    | Same version as the rest of the Qualifai schema; no upgrade in scope.       |
| `@prisma/client`     | ^7.3.0  | Generated runtime client   | Must stay in lockstep with `@prisma/adapter-pg`.                            |
| `@prisma/adapter-pg` | ^7.3.0  | PostgreSQL driver adapter  | Required for `lib/prisma.ts` to instantiate `PrismaPg`.                     |
| `@trpc/server`       | 11.9.0  | tRPC v11 server runtime    | All routers use the v11 `getRawInput()` pattern (NOT v10's `rawInput`).     |
| `@trpc/client`       | 11.9.0  | tRPC v11 client            | Must match server version exactly.                                          |
| `@trpc/react-query`  | 11.9.0  | React Query bindings       | Used by all admin pages.                                                    |
| `zod`                | ^4.3.6  | Schema validation (Zod 4!) | Note: Zod 4, not Zod 3. API differences matter (e.g. `z.coerce`, `.brand`). |
| `vitest`             | ^4.0.18 | Test runner (jsdom env)    | 205 existing tests; `globals: true` so no need to import `describe/it`.     |
| `tsx`                | ^4.21.0 | TypeScript script runner   | Used by all `scripts/*.ts` files; same approach for the import script.      |

### Supporting (need to add to `package.json`)

| Library | Version             | Purpose                        | When to Use                                    |
| ------- | ------------------- | ------------------------------ | ---------------------------------------------- |
| `yaml`  | latest stable (2.x) | Parse klarifai-core YAML files | Required by `scripts/import-klarifai-yaml.ts`. |

**Why `yaml` over `js-yaml`:** `yaml` (eemeli/yaml) is the modern TypeScript-friendly YAML parser. It ships its own types, supports the full YAML 1.2 spec, has zero dependencies, and is what the Node ecosystem has shifted to since 2023. `js-yaml` is older but acceptable; `yaml` is preferred for new code. Verified: NEITHER is in `package.json` today.

```bash
npm install yaml
```

### Alternatives Considered

| Instead of                        | Could Use             | Tradeoff                                                                                                                                           |
| --------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hand-rolled state machine helpers | XState                | XState is overkill for ~7 transitions per machine and adds a 16KB+ runtime dep with a learning curve. Locked decision (HANDOFF §2) is "no XState". |
| `yaml` library                    | `js-yaml`             | Both work; `yaml` is more modern. No project-specific reason to pick `js-yaml`.                                                                    |
| Zod 4 schemas                     | TypeScript types only | Zod 4 is the project standard at every router boundary; Phase 60 must follow that pattern, especially for FOUND-03.                                |

---

## Architecture Patterns

### Recommended Project Structure (additions for Phase 60)

```
qualifai/
├── lib/
│   ├── constants/
│   │   └── prospect-statuses.ts     # NEW — FOUND-01: as const arrays + helpers
│   ├── state-machines/
│   │   ├── prospect.ts              # NEW — FOUND-02: transition validation for Prospect
│   │   ├── prospect.test.ts         # NEW — TEST-01
│   │   ├── quote.ts                 # NEW — DATA-09: transitionQuote with sync
│   │   └── quote.test.ts            # NEW — TEST-02
│   └── schemas/
│       ├── quote-snapshot.ts        # NEW — FOUND-03: Zod schema + accessor helper
│       └── quote-snapshot.test.ts   # NEW — TEST-05
├── server/
│   └── routers/
│       ├── quotes.ts                # NEW — DATA-08, DATA-09, DATA-10
│       ├── quotes.test.ts           # NEW — TEST-03 (multi-project isolation)
│       └── _app.ts                  # MODIFY — register quotes router
├── prisma/
│   ├── schema.prisma                # MODIFY — add Quote, QuoteLine, QuoteStatus, SnapshotStatus, extend ProspectStatus
│   └── migrations/
│       └── 20260413xxxxxx_quote_foundation/
│           └── migration.sql        # NEW — generated by `npm run db:migrate`
└── scripts/
    ├── import-klarifai-yaml.ts      # NEW — IMPORT-01..04
    └── import-klarifai-yaml.test.ts # NEW — TEST-04 (uses real YAML fixtures)
```

### Pattern 1: tRPC v11 Router with `projectAdminProcedure`

**What:** Standard CRUD router scoped to active project via `ctx.projectId`. Quotes have no direct `projectId` column — multi-tenant isolation is enforced by joining through `Quote.prospect.projectId`.

**When to use:** All `quotes.*` procedures.

**Example (template lifted from `server/routers/use-cases.ts`, adapted for Quote):**

```typescript
// server/routers/quotes.ts
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { projectAdminProcedure, router } from '../trpc';
import { transitionQuote } from '@/lib/state-machines/quote';
import { QuoteSnapshotSchema } from '@/lib/schemas/quote-snapshot';

async function assertQuoteInProject(
  ctx: { db: any; projectId: string },
  id: string,
) {
  const quote = await ctx.db.quote.findFirst({
    where: { id, prospect: { projectId: ctx.projectId } },
    select: { id: true },
  });
  if (!quote) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Quote not found in active project scope',
    });
  }
}

export const quotesRouter = router({
  list: projectAdminProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              'DRAFT',
              'SENT',
              'VIEWED',
              'ACCEPTED',
              'REJECTED',
              'EXPIRED',
              'ARCHIVED',
            ])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.quote.findMany({
        where: {
          prospect: { projectId: ctx.projectId }, // <-- multi-tenant join filter
          ...(input?.status && { status: input.status }),
        },
        include: {
          lines: true,
          prospect: { select: { slug: true, companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),
  // get, create, update follow the same pattern
  transition: projectAdminProcedure
    .input(
      z.object({
        id: z.string(),
        newStatus: z.enum([
          'DRAFT',
          'SENT',
          'VIEWED',
          'ACCEPTED',
          'REJECTED',
          'EXPIRED',
          'ARCHIVED',
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertQuoteInProject(ctx, input.id);
      return transitionQuote(ctx.db, input.id, input.newStatus);
    }),
});
```

**Source:** `server/routers/use-cases.ts` (verified). Note: the `assertXInProject` helper pattern is used throughout (`assertProspectInProject`, `assertCampaignInProject`, etc.) — Quote needs its own variant that joins through `prospect.projectId`.

### Pattern 2: State Machine Helper (NEW abstraction — green field)

**What:** A pure function that takes the current state, a desired state, and returns either the validated transition result or throws a typed error.

**When to use:** Any time code needs to mutate `Quote.status` or `Prospect.status`.

**Example (proposed shape — no existing pattern in the codebase to mirror):**

```typescript
// lib/state-machines/prospect.ts
import { TRPCError } from '@trpc/server';
import type { ProspectStatus } from '@prisma/client';

const VALID_PROSPECT_TRANSITIONS: Record<ProspectStatus, ProspectStatus[]> = {
  DRAFT: ['ENRICHED', 'ARCHIVED'],
  ENRICHED: ['GENERATING', 'READY', 'ARCHIVED'],
  GENERATING: ['READY', 'ENRICHED', 'ARCHIVED'],
  READY: ['SENT', 'ARCHIVED'],
  SENT: ['VIEWED', 'ENGAGED', 'ARCHIVED'],
  VIEWED: ['ENGAGED', 'QUOTE_SENT', 'ARCHIVED'],
  ENGAGED: ['QUOTE_SENT', 'CONVERTED', 'ARCHIVED'], // ENGAGED → QUOTE_SENT is the new path
  QUOTE_SENT: ['CONVERTED', 'ENGAGED', 'ARCHIVED'], // QUOTE_SENT → ENGAGED on quote rejection
  CONVERTED: ['ARCHIVED'],
  ARCHIVED: [], // terminal
};

export function assertValidProspectTransition(
  current: ProspectStatus,
  next: ProspectStatus,
): void {
  if (current === next) return;
  if (!VALID_PROSPECT_TRANSITIONS[current].includes(next)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Invalid prospect status transition: ${current} → ${next}`,
    });
  }
}
```

```typescript
// lib/state-machines/quote.ts
import { TRPCError } from '@trpc/server';
import type { Prisma, QuoteStatus, ProspectStatus } from '@prisma/client';
import { assertValidProspectTransition } from './prospect';
import { QuoteSnapshotSchema } from '@/lib/schemas/quote-snapshot';

const VALID_QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ['SENT', 'ARCHIVED'],
  SENT: ['VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'ARCHIVED'],
  VIEWED: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'ARCHIVED'],
  ACCEPTED: ['ARCHIVED'],
  REJECTED: ['ARCHIVED'],
  EXPIRED: ['ARCHIVED'],
  ARCHIVED: [],
};

// Q13 sync mapping
const QUOTE_TO_PROSPECT_SYNC: Partial<Record<QuoteStatus, ProspectStatus>> = {
  SENT: 'QUOTE_SENT',
  ACCEPTED: 'CONVERTED',
  REJECTED: 'ENGAGED',
  // VIEWED, EXPIRED, ARCHIVED → no prospect change
};

export async function transitionQuote(
  db: Prisma.TransactionClient | typeof prismaSingleton,
  quoteId: string,
  newStatus: QuoteStatus,
) {
  return db.$transaction(async (tx) => {
    const quote = await tx.quote.findUniqueOrThrow({
      where: { id: quoteId },
      include: { prospect: { select: { id: true, status: true } } },
    });

    // 1. Quote-side validation
    if (!VALID_QUOTE_TRANSITIONS[quote.status].includes(newStatus)) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Invalid quote status transition: ${quote.status} → ${newStatus}`,
      });
    }

    // 2. Snapshot-on-SENT freezing (Q9)
    const snapshotPatch: Prisma.QuoteUpdateInput = {};
    if (newStatus === 'SENT' && quote.status === 'DRAFT') {
      // build snapshotData from current quote+lines, validate via Zod
      const snapshotData = QuoteSnapshotSchema.parse(
        buildSnapshotFromQuote(quote),
      );
      snapshotPatch.snapshotData = snapshotData;
      snapshotPatch.snapshotAt = new Date();
      snapshotPatch.templateVersion =
        process.env.QUOTE_TEMPLATE_VERSION ??
        new Date().toISOString().slice(0, 10);
      snapshotPatch.snapshotStatus = 'PENDING'; // PDF worker will flip to RENDERING/READY
    }

    const updatedQuote = await tx.quote.update({
      where: { id: quoteId },
      data: { status: newStatus, ...snapshotPatch },
    });

    // 3. Prospect sync (single transaction)
    const targetProspectStatus = QUOTE_TO_PROSPECT_SYNC[newStatus];
    if (
      targetProspectStatus &&
      quote.prospect.status !== targetProspectStatus
    ) {
      assertValidProspectTransition(
        quote.prospect.status,
        targetProspectStatus,
      );
      await tx.prospect.update({
        where: { id: quote.prospect.id },
        data: { status: targetProspectStatus },
      });
    }

    return updatedQuote;
  });
}
```

**Key insight:** The `transitionQuote` helper, NOT `quotes.update`, is the only authorised path for mutating `Quote.status`. The router's `update` mutation must reject any payload that touches `status`.

### Pattern 3: Zod 4 Schema + Type-Safe Accessor

**What:** A single source of truth for `snapshotData` shape.

**Example:**

```typescript
// lib/schemas/quote-snapshot.ts
import { z } from 'zod';

export const QuoteSnapshotSchema = z.object({
  // metadata
  templateVersion: z.string(),
  capturedAt: z.string().datetime(),
  // narrative content
  tagline: z.string(),
  introductie: z.string(),
  uitdaging: z.string(),
  aanpak: z.string(),
  // quote header
  nummer: z.string(),
  onderwerp: z.string(),
  datum: z.string(),
  geldigTot: z.string(),
  // line items
  lines: z.array(
    z.object({
      fase: z.string(),
      omschrijving: z.string(),
      oplevering: z.string(),
      uren: z.number().int().nonnegative(),
      tarief: z.number().int(), // negative allowed (discount lines)
    }),
  ),
  // commercial
  btwPercentage: z.number(),
  scope: z.string(),
  buitenScope: z.string(),
  // computed totals (frozen at snapshot time)
  totals: z.object({
    netto: z.number(),
    btw: z.number(),
    bruto: z.number(),
  }),
  // prospect snapshot (denormalised so the snapshot survives prospect edits)
  prospect: z.object({
    slug: z.string(),
    companyName: z.string().nullable(),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
  }),
});

export type QuoteSnapshot = z.infer<typeof QuoteSnapshotSchema>;

/** Type-safe accessor — FOUND-04. Avoids `as any` on Json fields. */
export function parseSnapshot(raw: unknown): QuoteSnapshot | null {
  if (raw === null || raw === undefined) return null;
  const result = QuoteSnapshotSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Read a single field with a typed default. */
export function getSnapshotField<K extends keyof QuoteSnapshot>(
  raw: unknown,
  key: K,
  fallback: QuoteSnapshot[K],
): QuoteSnapshot[K] {
  const parsed = parseSnapshot(raw);
  return parsed?.[key] ?? fallback;
}
```

### Pattern 4: tRPC Test with Mocked Prisma (TEST-03)

**Source:** `lib/outreach/send-email.test.ts` (verified — see TESTING.md §Common Patterns).

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/env.mjs', () => ({ env: { ADMIN_SECRET: 'test-secret' } }));

import { appRouter } from '@/server/routers/_app';

describe('quotes router multi-project isolation', () => {
  let mockDb: any;
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      project: { findUnique: vi.fn() },
      quote: { findMany: vi.fn() },
    };
  });

  it('Project A admin sees zero quotes when only Project B has quotes', async () => {
    mockDb.project.findUnique.mockResolvedValue({
      id: 'proj-a',
      slug: 'klarifai',
      name: 'Klarifai',
      projectType: 'KLARIFAI',
    });
    mockDb.quote.findMany.mockResolvedValue([]);

    const caller = appRouter.createCaller({
      db: mockDb,
      adminToken: 'test-secret',
    });
    const result = await caller.quotes.list();

    expect(result).toEqual([]);
    expect(mockDb.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          prospect: expect.objectContaining({ projectId: 'proj-a' }),
        }),
      }),
    );
  });
});
```

### Anti-Patterns to Avoid

- **Allowing `quotes.update` to touch `status`.** Status changes go through `transitionQuote` only. The Zod input on `update` must omit `status`.
- **Reading `snapshotData` with `as any`.** Use `parseSnapshot()` or `getSnapshotField()`. Existing code does `as any` on `inputSnapshot` and that bug is exactly why FOUND-03/04 exist.
- **Direct `prisma.prospect.update({ data: { status } })` from anywhere except the state machine helpers.** `admin.updateProspect` must validate via the Prospect helper (FOUND-02).
- **Adding `projectId` directly on `Quote`.** Quotes derive their project scope through `prospect.projectId`. Adding a duplicate column would create drift.
- **Hand-rolling YAML parsing.** Use the `yaml` library; never regex/split YAML files.

---

## Don't Hand-Roll

| Problem                        | Don't Build                     | Use Instead                                                             | Why                                                                                                                   |
| ------------------------------ | ------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| YAML parsing                   | Custom regex / line splitter    | `yaml` package (`parse()`)                                              | Multiline strings (`\|`), quoted keys, escapes — too many edge cases.                                                 |
| State machine library          | Full XState integration         | Plain `Record<Status, Status[]>` + helper                               | 7 states; XState would be 16KB+ for ~30 lines of logic. Locked: no XState.                                            |
| Multi-tenant filter helper     | New abstraction                 | Existing `projectAdminProcedure` middleware                             | Already gives `ctx.projectId`. Quote uses `prospect: { projectId }` join.                                             |
| Snapshot serialization library | Custom JSON shape contract      | Zod 4 `z.infer<>` + `safeParse`                                         | Single source of truth for shape + runtime validation + TypeScript type.                                              |
| Prisma migration scripting     | Raw SQL in `db push`            | `npm run db:migrate` (Prisma CLI)                                       | Generates SQL + tracks history in `prisma/migrations/`. Already standard.                                             |
| CLI argument parsing           | Custom `process.argv` walker    | Same simple `process.argv.includes('--apply')` pattern as other scripts | Existing `scripts/rerun-all-research.ts` uses 3-line `process.argv` parsing — keep it consistent, no commander/yargs. |
| Atomic Quote+Prospect update   | Two awaited writes back-to-back | `db.$transaction(async tx => ...)`                                      | Status drift is the exact failure mode the state machine prevents.                                                    |

---

## Common Pitfalls

### Pitfall 1: tRPC v11 `getRawInput()` not `rawInput`

**What goes wrong:** Copying old (v10) middleware patterns that read `rawInput` synchronously.
**Why it happens:** `prospectProcedure` in `server/trpc.ts` already uses the v11 `async ({ ctx, getRawInput, next }) => { const rawInput = await getRawInput(); ... }` pattern. Older docs/snippets still show the v10 sync API.
**How to avoid:** Mirror `prospectProcedure` exactly when writing new middleware. Quote router will not need new middleware — only new procedures on top of `projectAdminProcedure`.
**Warning signs:** TypeScript error "rawInput is not a function" or runtime "rawInput is undefined".

### Pitfall 2: ProspectStatus enum literal arrays out of sync after extension

**What goes wrong:** Adding `QUOTE_SENT` to the Prisma enum but forgetting to update one of the 15+ hardcoded `['READY','SENT','VIEWED','ENGAGED','CONVERTED']` literal arrays scattered across the codebase.
**Why it happens:** The literals exist in routers, components, tests, and library code. There's no single source of truth today.
**How to avoid:** FOUND-01 lands FIRST. After it lands, every literal array referenced below is replaced by an import from `lib/constants/prospect-statuses.ts`. The Prisma enum extension should be the LAST schema change in the migration, after the constants ship.
**Warning signs:** A test passes locally but a quote in `QUOTE_SENT` status is invisible on `/discover/[slug]` because `wizard.ts` still has the old hardcoded list.

### Pitfall 3: Prisma 7 Adapter Singleton Quirk

**What goes wrong:** Calling `new PrismaClient()` directly instead of using the `lib/prisma.ts` singleton breaks at runtime because the project uses `@prisma/adapter-pg` with a connection string, not vanilla Prisma.
**Why it happens:** Most Prisma docs still show `new PrismaClient()`. Memory note: "Prisma needs PrismaPg adapter with connectionString (not vanilla PrismaClient)".
**How to avoid:** Always `import { prisma } from '@/lib/prisma'`. The import script (`scripts/import-klarifai-yaml.ts`) must import this singleton, NOT instantiate its own client. Add `import 'dotenv/config'` at the very top of the script (memory: "dotenv needed for CLI scripts").
**Warning signs:** Cryptic "PrismaClientKnownRequestError" or connection refused on a script that works fine when called from a route.

### Pitfall 4: Snapshot Mutation After SENT

**What goes wrong:** A bug or convenience helper updates `snapshotData` on a `SENT` quote, breaking the legal "frozen offer" guarantee.
**Why it happens:** `Quote.snapshotData` is a normal Json column with no DB-level immutability constraint.
**How to avoid:** All writes to `snapshotData` must go through `transitionQuote` (Wave 0 task: code-search lint rule or commit-time grep that fails if any other file writes `snapshotData:`). The `quotes.update` mutation Zod input must explicitly OMIT `snapshotData`, `snapshotHtml`, `snapshotAt`, `templateVersion`, `snapshotStatus`, `snapshotPdfUrl`.
**Warning signs:** Acceptance test for "snapshot stays the same after a draft edit attempt" turns red.

### Pitfall 5: Negative tarief lines fail Zod validation

**What goes wrong:** OFF003 has a `Pakketkorting` line with `tarief: -800`. A naive `z.number().nonnegative()` rejects it.
**Why it happens:** The line item schema would naturally use `nonnegative` for sanity, but klarifai-core's existing pattern uses negative tarief for discount lines.
**How to avoid:** `tarief: z.number().int()` (no `.nonnegative()`). Add a unit test in `quote-snapshot.test.ts` asserting `-800` is accepted. Document the invariant in code comments.
**Warning signs:** Import script fails on OFF003 with Zod error "Number must be greater than or equal to 0".

### Pitfall 6: YAML script paths fragile across machines

**What goes wrong:** Hardcoding `/home/klarifai/Documents/klarifai/klarifai-core/data/...` makes the script unrunnable on staging or CI.
**Why it happens:** Easiest path is the absolute one.
**How to avoid:** Default to a relative path resolved from `process.cwd()` or repo root (`../klarifai-core/data` from the qualifai repo root). Allow `--source <path>` flag to override. Fail loudly if the path doesn't exist.
**Warning signs:** Script works locally for Romano, fails on any other developer machine.

### Pitfall 7: Vitest `vi.mock()` hoisting forgotten

**What goes wrong:** `vi.mock('@/env.mjs', ...)` placed AFTER an import of the module under test. Mock never applies; the real env is loaded; test fails with cryptic "ADMIN_SECRET is required".
**Why it happens:** Vitest hoists `vi.mock` calls to the top of the file but only if they appear before any imports.
**How to avoid:** All `vi.mock()` calls go at the very top of the test file, before ANY `import` statements. See `lib/outreach/send-email.test.ts` for the canonical layout.
**Warning signs:** Test only fails when run with full suite, passes when run alone.

### Pitfall 8: Prisma migration on existing data with NOT NULL columns

**What goes wrong:** Adding `Quote.snapshotStatus` as `SnapshotStatus NOT NULL DEFAULT 'PENDING'` to an empty table is fine, but if the migration is rerun on a partially-populated shadow DB it could fail.
**Why it happens:** Quote table is new — empty on first run. But migration must be safe to re-run on any DB state. Q12 explicitly says all new columns are nullable for backwards compat.
**How to avoid:** Make EVERY new column on `Quote` and `QuoteLine` nullable in the initial migration EXCEPT `id`, `createdAt`, `updatedAt`, `prospectId`, and `status` (default `DRAFT`). Specifically `snapshotStatus` should be nullable; the worker sets it to `PENDING` at SENT time, not at row creation.
**Warning signs:** `prisma migrate dev` aborts with "column contains null values" on rerun.

---

## Code Examples

### YAML import script skeleton

```typescript
// scripts/import-klarifai-yaml.ts
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const DEFAULT_SOURCE = resolve(__dirname, '../../klarifai-core/data');
const SOURCE_FLAG_INDEX = process.argv.indexOf('--source');
const SOURCE_DIR =
  SOURCE_FLAG_INDEX > -1 ? process.argv[SOURCE_FLAG_INDEX + 1] : DEFAULT_SOURCE;
const APPLY = process.argv.includes('--apply');
const PROJECT_SLUG = process.env.IMPORT_PROJECT_SLUG ?? 'klarifai';

// Fixture schemas — match the actual YAML shape we verified
const ClientYamlSchema = z.object({
  naam: z.string(),
  slug: z.string(),
  contactpersoon: z.string().optional(),
  email: z.string().email().optional(),
  adres: z
    .object({ straat: z.string(), postcode: z.string(), stad: z.string() })
    .optional(),
  standaard_tarief: z.number().optional(),
  betaaltermijn_dagen: z.number().optional(),
});

const QuoteLineYamlSchema = z.object({
  fase: z.string(),
  omschrijving: z.string(),
  oplevering: z.string(),
  uren: z.number().int(),
  tarief: z.number().int(), // negative allowed for discount lines
});

const QuoteYamlSchema = z.object({
  nummer: z.string(),
  datum: z.string(),
  geldig_tot: z.string(),
  klant: z.string(), // matches Client.slug
  status: z.string().default('concept'),
  onderwerp: z.string(),
  tagline: z.string().optional().default(''),
  introductie: z.string().optional().default(''),
  uitdaging: z.string().optional().default(''),
  aanpak: z.string().optional().default(''),
  regels: z.array(QuoteLineYamlSchema),
  btw_percentage: z.number(),
  scope: z.string().optional().default(''),
  buiten_scope: z.string().optional().default(''),
});

async function main() {
  console.log(
    `[import-klarifai-yaml] mode=${APPLY ? 'APPLY' : 'DRY'} source=${SOURCE_DIR}`,
  );

  const project = await prisma.project.findUnique({
    where: { slug: PROJECT_SLUG },
  });
  if (!project) throw new Error(`Project not found: ${PROJECT_SLUG}`);

  // 1. Clients → Prospects (idempotent on slug)
  const clientFiles = readdirSync(join(SOURCE_DIR, 'clients')).filter((f) =>
    f.endsWith('.yaml'),
  );
  for (const file of clientFiles) {
    const raw = parseYaml(
      readFileSync(join(SOURCE_DIR, 'clients', file), 'utf8'),
    );
    const client = ClientYamlSchema.parse(raw);
    // upsert by readableSlug or slug field (TBD by planner)
    // ... dry-log or apply
  }

  // 2. Quotes → Quote + QuoteLine (idempotent on nummer)
  const yearDirs = readdirSync(join(SOURCE_DIR, 'quotes'));
  for (const year of yearDirs) {
    const quoteFiles = readdirSync(join(SOURCE_DIR, 'quotes', year)).filter(
      (f) => f.endsWith('.yaml'),
    );
    for (const file of quoteFiles) {
      const raw = parseYaml(
        readFileSync(join(SOURCE_DIR, 'quotes', year, file), 'utf8'),
      );
      const quote = QuoteYamlSchema.parse(raw);
      // compute total: sum(uren * tarief) * (1 + btw/100)
      const netto = quote.regels.reduce((sum, r) => sum + r.uren * r.tarief, 0);
      const bruto = netto * (1 + quote.btw_percentage / 100);
      console.log(`[${quote.nummer}] netto=${netto} bruto=${bruto.toFixed(2)}`);
      // upsert by nummer
    }
  }

  if (!APPLY)
    console.log(
      '[import-klarifai-yaml] DRY RUN — no writes performed. Use --apply to commit.',
    );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Migration approach (Prisma CLI)

```bash
# 1. Edit prisma/schema.prisma — add Quote, QuoteLine, QuoteStatus, SnapshotStatus enums
# 2. Generate migration against shadow DB
DATABASE_URL=$DATABASE_URL SHADOW_DATABASE_URL=$SHADOW_DATABASE_URL npm run db:migrate -- --name quote_foundation

# 3. Verify migration SQL in prisma/migrations/<timestamp>_quote_foundation/migration.sql
# 4. Apply on staging BEFORE prod (handled by Vercel/Railway pipeline)
```

**Note from memory:** "DB drift: apply schema changes via docker exec psql, create migration file manually" — if the local Docker DB drifts from the migration history (already happened in v8.0), the planner may need to bypass `db:migrate` and write the SQL by hand. The PLANNER should explicitly check for drift before running migrate.

---

## State of the Art

| Old Approach                                    | Current Approach                                | When Changed         | Impact                                     |
| ----------------------------------------------- | ----------------------------------------------- | -------------------- | ------------------------------------------ |
| tRPC v10 `rawInput` synchronous                 | tRPC v11 `async getRawInput()`                  | tRPC 11 release      | All new middleware MUST use the async API. |
| Hardcoded status string literals everywhere     | Typed `as const` arrays with `typeof` types     | Phase 60 (now)       | Single source of truth for status checks.  |
| Untyped `Json` snapshots accessed with `as any` | Zod 4 schemas + `safeParse` accessor helpers    | Phase 60 (now)       | Compile-time + runtime safety.             |
| Direct status writes from any router            | State machine helpers as the only mutation path | Phase 60 (now)       | Prevents illegal transitions silently.     |
| `js-yaml`                                       | `yaml` (eemeli/yaml)                            | Node ecosystem 2023+ | Better TypeScript story, zero deps.        |

**Deprecated/outdated:**

- Klarifai-core's CLI commands (`npm run quote`) — being replaced by Qualifai admin UI in Phase 61. Not Phase 60 work, but the import script is the one-way migration.

---

## Existing Prisma Schema (verified)

### `ProspectStatus` (current — 9 values)

```prisma
enum ProspectStatus {
  DRAFT
  ENRICHED
  GENERATING
  READY
  SENT
  VIEWED
  ENGAGED
  CONVERTED
  ARCHIVED
}
```

**Phase 60 change:** Insert `QUOTE_SENT` between `ENGAGED` and `CONVERTED`. Result:

```prisma
enum ProspectStatus {
  DRAFT
  ENRICHED
  GENERATING
  READY
  SENT
  VIEWED
  ENGAGED
  QUOTE_SENT     // NEW (Phase 60, DATA-04)
  CONVERTED
  ARCHIVED
}
```

### `Prospect` model relations (current)

Already has 18+ relations: `sessions`, `notificationLogs`, `contacts`, `signals`, `campaignProspects`, `researchRuns`, `evidenceItems`, `workflowHypotheses`, `automationOpportunities`, `proofMatches`, `workflowLossMaps`, `outreachSequences`, `callPrepPlans`, `gateOverrideAudits`, `siteCatalogRuns`, `siteCatalogUrls`, `intentExtractions`, `prospectAnalyses`, `outreachLogs`.

**Phase 60 addition:** `quotes  Quote[]`

### Cascade rules pattern (verified)

Existing prospect-owned models use:

```prisma
prospectId String
prospect   Prospect @relation(fields: [prospectId], references: [id], onDelete: Cascade)
```

Examples: `Contact`, `WizardSession`, `WorkflowHypothesis`, `EvidenceItem`. **Quote should follow the same pattern** unless we need to preserve historical quotes after prospect deletion (planner decision; legal/audit suggests we might want `Restrict` instead — flag for discussion).

### Existing migration that mentions "quote" but is NOT a Quote model

`prisma/migrations/20260221120000_readable_slug_and_quote/migration.sql` adds `WizardSession.quoteRequested: Boolean` and `quoteRequestedAt: DateTime`. There is NO existing `Quote` model in the schema. Phase 60 starts from a clean slate.

---

## ProspectStatus Hardcoded Literal Inventory (FOUND-01 Refactor Targets)

Comprehensive grep of `'(DRAFT|ENRICHED|GENERATING|READY|SENT|VIEWED|ENGAGED|CONVERTED|ARCHIVED)'` across the codebase.

### Server (router files — must refactor in Phase 60)

| File                           | Lines                                                                              | Purpose                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `server/trpc.ts`               | 72                                                                                 | `prospectProcedure` public-access whitelist                                |
| `server/routers/wizard.ts`     | 32, 69, 75, 120, 189, 245, 248                                                     | Public visibility filter, first-view trigger, ENGAGED, CONVERTED           |
| `server/routers/admin.ts`      | 93, 193, 293, 315, 341, 386, 408, 658-666, 701, 1036, 1319, 1322, 1325, 1328, 1379 | Status filters, `updateProspect` Zod enum, dashboard counts, listProspects |
| `server/routers/campaigns.ts`  | 372, 381, 415                                                                      | Funnel counting (`SENT`, `CONVERTED`)                                      |
| `server/routers/contacts.ts`   | 408                                                                                | Contact `outreachStatus === 'CONVERTED'` check                             |
| `server/routers/search.ts`     | 101, 272                                                                           | `ENRICHED`, `DRAFT` defaults                                               |
| `server/routers/research.ts`   | 517                                                                                | Reset to DRAFT                                                             |
| `server/routers/outreach.ts`   | 184, 191, 1369, 1450                                                               | OutreachStep status (NOT ProspectStatus — leave)                           |
| `server/routers/sequences.ts`  | 20, 87, 110, 175                                                                   | Sequence/step status (NOT ProspectStatus — leave)                          |
| `server/routers/hypotheses.ts` | 221, 250                                                                           | HypothesisStatus enum (NOT ProspectStatus — leave)                         |

**Note:** Many of the above are NOT `ProspectStatus` — they're `OutreachStatus`, `SequenceStatus`, `HypothesisStatus`, etc. The planner must distinguish these. **Only `ProspectStatus` literals are in scope for FOUND-01.** A quick way to disambiguate: any literal compared to a `prospect.status` or `Prospect.status` field is in scope; literals compared to `step.status`, `seq.status`, `outreachStatus`, `hypothesis.status` are NOT.

### Likely-in-scope ProspectStatus call sites (curated subset)

```
server/trpc.ts:72            prospect public visibility allowlist
server/routers/wizard.ts:32  same allowlist (duplicated)
server/routers/wizard.ts:69  first-view check
server/routers/wizard.ts:75  status: 'VIEWED' write
server/routers/wizard.ts:120 status: 'ENGAGED' write
server/routers/wizard.ts:189 status: 'CONVERTED' write
server/routers/wizard.ts:245 status !== 'CONVERTED' guard
server/routers/wizard.ts:248 status: 'CONVERTED' write
server/routers/admin.ts:93   default 'ENRICHED' on import
server/routers/admin.ts:193  set DRAFT on reset
server/routers/admin.ts:293  set GENERATING during pipeline
server/routers/admin.ts:315  set READY on completion
server/routers/admin.ts:341  set DRAFT on failure
server/routers/admin.ts:386  set GENERATING (second path)
server/routers/admin.ts:408  set READY (second path)
server/routers/admin.ts:658-666  Zod enum on updateProspect
server/routers/admin.ts:701  set DRAFT (third path)
server/routers/admin.ts:1036 status in ['READY','ENRICHED']
server/routers/admin.ts:1319-1328 dashboard counts (READY, VIEWED, ENGAGED, CONVERTED)
server/routers/campaigns.ts:372,381,415  funnel reporting
```

### Library code (also affected — must verify scope per file)

| File                             | Lines                      | Notes                                                                                          |
| -------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `lib/pipeline-stage.ts`          | 25, 26, 27, 35, 38, 39, 45 | Uses `ProspectStatus` strings explicitly. **In scope.**                                        |
| `lib/outreach/send-email.ts`     | 153                        | Sets `OutreachLog.status` — NOT ProspectStatus. Out of scope.                                  |
| `lib/outreach/quality.ts`        | 412, 454                   | `contact.outreachStatus === 'CONVERTED'` — `OutreachStatus`, NOT ProspectStatus. Out of scope. |
| `lib/outreach/reply-workflow.ts` | 170, 171, 189              | Step statuses + `prospect.status: 'ENGAGED'` write at 189 — line 189 IS in scope.              |
| `lib/cadence/engine.ts`          | 249                        | `step.status === 'SENT'` — NOT ProspectStatus. Out of scope.                                   |

### Components (must refactor)

| File                                              | Line | Purpose                                                    |
| ------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `components/public/prospect-dashboard-client.tsx` | 330  | `['SENT','VIEWED','ENGAGED','CONVERTED']` allowlist        |
| `components/ui/status-badge.tsx`                  | 7-15 | Status type union (literal) — should derive from constants |

### App routes

| File                               | Line | Purpose                                |
| ---------------------------------- | ---- | -------------------------------------- |
| `app/discover/[slug]/page.tsx`     | 280  | `prospect.status === 'ARCHIVED'` guard |
| `app/api/webhooks/calcom/route.ts` | 387  | `data: { status: 'ENGAGED' }` write    |

### Total Scope Estimate

- **In-scope ProspectStatus literals:** ~30-35 call sites across ~10 files.
- **Refactor strategy:** Land `lib/constants/prospect-statuses.ts` first. Then sweep call sites in a single PR/wave. Tests before refactor to catch regressions.

### Suggested constants to expose

```typescript
// lib/constants/prospect-statuses.ts
import type { ProspectStatus } from '@prisma/client';

export const ALL_PROSPECT_STATUSES = [
  'DRAFT',
  'ENRICHED',
  'GENERATING',
  'READY',
  'SENT',
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
  'ARCHIVED',
] as const satisfies readonly ProspectStatus[];

/** Statuses where the public /discover/[slug] page is visible. */
export const PUBLIC_VISIBLE_STATUSES = [
  'READY',
  'SENT',
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
] as const satisfies readonly ProspectStatus[];

/** Statuses where the wizard counts as already-viewed. */
export const POST_FIRST_VIEW_STATUSES = [
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
] as const satisfies readonly ProspectStatus[];

/** Statuses where a Quote can be sent. */
export const QUOTE_SENDABLE_STATUSES = [
  'ENGAGED',
  'QUOTE_SENT',
] as const satisfies readonly ProspectStatus[];

export type PublicVisibleStatus = (typeof PUBLIC_VISIBLE_STATUSES)[number];
```

---

## Marfa Quote Shape (verified against klarifai-core)

### `klarifai-core/data/clients/marfa.yaml`

```yaml
naam: Marfa
slug: marfa
contactpersoon: Marfa
email: info@marfa.nl
adres:
  straat: Nog in te vullen
  postcode: '0000AA'
  stad: Nog in te vullen
standaard_tarief: 95
betaaltermijn_dagen: 14
```

### `klarifai-core/data/quotes/2026/2026-OFF001.yaml` (representative)

```yaml
nummer: '2026-OFF001'
datum: '2026-04-10'
geldig_tot: '2026-05-10'
klant: marfa
status: concept
onderwerp: 'Rebuild Plancraft in Marfa-vorm'
tagline: 'Een pragmatische rebuild van jullie bestaande tool, klaar om door te groeien.'
introductie: |
  TODO: Samen met Marfa uitschrijven — context van de samenwerking, achtergrond project.
uitdaging: |
  TODO: ...
aanpak: |
  TODO: ...
regels:
  - fase: 'Discovery & analyse'
    omschrijving: '...'
    oplevering: 'TODO: ...'
    uren: 8
    tarief: 95
  - fase: 'Rebuild & development'
    omschrijving: '...'
    oplevering: 'TODO: ...'
    uren: 48
    tarief: 95
  - fase: 'Testing & oplevering'
    omschrijving: '...'
    oplevering: 'TODO: ...'
    uren: 12
    tarief: 95
btw_percentage: 21
scope: |
  - Volledige rebuild van bestaande Plancraft-functionaliteit
  - ...
buiten_scope: |
  - Nieuwe features buiten huidige Plancraft-scope
  - ...
```

### Confirmed totals

| Quote       | Lines                                 | Netto (€) | BTW 21%  | Bruto (€)       |
| ----------- | ------------------------------------- | --------- | -------- | --------------- |
| 2026-OFF001 | (8 + 48 + 12) × 95                    | 6.460,00  | 1.356,60 | **7.816,60** ✓  |
| 2026-OFF002 | (16 + 72 + 12) × 95                   | 9.500,00  | 1.995,00 | **11.495,00** ✓ |
| 2026-OFF003 | (16 + 72 + 20 + 16) × 95 + (1 × −800) | 10.980,00 | 2.305,80 | **13.285,80** ✓ |

**OFF003 has a negative-tarief discount line** (`Pakketkorting`, `uren: 1`, `tarief: -800`). This is the canonical pattern for discounts in klarifai-core. The QuoteLine schema MUST allow negative `tarief` values (see Pitfall 5).

### Field mapping → Qualifai models

| YAML field (client)   | Qualifai `Prospect` field                  | Notes                                                                                                                                                                 |
| --------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`                | `Prospect.slug` OR `Prospect.readableSlug` | **Planner decision** — `slug` is 12-char CUID-style today. `readableSlug` is 80-char human. Use `readableSlug` for matching, generate a fresh `slug` if creating new. |
| `naam`                | `companyName`                              |                                                                                                                                                                       |
| `contactpersoon`      | (Contact record? or `internalNotes`?)      | Marfa value is currently "Marfa" (placeholder). Defer to planner.                                                                                                     |
| `email`               | (Contact record?)                          | Defer.                                                                                                                                                                |
| `adres.*`             | `city`, etc.                               | Marfa values are placeholders. Skip on import or warn.                                                                                                                |
| `standaard_tarief`    | (no current field)                         | Could become a Prospect-level rate or stored on Quote default. Likely just import into a custom field on Quote default tarief.                                        |
| `betaaltermijn_dagen` | (no current field)                         | Same — could be Prospect-level. Defer.                                                                                                                                |

| YAML field (quote)      | Qualifai `Quote` field                     | Notes                             |
| ----------------------- | ------------------------------------------ | --------------------------------- |
| `nummer`                | `Quote.nummer` (unique per project)        | Used as idempotency key.          |
| `datum`                 | `Quote.datum` (DateTime, parsed from ISO)  |                                   |
| `geldig_tot`            | `Quote.geldigTot` (DateTime)               |                                   |
| `klant`                 | `Quote.prospectId` (FK lookup by slug)     | If prospect not found, hard fail. |
| `status: concept`       | `Quote.status: DRAFT`                      | Map "concept" → DRAFT.            |
| `onderwerp`             | `Quote.onderwerp`                          |                                   |
| `tagline`               | `Quote.tagline`                            |                                   |
| `introductie`           | `Quote.introductie`                        | Multiline `\|` block from YAML.   |
| `uitdaging`             | `Quote.uitdaging`                          |                                   |
| `aanpak`                | `Quote.aanpak`                             |                                   |
| `btw_percentage`        | `Quote.btwPercentage` (Int)                |                                   |
| `scope`                 | `Quote.scope` (Text)                       |                                   |
| `buiten_scope`          | `Quote.buitenScope` (Text)                 |                                   |
| `regels[].fase`         | `QuoteLine.fase`                           |                                   |
| `regels[].omschrijving` | `QuoteLine.omschrijving`                   |                                   |
| `regels[].oplevering`   | `QuoteLine.oplevering` (Text, can be TODO) |                                   |
| `regels[].uren`         | `QuoteLine.uren` (Int)                     |                                   |
| `regels[].tarief`       | `QuoteLine.tarief` (Int, **signed**)       | Must allow negative.              |

---

## Validation Architecture

### Test Framework

| Property           | Value                                                               |
| ------------------ | ------------------------------------------------------------------- |
| Framework          | Vitest 4.0.18 + jsdom + @vitejs/plugin-react                        |
| Config file        | `vitest.config.ts` (verified, exists, no Wave 0 work needed)        |
| Globals            | Enabled (`describe`, `it`, `expect`, `vi` available without import) |
| Setup file         | `vitest.setup.ts` (mocks `next/navigation`, `next/config`)          |
| Co-location        | `*.test.ts` next to source file                                     |
| Quick run command  | `npm run test -- <path-or-pattern>`                                 |
| Full suite command | `npm run test`                                                      |
| Coverage           | `npm run test:coverage`                                             |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                                                           | Test Type             | Automated Command                                                                                           | File Exists?                           |
| --------- | ------------------------------------------------------------------------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| DATA-01   | Quote model has all narrative + meta fields                                                                        | schema check          | `npm run db:generate && tsc --noEmit`                                                                       | ❌ Wave 0 — schema edit                |
| DATA-02   | QuoteLine model has all line fields, FK to Quote                                                                   | schema check          | `npm run db:generate && tsc --noEmit`                                                                       | ❌ Wave 0 — schema edit                |
| DATA-03   | QuoteStatus enum has 7 expected values                                                                             | type check            | `tsc --noEmit` (referenced in state machine + Zod input)                                                    | ❌ Wave 0 — schema edit                |
| DATA-04   | ProspectStatus enum has new QUOTE_SENT value between ENGAGED and CONVERTED                                         | type check            | `tsc --noEmit`                                                                                              | ❌ Wave 0 — schema edit                |
| DATA-05   | Quote has 6 snapshot fields with correct types                                                                     | schema check          | `npm run db:generate && tsc --noEmit`                                                                       | ❌ Wave 0 — schema edit                |
| DATA-06   | Quote → Prospect FK with cascade rules consistent with existing pattern                                            | manual review         | inspect generated migration SQL                                                                             | ❌ Wave 0 — schema edit                |
| DATA-07   | Migration runs cleanly on shadow DB; new columns nullable                                                          | migration run         | `DATABASE_URL=$SHADOW_DB npm run db:migrate -- --name quote_foundation`                                     | ❌ Wave 0 — migration created in phase |
| DATA-08   | tRPC `quotes.create` works                                                                                         | unit                  | `npm run test -- server/routers/quotes.test.ts -t 'create'`                                                 | ❌ Wave 0 — test file new              |
| DATA-08   | tRPC `quotes.list` works                                                                                           | unit                  | `npm run test -- server/routers/quotes.test.ts -t 'list'`                                                   | ❌ Wave 0                              |
| DATA-08   | tRPC `quotes.get` works                                                                                            | unit                  | `npm run test -- server/routers/quotes.test.ts -t 'get'`                                                    | ❌ Wave 0                              |
| DATA-08   | tRPC `quotes.update` rejects status field in input                                                                 | unit                  | `npm run test -- server/routers/quotes.test.ts -t 'update.*status'`                                         | ❌ Wave 0                              |
| DATA-09   | `quotes.transition(SENT)` writes Quote.status=SENT AND Prospect.status=QUOTE_SENT in one transaction               | unit                  | `npm run test -- lib/state-machines/quote.test.ts -t 'transitionQuote.*SENT'`                               | ❌ Wave 0                              |
| DATA-09   | `quotes.transition(ACCEPTED)` writes Quote.ACCEPTED AND Prospect.CONVERTED in one transaction                      | unit                  | `npm run test -- lib/state-machines/quote.test.ts -t 'ACCEPTED.*CONVERTED'`                                 | ❌ Wave 0                              |
| DATA-09   | `quotes.transition(REJECTED)` writes Quote.REJECTED AND Prospect.ENGAGED in one transaction                        | unit                  | `npm run test -- lib/state-machines/quote.test.ts -t 'REJECTED.*ENGAGED'`                                   | ❌ Wave 0                              |
| DATA-09   | `quotes.transition(VIEWED)` does NOT change Prospect.status                                                        | unit                  | `npm run test -- lib/state-machines/quote.test.ts -t 'VIEWED.*no prospect'`                                 | ❌ Wave 0                              |
| DATA-09   | Snapshot is frozen on DRAFT → SENT (snapshotData, snapshotAt, templateVersion populated)                           | unit                  | `npm run test -- lib/state-machines/quote.test.ts -t 'snapshot frozen'`                                     | ❌ Wave 0                              |
| DATA-10   | Multi-tenant: `quotes.list` from Project A returns zero when only Project B has quotes                             | unit (TEST-03)        | `npm run test -- server/routers/quotes.test.ts -t 'multi-project isolation'`                                | ❌ Wave 0                              |
| FOUND-01  | All ProspectStatus literals replaced; `lib/constants/prospect-statuses.ts` is the only source                      | static + unit         | `npm run test -- lib/constants/prospect-statuses.test.ts` + grep regression check                           | ❌ Wave 0 — constants file new         |
| FOUND-02  | `admin.updateProspect(CONVERTED → DRAFT)` returns PRECONDITION_FAILED, no DB write happens                         | unit (TEST-01)        | `npm run test -- lib/state-machines/prospect.test.ts -t 'invalid transition'`                               | ❌ Wave 0                              |
| FOUND-02  | `admin.updateProspect(DRAFT → ENRICHED)` succeeds                                                                  | unit (TEST-01)        | `npm run test -- lib/state-machines/prospect.test.ts -t 'valid transition'`                                 | ❌ Wave 0                              |
| FOUND-03  | Malformed snapshotData rejected by Zod (missing required field)                                                    | unit (TEST-05)        | `npm run test -- lib/schemas/quote-snapshot.test.ts -t 'reject malformed'`                                  | ❌ Wave 0                              |
| FOUND-03  | Valid snapshotData accepted, including OFF003 with negative tarief                                                 | unit (TEST-05)        | `npm run test -- lib/schemas/quote-snapshot.test.ts -t 'accept negative tarief'`                            | ❌ Wave 0                              |
| FOUND-04  | `getSnapshotField()` returns typed value with fallback when field missing                                          | unit                  | `npm run test -- lib/schemas/quote-snapshot.test.ts -t 'accessor'`                                          | ❌ Wave 0                              |
| FOUND-04  | `parseSnapshot(null)` returns null without throwing                                                                | unit                  | `npm run test -- lib/schemas/quote-snapshot.test.ts -t 'parse null'`                                        | ❌ Wave 0                              |
| IMPORT-01 | Importing marfa.yaml creates/updates Prospect by readableSlug                                                      | integration (TEST-04) | `npm run test -- scripts/import-klarifai-yaml.test.ts -t 'client import'`                                   | ❌ Wave 0                              |
| IMPORT-02 | Importing 3 quote YAMLs creates/updates 3 Quote rows + line items, idempotent on `nummer`                          | integration (TEST-04) | `npm run test -- scripts/import-klarifai-yaml.test.ts -t 'quote import'`                                    | ❌ Wave 0                              |
| IMPORT-03 | `--dry` flag (default) performs no writes; `--apply` performs writes                                               | integration (TEST-04) | `npm run test -- scripts/import-klarifai-yaml.test.ts -t 'dry vs apply'`                                    | ❌ Wave 0                              |
| IMPORT-04 | After `--apply`, the 3 Marfa quotes exist with totals matching klarifai-core (€7.816,60 / €11.495,00 / €13.285,80) | integration (TEST-04) | `tsx scripts/import-klarifai-yaml.ts --apply && tsx scripts/verify-marfa.ts` (verify script TBD or use SQL) | ❌ Wave 0 — manual smoke check         |
| TEST-01   | Prospect state machine transition tests (valid + invalid)                                                          | unit                  | `npm run test -- lib/state-machines/prospect.test.ts`                                                       | ❌ Wave 0                              |
| TEST-02   | Quote state machine transition tests including auto-sync                                                           | unit                  | `npm run test -- lib/state-machines/quote.test.ts`                                                          | ❌ Wave 0                              |
| TEST-03   | Multi-project isolation test for quotes.\* endpoints                                                               | unit                  | `npm run test -- server/routers/quotes.test.ts -t 'isolation'`                                              | ❌ Wave 0                              |
| TEST-04   | Integration test for YAML import script — 3 Marfa fixtures, record counts + totals                                 | integration           | `npm run test -- scripts/import-klarifai-yaml.test.ts`                                                      | ❌ Wave 0                              |
| TEST-05   | Snapshot Zod validation (malformed rejected, valid accepted)                                                       | unit                  | `npm run test -- lib/schemas/quote-snapshot.test.ts`                                                        | ❌ Wave 0                              |

### Sampling Rate

- **Per task commit:** `npm run test -- <changed-test-file>` (sub-second)
- **Per wave merge:** `npm run test -- lib/state-machines lib/schemas lib/constants server/routers/quotes.test.ts scripts/import-klarifai-yaml.test.ts` (target: < 30 seconds)
- **Phase gate:** Full `npm run test` green + `npx tsc --noEmit` clean + `npx prisma format` clean + `npm run lint` clean before `/gsd:verify-work`
- **Manual smoke check at gate:** Romano runs `tsx scripts/import-klarifai-yaml.ts --apply` against staging DB and verifies in Prisma Studio that the 3 Marfa quotes exist with correct totals. This is the success criterion #1 from ROADMAP Phase 60.

### Wave 0 Gaps

All test files are NEW (no existing tests for Quote, state machines, prospect status constants, or the import script). Wave 0 must create:

- [ ] `lib/constants/prospect-statuses.ts` — typed constants (FOUND-01)
- [ ] `lib/constants/prospect-statuses.test.ts` — type-level checks for constant arrays
- [ ] `lib/state-machines/prospect.ts` — transition validator (FOUND-02)
- [ ] `lib/state-machines/prospect.test.ts` — TEST-01 (valid + invalid transitions)
- [ ] `lib/state-machines/quote.ts` — `transitionQuote` helper (DATA-09)
- [ ] `lib/state-machines/quote.test.ts` — TEST-02 (state machine + auto-sync + snapshot freeze)
- [ ] `lib/schemas/quote-snapshot.ts` — Zod schema + accessors (FOUND-03, FOUND-04)
- [ ] `lib/schemas/quote-snapshot.test.ts` — TEST-05 (Zod validation, accessor edge cases)
- [ ] `server/routers/quotes.ts` — new tRPC router (DATA-08, DATA-09, DATA-10)
- [ ] `server/routers/quotes.test.ts` — TEST-03 (multi-project isolation + CRUD smoke)
- [ ] `scripts/import-klarifai-yaml.ts` — IMPORT-01..04
- [ ] `scripts/import-klarifai-yaml.test.ts` — TEST-04 (uses real fixtures from klarifai-core)
- [ ] `prisma/migrations/<timestamp>_quote_foundation/migration.sql` — generated by `npm run db:migrate`
- [ ] `package.json` — add `yaml` dependency

**Framework install:** None — Vitest already configured. Only library addition is `npm install yaml`.

**No conftest / shared fixtures needed:** Each test file follows the existing co-located pattern. Mock factories live at the top of each test file (per `lib/outreach/send-email.test.ts` convention).

---

## Open Questions

1. **Cascade rule on Quote → Prospect FK**
   - What we know: Existing prospect-owned models use `onDelete: Cascade`.
   - What's unclear: Quotes are legally meaningful documents. Cascade-deleting a quote when a prospect is removed could destroy evidence.
   - **Recommendation:** `onDelete: Restrict` for `Quote.prospectId`. Forces explicit archival via `Quote.status = ARCHIVED` before a Prospect can be deleted. Planner should ask Romano.

2. **Slug field for Prospect matching in import**
   - What we know: `Prospect` has both `slug` (12-char CUID) and `readableSlug` (80-char human).
   - What's unclear: klarifai-core YAML uses `slug: marfa` (a human-readable name, not a CUID).
   - **Recommendation:** Match on `readableSlug` first; if no match, create a new Prospect with `readableSlug = yaml.slug` and a generated CUID for `slug`. Document this in the import script's header comment.

3. **`Quote.nummer` uniqueness scope**
   - What we know: klarifai-core YAML uses `2026-OFF001` style identifiers; uniqueness is global in klarifai-core.
   - What's unclear: Should `nummer` be unique per project or globally?
   - **Recommendation:** Per project (`@@unique([projectId, nummer])` if we add `projectId` directly OR `@@unique([nummer])` since the import is single-project for now). Phase 60 is single-tenant for Marfa, so global unique is fine; revisit if multi-project quotes ever overlap. Planner decision.

4. **Where does `templateVersion` come from at SENT time?**
   - What we know: Q12 says ISO date or git hash, no counter.
   - What's unclear: What computes/provides the value when `transitionQuote(SENT)` runs?
   - **Recommendation:** Read from `process.env.QUOTE_TEMPLATE_VERSION` if set, else fall back to today's ISO date. Phase 62 will set this env var per deploy. Document the convention in `lib/state-machines/quote.ts`.

5. **`replacesId` field on Quote**
   - What we know: Q9 mentions "new Quote with `replacesId` pointing to archived one."
   - What's unclear: Is `replacesId` a Phase 60 deliverable, or Phase 61 (when the admin UI introduces "create new version")?
   - **Recommendation:** Add the column NOW in Phase 60 (nullable self-FK). It costs nothing in this migration and avoids a second migration in Phase 61.

6. **`Contact` import from YAML**
   - What we know: marfa.yaml has `contactpersoon` and `email` at the top level, not as a list.
   - What's unclear: Should the import script create a `Contact` row, or store this on the `Prospect`?
   - **Recommendation:** Out of Phase 60 scope. Marfa's YAML values are placeholders ("Marfa", `info@marfa.nl`). Skip Contact creation; log a warning. Romano can fill in real contacts in Phase 61's admin UI.

---

## Sources

### Primary (HIGH confidence — direct file inspection)

- `prisma/schema.prisma` (lines 1-300, plus targeted greps) — current ProspectStatus enum, Prospect model, Project model
- `server/trpc.ts` — projectAdminProcedure, prospectProcedure (v11 getRawInput pattern verified)
- `server/routers/_app.ts` — router composition pattern
- `server/routers/use-cases.ts` (lines 1-120) — CRUD reference template
- `server/routers/admin.ts` (lines 640-700) — current updateProspect mutation shape
- `server/routers/wizard.ts` (lines 1-100) — public wizard status writes
- `lib/pipeline-stage.ts` — closest existing pseudo-state-machine; informs helper API design
- `package.json` — dependency versions, no yaml lib confirmed
- `vitest.config.ts` — test setup (jsdom, globals, co-located)
- `.planning/codebase/TESTING.md` — full testing patterns documentation
- `.planning/codebase/ARCHITECTURE.md` — layer boundaries, error handling
- `.planning/codebase/STACK.md` — versions and infrastructure
- `.planning/codebase/STRUCTURE.md` — directory layout, where-to-add-code
- `.planning/codebase/CONCERNS.md` — fragile areas, FOUND-01..04 rationale
- `.planning/REQUIREMENTS.md` — DATA-/FOUND-/IMPORT-/TEST- requirements
- `.planning/ROADMAP.md` — Phase 60 success criteria
- `klarifai-core/data/clients/marfa.yaml` — verified client YAML shape
- `klarifai-core/data/quotes/2026/2026-OFF001.yaml` — verified quote YAML shape
- `klarifai-core/data/quotes/2026/2026-OFF002.yaml` — verified
- `klarifai-core/data/quotes/2026/2026-OFF003.yaml` — verified, includes negative-tarief discount line
- `klarifai-core/docs/strategy/decisions.md` — Q5/Q8/Q9/Q12/Q13/Q14 locked decisions
- `klarifai-core/docs/strategy/HANDOFF.md` §2 — pre-answered planner FAQ (Prisma migration strategy, state machine pattern, test framework, import script path, scattered literals strategy)

### Secondary (MEDIUM confidence — existing project memory)

- Memory note: "Prisma needs PrismaPg adapter with connectionString" — confirmed by inspecting `lib/prisma.ts` is the singleton; planner must not instantiate a fresh client.
- Memory note: "tRPC v11 middleware uses async getRawInput()" — confirmed in `server/trpc.ts:55-83`.
- Memory note: "dotenv needed for CLI scripts" — applied to import script header.

### Tertiary (LOW confidence — none)

- No web research was needed; all questions are answered by repo inspection and locked decisions.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — package.json + version files inspected directly
- Architecture / patterns: HIGH — existing routers (use-cases, wizard) provide direct templates; TESTING.md verified against `lib/outreach/send-email.test.ts`
- Pitfalls: HIGH — derived from CONCERNS.md, MEMORY.md, and direct inspection of v8.0 patterns (negative tarief specifically observed in OFF003.yaml)
- ProspectStatus call-site inventory: HIGH — comprehensive grep across server/, lib/, components/, app/ directories (note: planner must filter out non-ProspectStatus literals — guidance provided)
- YAML / Marfa fixture totals: HIGH — manually computed and verified against klarifai-core HANDOFF §3 ("Wat werkt: Totalen: OFF001 €7.816,60 · OFF002 €11.495,00 · OFF003 €13.285,80")
- State machine helper API: MEDIUM — green field, no existing pattern in repo to mirror; proposed shape is conventional but the planner may refine
- Migration strategy: MEDIUM — Prisma CLI is standard, but the local Docker DB has historic drift (memory note v8.0). Planner must verify shadow DB state before running `db:migrate`.

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30 days; stack is stable, no fast-moving dependencies in scope)
