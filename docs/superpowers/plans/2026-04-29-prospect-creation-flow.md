# Prospect Creation Flow Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `status: READY` mean genuinely shippable. Strip legacy analysis-v1, refactor `createAndProcess` into Wave 1/Wave 2, gate the public route, and gate the admin UI until the master-analyzer has actually persisted `analysis-v2`.

**Architecture:** Single Wave 1 (sync, ~5s) handles enrichment and returns; Wave 2 (background fire-and-forget, ~120s) runs the research pipeline + master analyzer and only flips status to `READY` after `ProspectAnalysis` is persisted. Public `/analyse/[slug]` becomes a strict gate: only `PUBLIC_VISIBLE_STATUSES` render, otherwise 404. All legacy v1 fields, components, and code paths are deleted.

**Tech Stack:** Next.js App Router 16, tRPC v11, Prisma + PrismaPg adapter, Postgres, vitest, Tailwind, Sora typography, Klarifai navy/gold tokens.

**Spec:** `docs/superpowers/specs/2026-04-29-prospect-creation-flow-design.md`

---

## File Structure

**New:**

- `prisma/migrations/20260429120000_prospect_creation_flow/migration.sql` — schema migration
- `scripts/preflight-creation-flow-migration.ts` — count legacy rows, dump backup
- `app/not-found.tsx` — Klarifai-branded 404 page
- `app/api/internal/cron/stale-analysis-detection/route.ts` — hourly cron endpoint
- `scripts/cron-stale-analysis-detection.ts` — local crontab runner
- `server/routers/admin.retryAnalysis.test.ts` — vitest unit tests
- `app/analyse/[slug]/page.test.tsx` — public guard tests
- `lib/prospect-creation/wave-1.ts` — extracted enrichment logic (Wave 1)
- `lib/prospect-creation/wave-2.ts` — extracted research+analyse logic (Wave 2)
- `components/features/prospects/analyzing-hero.tsx` — admin detail in-progress hero
- `components/features/prospects/failed-banner.tsx` — admin detail FAILED banner

**Modified:**

- `prisma/schema.prisma` — enum + columns
- `server/routers/admin.ts` — `createAndProcess` rewrite + `retryAnalysis` add + delete `generateContent`
- `lib/constants/prospect-statuses.ts` — enum literals + comments
- `lib/state-machines/prospect.ts` — transition map
- `lib/pipeline-stage.ts` — derived stage labels
- `components/ui/status-badge.tsx` — badge variants
- `server/routers/search.ts` — status enum reference
- `app/analyse/[slug]/page.tsx` — strict guard, drop fallbacks
- `app/admin/prospects/page.tsx` — card gating
- `app/admin/prospects/[id]/page.tsx` — detail gating + FAILED banner
- `app/admin/prospects/new/page.tsx` — ProcessStage update
- `lib/prospect-url.ts` — rename `*Discover*` → `*Analyse*`
- `lib/analysis/master-analyzer.ts` — extend `recordAnalysisFailure` to set top-level status

**Deleted:**

- `lib/ai/generate-wizard.ts`
- `components/public/prospect-dashboard-client.tsx`
- All `lib/ai/wizard-*` prompt builders exclusively used by `generateWizardContent`

---

## Phase 1: Database foundation

### Task 1.1: Pre-flight inventory script

**Files:**

- Create: `scripts/preflight-creation-flow-migration.ts`

- [ ] **Step 1: Write the script**

```ts
// scripts/preflight-creation-flow-migration.ts
import 'dotenv/config';
import prisma from '../lib/prisma';

async function main() {
  const counts = await prisma.$queryRaw<
    Array<{ status: string; count: bigint }>
  >`SELECT status, COUNT(*) as count FROM "Prospect" GROUP BY status ORDER BY count DESC`;

  const legacyOnly = await prisma.prospect.count({
    where: {
      OR: [
        { heroContent: { not: null as unknown as never } },
        { dataOpportunities: { not: null as unknown as never } },
      ],
      analyses: { none: {} },
    },
  });

  const publicShared = await prisma.prospect.count({
    where: {
      status: { in: ['DRAFT', 'ENRICHED', 'GENERATING'] },
      sentAt: { not: null },
    },
  });

  console.log('=== Pre-flight: Prospect Creation Flow Migration ===');
  console.log('Status counts:');
  for (const row of counts) {
    console.log(`  ${row.status}: ${row.count}`);
  }
  console.log(
    `\nLegacy-only prospects (have v1, no ProspectAnalysis): ${legacyOnly}`,
  );
  console.log(`Pre-pitch prospects already shared externally: ${publicShared}`);
  console.log('\nIf legacyOnly > 5, hand-fix via re-run before migration.');
  console.log(
    'If publicShared > 0, those clients will hit 404 after deploy — coordinate.',
  );
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run on local DB**

Run: `npx tsx scripts/preflight-creation-flow-migration.ts`
Expected: status breakdown printed, legacyOnly count visible.

- [ ] **Step 3: Run on production DB** (via `DATABASE_URL` env)

Run with prod env: copy stdout into ticket comment for migration day.
Expected: legacyOnly count ≤ 5 (per spec §7 Risk 2). If higher, halt — needs manual cleanup first.

- [ ] **Step 4: Commit**

```bash
git add scripts/preflight-creation-flow-migration.ts
git commit -m "feat(prospect): pre-flight inventory script for creation flow migration"
```

---

### Task 1.2: Schema migration — add new enum values + columns

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260429120000_prospect_creation_flow/migration.sql`

- [ ] **Step 1: Update schema.prisma enum**

Replace `enum ProspectStatus` block:

```prisma
enum ProspectStatus {
  // Creation pipeline (pre-pitch)
  DRAFT
  ENRICHING
  ANALYZING
  READY
  FAILED

  // Pitch lifecycle (post-create)
  SENT
  VIEWED
  ENGAGED
  QUOTE_SENT
  CONVERTED
  ARCHIVED
}
```

- [ ] **Step 2: Add new columns to Prospect model**

In `prisma/schema.prisma`, locate the `Prospect` model and add:

```prisma
  failureReason       String?
  analysisCompletedAt DateTime?
```

Drop columns from `Prospect`:

```prisma
  // Remove these lines:
  heroContent          Json?
  dataOpportunities    Json?
  automationAgents     Json?
  successStories       Json?
  aiRoadmap            Json?
```

- [ ] **Step 3: Generate migration SQL manually**

Create `prisma/migrations/20260429120000_prospect_creation_flow/migration.sql`:

```sql
-- Step 1: Add new enum values (must commit before use in same transaction)
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'ENRICHING';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'ANALYZING';
ALTER TYPE "ProspectStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- Step 2: Add new columns
ALTER TABLE "Prospect" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "analysisCompletedAt" TIMESTAMP(3);
```

Note: enum value drops + column drops happen in Task 1.4 after data migration. Postgres requires committed transactions between adding enum values and using them.

- [ ] **Step 4: Apply migration locally**

Run: `npx prisma migrate dev --name prospect_creation_flow_part1 --create-only` (review file first)
Then: `docker exec -i qualifai-db psql -U user -d qualifai < prisma/migrations/20260429120000_prospect_creation_flow/migration.sql`
Then: `npx prisma migrate resolve --applied 20260429120000_prospect_creation_flow`

Expected: ALTER TYPE succeeds, new columns visible via `\d "Prospect"`.

- [ ] **Step 5: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: `node_modules/.prisma/client/index.d.ts` exports new enum members + `failureReason`, `analysisCompletedAt`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260429120000_prospect_creation_flow/
git commit -m "feat(db): add ENRICHING/ANALYZING/FAILED states + failureReason/analysisCompletedAt columns"
```

---

### Task 1.3: Data migration — remap existing rows

**Files:**

- Create: `scripts/migrate-prospect-statuses.ts`

- [ ] **Step 1: Write data migration script**

```ts
// scripts/migrate-prospect-statuses.ts
import 'dotenv/config';
import prisma from '../lib/prisma';

