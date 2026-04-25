# Use Case Catalog Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat, free-text use case catalog with a sector-structured catalog of 104 use cases, so the master analyzer can filter by prospect industry and the "Kansen" page shows relevant recommendations.

**Architecture:** Add a `sector` field to UseCase (enum, not free text). Seed 104 use cases with 10 sectors. Update the master analyzer's use case fetch to filter by prospect industry → sector mapping. Update the admin UI to group by sector. Remove legacy import buttons.

**Tech Stack:** Prisma schema migration, tRPC router, Next.js React pages, Gemini 2.5 Pro master prompt

---

## Sector Taxonomy (10 categories from the data)

| Sector Key      | Label (NL)                                   |
| --------------- | -------------------------------------------- |
| `BOUW`          | Bouw & Aannemerij                            |
| `INSTALLATIE`   | Installatie & Techniek                       |
| `ONDERHOUD`     | Onderhoud & Servicebedrijven                 |
| `PRODUCTIE`     | Productie & Maakindustrie                    |
| `LOGISTIEK`     | Logistiek & Transport                        |
| `ZORG`          | Zorginstellingen kleinschalig                |
| `BOUW_DIENSTEN` | Bouwgerelateerde diensten                    |
| `ZAKELIJK`      | Zakelijke Dienstverlening                    |
| `ACCOUNTANCY`   | Accountancy- & Administratiekantoren         |
| `ENERGIE`       | Energie, Installateurs & Duurzaamheidsadvies |

---

### Task 1: Add sector enum + migration

**Files:**

- Modify: `prisma/schema.prisma:587-612` (UseCase model)
- Create: `prisma/migrations/<timestamp>_add_use_case_sector/migration.sql`

- [ ] **Step 1: Add UseCaseSector enum and sector field to schema**

In `prisma/schema.prisma`, add above the UseCase model:

```prisma
enum UseCaseSector {
  BOUW
  INSTALLATIE
  ONDERHOUD
  PRODUCTIE
  LOGISTIEK
  ZORG
  BOUW_DIENSTEN
  ZAKELIJK
  ACCOUNTANCY
  ENERGIE
}
```

Then add `sector` field to the UseCase model, after `category`:

```prisma
model UseCase {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  title         String
  summary       String
  category      String
  sector        UseCaseSector?
  outcomes      String[]
  tags          String[]
  caseStudyRefs String[]
  isActive      Boolean  @default(true)
  isShipped     Boolean  @default(true)
  sourceRef     String?
  externalUrl   String?

  projectId String  @default("project_klarifai")
  project   Project @relation(fields: [projectId], references: [id], onDelete: Restrict)

  proofMatches ProofMatch[]

  @@index([isActive, isShipped])
  @@index([category])
  @@index([projectId, updatedAt])
  @@index([projectId, sourceRef])
  @@index([sector])
}
```

Note: `sector` is nullable so existing use cases don't break. New ones from the seed will always have it set.

- [ ] **Step 2: Create and apply the migration**

```bash
docker exec qualifai-db psql -U user -d qualifai -c "
  CREATE TYPE \"UseCaseSector\" AS ENUM ('BOUW', 'INSTALLATIE', 'ONDERHOUD', 'PRODUCTIE', 'LOGISTIEK', 'ZORG', 'BOUW_DIENSTEN', 'ZAKELIJK', 'ACCOUNTANCY', 'ENERGIE');
  ALTER TABLE \"UseCase\" ADD COLUMN \"sector\" \"UseCaseSector\";
  CREATE INDEX \"UseCase_sector_idx\" ON \"UseCase\"(\"sector\");
"
```

Then create the migration file manually:

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_use_case_sector
```

Write `migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "UseCaseSector" AS ENUM ('BOUW', 'INSTALLATIE', 'ONDERHOUD', 'PRODUCTIE', 'LOGISTIEK', 'ZORG', 'BOUW_DIENSTEN', 'ZAKELIJK', 'ACCOUNTANCY', 'ENERGIE');

