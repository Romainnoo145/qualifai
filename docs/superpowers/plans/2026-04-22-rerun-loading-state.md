# Rerun Loading State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace empty/blank pages with a Klarifai-branded loading render state on three surfaces (client `/analyse/[slug]`, admin prospect detail analyse page, admin prospects overview) whenever a `ResearchRun` is in an active status.

**Architecture:** Driven entirely by the existing `ResearchStatus` enum on the latest `ResearchRun` per prospect. New tRPC procedure `research.getActiveStatus` returns status + Dutch label + isActive flag. Client components poll every 5s (overview: 10s) and call `router.refresh()` or query invalidation when run completes. No schema changes, no rewrite of `executeResearchRun`.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma, React Query (built into tRPC), Tailwind + CSS variables (Klarifai brand: navy/gold/Sora).

**Spec:** `docs/superpowers/specs/2026-04-22-rerun-loading-state-design.md`

---

## File Structure

**Create:**

- `lib/research/status-labels.ts` — pure module: maps `ResearchStatus` enum → Dutch label, exports `isActiveStatus()` helper. Single source of truth.
- `lib/research/status-labels.test.ts` — vitest unit tests.
- `components/features/research/rerun-loading-screen.tsx` — branded loading component, two variants (`full`, `inline`), accepts optional `currentStep` string for the phase label.
- `components/features/research/research-run-badge.tsx` — gouden puls-pill badge with text "onderzoek loopt".
- `components/features/research/active-run-poller.tsx` — client-side polling wrapper for client `/analyse/[slug]`: polls `getActiveStatus`, calls `router.refresh()` on transition out of active state.

**Modify:**

- `server/routers/research.ts` — add `getActiveStatus` procedure (publicProcedure, slug-based) + admin variant by `prospectId`.
- `app/analyse/[slug]/page.tsx` — replace existing inline `statusLabel` function with imports from `lib/research/status-labels.ts`. Branch render: if latest run is active, render `<RerunLoadingScreen variant="full" />` wrapped in `<ActiveRunPoller>` instead of the brochure.
- `app/admin/prospects/[id]/analyse/page.tsx` — when no analysis but active run, render `<RerunLoadingScreen variant="inline" />` instead of "Nog geen analyse gegenereerd". Add `refetchInterval` to the `getAnalysis` query when a poll-companion query indicates active status.
- `app/admin/prospects/page.tsx` — add `<ResearchRunBadge />` next to prospect names where latest run is active. Add `refetchInterval` on `listProspects` query when any row is active.

---

## Task 1: Extract Status Labels Module

**Files:**

- Create: `lib/research/status-labels.ts`
- Create: `lib/research/status-labels.test.ts`

The existing inline `statusLabel` function in `app/analyse/[slug]/page.tsx:64-84` becomes our single source of truth. Add `isActiveStatus()` and `currentStepLabel()` helpers used by both UI and tRPC.

- [ ] **Step 1: Write the failing test**

Create `lib/research/status-labels.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_RESEARCH_STATUSES,
  currentStepLabel,
  isActiveStatus,
  statusLabel,
} from './status-labels';

describe('statusLabel', () => {
  it('maps each ResearchStatus to a Dutch label', () => {
    expect(statusLabel('PENDING')).toBe('Onderzoek gestart');
    expect(statusLabel('CRAWLING')).toBe('Bronnen verzamelen');
    expect(statusLabel('EXTRACTING')).toBe('Data-extractie');
    expect(statusLabel('HYPOTHESIS')).toBe('Hypotheses opstellen');
    expect(statusLabel('BRIEFING')).toBe('Briefing opstellen');
    expect(statusLabel('COMPLETED')).toBe('Onderzoek afgerond');
    expect(statusLabel('FAILED')).toBe('Onderzoek update nodig');
  });

  it('returns null for unknown status', () => {
    expect(statusLabel(null)).toBeNull();
    expect(statusLabel(undefined)).toBeNull();
    expect(statusLabel('NOT_A_STATUS')).toBeNull();
  });
});

describe('isActiveStatus', () => {
  it('returns true for in-progress statuses', () => {
    for (const s of ACTIVE_RESEARCH_STATUSES) {
      expect(isActiveStatus(s)).toBe(true);
    }
  });

  it('returns false for end states', () => {
    expect(isActiveStatus('COMPLETED')).toBe(false);
    expect(isActiveStatus('FAILED')).toBe(false);
    expect(isActiveStatus(null)).toBe(false);
  });
});

describe('currentStepLabel', () => {
  it('returns the active-state label, or null for end states', () => {
    expect(currentStepLabel('CRAWLING')).toBe('Bronnen verzamelen');
    expect(currentStepLabel('BRIEFING')).toBe('Briefing opstellen');
    expect(currentStepLabel('COMPLETED')).toBeNull();
    expect(currentStepLabel('FAILED')).toBeNull();
    expect(currentStepLabel(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/research/status-labels.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `lib/research/status-labels.ts`:

```typescript
import type { ResearchStatus } from '@prisma/client';