async function main() {
  // GENERATING → FAILED (assume stuck)
  const generatingResult = await prisma.prospect.updateMany({
    where: { status: 'GENERATING' as never },
    data: {
      status: 'FAILED',
      failureReason:
        'Pre-rebuild migration: stuck in GENERATING, please retry.',
    },
  });
  console.log(`GENERATING → FAILED: ${generatingResult.count}`);

  // ENRICHED with analysis-v2 → READY + analysisCompletedAt
  const enrichedWithAnalysis = await prisma.$executeRaw`
    UPDATE "Prospect" p
    SET status = 'READY'::"ProspectStatus",
        "analysisCompletedAt" = (
          SELECT MAX("createdAt") FROM "ProspectAnalysis" pa WHERE pa."prospectId" = p.id
        )
    WHERE p.status = 'ENRICHED'::"ProspectStatus"
      AND EXISTS (
        SELECT 1 FROM "ProspectAnalysis" pa
        WHERE pa."prospectId" = p.id
          AND pa.content::jsonb ? 'version'
          AND pa.content->>'version' = 'analysis-v2'
      )
  `;
  console.log(`ENRICHED (with analysis-v2) → READY: ${enrichedWithAnalysis}`);

  // ENRICHED without analysis-v2 → ANALYZING (cron will flag as stale after 30min)
  const enrichedWithoutAnalysis = await prisma.prospect.updateMany({
    where: { status: 'ENRICHED' as never },
    data: { status: 'ANALYZING' },
  });
  console.log(
    `ENRICHED (no analysis-v2) → ANALYZING: ${enrichedWithoutAnalysis.count}`,
  );

  // Sanity check
  const remaining = await prisma.$queryRaw<
    Array<{ status: string; count: bigint }>
  >`
    SELECT status, COUNT(*) as count FROM "Prospect"
    WHERE status IN ('GENERATING'::"ProspectStatus", 'ENRICHED'::"ProspectStatus")
    GROUP BY status
  `;
  if (remaining.length > 0) {
    console.error('FAIL: still rows in old states:', remaining);
    process.exit(1);
  }
  console.log('OK — all legacy states migrated.');
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run on local DB**

Run: `npx tsx scripts/migrate-prospect-statuses.ts`
Expected: counts logged, "OK — all legacy states migrated."

- [ ] **Step 3: Verify with raw query**

Run: `docker exec qualifai-db psql -U user -d qualifai -c "SELECT status, COUNT(*) FROM \"Prospect\" GROUP BY status;"`
Expected: zero rows for `GENERATING` and `ENRICHED`.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-prospect-statuses.ts
git commit -m "feat(db): data migration script for prospect status remapping"
```

---

### Task 1.4: Drop legacy enum values + columns

**Files:**

- Create: `prisma/migrations/20260429120100_prospect_creation_flow_cleanup/migration.sql`
- Modify: `prisma/schema.prisma` (already done in 1.2; drop columns are now physically applied)

- [ ] **Step 1: Write cleanup migration SQL**

```sql
-- Drop legacy v1 columns
ALTER TABLE "Prospect" DROP COLUMN IF EXISTS "heroContent";
ALTER TABLE "Prospect" DROP COLUMN IF EXISTS "dataOpportunities";
ALTER TABLE "Prospect" DROP COLUMN IF EXISTS "automationAgents";
ALTER TABLE "Prospect" DROP COLUMN IF EXISTS "successStories";
ALTER TABLE "Prospect" DROP COLUMN IF EXISTS "aiRoadmap";

-- Drop legacy enum values via swap (Postgres can't DROP VALUE directly)
ALTER TYPE "ProspectStatus" RENAME TO "ProspectStatus_old";

CREATE TYPE "ProspectStatus" AS ENUM (
  'DRAFT', 'ENRICHING', 'ANALYZING', 'READY', 'FAILED',
  'SENT', 'VIEWED', 'ENGAGED', 'QUOTE_SENT', 'CONVERTED', 'ARCHIVED'
);

ALTER TABLE "Prospect"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ProspectStatus" USING ("status"::text::"ProspectStatus"),
  ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"ProspectStatus";

DROP TYPE "ProspectStatus_old";
```

- [ ] **Step 2: Apply locally**

Run: `docker exec -i qualifai-db psql -U user -d qualifai < prisma/migrations/20260429120100_prospect_creation_flow_cleanup/migration.sql`
Then: `npx prisma migrate resolve --applied 20260429120100_prospect_creation_flow_cleanup`

Expected: columns gone, enum has only the new 11 values.

- [ ] **Step 3: Verify enum**

Run: `docker exec qualifai-db psql -U user -d qualifai -c "SELECT unnest(enum_range(NULL::\"ProspectStatus\"));"`
Expected: 11 values, no `ENRICHED` or `GENERATING`.

- [ ] **Step 4: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: `ProspectStatus` enum in generated types matches schema.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260429120100_prospect_creation_flow_cleanup/
git commit -m "feat(db): drop legacy v1 columns + ENRICHED/GENERATING enum values"
```

---

## Phase 2: Status enum types + helpers

### Task 2.1: Update `lib/constants/prospect-statuses.ts`

**Files:**

- Modify: `lib/constants/prospect-statuses.ts`

- [ ] **Step 1: Update ALL_PROSPECT_STATUSES literal**

Replace lines 11-22:

```ts
export const ALL_PROSPECT_STATUSES = [
  'DRAFT',
  'ENRICHING',
  'ANALYZING',
  'READY',
  'FAILED',
  'SENT',
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
  'ARCHIVED',
] as const satisfies readonly ProspectStatus[];
```

- [ ] **Step 2: Update PUBLIC_VISIBLE_STATUSES comment**

Replace line 24:

```ts
/** Statuses where the public /analyse/[slug] page is visible. */
```

- [ ] **Step 3: Update READY_FOR_OUTREACH_STATUSES**

Replace block (lines ~63-66):

```ts
/**
 * Statuses where a prospect is ready to be picked up for first outreach.
 * Used by server/routers/admin.ts (action queue: "ready for first outreach" filter).
 */
export const READY_FOR_OUTREACH_STATUSES = [
  'READY',
] as const satisfies readonly ProspectStatus[];
```

- [ ] **Step 4: Add new helper for in-pipeline statuses**

Append:

```ts
/** Statuses indicating the creation pipeline is in flight (admin UI gates clicks). */
export const IN_PIPELINE_STATUSES = [
  'DRAFT',
  'ENRICHING',
  'ANALYZING',
] as const satisfies readonly ProspectStatus[];

export type InPipelineStatus = (typeof IN_PIPELINE_STATUSES)[number];
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep prospect-statuses`
Expected: no errors in this file.

- [ ] **Step 6: Commit**

```bash
git add lib/constants/prospect-statuses.ts
git commit -m "feat(prospect): update status constants for new pipeline states"
```

---

### Task 2.2: Update `lib/state-machines/prospect.ts`

**Files:**

- Modify: `lib/state-machines/prospect.ts`

- [ ] **Step 1: Update transition map**

Replace lines 28-31 (the `TRANSITIONS` object members for old states):

```ts
  DRAFT: ['ENRICHING', 'ARCHIVED'],
  ENRICHING: ['ANALYZING', 'FAILED', 'ARCHIVED'],
  ANALYZING: ['READY', 'FAILED', 'ARCHIVED'],
  FAILED: ['ENRICHING', 'ANALYZING', 'ARCHIVED'], // retry paths
  READY: ['SENT', 'ARCHIVED', 'QUOTE_SENT'],
```

Remove old `ENRICHED:` and `GENERATING:` entries entirely.

- [ ] **Step 2: Update comment block**

Replace lines 19-22:

```ts
// Transition rules for the rebuilt prospect creation flow:
// DRAFT → ENRICHING → ANALYZING → READY (success path)
// Any pipeline state → FAILED (hard failure path; retryable)
// FAILED → ENRICHING (retry from scratch) or → ANALYZING (retry analysis only)
// READY → SENT (admin sends pitch; existing pitch lifecycle continues from there)
```

- [ ] **Step 3: Update existing test**

Open `lib/state-machines/prospect.test.ts`. Replace test cases referencing `ENRICHED`/`GENERATING` with the new state names. Specifically:

- Test "DRAFT → ENRICHED" → "DRAFT → ENRICHING"
- Test "ENRICHED → GENERATING" → "ENRICHING → ANALYZING"
- Add new tests: "ANALYZING → READY", "ENRICHING → FAILED", "FAILED → ENRICHING (retry)".

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/state-machines/prospect.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/state-machines/prospect.ts lib/state-machines/prospect.test.ts
git commit -m "feat(prospect): rewire state machine for new creation pipeline"
```

---

### Task 2.3: Update `components/ui/status-badge.tsx`

**Files:**

- Modify: `components/ui/status-badge.tsx`

- [ ] **Step 1: Update status union + variant map**

Replace the status type union and variants:

```ts
type Status =
  | 'DRAFT'
  | 'ENRICHING'
  | 'ANALYZING'
  | 'READY'
  | 'FAILED'
  | 'SENT'
  | 'VIEWED'
  | 'ENGAGED'
  | 'QUOTE_SENT'
  | 'CONVERTED'
  | 'ARCHIVED';

const VARIANTS: Record<Status, { label: string; className: string }> = {
  DRAFT: { label: 'Concept', className: 'bg-gray-100 text-gray-600' },
  ENRICHING: { label: 'Verrijken', className: 'bg-blue-50 text-blue-700' },
  ANALYZING: { label: 'Analyseert', className: 'bg-amber-50 text-amber-700' },
  READY: { label: 'Klaar', className: 'bg-emerald-50 text-emerald-700' },
  FAILED: { label: 'Mislukt', className: 'bg-red-50 text-red-700' },
  SENT: { label: 'Verzonden', className: 'bg-blue-50 text-blue-700' },
  VIEWED: { label: 'Bekeken', className: 'bg-violet-50 text-violet-700' },
  ENGAGED: {
    label: 'Geëngageerd',
    className: 'bg-emerald-50 text-emerald-700',
  },
  QUOTE_SENT: { label: 'Offerte', className: 'bg-amber-50 text-amber-700' },
  CONVERTED: { label: 'Klant', className: 'bg-emerald-100 text-emerald-800' },
  ARCHIVED: { label: 'Gearchiveerd', className: 'bg-gray-100 text-gray-500' },
};
```

(Match existing color tokens in this file — use whatever the current Klarifai theme variables are. The above are reasonable defaults; verify against `app/globals.css` brand tokens during execution.)

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep status-badge`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/status-badge.tsx
git commit -m "feat(prospect): status badge variants for new pipeline states"
```

---

### Task 2.4: Update `lib/pipeline-stage.ts`

**Files:**

- Modify: `lib/pipeline-stage.ts`

- [ ] **Step 1: Update derived stage logic**

In `lib/pipeline-stage.ts` lines 38-43, replace `'GENERATING'` references with `'ANALYZING'`. Read the file first to understand context, then replace each `'GENERATING'` literal with `'ANALYZING'`.

- [ ] **Step 2: Run pipeline-stage tests**

Run: `npx vitest run lib/pipeline-stage` (if test file exists; else add one).
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline-stage.ts
git commit -m "feat(prospect): pipeline-stage helper uses ANALYZING instead of GENERATING"
```

---

### Task 2.5: Update remaining call sites

**Files:**

- Modify: `server/routers/search.ts:101`
- Modify: `server/routers/admin.ts:115` (status default), `:469` and `:597` (the legacy `data: { status: 'GENERATING' }` writes — these will be deleted in Phase 3, but if linter complains earlier, replace with `'ANALYZING'`)
- Modify: `server/routers/admin.ts:897-898` (status filter array — replace `'ENRICHED', 'GENERATING'` with `'ENRICHING', 'ANALYZING'`)

- [ ] **Step 1: grep for remaining old status literals**

Run: `grep -rn "'ENRICHED'\|'GENERATING'" server/ lib/ components/ app/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."`
Expected: only the locations to update (any tests update in Phase 3).

- [ ] **Step 2: Replace each occurrence with new equivalent**

For each line:

- `'ENRICHED'` → `'ENRICHING'` (closest semantic equivalent)
- `'GENERATING'` → `'ANALYZING'`

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors related to ProspectStatus.

- [ ] **Step 4: Commit**

```bash
git add server/routers/search.ts server/routers/admin.ts
git commit -m "feat(prospect): update remaining call sites to new status enum"
```

---

## Phase 3: createAndProcess rewrite (Wave 1 / Wave 2 split)

### Task 3.1: Extract Wave 1 to `lib/prospect-creation/wave-1.ts`

**Files:**

- Create: `lib/prospect-creation/wave-1.ts`
- Create: `lib/prospect-creation/wave-1.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/prospect-creation/wave-1.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWave1 } from './wave-1';

vi.mock('@/lib/enrichment/apollo-coverage', () => ({
  enrichCompany: vi.fn(),
}));
vi.mock('@/lib/enrichment/kvk', () => ({
  mergeApolloWithKvk: vi.fn(),
}));

describe('runWave1', () => {
  let db: any;
  beforeEach(() => {
    db = {
      prospect: {
        create: vi.fn().mockResolvedValue({ id: 'p1', domain: 'mujjo.com' }),
        update: vi
          .fn()
          .mockImplementation(({ data }) => ({ id: 'p1', ...data })),
      },
    };
  });

  it('transitions DRAFT → ENRICHING → ANALYZING on Apollo success', async () => {
    const { enrichCompany } = await import('@/lib/enrichment/apollo-coverage');
    const { mergeApolloWithKvk } = await import('@/lib/enrichment/kvk');
    (enrichCompany as any).mockResolvedValue({ companyName: 'Mujjo' });
    (mergeApolloWithKvk as any).mockResolvedValue({
      merged: { companyName: 'Mujjo', industry: 'D2C' },
      kvk: null,
      confidence: { combined: 0.7 },
    });

    const result = await runWave1(db, {
      domain: 'mujjo.com',
      projectId: 'proj1',
      manualFields: {},
    });

    expect(result.status).toBe('ANALYZING');
    expect(db.prospect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ENRICHING' }),
      }),
    );
  });

  it('returns FAILED when Apollo no-coverage + no manual fields', async () => {
    const { enrichCompany } = await import('@/lib/enrichment/apollo-coverage');
    (enrichCompany as any).mockResolvedValue(null); // no coverage

    const result = await runWave1(db, {
      domain: 'unknownco.example',
      projectId: 'proj1',
      manualFields: {},
    });

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toMatch(/Onvoldoende bedrijfsdata/i);
  });

  it('continues to ANALYZING when Apollo no-coverage but manualFields present', async () => {
    const { enrichCompany } = await import('@/lib/enrichment/apollo-coverage');
    (enrichCompany as any).mockResolvedValue(null);

    const result = await runWave1(db, {
      domain: 'unknownco.example',
      projectId: 'proj1',
      manualFields: { companyName: 'UnknownCo', industry: 'Manufacturing' },
    });

    expect(result.status).toBe('ANALYZING');
  });

  it('returns FAILED when Apollo throws', async () => {
    const { enrichCompany } = await import('@/lib/enrichment/apollo-coverage');
    (enrichCompany as any).mockRejectedValue(new Error('Apollo 503 timeout'));

    const result = await runWave1(db, {
      domain: 'mujjo.com',
      projectId: 'proj1',
      manualFields: {},
    });

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toMatch(/^Apollo:/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/prospect-creation/wave-1.test.ts`
Expected: FAIL — `runWave1 is not a function`.

- [ ] **Step 3: Implement Wave 1**

```ts
// lib/prospect-creation/wave-1.ts
import { nanoid } from 'nanoid';
import type { PrismaClient } from '@prisma/client';
import { enrichCompany } from '@/lib/enrichment/apollo-coverage';
import { mergeApolloWithKvk } from '@/lib/enrichment/kvk';
import { generateUniqueReadableSlug } from '@/lib/readable-slug';
import { buildEnrichmentData } from '@/lib/enrichment/build-enrichment-data';

export interface Wave1Input {
  domain: string;
  projectId: string;
  internalNotes?: string;
  manualFields: {
    companyName?: string | null;
    industry?: string | null;
    description?: string | null;
    employeeRange?: string | null;
    city?: string | null;
    country?: string | null;
  };
}

export interface Wave1Result {
  prospectId: string;
  status: 'ANALYZING' | 'FAILED';
  failureReason?: string;
}

export async function runWave1(
  db: Pick<PrismaClient, 'prospect'>,
  input: Wave1Input,
): Promise<Wave1Result> {
  const cleanDomain = input.domain
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('/')[0]!;
  const slug = nanoid(8);

  // 1. Create DRAFT
  const prospect = await db.prospect.create({
    data: {
      domain: cleanDomain,
      slug,
      status: 'DRAFT',
      internalNotes: input.internalNotes,
      projectId: input.projectId,
      ...(input.manualFields.companyName && {
        companyName: input.manualFields.companyName,
      }),
      ...(input.manualFields.industry && {
        industry: input.manualFields.industry,
      }),
      ...(input.manualFields.description && {
        description: input.manualFields.description,
      }),
      ...(input.manualFields.employeeRange && {
        employeeRange: input.manualFields.employeeRange,
      }),
      ...(input.manualFields.city && { city: input.manualFields.city }),
      ...(input.manualFields.country && {
        country: input.manualFields.country,
      }),
    },
  });

  // 2. Transition to ENRICHING
  await db.prospect.update({
    where: { id: prospect.id },
    data: { status: 'ENRICHING' },
  });

  // 3. Apollo + KvK
  let enriched;
  try {
    enriched = await enrichCompany(cleanDomain, prospect.id);
  } catch (error) {
    const reason = `Apollo: ${(error instanceof Error ? error.message : String(error)).slice(0, 100)}`;
    await db.prospect.update({
      where: { id: prospect.id },
      data: { status: 'FAILED', failureReason: reason },
    });
    return { prospectId: prospect.id, status: 'FAILED', failureReason: reason };
  }

  const hasManualFields =
    Boolean(input.manualFields.companyName) ||
    Boolean(input.manualFields.industry) ||
    Boolean(input.manualFields.description);

  if (!enriched && !hasManualFields) {
    const reason =
      'Onvoldoende bedrijfsdata — vul handmatig aan via "+ optionele verrijking".';
    await db.prospect.update({
      where: { id: prospect.id },
      data: { status: 'FAILED', failureReason: reason },
    });
    return { prospectId: prospect.id, status: 'FAILED', failureReason: reason };
  }

  // 4. Merge with KvK + apply enrichment data + generate readableSlug
  if (enriched) {
    const combined = await mergeApolloWithKvk(enriched, {
      domainHint: cleanDomain,
      companyNameHint: prospect.companyName,
    });
    const slugSource =
      combined.merged.companyName ?? cleanDomain.split('.')[0]!;
    const readableSlug = await generateUniqueReadableSlug(db, slugSource);
    const enrichDataToApply = {
      ...buildEnrichmentData(combined.merged, {
        kvk: combined.kvk,
        confidence: combined.confidence,
      }),
      // Sticky guard: manual fields beat Apollo
      ...(input.manualFields.companyName && {
        companyName: input.manualFields.companyName,
      }),
      ...(input.manualFields.industry && {
        industry: input.manualFields.industry,
      }),
      ...(input.manualFields.city && { city: input.manualFields.city }),
      ...(input.manualFields.country && {
        country: input.manualFields.country,
      }),
    };
    await db.prospect.update({
      where: { id: prospect.id },
      data: { ...enrichDataToApply, readableSlug },
    });
  } else {
    // Manual-only path: still need readableSlug
    const slugSource =
      input.manualFields.companyName ?? cleanDomain.split('.')[0]!;
    const readableSlug = await generateUniqueReadableSlug(db, slugSource);
    await db.prospect.update({
      where: { id: prospect.id },
      data: { readableSlug },
    });
  }

  // 5. Transition to ANALYZING
  await db.prospect.update({
    where: { id: prospect.id },
    data: { status: 'ANALYZING' },
  });

  return { prospectId: prospect.id, status: 'ANALYZING' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/prospect-creation/wave-1.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/prospect-creation/wave-1.ts lib/prospect-creation/wave-1.test.ts
git commit -m "feat(prospect): extract Wave 1 enrichment with status transitions + tests"
```

---

### Task 3.2: Extract Wave 2 to `lib/prospect-creation/wave-2.ts`

**Files:**

- Create: `lib/prospect-creation/wave-2.ts`
- Create: `lib/prospect-creation/wave-2.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/prospect-creation/wave-2.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWave2 } from './wave-2';

vi.mock('@/lib/research-executor', () => ({
  executeResearchRun: vi.fn(),
}));
vi.mock('@/lib/logo/resolve', () => ({
  resolveLogoUrl: vi.fn().mockResolvedValue(null),
}));

describe('runWave2', () => {
  let db: any;
  beforeEach(() => {
    db = {
      prospect: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'p1',
          domain: 'mujjo.com',
          projectId: 'proj1',
          industry: 'D2C',
          logoUrl: null,
        }),
        update: vi.fn(),
      },
      prospectAnalysis: {
        findFirst: vi.fn(),
      },
    };
  });

  it('transitions ANALYZING → READY when research run + analysis-v2 succeed', async () => {
    const { executeResearchRun } = await import('@/lib/research-executor');
    (executeResearchRun as any).mockResolvedValue({ run: { id: 'r1' } });
    db.prospectAnalysis.findFirst.mockResolvedValue({
      content: { version: 'analysis-v2' },
    });

    const result = await runWave2(db, { prospectId: 'p1' });

    expect(result.status).toBe('READY');
    expect(db.prospect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'READY',
          analysisCompletedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('transitions to FAILED when executeResearchRun throws', async () => {
    const { executeResearchRun } = await import('@/lib/research-executor');
    (executeResearchRun as any).mockRejectedValue(new Error('SERP API down'));

    const result = await runWave2(db, { prospectId: 'p1' });

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toMatch(/Research pipeline:/);
  });

  it('transitions to FAILED when analysis-v2 row is missing post-pipeline', async () => {
    const { executeResearchRun } = await import('@/lib/research-executor');
    (executeResearchRun as any).mockResolvedValue({ run: { id: 'r1' } });
    db.prospectAnalysis.findFirst.mockResolvedValue(null); // no analysis row

    const result = await runWave2(db, { prospectId: 'p1' });

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toMatch(/Analysis row missing/);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `npx vitest run lib/prospect-creation/wave-2.test.ts`
Expected: FAIL — `runWave2 is not a function`.

- [ ] **Step 3: Implement Wave 2**

```ts
// lib/prospect-creation/wave-2.ts
import type { PrismaClient } from '@prisma/client';
import { executeResearchRun } from '@/lib/research-executor';
import { resolveLogoUrl } from '@/lib/logo/resolve';

export interface Wave2Input {
  prospectId: string;
}

export interface Wave2Result {
  prospectId: string;
  status: 'READY' | 'FAILED';
  failureReason?: string;
}

export async function runWave2(
  db: Pick<PrismaClient, 'prospect' | 'prospectAnalysis'>,
  input: Wave2Input,
): Promise<Wave2Result> {
  const prospect = await db.prospect.findUniqueOrThrow({
    where: { id: input.prospectId },
    select: { id: true, domain: true, logoUrl: true },
  });

  // Logo resolution (best-effort, non-blocking within wave)
  void (async () => {
    try {
      const logoUrl = await resolveLogoUrl(prospect.domain, {
        apolloLogoUrl: prospect.logoUrl,
      });
      if (logoUrl && logoUrl !== prospect.logoUrl) {
        await db.prospect.update({
          where: { id: prospect.id },
          data: { logoUrl },
        });
      }
    } catch {
      // logo failure is never fatal
    }
  })();

  // Research run + master analyzer
  try {
    await executeResearchRun(db as PrismaClient, {
      prospectId: prospect.id,
      manualUrls: [],
    });
  } catch (error) {
    const reason = `Research pipeline: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`;
    await db.prospect.update({
      where: { id: prospect.id },
      data: { status: 'FAILED', failureReason: reason },
    });
    return { prospectId: prospect.id, status: 'FAILED', failureReason: reason };
  }

  // Verify analysis-v2 row was created (data integrity guard)
  const analysis = await db.prospectAnalysis.findFirst({
    where: { prospectId: prospect.id },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  });

  const hasV2 =
    analysis?.content &&
    typeof analysis.content === 'object' &&
    !Array.isArray(analysis.content) &&
    (analysis.content as { version?: string }).version === 'analysis-v2';

  if (!hasV2) {
    const reason = 'Analysis row missing post-pipeline (data integrity)';
    await db.prospect.update({
      where: { id: prospect.id },
      data: { status: 'FAILED', failureReason: reason },
    });
    return { prospectId: prospect.id, status: 'FAILED', failureReason: reason };
  }

  // Success → READY
  await db.prospect.update({
    where: { id: prospect.id },
    data: {
      status: 'READY',
      analysisCompletedAt: new Date(),
      failureReason: null,
    },
  });

  return { prospectId: prospect.id, status: 'READY' };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run lib/prospect-creation/wave-2.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/prospect-creation/wave-2.ts lib/prospect-creation/wave-2.test.ts
git commit -m "feat(prospect): extract Wave 2 research+analyse with READY/FAILED transitions"
```

---

### Task 3.3: Rewrite `createAndProcess` to use Wave 1/Wave 2

**Files:**

- Modify: `server/routers/admin.ts:499-688`

- [ ] **Step 1: Replace `createAndProcess` mutation body**

Replace lines 499-688 (the entire `createAndProcess: projectAdminProcedure ...` block) with:

```ts
  createAndProcess: projectAdminProcedure
    .input(
      z.object({
        domain: z.string().min(1),
        internalNotes: z.string().optional(),
        companyName: z.string().min(1).max(200).optional().nullable(),
        industry: z.string().min(1).max(100).optional().nullable(),
        description: z.string().max(500).optional().nullable(),
        employeeRange: z
          .enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+'])
          .optional()
          .nullable(),
        city: z.string().max(100).optional().nullable(),
        country: z.string().max(100).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wave1Result = await runWave1(ctx.db, {
        domain: input.domain,
        projectId: ctx.projectId,
        internalNotes: input.internalNotes,
        manualFields: {
          companyName: input.companyName ?? undefined,
          industry: input.industry ?? undefined,
          description: input.description ?? undefined,
          employeeRange: input.employeeRange ?? undefined,
          city: input.city ?? undefined,
          country: input.country ?? undefined,
        },
      });

      // If Wave 1 hard-failed, return prospect immediately. Wave 2 does NOT run.
      if (wave1Result.status === 'FAILED') {
        return ctx.db.prospect.findUniqueOrThrow({ where: { id: wave1Result.prospectId } });
      }

      // Wave 2 fires-and-forgets. UI redirects to detail page and polls status.
      void (async () => {
        try {
          await runWave2(ctx.db, { prospectId: wave1Result.prospectId });
        } catch (error) {
          console.error('[createAndProcess] Wave 2 unexpected error:', error);
          // runWave2 internally writes FAILED status; this catch is defensive.
        }
      })();

      return ctx.db.prospect.findUniqueOrThrow({ where: { id: wave1Result.prospectId } });
    }),
```

- [ ] **Step 2: Add imports at top of `server/routers/admin.ts`**

```ts
import { runWave1 } from '@/lib/prospect-creation/wave-1';
import { runWave2 } from '@/lib/prospect-creation/wave-2';
```

Remove now-unused imports if `generateWizardContent`, `buildIndustryPrompts`, `buildCompanyContext` are no longer referenced anywhere else in the file (check after Task 3.4).

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "admin\.ts|wave-"`
Expected: zero errors.

- [ ] **Step 4: Run existing createAndProcess tests**

Run: `npx vitest run server/routers/admin.createAndProcess.test.ts`
Expected: pass (Zod schema unchanged, tests still valid).

- [ ] **Step 5: Commit**

```bash
git add server/routers/admin.ts
git commit -m "feat(prospect): createAndProcess uses Wave 1/Wave 2 split — no more legacy v1 generation"
```

---

### Task 3.4: Add `retryAnalysis` tRPC mutation

**Files:**

- Create: `server/routers/admin.retryAnalysis.test.ts`
- Modify: `server/routers/admin.ts` (insert near `runMasterAnalysis`)

- [ ] **Step 1: Write the failing test**

```ts
// server/routers/admin.retryAnalysis.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prospect-creation/wave-1', () => ({
  runWave1: vi
    .fn()
    .mockResolvedValue({ prospectId: 'p1', status: 'ANALYZING' }),
}));
vi.mock('@/lib/prospect-creation/wave-2', () => ({
  runWave2: vi.fn().mockResolvedValue({ prospectId: 'p1', status: 'READY' }),
}));

describe('admin.retryAnalysis behavior', () => {
  // Note: full tRPC procedure invocation requires the test harness used in
  // admin.createAndProcess.test.ts. Adapt that harness here. For now, this
  // test asserts the BRANCHING logic via direct call to the helper.

  let db: any;
  beforeEach(() => {
    db = {
      prospect: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
  });

  it('skips Wave 1 when lushaRawData is non-null (enrichment was successful)', async () => {
    db.prospect.findFirst.mockResolvedValue({
      id: 'p1',
      status: 'FAILED',
      lushaRawData: { companyName: 'Mujjo' },
      projectId: 'proj1',
    });
    const { retryAnalysisHandler } = await import('@/server/routers/admin');
    // Helper must be exported for testability; adapt accordingly.
    const result = await retryAnalysisHandler(
      { db, projectId: 'proj1' },
      { id: 'p1' },
    );

    const { runWave1 } = await import('@/lib/prospect-creation/wave-1');
    const { runWave2 } = await import('@/lib/prospect-creation/wave-2');
    expect(runWave1).not.toHaveBeenCalled();
    expect(runWave2).toHaveBeenCalledWith(db, { prospectId: 'p1' });
    expect(result.status).toBe('READY');
  });

  it('runs full pipeline when lushaRawData is null (enrichment never completed)', async () => {
    db.prospect.findFirst.mockResolvedValue({
      id: 'p1',
      status: 'FAILED',
      lushaRawData: null,
      domain: 'mujjo.com',
      projectId: 'proj1',
    });
    const { retryAnalysisHandler } = await import('@/server/routers/admin');
    await retryAnalysisHandler({ db, projectId: 'proj1' }, { id: 'p1' });

    const { runWave1 } = await import('@/lib/prospect-creation/wave-1');
    expect(runWave1).toHaveBeenCalled();
  });

  it('throws when status is not FAILED', async () => {
    db.prospect.findFirst.mockResolvedValue({
      id: 'p1',
      status: 'READY',
      lushaRawData: {},
      projectId: 'proj1',
    });
    const { retryAnalysisHandler } = await import('@/server/routers/admin');
    await expect(
      retryAnalysisHandler({ db, projectId: 'proj1' }, { id: 'p1' }),
    ).rejects.toThrow(/only retryable from FAILED/i);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `npx vitest run server/routers/admin.retryAnalysis.test.ts`
Expected: FAIL — `retryAnalysisHandler` not exported.

- [ ] **Step 3: Add `retryAnalysisHandler` helper + tRPC mutation**

In `server/routers/admin.ts`, replace the entire existing `runMasterAnalysis` block with:

```ts
// Exported for unit testing; tRPC procedure delegates here.
export async function retryAnalysisHandler(
  ctx: { db: PrismaClient; projectId: string },
  input: { id: string },
) {
  const prospect = await ctx.db.prospect.findFirst({
    where: { id: input.id, projectId: ctx.projectId },
    select: {
      id: true,
      status: true,
      domain: true,
      lushaRawData: true,
      companyName: true,
      industry: true,
      description: true,
      employeeRange: true,
      city: true,
      country: true,
      internalNotes: true,
    },
  });

  if (!prospect) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Prospect not found in active project scope',
    });
  }
  if (prospect.status !== 'FAILED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Retry only retryable from FAILED status.',
    });
  }

  // Clear failureReason on transition.
  await ctx.db.prospect.update({
    where: { id: prospect.id },
    data: { failureReason: null },
  });

  if (prospect.lushaRawData != null) {
    // Enrichment previously succeeded — only retry analysis.
    await ctx.db.prospect.update({
      where: { id: prospect.id },
      data: { status: 'ANALYZING' },
    });
    return await runWave2(ctx.db, { prospectId: prospect.id });
  }

  // Full retry from Wave 1 (note: re-runs Apollo, may consume credits).
  const wave1 = await runWave1(ctx.db, {
    domain: prospect.domain,
    projectId: ctx.projectId,
    internalNotes: prospect.internalNotes ?? undefined,
    manualFields: {
      companyName: prospect.companyName ?? undefined,
      industry: prospect.industry ?? undefined,
      description: prospect.description ?? undefined,
      employeeRange: prospect.employeeRange ?? undefined,
      city: prospect.city ?? undefined,
      country: prospect.country ?? undefined,
    },
  });
  if (wave1.status === 'FAILED') {
    return wave1;
  }
  // Fire-and-forget Wave 2 (UI polls status).
  void runWave2(ctx.db, { prospectId: prospect.id });
  return wave1;
}