-- AlterTable
ALTER TABLE "UseCase" ADD COLUMN "sector" "UseCaseSector";

-- CreateIndex
CREATE INDEX "UseCase_sector_idx" ON "UseCase"("sector");
```

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add UseCaseSector enum and sector field to UseCase model"
```

---

### Task 2: Sector constants and industry mapping

**Files:**

- Create: `lib/constants/sectors.ts`

- [ ] **Step 1: Create the sector constants file**

```typescript
// lib/constants/sectors.ts
import type { UseCaseSector } from '@prisma/client';

export const SECTOR_LABELS: Record<UseCaseSector, string> = {
  BOUW: 'Bouw & Aannemerij',
  INSTALLATIE: 'Installatie & Techniek',
  ONDERHOUD: 'Onderhoud & Servicebedrijven',
  PRODUCTIE: 'Productie & Maakindustrie',
  LOGISTIEK: 'Logistiek & Transport',
  ZORG: 'Zorginstellingen kleinschalig',
  BOUW_DIENSTEN: 'Bouwgerelateerde diensten',
  ZAKELIJK: 'Zakelijke Dienstverlening',
  ACCOUNTANCY: 'Accountancy- & Administratiekantoren',
  ENERGIE: 'Energie, Installateurs & Duurzaamheidsadvies',
};

/**
 * Map Apollo/enrichment industry strings to UseCaseSector.
 * Returns null if no clear match — the master analyzer will then
 * receive ALL use cases (current behavior, safe fallback).
 */
export function industryToSector(
  industry: string | null,
): UseCaseSector | null {
  if (!industry) return null;
  const lower = industry.toLowerCase();

  // Construction & building
  if (
    lower.includes('construction') ||
    lower.includes('bouw') ||
    lower.includes('building')
  )
    return 'BOUW';

  // Installation & HVAC
  if (
    lower.includes('hvac') ||
    lower.includes('install') ||
    lower.includes('electrical') ||
    lower.includes('plumbing')
  )
    return 'INSTALLATIE';

  // Maintenance & facility
  if (
    lower.includes('facility') ||
    lower.includes('maintenance') ||
    lower.includes('cleaning') ||
    lower.includes('onderhoud')
  )
    return 'ONDERHOUD';

  // Manufacturing & production
  if (
    lower.includes('manufacturing') ||
    lower.includes('production') ||
    lower.includes('industrial') ||
    lower.includes('machining') ||
    lower.includes('fabricat')
  )
    return 'PRODUCTIE';

  // Logistics & transport
  if (
    lower.includes('logistics') ||
    lower.includes('transport') ||
    lower.includes('freight') ||
    lower.includes('shipping') ||
    lower.includes('warehousing')
  )
    return 'LOGISTIEK';

  // Healthcare (small scale)
  if (
    lower.includes('health') ||
    lower.includes('care') ||
    lower.includes('zorg') ||
    lower.includes('medical') ||
    lower.includes('nursing')
  )
    return 'ZORG';

  // Architecture & engineering services
  if (
    lower.includes('architecture') ||
    lower.includes('engineering services') ||
    lower.includes('civil engineering') ||
    lower.includes('structural')
  )
    return 'BOUW_DIENSTEN';

  // Professional services & consulting
  if (
    lower.includes('consulting') ||
    lower.includes('professional services') ||
    lower.includes('management consulting') ||
    lower.includes('advisory') ||
    lower.includes('marketing') ||
    lower.includes('advertising') ||
    lower.includes('creative') ||
    lower.includes('legal')
  )
    return 'ZAKELIJK';

  // Accounting & administration
  if (
    lower.includes('accounting') ||
    lower.includes('accountancy') ||
    lower.includes('bookkeeping') ||
    lower.includes('audit') ||
    lower.includes('tax')
  )
    return 'ACCOUNTANCY';

  // Energy & sustainability
  if (
    lower.includes('energy') ||
    lower.includes('solar') ||
    lower.includes('renewable') ||
    lower.includes('sustainability') ||
    lower.includes('utilities') ||
    lower.includes('duurzaam')
  )
    return 'ENERGIE';

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/constants/sectors.ts
git commit -m "feat: add sector taxonomy constants and industry-to-sector mapping"
```

