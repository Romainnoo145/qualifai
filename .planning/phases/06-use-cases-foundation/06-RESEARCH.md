# Phase 6: Use Cases Foundation - Research

**Researched:** 2026-02-20
**Domain:** Prisma model migration, tRPC CRUD router, Claude-powered semantic matching, admin UI
**Confidence:** HIGH

---

## Summary

Phase 6 replaces the flat Obsidian JSON proof catalog (`OBSIDIAN_INVENTORY_JSON_PATH`, `OBSIDIAN_CLIENT_OFFERS_JSON_PATH`) with a database-managed `UseCase` model. The codebase has been read in full and the integration points are fully understood: `matchProofs()` in `lib/workflow-engine.ts` currently reads from the filesystem via `loadProofCatalog()` and `readJsonSafe()`, and two callers exist — `server/routers/proof.ts` and `server/routers/campaigns.ts` — both of which have `ctx.db` available and require only a one-line call-site update when `matchProofs()` accepts a `db` parameter.

The existing proof infrastructure (`ProofMatch` model, `proofId` string field, `isRealShipped`, `isCustomPlan` flags) is stable and stays unchanged. Phase 6 adds a `useCaseId` FK to `ProofMatch` for new DB-backed matches while keeping `proofId` for backwards compatibility with legacy JSON-backed match records. The admin UI follows the identical pattern of `app/admin/campaigns/page.tsx` — a `'use client'` page using `api` (tRPC React Query) with `useQuery`/`useMutation` and inline form state.

The key architectural decision for matching: the existing `toTokens()` keyword-overlap scorer works as an MVP fallback but scores poorly against Dutch-language evidence snippets. The `ANTHROPIC_API_KEY` is already in the stack (`@anthropic-ai/sdk` is a production dependency). The recommended approach is Claude-powered semantic scoring as the primary matcher, with keyword fallback when Claude is unavailable. This is the correct choice per the requirements ("AI-powered matching links prospect pain points to relevant use cases using Claude") and the prior decision document explicitly calls for NL synonym tags.

**Primary recommendation:** Add `UseCase` model with a `tags String[]` field for NL synonyms, write a `server/routers/use-cases.ts` with CRUD + import procedures, update `matchProofs()` to accept `db` and use Claude for semantic scoring, and build `app/admin/use-cases/page.tsx` following the campaigns page pattern.

---

## Standard Stack

### Core (all already in project — no new installs required)

| Library             | Version   | Purpose                             | Why Standard                  |
| ------------------- | --------- | ----------------------------------- | ----------------------------- |
| `prisma`            | `^7.3.0`  | Schema migration, query client      | Already used for all models   |
| `@prisma/client`    | `^7.3.0`  | DB queries in tRPC routers          | Already used everywhere       |
| `@anthropic-ai/sdk` | `^0.73.0` | Claude API for semantic matching    | Already production dependency |
| `zod`               | `^4.3.6`  | Input validation in tRPC procedures | Already used in all routers   |
| `@trpc/server`      | `11.9.0`  | Router/procedure definition         | Already used in all routers   |

### No New Dependencies Required

This phase is pure schema + code — no npm installs needed.

**Installation:**

```bash
# No new packages — everything already in package.json
```

---

## Architecture Patterns

### Recommended Project Structure

```
prisma/
├── schema.prisma                    # Add UseCase model + ProofMatch.useCaseId FK
├── migrations/YYYYMMDDHHMMSS_use_cases/
│   └── migration.sql
server/routers/
├── use-cases.ts                     # NEW: CRUD + import router
├── _app.ts                          # MODIFIED: add useCasesRouter
├── proof.ts                         # MODIFIED: pass ctx.db to matchProofs()
├── campaigns.ts                     # MODIFIED: pass ctx.db to matchProofs()
lib/
└── workflow-engine.ts               # MODIFIED: matchProofs() accepts db, uses Claude
app/admin/
└── use-cases/
    └── page.tsx                     # NEW: admin list/create/edit/delete/import page
```

### Pattern 1: Prisma Model Addition