// tRPC procedure wraps the handler.
export const retryAnalysis = projectAdminProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => retryAnalysisHandler(ctx, input));
```

Then **add `retryAnalysis` to the router export** (the object at the bottom of the file): replace the now-removed `runMasterAnalysis: ...` entry with `retryAnalysis,`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/routers/admin.retryAnalysis.test.ts`
Expected: all 3 pass.

- [ ] **Step 5: Commit**

```bash
git add server/routers/admin.ts server/routers/admin.retryAnalysis.test.ts
git commit -m "feat(prospect): retryAnalysis tRPC procedure with smart skip-enrichment branch"
```

---

### Task 3.5: Delete legacy `generateContent` mutation

**Files:**

- Modify: `server/routers/admin.ts:460-496`

- [ ] **Step 1: Delete the entire `generateContent` block**

Remove lines `generateContent: projectAdminProcedure ...` through its closing `}),`.

- [ ] **Step 2: Remove from router export**

Remove `generateContent,` from the `adminRouter` object literal at the bottom.

- [ ] **Step 3: Search for callers**

Run: `grep -rn "admin.generateContent\|generateContent\.useMutation" --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: zero callers (legacy regenerate-wizard button was already removed in earlier milestone). If any remain, delete them.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add server/routers/admin.ts
git commit -m "refactor(admin): drop legacy generateContent mutation (replaced by Wave 1/2 flow)"
```