export const ACTIVE_RESEARCH_STATUSES = [
  'PENDING',
  'CRAWLING',
  'EXTRACTING',
  'HYPOTHESIS',
  'BRIEFING',
] as const satisfies readonly ResearchStatus[];

export type ActiveResearchStatus = (typeof ACTIVE_RESEARCH_STATUSES)[number];

const LABELS: Record<ResearchStatus, string> = {
  PENDING: 'Onderzoek gestart',
  CRAWLING: 'Bronnen verzamelen',
  EXTRACTING: 'Data-extractie',
  HYPOTHESIS: 'Hypotheses opstellen',
  BRIEFING: 'Briefing opstellen',
  COMPLETED: 'Onderzoek afgerond',
  FAILED: 'Onderzoek update nodig',
};

export function statusLabel(
  status: ResearchStatus | string | null | undefined,
): string | null {
  if (!status) return null;
  return LABELS[status as ResearchStatus] ?? null;
}

export function isActiveStatus(
  status: ResearchStatus | string | null | undefined,
): status is ActiveResearchStatus {
  if (!status) return false;
  return (ACTIVE_RESEARCH_STATUSES as readonly string[]).includes(status);
}

export function currentStepLabel(
  status: ResearchStatus | string | null | undefined,
): string | null {
  if (!isActiveStatus(status)) return null;
  return statusLabel(status);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/research/status-labels.test.ts`
Expected: PASS — all 3 describe blocks green.

- [ ] **Step 5: Replace inline function in `app/analyse/[slug]/page.tsx`**

Open `app/analyse/[slug]/page.tsx`. Delete the local `statusLabel` function (currently lines 64–84). Add this import near the top with the other imports:

```typescript
import { statusLabel } from '@/lib/research/status-labels';
```

Verify usages of `statusLabel(...)` elsewhere in the file still compile by running:

```
npx tsc --noEmit
```

Expected: No new errors related to `statusLabel`.

- [ ] **Step 6: Commit**

```bash
git add lib/research/status-labels.ts lib/research/status-labels.test.ts app/analyse/[slug]/page.tsx
git commit -m "refactor(research): extract status labels to shared module with tests"
```

---

## Task 2: tRPC Procedure `research.getActiveStatus`

**Files:**

- Modify: `server/routers/research.ts`
- Create: `server/routers/research.getActiveStatus.test.ts`

Two procedures: `getActiveStatusBySlug` (publicProcedure, used by client `/analyse`) and `getActiveStatusByProspectId` (adminProcedure, used by admin pages). Both return the same shape.

- [ ] **Step 1: Write the failing test**

Create `server/routers/research.getActiveStatus.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResearchStatus } from '@prisma/client';

const findFirst = vi.fn();
const prospectFindFirst = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    researchRun: { findFirst },
    prospect: { findFirst: prospectFindFirst },
  },
}));

import { researchRouter } from './research';

function callerForAdmin() {
  return researchRouter.createCaller({
    db: {
      researchRun: { findFirst },
      prospect: { findFirst: prospectFindFirst },
    },
    user: { id: 'admin-1', isAdmin: true },
    projectId: 'project_klarifai',
    session: null,
  } as never);
}