**What:** Add `UseCase` to `prisma/schema.prisma` alongside `ProofMatch.useCaseId` FK.

**When to use:** Any time a new entity is needed in the domain.

**Example:**

```prisma
// Source: existing schema.prisma patterns (Campaign, EvidenceItem)
model UseCase {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  title       String
  summary     String
  category    String           // 'workflow' | 'automation' | 'intake' | 'reporting'
  outcomes    String[]         // bullet outcomes (e.g. "40% faster invoice cycle")
  tags        String[]         // NL + EN synonym tags for semantic matching
  caseStudyRefs String[]       // references to case study files / URLs
  isActive    Boolean  @default(true)
  isShipped   Boolean  @default(true)   // false = planned/custom
  sourceRef   String?          // original proofId from Obsidian migration
  externalUrl String?

  proofMatches ProofMatch[]

  @@index([isActive, isShipped])
  @@index([category])
}
```

Add to `ProofMatch`:

```prisma
model ProofMatch {
  // ... all existing fields unchanged ...
  useCaseId   String?
  useCase     UseCase? @relation(fields: [useCaseId], references: [id], onDelete: SetNull)
}
```

**Critical:** `proofId String?` and `proofTitle String` already exist on `ProofMatch`. Do NOT rename or remove them — they are used by historical records. New matches set `useCaseId` AND still populate `proofTitle` (from `useCase.title`) for display consistency.

### Pattern 2: tRPC CRUD Router

**What:** `server/routers/use-cases.ts` — follows the exact pattern of `campaigns.ts` and `hypotheses.ts`.

**When to use:** Any admin-only CRUD resource.

**Example:**

```typescript
// Source: server/routers/campaigns.ts pattern
import { z } from 'zod';
import { adminProcedure, router } from '../trpc';

export const useCasesRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          isActive: z.boolean().optional(),
          limit: z.number().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.useCase.findMany({
        where: {
          ...(input?.isActive !== undefined && { isActive: input.isActive }),
          ...(input?.category && { category: input.category }),
        },
        orderBy: { updatedAt: 'desc' },
        take: input?.limit ?? 100,
        include: { _count: { select: { proofMatches: true } } },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(2),
        summary: z.string().min(10),
        category: z.string().min(2),
        outcomes: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([]),
        caseStudyRefs: z.array(z.string()).default([]),
        isActive: z.boolean().default(true),
        isShipped: z.boolean().default(true),
        externalUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.useCase.create({ data: input });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(2).optional(),
        summary: z.string().min(10).optional(),
        category: z.string().min(2).optional(),
        outcomes: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        caseStudyRefs: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        isShipped: z.boolean().optional(),
        externalUrl: z.string().url().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.useCase.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Soft delete — keeps historical ProofMatch references valid
      return ctx.db.useCase.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  // One-shot import: reads Obsidian JSON env paths and creates UseCase records
  importFromObsidian: adminProcedure.mutation(async ({ ctx }) => {
    // Reads OBSIDIAN_INVENTORY_JSON_PATH + OBSIDIAN_CLIENT_OFFERS_JSON_PATH
    // Converts via inventoryToCandidates() / offersToCandidates() (already in workflow-engine.ts)
    // Creates UseCase records with sourceRef = original proofId
    // Returns { created, skipped } counts
  }),
});
```

### Pattern 3: matchProofs() Signature Update

**What:** Update `matchProofs()` in `lib/workflow-engine.ts` to accept `db: PrismaClient` and query `UseCase` records from the database. Replace `loadProofCatalog()` with a DB query.

**When to use:** Anywhere proof matching is called.

**Example:**

```typescript
// Source: lib/workflow-engine.ts (current signature)
// BEFORE:
export async function matchProofs(
  query: string,
  limit = 4,
): Promise<ProofMatchResult[]>;

// AFTER:
import type { PrismaClient } from '@prisma/client';

export async function matchProofs(
  db: PrismaClient,
  query: string,
  limit = 4,
): Promise<ProofMatchResult[]> {
  const useCases = await db.useCase.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      summary: true,
      tags: true,
      isShipped: true,
      externalUrl: true,
    },
  });

  if (useCases.length === 0) {
    return [
      {
        /* custom-plan fallback */
      },
    ];
  }

  // Claude-powered semantic scoring
  return scoreWithClaude(useCases, query, limit);
}
```