---

### Task 3: Seed script for 104 use cases

**Files:**

- Create: `prisma/seed-use-cases.ts`

- [ ] **Step 1: Create the seed script**

Create `prisma/seed-use-cases.ts` that:

1. Reads the 104 use cases from an inline JSON array (the data the user provided)
2. Maps each `category` string to the `UseCaseSector` enum
3. Upserts by `title + projectId` (idempotent — safe to re-run)

```typescript
// prisma/seed-use-cases.ts
import { PrismaClient, UseCaseSector } from '@prisma/client';

const CATEGORY_TO_SECTOR: Record<string, UseCaseSector> = {
  'Bouw & Aannemerij': 'BOUW',
  'Installatie & Techniek': 'INSTALLATIE',
  'Onderhoud & Servicebedrijven': 'ONDERHOUD',
  'Productie & Maakindustrie': 'PRODUCTIE',
  'Logistiek & Transport': 'LOGISTIEK',
  'Zorginstellingen kleinschalig': 'ZORG',
  'Bouwgerelateerde diensten': 'BOUW_DIENSTEN',
  'Zakelijke Dienstverlening': 'ZAKELIJK',
  'Accountancy- & Administratiekantoren': 'ACCOUNTANCY',
  'Energie, Installateurs & Duurzaamheidsadvies': 'ENERGIE',
};

const USE_CASES: Array<{
  title: string;
  summary: string;
  category: string;
  outcomes: string[];
  tags: string[];
  isShipped: boolean;
}> = [
  // <<< PASTE THE FULL 104 USE CASES JSON ARRAY HERE >>>
];

async function main() {
  const db = new PrismaClient();
  const PROJECT_ID = 'project_klarifai';

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const uc of USE_CASES) {
    const sector = CATEGORY_TO_SECTOR[uc.category] ?? null;
    if (!sector) {
      console.warn(`Unknown category: ${uc.category} for "${uc.title}"`);
    }

    const existing = await db.useCase.findFirst({
      where: { projectId: PROJECT_ID, title: uc.title },
      select: { id: true },
    });

    if (existing) {
      await db.useCase.update({
        where: { id: existing.id },
        data: {
          summary: uc.summary,
          category: uc.category,
          sector,
          outcomes: uc.outcomes,
          tags: uc.tags,
          isShipped: uc.isShipped,
          isActive: true,
        },
      });
      updated++;
    } else {
      await db.useCase.create({
        data: {
          projectId: PROJECT_ID,
          title: uc.title,
          summary: uc.summary,
          category: uc.category,
          sector,
          outcomes: uc.outcomes,
          tags: uc.tags,
          caseStudyRefs: [],
          isActive: true,
          isShipped: uc.isShipped,
        },
      });
      created++;
    }
  }

  console.log(
    `Seed complete: ${created} created, ${updated} updated, ${skipped} skipped`,
  );
  await db.$disconnect();
}

main().catch(console.error);
```

- [ ] **Step 2: Run the seed**

```bash
npx tsx prisma/seed-use-cases.ts
```

Expected: `Seed complete: 104 created, 0 updated, 0 skipped`

- [ ] **Step 3: Verify in DB**

```bash
docker exec qualifai-db psql -U user -d qualifai -c "
  SELECT sector, COUNT(*) FROM \"UseCase\" WHERE sector IS NOT NULL GROUP BY sector ORDER BY COUNT(*) DESC;
"
```