---

## Phase 4: Legacy v1 deletion

### Task 4.1: Delete `lib/ai/generate-wizard.ts` and related prompt builders

**Files:**

- Delete: `lib/ai/generate-wizard.ts`
- Delete (verify usage first): `lib/ai/wizard-*` files

- [ ] **Step 1: List all wizard-related files**

Run: `ls lib/ai/ | grep -i wizard`
Expected: list of candidate files.

- [ ] **Step 2: Verify no callers**

For each candidate file, run: `grep -rn "from.*<filename>" --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: zero callers (after Phase 3, only deleted code referenced these).

- [ ] **Step 3: Delete files**

```bash
git rm lib/ai/generate-wizard.ts
# Plus any wizard-* prompt builders identified above with zero callers.
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor: delete legacy generate-wizard module (analysis-v1)"
```

---

### Task 4.2: Delete `components/public/prospect-dashboard-client.tsx`

**Files:**

- Delete: `components/public/prospect-dashboard-client.tsx`
- Delete: `components/public/atlantis-discover-client.tsx` (verify is also legacy)

- [ ] **Step 1: Verify no callers in active code**

Run: `grep -rn "DashboardClient\|prospect-dashboard-client" --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: only references in `app/analyse/[slug]/page.tsx` (will be removed in Phase 5).