function callerForPublic() {
  return researchRouter.createCaller({
    db: {
      researchRun: { findFirst },
      prospect: { findFirst: prospectFindFirst },
    },
    user: null,
    session: null,
  } as never);
}

beforeEach(() => {
  findFirst.mockReset();
  prospectFindFirst.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('research.getActiveStatusByProspectId', () => {
  it('returns isActive=true with currentStep label when latest run is CRAWLING', async () => {
    findFirst.mockResolvedValueOnce({
      status: 'CRAWLING' as ResearchStatus,
      startedAt: new Date('2026-04-22T10:00:00Z'),
    });

    const result = await callerForAdmin().getActiveStatusByProspectId({
      prospectId: 'p1',
    });

    expect(result.isActive).toBe(true);
    expect(result.status).toBe('CRAWLING');
    expect(result.currentStep).toBe('Bronnen verzamelen');
    expect(result.startedAt).toEqual(new Date('2026-04-22T10:00:00Z'));
  });

  it('returns isActive=false when latest run is COMPLETED', async () => {
    findFirst.mockResolvedValueOnce({
      status: 'COMPLETED' as ResearchStatus,
      startedAt: new Date('2026-04-22T10:00:00Z'),
    });

    const result = await callerForAdmin().getActiveStatusByProspectId({
      prospectId: 'p1',
    });

    expect(result.isActive).toBe(false);
    expect(result.status).toBe('COMPLETED');
    expect(result.currentStep).toBeNull();
  });

  it('returns nulls when no run exists', async () => {
    findFirst.mockResolvedValueOnce(null);

    const result = await callerForAdmin().getActiveStatusByProspectId({
      prospectId: 'p1',
    });

    expect(result).toEqual({
      isActive: false,
      status: null,
      currentStep: null,
      startedAt: null,
    });
  });
});

describe('research.getActiveStatusBySlug', () => {
  it('looks up prospect by slug then returns its latest run status', async () => {
    prospectFindFirst.mockResolvedValueOnce({ id: 'p1' });
    findFirst.mockResolvedValueOnce({
      status: 'BRIEFING' as ResearchStatus,
      startedAt: new Date('2026-04-22T10:00:00Z'),
    });

    const result = await callerForPublic().getActiveStatusBySlug({
      slug: 'marfa-abc12345',
    });

    expect(result.isActive).toBe(true);
    expect(result.status).toBe('BRIEFING');
    expect(result.currentStep).toBe('Briefing opstellen');
  });

  it('returns nulls when slug does not match a prospect', async () => {
    prospectFindFirst.mockResolvedValueOnce(null);

    const result = await callerForPublic().getActiveStatusBySlug({
      slug: 'unknown',
    });

    expect(result).toEqual({
      isActive: false,
      status: null,
      currentStep: null,
      startedAt: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routers/research.getActiveStatus.test.ts`
Expected: FAIL — procedures don't exist yet.

- [ ] **Step 3: Add procedures to research router**

Open `server/routers/research.ts`. Add these imports near existing imports:

```typescript
import { currentStepLabel, isActiveStatus } from '@/lib/research/status-labels';
import { discoverLookupCandidates } from '@/lib/prospect-url';
import { publicProcedure } from '../trpc';
```

(`adminProcedure` and `router` already imported; double-check.)

Add the procedures inside the `router({ ... })` block — place them right after `startRun` for visibility:

```typescript
  getActiveStatusByProspectId: adminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.researchRun.findFirst({
        where: { prospectId: input.prospectId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, startedAt: true },
      });
      if (!run) {
        return {
          isActive: false,
          status: null,
          currentStep: null,
          startedAt: null,
        };
      }
      return {
        isActive: isActiveStatus(run.status),
        status: run.status,
        currentStep: currentStepLabel(run.status),
        startedAt: run.startedAt,
      };
    }),

  getActiveStatusBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const candidates = discoverLookupCandidates(input.slug);
      if (candidates.length === 0) {
        return {
          isActive: false,
          status: null,
          currentStep: null,
          startedAt: null,
        };
      }
      const prospect = await ctx.db.prospect.findFirst({
        where: {
          OR: candidates.flatMap((c) => [
            { slug: c },
            { readableSlug: c },
          ]),
        },
        select: { id: true },
      });
      if (!prospect) {
        return {
          isActive: false,
          status: null,
          currentStep: null,
          startedAt: null,
        };
      }
      const run = await ctx.db.researchRun.findFirst({
        where: { prospectId: prospect.id },
        orderBy: { createdAt: 'desc' },
        select: { status: true, startedAt: true },
      });
      if (!run) {
        return {
          isActive: false,
          status: null,
          currentStep: null,
          startedAt: null,
        };
      }
      return {
        isActive: isActiveStatus(run.status),
        status: run.status,
        currentStep: currentStepLabel(run.status),
        startedAt: run.startedAt,
      };
    }),
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/routers/research.getActiveStatus.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Type-check whole project**

Run: `npx tsc --noEmit`
Expected: only pre-existing errors (the `lib/enrichment/sitemap.test.ts` Buffer/BodyInit error). No new errors related to research router.

- [ ] **Step 6: Commit**

```bash
git add server/routers/research.ts server/routers/research.getActiveStatus.test.ts
git commit -m "feat(research): tRPC getActiveStatus procedures (slug + prospectId)"
```

---

## Task 3: `RerunLoadingScreen` Component

**Files:**

- Create: `components/features/research/rerun-loading-screen.tsx`

No unit test — it's a visual component. We verify it manually in the dev server (Task 6 wires it up live).

- [ ] **Step 1: Create the component**

Create `components/features/research/rerun-loading-screen.tsx`:

```typescript
'use client';

interface Props {
  variant?: 'full' | 'inline';
  currentStep?: string | null;
}

export function RerunLoadingScreen({
  variant = 'inline',
  currentStep,
}: Props) {
  const isFull = variant === 'full';

  return (
    <div
      className={
        isFull
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-navy)]'
          : 'flex items-center justify-center py-24'
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <Spinner inverted={isFull} />
        <div className="flex flex-col gap-2">
          <h2
            className={
              'font-["Sora"] text-2xl font-medium ' +
              (isFull
                ? 'text-white'
                : 'text-[var(--color-ink)]')
            }
          >
            Analyse wordt bijgewerkt
          </h2>
          <p
            className={
              'font-["Sora"] text-sm font-light ' +
              (isFull
                ? 'text-white/70'
                : 'text-[var(--color-muted)]')
            }
          >
            Dit duurt een paar minuten.
          </p>
          {currentStep ? (
            <p
              className={
                'mt-3 font-["Sora"] text-xs font-medium uppercase tracking-[0.14em] ' +
                (isFull
                  ? 'text-[var(--color-gold)]'
                  : 'text-[var(--color-gold)]')
              }
            >
              {currentStep}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Spinner({ inverted }: { inverted: boolean }) {
  const ringColor = inverted
    ? 'rgba(255,255,255,0.15)'
    : 'var(--color-border)';
  const accentColor = 'var(--color-gold)';
  return (
    <div
      className="relative h-12 w-12"
      aria-hidden="true"
      style={{
        animation: 'klarifai-spin 1.1s linear infinite',
      }}
    >
      <span
        className="absolute inset-0 rounded-full border-2"
        style={{ borderColor: ringColor }}
      />
      <span
        className="absolute inset-0 rounded-full border-2 border-transparent"
        style={{ borderTopColor: accentColor }}
      />
      <style jsx>{`
        @keyframes klarifai-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/features/research/rerun-loading-screen.tsx
git commit -m "feat(research): RerunLoadingScreen component (full + inline variants)"
```

---

## Task 4: `ResearchRunBadge` Component

**Files:**

- Create: `components/features/research/research-run-badge.tsx`

- [ ] **Step 1: Create the component**

Create `components/features/research/research-run-badge.tsx`:

```typescript
'use client';

import type { ResearchStatus } from '@prisma/client';
import { isActiveStatus } from '@/lib/research/status-labels';

interface Props {
  status: ResearchStatus | string | null | undefined;
}

export function ResearchRunBadge({ status }: Props) {
  if (!isActiveStatus(status)) return null;

  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 ' +
        'text-[10px] font-medium uppercase tracking-[0.1em] ' +
        'text-[var(--color-navy)] bg-[var(--color-gold)]/15 ' +
        'border border-[var(--color-gold)]/40'
      }
      style={{
        animation: 'klarifai-pulse 1.8s ease-in-out infinite',
      }}
      aria-label={`Onderzoek loopt voor deze prospect (status: ${status})`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]"
        aria-hidden="true"
      />
      onderzoek loopt
      <style jsx>{`
        @keyframes klarifai-pulse {
          0%,
          100% {
            opacity: 0.85;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </span>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/features/research/research-run-badge.tsx
git commit -m "feat(research): ResearchRunBadge pulse-pill for active runs"
```

---

## Task 5: `ActiveRunPoller` Client Wrapper

**Files:**

- Create: `components/features/research/active-run-poller.tsx`

This wraps the client `/analyse/[slug]` page. It polls `getActiveStatusBySlug` and calls `router.refresh()` when transitioning out of the active state — which causes the server component to refetch and render the new analysis.

- [ ] **Step 1: Create the component**

Create `components/features/research/active-run-poller.tsx`:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/providers';
import { RerunLoadingScreen } from './rerun-loading-screen';

interface Props {
  slug: string;
}

export function ActiveRunPoller({ slug }: Props) {
  const router = useRouter();
  const wasActiveRef = useRef(false);

  const query = api.research.getActiveStatusBySlug.useQuery(
    { slug },
    {
      refetchInterval: (q) => (q.state.data?.isActive ? 5000 : false),
      refetchOnWindowFocus: true,
    },
  );

  const data = query.data;

  useEffect(() => {
    if (!data) return;
    if (data.isActive) {
      wasActiveRef.current = true;
      return;
    }
    if (wasActiveRef.current && !data.isActive) {
      wasActiveRef.current = false;
      router.refresh();
    }
  }, [data, router]);

  if (!data?.isActive) return null;

  return (
    <RerunLoadingScreen variant="full" currentStep={data.currentStep} />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (If tRPC v11 inference complains, follow the existing `as any` workaround pattern from `quality-chip.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add components/features/research/active-run-poller.tsx
git commit -m "feat(research): ActiveRunPoller client wrapper for /analyse"
```

---

## Task 6: Wire Client `/analyse/[slug]/page.tsx`

**Files:**

- Modify: `app/analyse/[slug]/page.tsx`

The server component already loads `prospect.researchRuns[0].status`. We branch on that: if active → render `<ActiveRunPoller>` only (full-bleed loading screen). Otherwise → existing render path.

- [ ] **Step 1: Add imports**

At the top of `app/analyse/[slug]/page.tsx`, add:

```typescript
import { isActiveStatus } from '@/lib/research/status-labels';
import { ActiveRunPoller } from '@/components/features/research/active-run-poller';
```

- [ ] **Step 2: Branch the render**

Find the section after `if (!prospect || prospect.status === 'ARCHIVED') notFound();` (~line 282–284). Right after that block, before the `prospectAnalysis` fetch, add:

```typescript
const latestRunStatus = prospect.researchRuns?.[0]?.status ?? null;

if (isActiveStatus(latestRunStatus)) {
  return <ActiveRunPoller slug={discoverParam} />;
}
```

This short-circuits the entire brochure render while the rerun is in progress — the client sees only the loading screen. The poller flips its own state via `router.refresh()` once the run completes, server re-renders with the new analysis.

- [ ] **Step 3: Manual visual verification**

Start dev server (already running on :9200 per project state). In one terminal trigger a rerun for Marfa via the admin UI — `/admin/prospects/{marfa-id}` → "Nieuwe run" button.

Within ~10 seconds open `/analyse/_JHTy2L6` (Marfa's slug) in the browser. You should see:

- Full-bleed navy background.
- Klarifai-gold spinner.
- Heading "Analyse wordt bijgewerkt".
- Phase label updating as run progresses ("Bronnen verzamelen" → "Briefing opstellen" etc.).

When the run completes (~5–10 min), the page auto-refreshes to the new brochure without any manual action.

- [ ] **Step 4: Commit**

```bash
git add app/analyse/[slug]/page.tsx
git commit -m "feat(analyse): branch to RerunLoadingScreen when latest run is active"
```

---

## Task 7: Wire Admin Analyse Subpage

**Files:**

- Modify: `app/admin/prospects/[id]/analyse/page.tsx`

Currently shows "Nog geen analyse gegenereerd" when `analysis` is null. We add a poll for active status and show the inline loading screen instead when a run is active.

- [ ] **Step 1: Add imports**

At the top of `app/admin/prospects/[id]/analyse/page.tsx`, add:

```typescript
import { RerunLoadingScreen } from '@/components/features/research/rerun-loading-screen';
```

- [ ] **Step 2: Add active-status query and refetch**

Inside the `AnalysePage` component (after the existing `useParams` and `getAnalysis` query), add:

```typescript
const activeRun = api.research.getActiveStatusByProspectId.useQuery(
  { prospectId: id },
  {
    refetchInterval: (q) => (q.state.data?.isActive ? 5000 : false),
    refetchOnWindowFocus: true,
  },
);

const wasActiveRef = useRef(false);
useEffect(() => {
  const isActive = activeRun.data?.isActive ?? false;
  if (isActive) {
    wasActiveRef.current = true;
    return;
  }
  if (wasActiveRef.current && !isActive) {
    wasActiveRef.current = false;
    void analysisQuery.refetch?.();
  }
}, [activeRun.data?.isActive]);
```

Note: `analysisQuery` is the existing destructured `getAnalysis` result — rename the destructure if needed:

```typescript
const analysisQuery = (api.admin.getAnalysis as any).useQuery({
  prospectId: id,
}) as {
  data: AnalysisRow | null | undefined;
  isLoading: boolean;
  refetch?: () => Promise<unknown>;
};
const { data: analysis, isLoading } = analysisQuery;
```

Also add the missing imports at the top of the file:

```typescript
import { useEffect, useRef } from 'react';
```

- [ ] **Step 3: Replace the "no analysis" branch**

Find the existing JSX (around line 138–155) that shows the empty state. Update the conditional:

```typescript
return (
  <SubRouteShell active="analyse">
    {isLoading ? (
      <PageLoader label="Analyse laden" description="Narrative ophalen." />
    ) : activeRun.data?.isActive ? (
      <RerunLoadingScreen
        variant="inline"
        currentStep={activeRun.data.currentStep}
      />
    ) : !analysis ? (
      <div className="py-16 text-center">
        <p className="text-[15px] text-[var(--color-muted-dark)]">
          Nog geen analyse gegenereerd.
        </p>
        <p className="mt-2 text-[13px] text-[var(--color-muted)]">
          Genereer een analyse vanuit het prospect-dossier.
        </p>
      </div>
    ) : (
      <AnalysisContent analysis={analysis} />
    )}
  </SubRouteShell>
);
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual visual verification**

With Marfa rerun running (or trigger a fresh one), open `/admin/prospects/{marfa-id}/analyse`. You should see the inline loading screen centered in the analyse content area (sub-route shell stays intact). When the run completes, the analyse content auto-replaces it.

- [ ] **Step 6: Commit**

```bash
git add app/admin/prospects/[id]/analyse/page.tsx
git commit -m "feat(admin): inline RerunLoadingScreen on prospect analyse subpage"
```

---

## Task 8: Wire Admin Prospects Overview

**Files:**

- Modify: `app/admin/prospects/page.tsx`

The list query already returns `researchRuns[0].status` per row (lines 141–144 in the page). We add the badge next to each prospect's name and turn on `refetchInterval` while any row is active.

- [ ] **Step 1: Add import**

At the top of `app/admin/prospects/page.tsx`, add:

```typescript
import { ResearchRunBadge } from '@/components/features/research/research-run-badge';
import { isActiveStatus } from '@/lib/research/status-labels';
```

- [ ] **Step 2: Enable polling on `listProspects`**

Find the existing query (~line 134):

```typescript
const prospects = api.admin.listProspects.useQuery();
```

Replace with:

```typescript
const prospects = api.admin.listProspects.useQuery(undefined, {
  refetchInterval: (q) => {
    const rows = (q.state.data ?? []) as Array<{
      researchRuns?: Array<{ status?: string | null }>;
    }>;
    const anyActive = rows.some((r) =>
      isActiveStatus(r.researchRuns?.[0]?.status),
    );
    return anyActive ? 10_000 : false;
  },
});
```

- [ ] **Step 3: Render the badge per row**

Find the location where the prospect name is rendered in the row/card. Around line 302 in `app/admin/prospects/page.tsx` there's:

```typescript
const run = prospect.researchRuns?.[0];
```

Locate the JSX that renders the prospect's company name (search for `prospect.companyName` or similar near that block). Add the badge next to it:

```typescript
<div className="flex items-center gap-2">
  <span className="font-medium text-[var(--color-ink)]">
    {prospect.companyName ?? prospect.domain}
  </span>
  <ResearchRunBadge status={run?.status} />
</div>
```

(Adapt to match the existing markup — keep all current classes, only insert the badge as a sibling.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual visual verification**

With a Marfa rerun active, open `/admin/prospects`. The Marfa row should show the gold pulsing badge "onderzoek loopt" next to the company name. Other rows (none in scope right now since DB only has Marfa) would not. When the run completes, the badge disappears within 10s without a manual refresh.

- [ ] **Step 6: Commit**

```bash
git add app/admin/prospects/page.tsx
git commit -m "feat(admin): show ResearchRunBadge on prospects overview while runs are active"
```

---

## Task 9: End-to-End Manual Verification

**Files:** none — verification only.

Run all three surfaces in one rerun cycle to confirm the loop works end-to-end.

- [ ] **Step 1: Trigger a fresh Marfa rerun**

Open `/admin/prospects/{marfa-id}` in the browser and click "Nieuwe run".

- [ ] **Step 2: Verify all three surfaces simultaneously**

In three browser tabs:

1. `/analyse/_JHTy2L6` → full-bleed loading screen with current step label.
2. `/admin/prospects/{marfa-id}/analyse` → inline loading screen centered in the analyse panel.
3. `/admin/prospects` → gold pulsing "onderzoek loopt" badge next to Marfa.

- [ ] **Step 3: Watch phase transitions**

The currentStep label on (1) and (2) should update across the run lifecycle: "Onderzoek gestart" → "Bronnen verzamelen" → "Data-extractie" → "Hypotheses opstellen" → "Briefing opstellen".

- [ ] **Step 4: Verify auto-refresh on completion**

When `executeResearchRun` finishes (~5–10 min):

- (1) refreshes to show the new brochure narrative.
- (2) replaces the loading panel with the fresh `AnalysisContent`.
- (3) badge disappears from the row.

No manual page refresh needed on any tab.

- [ ] **Step 5: Failure-mode sanity check (optional)**

To verify the FAILED handling works without crashing the UI: in psql update the latest run's status manually:

```bash
docker exec qualifai-db psql -U user -d qualifai -c "UPDATE \"ResearchRun\" SET status='FAILED' WHERE id=(SELECT id FROM \"ResearchRun\" ORDER BY \"createdAt\" DESC LIMIT 1);"
```

All three surfaces should stop showing the loading state within their respective polling intervals (5s / 5s / 10s). (1) falls back to "no analysis" if the cascade already wiped it, otherwise to the most recent succesful analysis. (2) shows "Nog geen analyse gegenereerd". (3) badge disappears.

(Restore by running another rerun.)

- [ ] **Step 6: No commit**

Verification only. Spec implementation complete.

---

## Self-Review Notes

- All spec sections are covered: status-labels module (Task 1), tRPC procedures (Task 2), `RerunLoadingScreen` (Task 3), `ResearchRunBadge` (Task 4), `ActiveRunPoller` (Task 5), three surfaces wired (Tasks 6–8), end-to-end verification (Task 9).
- Open punten from the spec resolved in plan: spinner is built fresh (no library); procedures live in existing `research` router (no new router).
- No placeholder text, no "implement later", no TODOs without code.
- Type names consistent: `ResearchStatus`, `ActiveResearchStatus`, `RerunLoadingScreen`, `ResearchRunBadge`, `ActiveRunPoller`, `getActiveStatusByProspectId`, `getActiveStatusBySlug` used identically across all tasks.
