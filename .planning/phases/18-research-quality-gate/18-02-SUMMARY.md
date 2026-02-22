---
phase: 18-research-quality-gate
plan: '02'
subsystem: ui
tags: [react, trpc, quality-gate, traffic-light, admin-ui, prospect-list]
dependency_graph:
  requires: [18-01]
  provides:
    [
      QualityChip-component,
      traffic-light-admin-list,
      traffic-light-admin-detail,
      quality-approve-ui,
    ]
  affects:
    [
      app/admin/prospects/page.tsx,
      app/admin/prospects/[id]/page.tsx,
      components/features/prospects/quality-chip.tsx,
    ]
tech_stack:
  added: []
  patterns:
    [lazy-query-on-open, any-cast-TS2589, click-outside-useEffect, accordion-panel]
key_files:
  created:
    - components/features/prospects/quality-chip.tsx
  modified:
    - app/admin/prospects/page.tsx
    - app/admin/prospects/[id]/page.tsx
decisions:
  - QualityChip extracts evidenceItems into local any[] before mapping to avoid TS2589 — consistent with established project pattern
  - fullRun data cast as any via runQuery.data — TS2589 deep Prisma inference avoided same as Phase 13/14
  - Traffic light on list view computed with worst-case source diversity (1 type) — list is indicative, detail is definitive
  - Dutch UI labels throughout QualityChip — consistent with project language convention
metrics:
  duration: '~4 min'
  completed: '2026-02-22'
  tasks: 2
  files: 3
---

# Phase 18 Plan 02: Research Quality Gate — Admin UI Summary

**QualityChip component with traffic-light chip (THIN/LIMITED/SOLID) and inline quality breakdown accordion wired into both the admin prospect list and prospect detail header.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-22T16:28:19Z
- **Completed:** 2026-02-22T16:32:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `QualityChip` component: traffic-light chip with lazy-loaded breakdown panel, approve/amber-override/re-run actions, click-outside dismiss
- Prospect list page: quality chip rendered per row after status chip using `researchRuns[0]` data from the extended `listProspects` query (Phase 18-01)
- Prospect detail header: quality chip placed in back-row next to `StatusBadge` using existing `listRuns` query data
- Full breakdown shows evidence count, source types, average confidence, hypothesis count, and gate failure reasons in Dutch
- Approve and "approve anyway (amber override)" actions call `approveQuality` mutation with appropriate notes
- Re-run action available after quality approval via `retryRun` mutation
- All cache invalidations: `listProspects`, `listRuns`, `getRun` on mutation success

## Task Commits

Each task was committed atomically:

1. **Task 1: Create QualityChip component** - `fa51ccb` (feat)
2. **Task 2: Wire QualityChip into prospect list and detail header** - `821c570` (feat)

## Files Created/Modified

- `components/features/prospects/quality-chip.tsx` — New QualityChip component (traffic-light chip + inline breakdown accordion + approve/re-run actions)
- `app/admin/prospects/page.tsx` — Added QualityChip import + chip after status chip in each prospect row
- `app/admin/prospects/[id]/page.tsx` — Added QualityChip import + chip in back-row alongside StatusBadge

## Decisions Made

- `fullRun` from `getRun.useQuery` cast as `any` via `runQuery.data as any` — avoids TS2589 deep Prisma type inference, consistent with Phase 13/14 pattern
- Traffic light on list view uses worst-case `computeTrafficLight(evidenceCount, 1, 0.65)` — source diversity not available from list query; list chip is indicative, detail breakdown is definitive
- Dutch UI labels throughout QualityChip (Bewijsstukken, Brontypen, Hypothesen, etc.) — project language convention for user-facing content
- Breakdown panel positioned absolute below chip, glass-card style, z-20, closes on click-outside via `useEffect` + document mousedown listener

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Minor: `fullRun._count` not accessible due to TS2589 Prisma deep inference — resolved by casting `runQuery.data as any` and hoisting `evidenceItems` into a typed local variable before use. Standard project pattern, no unplanned work.

## Next Phase Readiness

- Phase 18 UI complete: admins can see quality traffic lights across the entire prospect list and drill into breakdowns with approve/override actions
- Phase 18-01 + 18-02 together complete the Research Quality Gate phase
- Phase 19 (Client Hypothesis Validation on /voor/) can proceed — quality gate state is now visible and actionable

## Self-Check: PASSED

- [x] `components/features/prospects/quality-chip.tsx` — exists, 347 lines (min 80 required)
- [x] `app/admin/prospects/page.tsx` — QualityChip imported and used (2 occurrences)
- [x] `app/admin/prospects/[id]/page.tsx` — QualityChip imported and used (2 occurrences)
- [x] `computeTrafficLight` referenced 3 times in quality-chip.tsx
- [x] `approveQuality` and `getRun` referenced 7 times in quality-chip.tsx
- [x] Commits `fa51ccb` and `821c570` exist in git log
- [x] TypeScript: npx tsc --noEmit passes with zero errors
- [x] ESLint: no errors on quality-chip.tsx or modified pages

---

_Phase: 18-research-quality-gate_
_Completed: 2026-02-22_