**Call-site updates (two places):**

```typescript
// server/routers/proof.ts — line 31
const matches = await matchProofs(ctx.db, query, 4);

// server/routers/campaigns.ts — lines 274, 300
const matches = await matchProofs(
  ctx.db,
  `${hypothesis.title} ${hypothesis.problemStatement}`,
  4,
);
```

### Pattern 4: Claude Semantic Scoring

**What:** Use `@anthropic-ai/sdk` to score use cases against a pain-point query. Already in the stack — `lib/ai/generate-wizard.ts` and `lib/ai/outreach-prompts.ts` show the established pattern.

**When to use:** `matchProofs()` — when use cases are in the DB and the query is a hypothesis/opportunity title+description.

**Example:**

```typescript
// Source: @anthropic-ai/sdk pattern already used in lib/ai/generate-wizard.ts
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/env.mjs';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

async function scoreWithClaude(
  useCases: Array<{
    id: string;
    title: string;
    summary: string;
    tags: string[];
    isShipped: boolean;
    externalUrl: string | null;
  }>,
  query: string,
  limit: number,
): Promise<ProofMatchResult[]> {
  // Pass all use case titles/summaries + the query in a single prompt
  // Ask Claude to return a JSON array of { id, score } objects (0.0–1.0)
  // Parse and sort; return top `limit` results above score threshold
  // Fallback: if Claude call fails, fall back to toTokens() keyword overlap (existing scorer)
}
```

**Cost estimate:** At ~500 tokens per call (3-5 use cases, one hypothesis query), Claude Haiku costs <$0.001 per match call. Safe for production use.

### Pattern 5: Admin UI Page

**What:** `app/admin/use-cases/page.tsx` — a `'use client'` page following the exact pattern of `campaigns.tsx` and `research.tsx`.

**When to use:** Any new admin resource.

**Key observations from existing pages:**

- Import `api` from `@/components/providers`
- Use `api.useUtils()` for cache invalidation after mutations
- Inline local state with `useState` (no external form library)
- Tailwind classes: `glass-card`, `btn-pill-primary`, `btn-pill-secondary` are existing design tokens (defined in `globals.css`)
- Input styling: `px-6 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50`
- Always show loading state with `Loader2` from `lucide-react`

### Anti-Patterns to Avoid

- **Dual-source `matchProofs()` (file OR DB):** Do not add a conditional that reads from JSON files if DB is empty. Instead, run the import first, verify it, then cut over. The import procedure returns counts — verify before switching.
- **Deleting `proofId` from `ProofMatch`:** Historical records reference Obsidian `item_id` strings. Leave `proofId String?` in place — it is already nullable.
- **Keyword-only matching for Dutch prospects:** `toTokens("facturering")` never matches a use case titled "Invoice Automation". Use Claude as primary, keywords as fallback.
- **Hard-deleting use cases:** Use `isActive: false` (soft delete). ProofMatch records with `useCaseId` remain queryable for historical reporting.
- **Running the import twice without deduplication:** Use `sourceRef` (original proofId) to check for duplicates before creating a record. The import should be idempotent.

---

## Don't Hand-Roll

| Problem                 | Don't Build               | Use Instead                                    | Why                                                  |
| ----------------------- | ------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Semantic NL/EN matching | Custom embedding pipeline | Claude API (already in stack)                  | $0.001/call vs. weeks of implementation              |
| Form validation         | Custom form state machine | Zod + existing tRPC input validation           | Already the pattern in all routers                   |
| DB migration            | Manual SQL ALTER TABLE    | `prisma migrate dev`                           | Already used; generates migration file automatically |
| Admin auth              | New auth system           | Existing `adminProcedure` middleware           | Checks `ADMIN_SECRET` header — same pattern          |
| Caching UseCase queries | Custom cache layer        | Prisma `findMany` with `isActive: true` filter | Catalog is small (<200 records); no cache needed     |