- [ ] **Step 2: For atlantis-discover-client, check if used outside `/analyse/[slug]/page.tsx`**

Run: `grep -rn "atlantis-discover-client\|AtlantisDiscoverClient" --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: same — only `/analyse/[slug]/page.tsx`. Atlantis still uses analysis-v2 → AnalyseBrochure handles both, so this client is also legacy.

- [ ] **Step 3: Delete both files** (after confirming Step 2)

```bash
git rm components/public/prospect-dashboard-client.tsx
git rm components/public/atlantis-discover-client.tsx
```

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: delete legacy DashboardClient + AtlantisDiscoverClient (analysis-v1 fallbacks)"
```

---

## Phase 5: Public route guard

### Task 5.1: Rewrite `app/analyse/[slug]/page.tsx` with strict guard

**Files:**

- Modify: `app/analyse/[slug]/page.tsx`
- Create: `app/analyse/[slug]/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// app/analyse/[slug]/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { notFound } from 'next/navigation';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    prospect: {
      findFirst: vi.fn(),
    },
    prospectAnalysis: {
      findFirst: vi.fn(),
    },
  },
}));

import AnalysePage from './page';
import prisma from '@/lib/prisma';

describe('/analyse/[slug] public guard', () => {
  it('404s for status DRAFT', async () => {
    (prisma.prospect.findFirst as any).mockResolvedValue({
      id: 'p1',
      slug: 'mujjo-9N97ckpR',
      status: 'DRAFT',
    });
    await expect(
      AnalysePage({ params: Promise.resolve({ slug: 'mujjo-9N97ckpR' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it.each(['ENRICHING', 'ANALYZING', 'FAILED', 'ARCHIVED'])(
    '404s for status %s',
    async (status) => {
      (prisma.prospect.findFirst as any).mockResolvedValue({
        id: 'p1',
        status,
      });
      await expect(
        AnalysePage({ params: Promise.resolve({ slug: 'x' }) }),
      ).rejects.toThrow('NEXT_NOT_FOUND');
    },
  );

  it.each(['READY', 'SENT', 'VIEWED', 'ENGAGED', 'QUOTE_SENT', 'CONVERTED'])(
    'renders for status %s with analysis-v2',
    async (status) => {
      (prisma.prospect.findFirst as any).mockResolvedValue({
        id: 'p1',
        slug: 'mujjo-9N97ckpR',
        status,
        readableSlug: 'mujjo',
        domain: 'mujjo.com',
        companyName: 'Mujjo',
        project: { projectType: 'KLARIFAI' },
        _count: { evidenceItems: 8 },
      });
      (prisma.prospectAnalysis.findFirst as any).mockResolvedValue({
        content: {
          version: 'analysis-v2',
          openingHook: '…',
          executiveSummary: '…',
          sections: [{ id: 's1', title: '…' }],
          useCaseRecommendations: [],
        },
        createdAt: new Date(),
      });
      const result = await AnalysePage({
        params: Promise.resolve({ slug: 'mujjo-9N97ckpR' }),
      });
      expect(result).toBeDefined();
    },
  );
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `npx vitest run app/analyse/[slug]/page.test.tsx`
Expected: FAIL (current page has fallback chain).

- [ ] **Step 3: Replace `app/analyse/[slug]/page.tsx` with strict guard**

Replace the entire file body (keep imports; remove `DashboardClient`, `ActiveRunPoller`, `AtlantisDiscoverClient` imports).

```tsx
import { AnalyseBrochure } from '@/components/features/analyse/analyse-brochure';
import type {
  NarrativeAnalysis,
  KlarifaiNarrativeAnalysis,
} from '@/lib/analysis/types';
import prisma from '@/lib/prisma';
import { buildAnalyseSlug, analyseLookupCandidates } from '@/lib/prospect-url';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { PUBLIC_VISIBLE_STATUSES } from '@/lib/constants/prospect-statuses';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function parseNarrativeAnalysis(content: unknown): NarrativeAnalysis | null {
  const obj = asRecord(content);
  if (!obj || obj.version !== 'analysis-v2') return null;
  if (typeof obj.openingHook !== 'string') return null;
  if (typeof obj.executiveSummary !== 'string') return null;
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) return null;
  if (!Array.isArray(obj.spvRecommendations)) return null;
  return obj as unknown as NarrativeAnalysis;
}

