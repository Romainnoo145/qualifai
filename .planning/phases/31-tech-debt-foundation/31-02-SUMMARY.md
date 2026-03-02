---
phase: 31-tech-debt-foundation
plan: 02
subsystem: api
tags: [typescript, prisma, trpc, type-safety, debt]

# Dependency graph
requires:
  - phase: 31-tech-debt-foundation
    provides: Phase 31 research identifying TS2589 cast locations

provides:
  - Prisma.ResearchRunGetPayload typed helper (ResearchRunRow) replacing 5 TS2589 as any casts in detail view
  - Typed Json guards for summary.gate access in outreach.ts (zero as any)
  - Typed Json guards for summary.gate access in quality-chip.tsx (summary cast)
  - MEMORY.md updated with Prisma.XGetPayload pattern for future sessions

affects:
  - 31-tech-debt-foundation (remaining plans benefit from the established pattern)
  - Any future work touching admin prospect detail page, quality chip, or outreach router

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Prisma.XGetPayload<{include:{...}}> mirrors query include shape to replace TS2589 as any casts'
    - "Typed Json guard: value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string,unknown>) : null"
    - 'tRPC v11 inference gaps marked with // TODO: tRPC v11 inference comment (not TS2589)'

key-files:
  created: []
  modified:
    - app/admin/prospects/[id]/page.tsx
    - components/features/prospects/quality-chip.tsx
    - server/routers/outreach.ts

key-decisions:
  - 'TS2589 casts replaced with Prisma.ResearchRunGetPayload mirroring listRuns include shape'
  - 'tRPC v11 inference gaps (prospect.data, getRun data) kept as any with TODO comment — not TS2589'
  - 'quality-chip fullRun cast kept as any with TODO — getRun include shape too complex for immediate GetPayload'
  - 'overrideAudits.data as any[] kept — tRPC v11 listOverrideAudits inference gap, not TS2589'

patterns-established:
  - 'ResearchRunRow = Prisma.ResearchRunGetPayload<{include:{...}}> in app/admin/prospects/[id]/page.tsx'
  - 'Json field guard: summaryObj -> gate -> Record<string,unknown> for nested access'

requirements-completed: [DEBT-04, DEBT-06]

# Metrics
duration: 7min
completed: 2026-03-02
---

# Phase 31 Plan 02: TS2589 Cast Replacement Summary

**Prisma.ResearchRunGetPayload typed helper replaces 5 TS2589 `as any` casts in detail view; typed Json guards replace `as any` in outreach router and quality chip summary access**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-02T08:41:35Z
- **Completed:** 2026-03-02T08:48:55Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Detail page: ResearchRunRow type mirrors listRuns query include shape exactly; all 5 downstream `qualityApproved`/`qualityReviewedAt`/`summary`/`_count`/`status` accesses now typed
- outreach.ts: `(latestRun.summary as any)?.gate` replaced with double-guard pattern — zero `as any` casts remain
- quality-chip.tsx: `(summary as any)?.gate` replaced with typed guard; `fullRun` remains `as any` with TODO comment (tRPC v11 inference, not TS2589)
- MEMORY.md updated: TS2589 tech debt entry removed, Prisma.XGetPayload pattern documented in Key Patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace detail-view as any casts with Prisma.ResearchRunGetPayload types** - `3d7d53a` (feat)
2. **Task 2: Fix TS2589 casts in quality-chip and outreach router** - `f4822e6` (feat)

## Files Created/Modified

- `app/admin/prospects/[id]/page.tsx` - Added ResearchRunRow type, replaced 5 as any casts with typed runs[] access
- `components/features/prospects/quality-chip.tsx` - Replaced summary as any gate access with typed Json guard
- `server/routers/outreach.ts` - Replaced summary as any gate access with typed double-guard (zero as any remains)

## Decisions Made

- **ResearchRunRow mirrors listRuns query exactly:** include shape matches `prospect.{id,companyName,domain}`, `campaign.{id,name,nicheKey,strictGate}`, `_count.{evidenceItems,workflowHypotheses,automationOpportunities,workflowLossMaps}`. Fields `qualityApproved`, `qualityReviewedAt`, `summary`, `error`, `inputSnapshot` are direct model fields returned automatically.
- **tRPC v11 inference gaps distinguished from TS2589:** `prospect.data` and `getRun` data kept as `any` with `// TODO: tRPC v11 inference` comments. These are genuine inference limitations, not TS2589.
- **quality-chip fullRun kept as any:** getRun returns deeply nested evidenceItems, workflowHypotheses etc. — applying GetPayload here deferred; the existing fallback IIFE still uses any[] with eslint-disable comments.

## Deviations from Plan

None — plan executed exactly as written. The plan explicitly covered the distinction between TS2589 (fix) and tRPC v11 inference (keep with TODO comment).

## Issues Encountered

- Changing `p = prospect.data as Record<string, unknown> & {slug: string}` caused 6 TypeScript errors in JSX (properties typed as `unknown` not assignable to ReactNode). Reverted to `as any` with `// TODO: tRPC v11 inference` comment per plan directive ("Do NOT fix non-TS2589 casts").
- Changing inner fallback `any[]` to `unknown[]` in quality-chip caused type errors in callbacks. Reverted — this variable is inside an IIFE using the `fullRun as any` value.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ResearchRunRow type established and working — future plans can reference this pattern
- Pattern for Json guard documented in MEMORY.md for next session
- outreach.ts quality gate path is now fully typed
- Plan 31-03 and beyond can follow the same Prisma.XGetPayload approach for other deep inference sites

---

_Phase: 31-tech-debt-foundation_
_Completed: 2026-03-02_