**Key insight:** The entire stack for this phase already exists in the codebase. The work is wiring, not infrastructure.

---

## Common Pitfalls

### Pitfall 1: matchProofs() Callers in campaigns.ts

**What goes wrong:** `matchProofs()` is called in TWO places — `server/routers/proof.ts` (lines 31 and 56) and `server/routers/campaigns.ts` (lines 274 and 300). Updating the signature in `workflow-engine.ts` without updating both call sites causes a TypeScript compile error.

**Why it happens:** `campaigns.ts` has the most complex call context (inside a nested loop in `runAutopilot`) — easy to miss.

**How to avoid:** After changing the `matchProofs()` signature, run `npm run check` immediately. TypeScript will flag both missing `db` arguments. Fix all four call sites before proceeding.

**Warning signs:** `npm run check` passes on `proof.ts` but fails on `campaigns.ts`.

### Pitfall 2: Obsidian JSON Structure Mismatch on Import

**What goes wrong:** The import procedure calls `inventoryToCandidates()` and `offersToCandidates()` from `workflow-engine.ts`, which parse Obsidian JSON. If the actual JSON files don't match the `InventoryRoot` / `ClientOffersRoot` interfaces, the import silently creates 0 records (the functions return `[]` on parse failure).

**Why it happens:** `readJsonSafe()` catches all errors and returns `null`. `inventoryToCandidates(null)` returns `[]`.

**How to avoid:** The import procedure must return `{ created: number, errors: string[] }`. Log the raw item count before filtering. If `items.length > 0` but `created === 0`, surface an error.

**Warning signs:** Import returns `{ created: 0 }` when JSON files clearly exist and have content.

### Pitfall 3: ProofMatch Display Breaks After Cutover

**What goes wrong:** Existing admin pages that show `ProofMatch` records (e.g., `app/admin/prospects/[id]/page.tsx`) display `proofTitle` from the `ProofMatch` row. New DB-backed matches populate `proofTitle` from `useCase.title` at creation time — but if the `UseCase` record is later edited, the title on `ProofMatch` becomes stale.

**Why it happens:** `ProofMatch.proofTitle` is a denormalized copy — correct for historical records, potentially stale for live DB-backed records.

**How to avoid:** When displaying a `ProofMatch` that has a `useCaseId`, fetch and display `useCase.title` via a Prisma `include`. This requires updating any page that lists ProofMatch records to include `{ useCase: { select: { title: true } } }`.

**Warning signs:** ProofMatch title shows old name after use case is edited in admin.

### Pitfall 4: workflow-engine.test.ts Mock Breaks After matchProofs() Signature Change

**What goes wrong:** `lib/workflow-engine.test.ts` mocks `@/env.mjs` and calls `matchProofs('nonexistent-query', 3)` without a `db` argument. After the signature change, this test fails with a TypeScript error.

**Why it happens:** The test was written for the old signature. The mock needs updating.

**How to avoid:** When updating `matchProofs()`, also update `workflow-engine.test.ts` to pass a mock `db` object (Vitest `vi.fn()` stub or a minimal Prisma mock). The test's `matchProofs` call returns the custom-plan fallback when no JSON files are configured — the same fallback should trigger when `db.useCase.findMany()` returns `[]`.

**Warning signs:** `npm run test` fails immediately after signature change.

---

## Code Examples

Verified patterns from the existing codebase:

### Prisma Migration Command

```bash
# Source: package.json scripts
npx prisma migrate dev --name use_cases
```

### Importing from existing Obsidian converter functions