function parseKlarifaiNarrativeAnalysis(
  content: unknown,
): KlarifaiNarrativeAnalysis | null {
  const obj = asRecord(content);
  if (!obj || obj.version !== 'analysis-v2') return null;
  if (typeof obj.openingHook !== 'string') return null;
  if (typeof obj.executiveSummary !== 'string') return null;
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) return null;
  if (!Array.isArray(obj.useCaseRecommendations)) return null;
  return obj as unknown as KlarifaiNarrativeAnalysis;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const candidates = analyseLookupCandidates(slug);
  if (candidates.length === 0) return { title: 'Not Found' };

  const prospect = await prisma.prospect.findFirst({
    where: {
      OR: candidates.map((c) => ({ slug: c }, { readableSlug: c })).flat(),
    },
    select: { companyName: true, domain: true, status: true },
  });
  if (
    !prospect ||
    !(PUBLIC_VISIBLE_STATUSES as readonly string[]).includes(prospect.status)
  ) {
    return { title: 'Not Found' };
  }
  return {
    title: `${prospect.companyName ?? prospect.domain} | Workflow Analyse`,
  };
}

export default async function AnalysePage({ params }: Props) {
  const { slug: discoverParam } = await params;
  const candidates = analyseLookupCandidates(discoverParam);
  if (candidates.length === 0) notFound();

  const prospect = await prisma.prospect.findFirst({
    where: {
      OR: candidates.flatMap((c) => [{ slug: c }, { readableSlug: c }]),
    },
    select: {
      id: true,
      slug: true,
      readableSlug: true,
      status: true,
      companyName: true,
      domain: true,
      project: {
        select: { projectType: true, brandName: true, name: true },
      },
      _count: { select: { evidenceItems: true } },
    },
  });

  // Strict guard: 404 for any non-public status.
  if (
    !prospect ||
    !(PUBLIC_VISIBLE_STATUSES as readonly string[]).includes(prospect.status)
  ) {
    notFound();
  }

  // Canonical slug redirect.
  const canonicalSlug = buildAnalyseSlug({
    slug: prospect.slug,
    readableSlug: prospect.readableSlug,
    companyName: prospect.companyName,
    domain: prospect.domain,
  });
  if (discoverParam !== canonicalSlug) {
    redirect(`/analyse/${canonicalSlug}`);
  }

  // Fetch the analysis-v2 narrative.
  const prospectAnalysis = await prisma.prospectAnalysis.findFirst({
    where: { prospectId: prospect.id },
    orderBy: { createdAt: 'desc' },
    select: { content: true, createdAt: true },
  });

  const narrativeAnalysis = parseNarrativeAnalysis(prospectAnalysis?.content);
  const klarifaiNarrativeAnalysis =
    prospect.project.projectType !== 'ATLANTIS'
      ? parseKlarifaiNarrativeAnalysis(prospectAnalysis?.content)
      : null;
  const analysis = narrativeAnalysis ?? klarifaiNarrativeAnalysis;

  // Data integrity guard: a READY+ prospect MUST have analysis-v2.
  if (!analysis) {
    console.error(
      `[analyse/${prospect.slug}] DATA INTEGRITY: prospect status=${prospect.status} but no analysis-v2 row.`,
    );
    notFound();
  }

  const isAtlantis = prospect.project.projectType === 'ATLANTIS';
  const recommendations =
    isAtlantis && narrativeAnalysis
      ? narrativeAnalysis.spvRecommendations
      : (klarifaiNarrativeAnalysis?.useCaseRecommendations ?? []);

  return (
    <AnalyseBrochure
      slug={prospect.slug}
      prospect={{
        id: prospect.id,
        companyName: prospect.companyName ?? prospect.domain,
        domain: prospect.domain,
      }}
      sections={analysis.sections}
      recommendations={recommendations}
      recommendationType={isAtlantis ? 'spv' : 'usecase'}
      researchStats={{
        bronnen: prospect._count.evidenceItems,
        brontypen: 0,
        inzichten: analysis.sections.length,
      }}
      bookingUrl={process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL ?? null}
      contactEmail={process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null}
      phoneNumber={process.env.NEXT_PUBLIC_PHONE_NUMBER ?? null}
    />
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx vitest run app/analyse/[slug]/page.test.tsx`
Expected: 11 tests pass (1 + 4 + 6).

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add app/analyse/[slug]/page.tsx app/analyse/[slug]/page.test.tsx
git commit -m "feat(analyse): strict public route guard — only PUBLIC_VISIBLE_STATUSES render"
```

---

### Task 5.2: Add Klarifai-branded `app/not-found.tsx`

**Files:**

- Create: `app/not-found.tsx`

- [ ] **Step 1: Implement the page**

```tsx
// app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center px-6">
      <div className="max-w-md text-center space-y-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-gold)]">
          [ 404 ]
        </p>
        <h1 className="text-[64px] font-bold text-[var(--color-ink)] leading-[1.05] tracking-[-0.025em]">
          Pagina niet gevonden
          <span className="text-[var(--color-gold)]">.</span>
        </h1>
        <p className="text-[15px] font-light text-[var(--color-muted)] leading-relaxed">
          Deze analyse bestaat niet of is nog niet beschikbaar. Heb je een link
          ontvangen van Klarifai? Check de URL of neem contact op.
        </p>
        <div className="pt-4">
          <Link
            href="https://klarifai.nl"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[11px] font-medium uppercase tracking-[0.1em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c]"
          >
            Naar klarifai.nl
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify locally**

Run dev server (port 9200) and visit `http://localhost:9200/this-page-does-not-exist`.
Expected: navy-bg branded 404 with Sora typography + gold accents.

- [ ] **Step 3: Commit**

```bash
git add app/not-found.tsx
git commit -m "feat(404): Klarifai-branded not-found page (navy + gold + Sora)"
```

---

## Phase 6: Admin UI gating

### Task 6.1: Build `<AnalyzingHero />` component

**Files:**

- Create: `components/features/prospects/analyzing-hero.tsx`

- [ ] **Step 1: Implement component**

```tsx
// components/features/prospects/analyzing-hero.tsx
'use client';

import { Loader2 } from 'lucide-react';
import { api } from '@/components/providers';

interface Props {
  prospectId: string;
  status: 'ENRICHING' | 'ANALYZING';
}

const STAGE_LABELS: Record<string, string> = {
  PENDING: 'Onderzoek voorbereiden',
  CRAWLING: 'Website crawlen',
  EXTRACTING: 'Bewijsstukken verzamelen',
  HYPOTHESIS: 'Pijnpunten formuleren',
  BRIEFING: 'Analyse opstellen',
};

export function AnalyzingHero({ prospectId, status }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (api.research.getActiveStatusByProspectId as any).useQuery(
    { prospectId },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      refetchInterval: (q: any) =>
        (q.state.data as { isActive?: boolean } | undefined)?.isActive
          ? 5000
          : false,
      refetchOnWindowFocus: true,
      enabled: status === 'ANALYZING',
    },
  );

  const heading =
    status === 'ENRICHING' ? 'Bedrijfsdata verrijken' : 'Analyse loopt';
  const subStage = data?.currentStep ? STAGE_LABELS[data.currentStep] : null;

  return (
    <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 flex items-center gap-4">
      <Loader2 className="w-6 h-6 text-[var(--color-gold)] animate-spin shrink-0" />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">
          [ pipeline ]
        </p>
        <h2 className="text-[18px] font-medium text-[var(--color-ink)] mt-1">
          {heading}
          {subStage ? (
            <span className="text-[var(--color-muted)]"> — {subStage}</span>
          ) : null}
        </h2>
        <p className="text-[12px] font-light text-[var(--color-muted)] mt-2">
          De prospect is pas deelbaar zodra deze stap voltooid is. Je kunt
          ondertussen andere prospects bekijken.
        </p>
      </div>
    </div>
  );
}
```

Note: this assumes `api.research.getActiveStatusByProspectId` exists; the existing `getActiveStatusBySlug` may need a sibling procedure. If not present:

- Add procedure in `server/routers/research.ts` accepting `{ prospectId }` instead of `{ slug }`. Mirror existing logic, just change WHERE clause.

- [ ] **Step 2: Add the new tRPC procedure if needed**

Open `server/routers/research.ts`. Locate `getActiveStatusBySlug`. Add sibling:

```ts
getActiveStatusByProspectId: protectedProcedure
  .input(z.object({ prospectId: z.string() }))
  .query(async ({ ctx, input }) => {
    const run = await ctx.db.researchRun.findFirst({
      where: { prospectId: input.prospectId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, currentStep: true },
    });
    if (!run) return { isActive: false, status: null, currentStep: null };
    const isActive = ['PENDING', 'CRAWLING', 'EXTRACTING', 'HYPOTHESIS', 'BRIEFING'].includes(
      run.status,
    );
    return { isActive, status: run.status, currentStep: run.currentStep };
  }),
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/features/prospects/analyzing-hero.tsx server/routers/research.ts
git commit -m "feat(prospect): AnalyzingHero component + getActiveStatusByProspectId procedure"
```

---

### Task 6.2: Build `<FailedBanner />` component

**Files:**

- Create: `components/features/prospects/failed-banner.tsx`

- [ ] **Step 1: Implement component**

```tsx
// components/features/prospects/failed-banner.tsx
'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { api } from '@/components/providers';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  prospectId: string;
  failureReason: string | null;
}

export function FailedBanner({ prospectId, failureReason }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const retry = (api.admin.retryAnalysis as any).useMutation({
    onSuccess: () => router.refresh(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => setError(err.message),
  });

  return (
    <div className="rounded-[12px] border border-red-300 bg-red-50 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-red-600">
            [ pipeline mislukt ]
          </p>
          <h3 className="text-[16px] font-medium text-red-900 mt-1">
            Aanmaken kon niet worden voltooid
          </h3>
          <p className="text-[13px] font-light text-red-700 mt-2">
            {failureReason ?? 'Onbekende fout — probeer opnieuw.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => retry.mutate({ id: prospectId })}
          disabled={retry.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] bg-red-600 text-white border border-red-700 hover:bg-red-700 disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {retry.isPending ? 'Bezig...' : 'Opnieuw proberen'}
        </button>
        {error && <p className="text-[11px] text-red-700">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/features/prospects/failed-banner.tsx
git commit -m "feat(prospect): FailedBanner component with retryAnalysis wired"
```

---

### Task 6.3: Wire gating into `app/admin/prospects/[id]/page.tsx`

**Files:**

- Modify: `app/admin/prospects/[id]/page.tsx`

- [ ] **Step 1: Import new components + helpers**

Near top of file:

```tsx
import { AnalyzingHero } from '@/components/features/prospects/analyzing-hero';
import { FailedBanner } from '@/components/features/prospects/failed-banner';
import { IN_PIPELINE_STATUSES } from '@/lib/constants/prospect-statuses';
```

- [ ] **Step 2: Insert gating render branches near top of main return**

After fetching prospect, before existing JSX:

```tsx
const isInPipeline = (IN_PIPELINE_STATUSES as readonly string[]).includes(
  prospect.status,
);
const isFailed = prospect.status === 'FAILED';
```

In the JSX (top of the main content area, after the back-link breadcrumb):

```tsx
{
  isInPipeline && (
    <AnalyzingHero
      prospectId={prospect.id}
      status={prospect.status === 'ENRICHING' ? 'ENRICHING' : 'ANALYZING'}
    />
  );
}
{
  isFailed && (
    <FailedBanner
      prospectId={prospect.id}
      failureReason={prospect.failureReason ?? null}
    />
  );
}
```

- [ ] **Step 3: Disable "Bekijk pitch" + "Nieuwe offerte" buttons when in pipeline or failed**

Locate the "Bekijk pitch" link (around line 847) and the "Nieuwe offerte" button. Wrap with conditional:

```tsx
const canShareOrQuote = !isInPipeline && !isFailed;

// Where "Bekijk pitch" is rendered:
{
  canShareOrQuote ? (
    <a
      href={`/analyse/${canonicalSlug}`}
      target="_blank"
      className="...current classes..."
    >
      Bekijk pitch
    </a>
  ) : (
    <span
      className="...same classes but with opacity-40 cursor-not-allowed"
      title="Beschikbaar zodra de analyse klaar is"
    >
      Bekijk pitch
    </span>
  );
}
```

Same pattern for "Nieuwe offerte".

- [ ] **Step 4: Update prospect select to include `failureReason`**

In whatever query loads the prospect for this page, ensure `failureReason: true` is in the `select`.

- [ ] **Step 5: Run typecheck + visual check on dev server**

Run: `npx tsc --noEmit`. Then start dev (`npm run dev` on port 9200). Manually open a prospect in each state (force via SQL update for testing) and verify:

- ENRICHING/ANALYZING: hero shown, "Bekijk pitch" disabled.
- FAILED: red banner, retry button works.
- READY: full UI as before.

- [ ] **Step 6: Commit**

```bash
git add app/admin/prospects/[id]/page.tsx
git commit -m "feat(prospect): gate detail page UI on pipeline status (analyzing hero + failed banner)"
```

---

### Task 6.4: Wire card gating in `app/admin/prospects/page.tsx`

**Files:**

- Modify: `app/admin/prospects/page.tsx`

- [ ] **Step 1: Add gating logic to card render**

Locate the card-render loop. For each card:

```tsx
const isInPipeline = (IN_PIPELINE_STATUSES as readonly string[]).includes(
  prospect.status,
);
const isFailed = prospect.status === 'FAILED';

// Wrap the existing <Link> for the card:
{
  isInPipeline ? (
    <div
      className="...same classes... opacity-60 cursor-not-allowed"
      title="Pipeline loopt nog — wacht tot READY"
      aria-disabled
    >
      {/* card contents */}
    </div>
  ) : (
    <Link
      href={`/admin/prospects/${prospect.id}`}
      className="...same classes..."
    >
      {/* card contents */}
    </Link>
  );
}
```

For FAILED state: card stays clickable but render with red border (`border-red-300`) and a small `<AlertTriangle />` icon + truncated `failureReason` chip.

- [ ] **Step 2: Update Prospect query to include `failureReason`**

In whatever query feeds this page (likely `api.admin.list` or similar), ensure `failureReason: true` in select.

- [ ] **Step 3: Run typecheck + visual check**

Run: `npx tsc --noEmit`. Open `/admin/prospects` in dev. Verify cards have correct gating.

- [ ] **Step 4: Commit**

```bash
git add app/admin/prospects/page.tsx
git commit -m "feat(prospect): card gating on prospects list (in-pipeline = non-clickable, failed = red border)"
```

---

### Task 6.5: Update `app/admin/prospects/new/page.tsx` ProcessStage

**Files:**

- Modify: `app/admin/prospects/new/page.tsx`

- [ ] **Step 1: Update ProcessStage type and stage messages**

Replace the `ProcessStage` type and `stageMessages` map:

```ts
type ProcessStage = 'idle' | 'creating' | 'enriching' | 'done' | 'failed';

const stageMessages: Record<ProcessStage, string> = {
  idle: '',
  creating: 'Prospect aanmaken...',
  enriching: 'Bedrijfsdata verrijken via Apollo + KvK...',
  done: 'Klaar! Doorsturen...',
  failed: 'Aanmaken mislukt.',
};
```

- [ ] **Step 2: Update `onMutate` and `onSuccess` handlers**

Replace existing handlers:

```tsx
const createAndProcess = (api.admin.createAndProcess as any).useMutation({
  onMutate: () => {
    setStage('creating');
    setError(null);
    setTimeout(() => setStage('enriching'), 800);
  },
  onSuccess: (data: any) => {
    if (data.status === 'FAILED') {
      setStage('failed');
      setError(
        data.failureReason ??
          'Onbekende fout. Probeer "+ optionele verrijking".',
      );
      return;
    }
    setStage('done');
    // Redirect to detail page; user watches Wave 2 progression there.
    setTimeout(() => router.push(`/admin/prospects/${data.id}`), 600);
  },
  onError: (err: any) => {
    setError(err.message);
    setStage('failed');
  },
});
```

- [ ] **Step 3: Remove the "Success state" view (lines ~138-221)**

Since we now redirect to detail page, the in-form success view (preview link + "Bekijk prospect" button) is no longer reached. Delete the `stage === 'done'` JSX branch.

Replace the conditional render around lines 138-369 with just the form (always visible until redirect happens).

- [ ] **Step 4: Update progress bar to show enriching → done flow**

Update the progress bar JSX so widths are: `creating: 30%`, `enriching: 70%`, `done: 100%`.

- [ ] **Step 5: Run typecheck + visual test**

Run: `npx tsc --noEmit`. Submit form with `mujjo.com` on dev server, verify:

- Stage transitions visible.
- On success → redirected to detail page where AnalyzingHero is shown.
- On Apollo no-coverage → error message shown with hint to use "+ optionele verrijking".

- [ ] **Step 6: Commit**

```bash
git add app/admin/prospects/new/page.tsx
git commit -m "feat(prospect): new prospect form flows to detail page after Wave 1; failure handled inline"
```

---

## Phase 7: Naming cleanup

### Task 7.1: Rename `buildDiscoverPath` → `buildAnalysePath`

**Files:**

- Modify: `lib/prospect-url.ts`
- Modify: all callers (use grep)

- [ ] **Step 1: Rename functions in `lib/prospect-url.ts`**

```ts
// Rename:
//   discoverLookupCandidates → analyseLookupCandidates
//   buildDiscoverSlug → buildAnalyseSlug
//   buildDiscoverPath → buildAnalysePath
//   buildDiscoverUrl → buildAnalyseUrl
```

Just rename function definitions; the bodies stay the same.

- [ ] **Step 2: Update all imports/callers**

Run: `grep -rn "buildDiscoverPath\|buildDiscoverSlug\|buildDiscoverUrl\|discoverLookupCandidates" --include="*.ts" --include="*.tsx" | grep -v node_modules`

For each result, replace the identifier with the renamed version. Use `sed` for bulk:

```bash
grep -rl "buildDiscoverPath\|buildDiscoverSlug\|buildDiscoverUrl\|discoverLookupCandidates" \
  --include="*.ts" --include="*.tsx" \
  app/ components/ lib/ server/ |
  xargs sed -i \
    -e 's/buildDiscoverPath/buildAnalysePath/g' \
    -e 's/buildDiscoverSlug/buildAnalyseSlug/g' \
    -e 's/buildDiscoverUrl/buildAnalyseUrl/g' \
    -e 's/discoverLookupCandidates/analyseLookupCandidates/g'
```

- [ ] **Step 3: Update stale comment in `lib/constants/prospect-statuses.ts`**

If the `/discover/[slug]` comment wasn't fixed in Task 2.1, fix it now.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Run lib/prospect-url tests**

Run: `npx vitest run lib/prospect-url`
Expected: all pass (rename should not change behavior).

- [ ] **Step 6: Commit**

```bash
git add lib/prospect-url.ts lib/constants/prospect-statuses.ts
git add -u  # stages all callers updated
git commit -m "refactor: rename buildDiscover* → buildAnalyse* (route is /analyse, not /discover)"
```

---

## Phase 8: Stale-detection cron

### Task 8.1: Create cron endpoint

**Files:**

- Create: `app/api/internal/cron/stale-analysis-detection/route.ts`

- [ ] **Step 1: Implement endpoint**

```ts
// app/api/internal/cron/stale-analysis-detection/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';

export const dynamic = 'force-dynamic';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function POST(req: Request) {
  // Auth: shared secret for internal crons (mirrors existing pattern in
  // app/api/internal/cron/* — confirm exact env var name during execution).
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${env.INTERNAL_CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const result = await prisma.prospect.updateMany({
    where: {
      status: 'ANALYZING',
      createdAt: { lt: cutoff },
      analysisCompletedAt: null,
    },
    data: {
      status: 'FAILED',
      failureReason:
        'Pipeline timeout (>30min). Probeer opnieuw via "Opnieuw proberen".',
    },
  });

  console.log(
    `[stale-analysis-detection] flagged ${result.count} stale prospects as FAILED`,
  );

  return NextResponse.json({ flagged: result.count });
}
```

- [ ] **Step 2: Verify env var name**

Run: `grep -rn "INTERNAL_CRON_SECRET\|CRON_SECRET" app/api/internal/cron/ env.mjs 2>/dev/null`
Expected: existing crons use the same env var. Match the name exactly.

- [ ] **Step 3: Test locally**

Insert a stale prospect in DB:

```bash
docker exec qualifai-db psql -U user -d qualifai -c "
INSERT INTO \"Prospect\" (id, \"createdAt\", \"updatedAt\", slug, domain, status, \"projectId\")
VALUES ('test-stale-1', NOW() - INTERVAL '31 minutes', NOW(), 'test1234', 'test.example', 'ANALYZING',
  (SELECT id FROM \"Project\" LIMIT 1));
"
```

Then call:

```bash
curl -X POST http://localhost:9200/api/internal/cron/stale-analysis-detection \
  -H "Authorization: Bearer $INTERNAL_CRON_SECRET"
```

Expected: `{"flagged": 1}`. Verify in DB the test prospect now has status=FAILED.

- [ ] **Step 4: Add to crontab**

Open `scripts/cron-research-refresh.ts` for the existing pattern. Create `scripts/cron-stale-analysis-detection.ts`:

```ts
// scripts/cron-stale-analysis-detection.ts
import 'dotenv/config';

const url = process.env.CRON_BASE_URL ?? 'https://qualifai.klarifai.nl';
const secret = process.env.INTERNAL_CRON_SECRET;

if (!secret) {
  console.error('INTERNAL_CRON_SECRET not set');
  process.exit(1);
}

const res = await fetch(`${url}/api/internal/cron/stale-analysis-detection`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${secret}` },
});
const body = await res.json();
console.log(`stale-analysis-detection: ${res.status}`, body);
process.exit(res.ok ? 0 : 1);
```

Add crontab entry: `0 * * * * cd /path/to/qualifai && npx tsx scripts/cron-stale-analysis-detection.ts >> /var/log/qualifai-cron.log 2>&1`.

- [ ] **Step 5: Commit**

```bash
git add app/api/internal/cron/stale-analysis-detection/route.ts scripts/cron-stale-analysis-detection.ts
git commit -m "feat(cron): hourly stale-analysis-detection — flag ANALYZING > 30min as FAILED"
```

---

## Phase 9: Verification

### Task 9.1: Run full type + test suite

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: all pass. New tests:

- `lib/prospect-creation/wave-1.test.ts` (4 tests)
- `lib/prospect-creation/wave-2.test.ts` (3 tests)
- `server/routers/admin.retryAnalysis.test.ts` (3 tests)
- `app/analyse/[slug]/page.test.tsx` (11 tests)

Plus existing tests still green.

- [ ] **Step 3: Check that no `'GENERATING'` or `'ENRICHED'` literals remain**

Run: `grep -rn "'GENERATING'\|'ENRICHED'" --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: zero results outside historical migration files and `.test.` snapshots.