Expected: 10 sectors with counts totaling 104.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-use-cases.ts
git commit -m "feat: seed 104 use cases across 10 sectors"
```

---

### Task 4: Update master analyzer to filter use cases by sector

**Files:**

- Modify: `lib/research-executor.ts:1750-1765` (use case fetch)
- Modify: `lib/analysis/master-prompt.ts:327-345` (prompt section)

- [ ] **Step 1: Add sector-aware use case fetch in research-executor**

In `lib/research-executor.ts`, replace the use case fetch at line ~1750:

```typescript
// Current:
const useCases = await db.useCase.findMany({
  where: {
    projectId: prospect.project.id,
    isActive: true,
    isShipped: true,
  },
  select: {
    id: true,
    title: true,
    summary: true,
    category: true,
    outcomes: true,
  },
  orderBy: { updatedAt: 'desc' },
  take: 20,
});

// Replace with:
import { industryToSector } from '@/lib/constants/sectors';

const prospectSector = industryToSector(prospect.industry);

// Fetch sector-matched use cases first, then fill with others
const sectorUseCases = prospectSector
  ? await db.useCase.findMany({
      where: {
        projectId: prospect.project.id,
        isActive: true,
        sector: prospectSector,
      },
      select: {
        id: true,
        title: true,
        summary: true,
        category: true,
        outcomes: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    })
  : [];

// Fill remaining slots with other sectors (cross-pollination)
const sectorIds = new Set(sectorUseCases.map((u) => u.id));
const otherUseCases = await db.useCase.findMany({
  where: {
    projectId: prospect.project.id,
    isActive: true,
    id: { notIn: [...sectorIds] },
  },
  select: {
    id: true,
    title: true,
    summary: true,
    category: true,
    outcomes: true,
  },
  orderBy: { updatedAt: 'desc' },
  take: 5,
});

const useCases = [...sectorUseCases, ...otherUseCases];
```

This gives the AI 15 sector-matched + 5 cross-sector use cases (20 total, same budget).

- [ ] **Step 2: Update master prompt to show sector context**

In `lib/analysis/master-prompt.ts`, update the use cases section at line ~327:

```typescript
// Replace header:
parts.push('=== BEWEZEN DIENSTEN (Klarifai) ===');
parts.push(
  'Gebruik deze diensten als basis voor aanbevelingen. Match diensten aan pijnpunten uit het bewijs.',
);

// With:
parts.push('=== BEWEZEN DIENSTEN (Klarifai) ===');
if (prospect.industry) {
  parts.push(
    `Dit bedrijf zit in de sector "${prospect.industry}". Prioriteer diensten die passen bij deze sector.`,
  );
}
parts.push(
  'Match diensten aan pijnpunten uit het bewijs. Kies de 3-6 meest relevante.',
);
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep -v "scripts/tmp-" | grep -v "sitemap.test.ts" | grep "error TS"
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/research-executor.ts lib/analysis/master-prompt.ts
git commit -m "feat: filter use cases by prospect sector in master analyzer"
```

---

### Task 5: Update tRPC router — add sector filter, seed mutation, remove legacy imports

**Files:**

- Modify: `server/routers/use-cases.ts`

- [ ] **Step 1: Add sector to list query filter and create/update inputs**

In `server/routers/use-cases.ts`, update the `list` query input:

```typescript
list: projectAdminProcedure
  .input(
    z
      .object({
        category: z.string().optional(),
        sector: z.nativeEnum(UseCaseSector).optional(), // ADD
        isActive: z.boolean().optional(),
        limit: z.number().min(1).max(500).default(200), // raise limit for 104+ cases
      })
      .optional(),
  )
  .query(async ({ ctx, input }) => {
    const where: Record<string, unknown> = {
      projectId: ctx.projectId,
    };
    if (input?.category !== undefined) where.category = input.category;
    if (input?.sector !== undefined) where.sector = input.sector;
    if (input?.isActive !== undefined) where.isActive = input.isActive;

    return ctx.db.useCase.findMany({
      where,
      orderBy: [{ sector: 'asc' }, { updatedAt: 'desc' }],
      take: input?.limit ?? 200,
      include: {
        _count: { select: { proofMatches: true } },
      },
    });
  }),
```

Add `UseCaseSector` import at top:

```typescript
import { UseCaseSector } from '@prisma/client';
```

Add `sector` to `create` and `update` inputs:

```typescript
// In create input, after category:
sector: z.nativeEnum(UseCaseSector).optional(),

// In update input, after category:
sector: z.nativeEnum(UseCaseSector).optional(),
```

- [ ] **Step 2: Add a bulk seed mutation (for re-running the seed from admin)**

```typescript
seedFromJson: projectAdminProcedure
  .input(
    z.object({
      useCases: z.array(
        z.object({
          title: z.string().min(2),
          summary: z.string().min(10),
          category: z.string(),
          sector: z.nativeEnum(UseCaseSector).optional(),
          outcomes: z.array(z.string()),
          tags: z.array(z.string()),
          isShipped: z.boolean().default(false),
        }),
      ),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    let created = 0;
    let updated = 0;

    for (const uc of input.useCases) {
      const existing = await ctx.db.useCase.findFirst({
        where: { projectId: ctx.projectId, title: uc.title },
        select: { id: true },
      });

      if (existing) {
        await ctx.db.useCase.update({
          where: { id: existing.id },
          data: {
            summary: uc.summary,
            category: uc.category,
            sector: uc.sector,
            outcomes: uc.outcomes,
            tags: uc.tags,
            isShipped: uc.isShipped,
            isActive: true,
          },
        });
        updated++;
      } else {
        await ctx.db.useCase.create({
          data: {
            projectId: ctx.projectId,
            title: uc.title,
            summary: uc.summary,
            category: uc.category,
            sector: uc.sector,
            outcomes: uc.outcomes,
            tags: uc.tags,
            caseStudyRefs: [],
            isActive: true,
            isShipped: uc.isShipped,
          },
        });
        created++;
      }
    }

    return { created, updated };
  }),
```

- [ ] **Step 3: Remove legacy import mutations**

Delete these four mutations from the router:

- `importFromObsidian`
- `importFromVault`
- `importFromAtlantisVolumes`
- `importFromCodebase`

Also remove the now-unused imports at the top:

- `scanVaultForUseCases`
- `analyzeCodebase`
- `inventoryToCandidates`, `offersToCandidates`, `readJsonSafe`
- `scanAtlantisVolumesForUseCases`

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep -v "scripts/tmp-" | grep -v "sitemap.test.ts" | grep "error TS"
```

Fix any errors from removed imports being referenced elsewhere. The admin UI page will break — that's Task 6.

- [ ] **Step 5: Commit**

```bash
git add server/routers/use-cases.ts
git commit -m "feat: add sector filter to use cases router, remove legacy imports"
```

---

### Task 6: Rebuild admin use cases page — grouped by sector

**Files:**

- Modify: `app/admin/use-cases/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the use cases admin page**

Replace the entire page with a sector-grouped view:

- Sidebar: list of sectors with count badges
- Main area: use cases for selected sector
- Each use case card: title, summary (truncated), outcomes count, tags, proof matches count
- Remove: Obsidian/Vault/Codebase/Atlantis import buttons
- Keep: Create and Edit inline forms (add sector dropdown)
- Add: sector filter in the list query

The page should:

1. Default to showing ALL use cases grouped by sector headers
2. Allow clicking a sector in sidebar to filter
3. Show total count and per-sector counts
4. Maintain create/edit/delete functionality with sector dropdown

Key patterns to follow from existing admin pages:

- Use `api.useCases.list.useQuery()` with sector filter
- Use `SECTOR_LABELS` from `lib/constants/sectors.ts` for display
- Use collapsible sector groups (same pattern as evidence page)
- Keep the existing `UseCase` type shape, add `sector: UseCaseSector | null`

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep -v "scripts/tmp-" | grep -v "sitemap.test.ts" | grep "error TS"
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/use-cases/page.tsx
git commit -m "feat: rebuild use cases admin page with sector grouping"
```

---

### Task 7: Update matchProofs to include sector context

**Files:**

- Modify: `lib/workflow-engine.ts:1511-1569` (matchProofs function)

- [ ] **Step 1: Add sector filter to matchProofs**

Update the `matchProofs` function to accept an optional `sector` parameter and prioritize sector-matched use cases:

```typescript
export async function matchProofs(
  db: PrismaClient,
  query: string,
  limit = 4,
  options?: {
    projectId?: string;
    sector?: UseCaseSector | null; // ADD
  },
): Promise<ProofMatchResult[]> {
  // Fetch sector-matched first, then others
  const where: Record<string, unknown> = {
    isActive: true,
    ...(options?.projectId ? { projectId: options.projectId } : {}),
  };

  let useCases;
  if (options?.sector) {
    const sectorCases = await db.useCase.findMany({
      where: { ...where, sector: options.sector },
      select: { id: true, title: true, summary: true, tags: true, isShipped: true, externalUrl: true },
    });
    const otherCases = await db.useCase.findMany({
      where: { ...where, sector: { not: options.sector } },
      select: { id: true, title: true, summary: true, tags: true, isShipped: true, externalUrl: true },
      take: 10,
    });
    useCases = [...sectorCases, ...otherCases];
  } else {
    useCases = await db.useCase.findMany({
      where,
      select: { id: true, title: true, summary: true, tags: true, isShipped: true, externalUrl: true },
    });
  }

  // Rest of scoring logic unchanged
```

- [ ] **Step 2: Pass sector from callers**

Find callers of `matchProofs` and pass `sector: industryToSector(prospect.industry)` where available.

- [ ] **Step 3: Commit**

```bash
git add lib/workflow-engine.ts
git commit -m "feat: add sector-aware proof matching"
```

---

### Task 8: Type check, verify, update UseCaseInput type

**Files:**

- Modify: `lib/analysis/types.ts:110-116` (UseCaseInput)

- [ ] **Step 1: Add sector to UseCaseInput type**

```typescript
export type UseCaseInput = {
  id: string;
  title: string;
  summary: string;
  category: string;
  sector?: string | null; // ADD — passed to prompt for context
  outcomes: string[];
};
```

- [ ] **Step 2: Update research-executor to include sector in the mapping**

In `lib/research-executor.ts` at the `useCases.map()` call (~line 1830):

```typescript
useCases: useCases.map((uc) => ({
  id: uc.id,
  title: uc.title,
  summary: uc.summary,
  category: uc.category,
  sector: uc.sector ?? null, // ADD
  outcomes: uc.outcomes as string[],
})),
```

Also add `sector: true` to the select clause at ~line 1758.

- [ ] **Step 3: Full type check**

```bash
npx tsc --noEmit 2>&1 | grep -v "scripts/tmp-" | grep -v "sitemap.test.ts" | grep "error TS"
```

- [ ] **Step 4: Commit**

```bash
git add lib/analysis/types.ts lib/research-executor.ts
git commit -m "feat: propagate sector through analysis pipeline types"
```

---

## Verification

After all tasks:

1. **DB check:** `SELECT sector, COUNT(*) FROM "UseCase" WHERE sector IS NOT NULL GROUP BY sector` → 10 rows, 104 total
2. **Admin UI:** `/admin/use-cases` shows use cases grouped by sector
3. **Pipeline test:** Re-run master analysis for one prospect (`Genereer analyse` button) → verify the AI receives sector-filtered use cases and recommends relevant ones
4. **Type check:** `npx tsc --noEmit` clean (no new errors)