```typescript
// Source: lib/workflow-engine.ts — inventoryToCandidates() and offersToCandidates() exist
// The import procedure in use-cases.ts calls these same converters
// then maps ProofCandidate → UseCase create data:

import { readFile } from 'node:fs/promises';
import { env } from '@/env.mjs';

async function importObsidianToUseCases(db: PrismaClient) {
  const inventoryPath = env.OBSIDIAN_INVENTORY_JSON_PATH;
  const offersPath = env.OBSIDIAN_CLIENT_OFFERS_JSON_PATH;

  // Re-use existing JSON read pattern from workflow-engine.ts
  const inventoryRaw = inventoryPath
    ? JSON.parse(await readFile(inventoryPath, 'utf-8'))
    : null;
  const offersRaw = offersPath
    ? JSON.parse(await readFile(offersPath, 'utf-8'))
    : null;

  let created = 0;
  const errors: string[] = [];

  for (const candidate of inventoryToCandidates(inventoryRaw)) {
    const existing = await db.useCase.findFirst({
      where: { sourceRef: candidate.proofId },
    });
    if (existing) continue; // idempotent

    await db.useCase.create({
      data: {
        title: candidate.title,
        summary: candidate.summary,
        category: 'workflow', // default; admin can update post-import
        tags: candidate.keywords, // use existing keyword tokens as initial tags
        outcomes: [],
        caseStudyRefs: candidate.url ? [candidate.url] : [],
        isActive: true,
        isShipped: candidate.shipped,
        sourceRef: candidate.proofId,
        externalUrl: candidate.url,
      },
    });
    created++;
  }

  return { created, errors };
}
```

### Claude Scoring Pattern (matching lib/ai pattern)

```typescript
// Source: lib/ai/generate-wizard.ts pattern — Anthropic SDK usage in this project
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5', // use cheapest model for scoring
  max_tokens: 512,
  messages: [
    {
      role: 'user',
      content: `Score each use case for relevance to the prospect's pain point.

Pain point: ${query}

Use cases:
${useCases.map((uc, i) => `${i + 1}. [${uc.id}] ${uc.title}: ${uc.summary}. Tags: ${uc.tags.join(', ')}`).join('\n')}

Return JSON array: [{"id": "...", "score": 0.0-1.0}]
Higher score = more relevant. 0.0 = no relevance.`,
    },
  ],
});
```

### Adding useCasesRouter to \_app.ts

```typescript
// Source: server/routers/_app.ts pattern
import { useCasesRouter } from './use-cases';

export const appRouter = router({
  // ... existing routers ...
  useCases: useCasesRouter,
});
```

### Admin Nav Item Addition

```typescript
// Source: app/admin/layout.tsx navItems array
// Add to 'Intelligence' group:
{ href: '/admin/use-cases', label: 'Use Cases', icon: BookOpen }
// Import BookOpen from 'lucide-react'
```

---

## State of the Art

| Old Approach                          | Current Approach                          | When Changed | Impact                                          |
| ------------------------------------- | ----------------------------------------- | ------------ | ----------------------------------------------- |
| Filesystem JSON proof catalog         | Database `UseCase` model                  | Phase 6      | Admin can manage without file access            |
| Token-overlap keyword scoring         | Claude semantic scoring                   | Phase 6      | Dutch-language matches work correctly           |
| `matchProofs(query, limit)` signature | `matchProofs(db, query, limit)` signature | Phase 6      | Breaking change — two call sites must update    |
| `OBSIDIAN_*` env vars required        | Optional (import once, then unused)       | Phase 6      | `OBSIDIAN_*` become dead config after migration |

**Deprecated/outdated after this phase:**

- `loadProofCatalog()` in `workflow-engine.ts`: remove after DB cutover is verified
- `inventoryToCandidates()` and `offersToCandidates()`: move to import script only, remove from `matchProofs()` path
- `OBSIDIAN_INVENTORY_JSON_PATH` and `OBSIDIAN_CLIENT_OFFERS_JSON_PATH` env vars: remain in `env.mjs` for the import procedure but no longer required for production operation

---

## Open Questions

1. **Claude model selection for matching**
   - What we know: `@anthropic-ai/sdk@^0.73.0` is installed; the project already calls Claude for outreach generation
   - What's unclear: Which Claude model is used in existing AI calls? (`lib/ai/generate-wizard.ts` should be checked for the model name actually used — may already be Haiku or Sonnet)
   - Recommendation: Use the cheapest capable model (Haiku) for scoring to keep cost per match under $0.001. If the project standardizes on Sonnet, use that.