- [ ] **Step 4: Check that no `DashboardClient` or `generateWizardContent` references remain**

Run: `grep -rn "DashboardClient\|generateWizardContent\|prospect-dashboard-client" --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: zero results.

---

### Task 9.2: Manual UAT

- [ ] **Scenario 1: Happy path with real Apollo + Gemini**

1. Open `/admin/prospects/new` on local dev (port 9200).
2. Enter `mujjo.com`, no manual fields, submit.
3. Form transitions: creating → enriching → done. Redirects to `/admin/prospects/[id]`.
4. Detail page shows `AnalyzingHero` with sub-stages updating every 5s.
5. Card on `/admin/prospects` for mujjo: skeleton overlay, non-clickable.
6. Wait ~120s for Wave 2 to complete.
7. Status flips to `READY`. AnalyzingHero disappears. "Bekijk pitch" button enabled.
8. Click "Bekijk pitch" → opens `/analyse/mujjo-{slug}` showing `AnalyseBrochure` (NOT placeholder).

- [ ] **Scenario 2: Apollo no-coverage hard fail**

1. Enter unknown domain (e.g. `xkcd.example.invalid`), no manual fields.
2. Submit — expect inline error "Onvoldoende bedrijfsdata — vul handmatig aan...".
3. Card on `/admin/prospects` (if prospect exists in DRAFT/FAILED): red border, clickable.

- [ ] **Scenario 3: Apollo no-coverage soft success**

1. Enter unknown domain WITH manual fields filled (companyName, industry).
2. Submit — expect normal flow to ANALYZING → READY.

- [ ] **Scenario 4: Failure recovery via retry**

1. Manually flip a prospect to FAILED via DB:
   ```sql
   UPDATE "Prospect" SET status='FAILED', "failureReason"='Test' WHERE id='...';
   ```
2. Open detail page — see red banner.
3. Click "Opnieuw proberen" — observe transition through pipeline back to READY.

- [ ] **Scenario 5: Public guard 404**

1. Visit `/analyse/some-non-existent-slug` — expect Klarifai 404.
2. Force a prospect to status `ENRICHING` via DB. Visit its `/analyse/{slug}` URL — expect 404.

- [ ] **Scenario 6: READY prospect renders cleanly**

1. Visit `/analyse/{slug}` for an existing READY prospect (Maintix, Marfa, STB Kozijnen).
2. Expect AnalyseBrochure rendering with no DashboardClient/legacy fallback.

---

### Task 9.3: Production deploy + post-deploy validation

- [ ] **Step 1: Run pre-flight on prod DB**

Run preflight script against prod (with prod `DATABASE_URL`).
Expected: legacyOnly count ≤ 5; if higher, halt + manual cleanup.

- [ ] **Step 2: Backup prod DB**

```bash
pg_dump $PROD_DATABASE_URL > backups/pre-creation-flow-$(date +%Y%m%d-%H%M).sql
```

- [ ] **Step 3: Merge to main + deploy**

Merge feat branch to main. Vercel auto-deploys main → production.

`prisma migrate deploy` runs as part of `vercel build` (verify in `package.json` build script).

- [ ] **Step 4: Run data migration on prod**

```bash
DATABASE_URL=$PROD_DATABASE_URL npx tsx scripts/migrate-prospect-statuses.ts
```

Expected: counts logged + "OK" message.

- [ ] **Step 5: Smoke test production**

1. Open `qualifai.klarifai.nl/admin/prospects` — list renders, status badges look right.
2. Open existing READY prospects — `/analyse/{slug}` renders AnalyseBrochure.
3. Create one fresh test prospect via `/admin/prospects/new` — observe full flow.

- [ ] **Step 6: Update memory**

Add to `.claude/memory/`:

- `feedback_creation_flow_rebuild.md` — summary of what changed and why.
- Update `MEMORY.md` to reflect new ProspectStatus enum.

---

## Self-Review

**Spec coverage:**

- §3.1 status model → Phase 1 + 2 ✓
- §3.2 createAndProcess Wave 1/2 → Phase 3 ✓
- §3.3 retryAnalysis → Task 3.4 ✓
- §3.4 Public route guard → Phase 5 ✓
- §3.5 Admin UI gating → Phase 6 ✓
- §3.6 Legacy v1 cleanup → Phase 4 + 7 ✓
- §3.7 Stale-detection cron → Phase 8 ✓
- §4 Error handling matrix → covered in tests + helpers ✓
- §5 Testing strategy → Tasks 3.1, 3.2, 3.4, 5.1 + Phase 9 ✓
- §7 Migration risk → Tasks 1.1, 9.3 ✓

**Placeholder scan:** No "TBD", "TODO", or "implement later". One step (6.4) says "wherever the query feeds this page" — acceptable because exact query name needs verifying in code; engineer can grep.

**Type consistency:** `runWave1`, `runWave2`, `retryAnalysisHandler` signatures match across tests and implementations. `Wave1Result` / `Wave2Result` shapes match what `createAndProcess` consumes.

**Scope check:** 9 phases, ~20 tasks, ~3 days of focused work for one engineer. Cohesive — every phase serves the milestone goal. No further decomposition needed.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-04-29-prospect-creation-flow.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task with two-stage review, fast iteration, protected main context.

**2. Inline Execution** — execute tasks in this session with checkpoints between phases.

Which approach?