2. **Category taxonomy for UseCase**
   - What we know: `category: String` is a free-form field in the proposed model
   - What's unclear: What are the actual categories that represent Klarifai's service offerings? (workflow, automation, intake, reporting, billing — from the existing hypothesis tags, but needs confirmation)
   - Recommendation: Use `String` (not an enum) so categories can be added without a migration. Admin enters free text; a filter dropdown can enumerate distinct values from the DB.

3. **Tag seeding strategy for the imported Obsidian records**
   - What we know: `inventoryToCandidates()` already calls `toTokens()` to generate keywords from title+description+use_cases. These are English tokens.
   - What's unclear: Does the Obsidian vault contain NL-language content? If so, `toTokens()` will generate Dutch tokens automatically. If it's English-only, NL synonyms must be added manually post-import.
   - Recommendation: Import with `toTokens()` tokens as initial tags. After import, admin reviews and adds NL synonyms for each use case. The admin UI must make tag editing easy (comma-separated or tag chips).

4. **ProofMatch display pages that need updating**
   - What we know: `ProofMatch.proofTitle` is queried in at least `app/admin/prospects/[id]/page.tsx` and the hypotheses router output
   - What's unclear: Whether the full list of all admin pages querying ProofMatch was checked exhaustively
   - Recommendation: `grep -r "proofMatch" app/` before shipping to find all display sites.

---

## Sources

### Primary (HIGH confidence — read directly from codebase)

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.ts` — `matchProofs()`, `loadProofCatalog()`, `inventoryToCandidates()`, `offersToCandidates()`, `toTokens()`, `ProofCandidate` interface, `ProofMatchResult` interface
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/proof.ts` — both `matchProofs()` call sites (lines 31, 56)
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/campaigns.ts` — both `matchProofs()` call sites (lines 274, 300), full CRUD pattern reference
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/_app.ts` — router registration pattern
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/hypotheses.ts` — CRUD router pattern (simpler than campaigns)
- `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma` — `ProofMatch` model (existing fields), all existing models
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/campaigns/page.tsx` — admin UI pattern: `'use client'`, `api.useUtils()`, inline state, Tailwind classes
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/layout.tsx` — nav structure, `navItems` array, lucide-react icons
- `/home/klarifai/Documents/klarifai/projects/qualifai/env.mjs` — `OBSIDIAN_INVENTORY_JSON_PATH`, `OBSIDIAN_CLIENT_OFFERS_JSON_PATH` (server-side optional), `ANTHROPIC_API_KEY` (required)
- `/home/klarifai/Documents/klarifai/projects/qualifai/package.json` — confirmed `@anthropic-ai/sdk`, `prisma`, `zod`, `@trpc/server` versions; no new installs needed
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.test.ts` — test mock setup for `@/env.mjs`, `matchProofs` call signature (must update)
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/trpc.ts` — `adminProcedure` definition
- `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/research/ARCHITECTURE.md` — `UseCase` model specification, `matchProofs()` signature change, `ProofMatch.useCaseId` FK design
- `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/research/PITFALLS.md` — Pitfall 5 (Dutch/English matching), Pitfall 11 (ProofMatch versioning)
- `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/research/FEATURES.md` — UseCase admin CRUD scope, anti-feature (no semantic embeddings, no AI-generated use cases)

### Secondary (MEDIUM confidence)

- Prior planning research in `.planning/research/` — authored 2026-02-20, reflects direct codebase analysis of same repo

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed; verified in package.json
- Architecture: HIGH — `matchProofs()` callers, ProofMatch schema, admin UI pattern all read from source
- Pitfalls: HIGH — derived from direct codebase analysis + prior planning research
- Claude scoring approach: MEDIUM — pattern confirmed from existing `lib/ai/` files; exact model name in current use needs one file read to confirm

**Research date:** 2026-02-20
**Valid until:** 2026-03-22 (30 days — stack is stable)
