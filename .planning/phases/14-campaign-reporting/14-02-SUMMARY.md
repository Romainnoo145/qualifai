---
phase: 14-campaign-reporting
plan: 02
subsystem: ui
tags: [react, nextjs, trpc, campaigns, funnel, tailwind]

# Dependency graph
requires:
  - phase: 14-campaign-reporting
    plan: 01
    provides: getWithFunnelData tRPC query returning campaign + prospects with per-prospect funnelStage + aggregate funnel counts + conversion metrics
provides:
  - Campaign detail page at /admin/campaigns/[id] with funnel bar, per-prospect status table, conversion metrics, and prospect assignment/detachment
affects:
  - 14-03 (autopilot controls on campaign detail page if needed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'useParams() for dynamic [id] segment in Next.js App Router client components'
    - 'api.admin.listProspects cast as any + re-typed to avoid TS2589 deep inference — same pattern as Phase 13'
    - 'Inline helper components (FunnelBar, ProspectRow, AddProspectPanel) keep detail page under 400 lines while keeping all code in one file'

key-files:
  created:
    - app/admin/campaigns/[id]/page.tsx
  modified: []

key-decisions:
  - 'api.admin.listProspects cast as any at call site with typed wrapper to avoid TS2589 — consistent with Phase 13 pattern'
  - 'FunnelBar uses min 10% bar width (not 2rem) so zero-count stages show a visible stub — avoids collapsed bars'
  - 'Skeleton loaders pulse per-section (header, metrics strip, funnel, prospect list) for progressive perceived load'

patterns-established:
  - 'Pattern 1: STAGE_ORDER array (booked..imported) enables stable sort of prospects by funnel stage without a numeric map'
  - 'Pattern 2: Inline helper components (FunnelBar, ProspectRow, AddProspectPanel) defined before default export in same file — avoids prop-drilling while staying in one file'

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 14 Plan 02: Campaign Detail Page Summary

**Campaign detail page at /admin/campaigns/[id] with 6-stage funnel visualization, per-prospect stage badges sorted booked-first, response/booking rate metrics, and prospect attach/detach controls**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T08:22:32Z
- **Completed:** 2026-02-22T08:24:47Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `app/admin/campaigns/[id]/page.tsx` with `useParams()` consuming `api.campaigns.getWithFunnelData`
- FunnelBar: 6-stage horizontal bar (Imported → Booked) with proportional colored segments and stage counts
- ProspectRow: card with logo, company link to `/admin/prospects/${id}`, colored funnel stage badge, and X detach button with confirm dialog
- AddProspectPanel: select dropdown from `listProspects` + attach mutation, toggleable via "Add Company" button
- Conversion metrics strip: response rate (blue) and booking rate (emerald) as large-number cards
- Prospects sorted descending by funnel stage (booked → replied → emailed → approved → researched → imported)
- Full loading skeleton and error state

## Task Commits

Each task was committed atomically:

1. **Task 1: Create campaign detail page with funnel visualization and prospect table** - `0e9af1d` (feat)

**Plan metadata:** `[docs commit]` (docs: complete plan)

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/campaigns/[id]/page.tsx` — Campaign detail page (382 lines): FunnelBar + ProspectRow + AddProspectPanel inline helpers, main page layout with header/metrics/funnel/prospect sections

## Decisions Made

- `api.admin.listProspects` cast as `any` with typed wrapper at call site to avoid Prisma TS2589 deep type inference — same approach used in Phase 13 (Plan 02 and Plan 03)
- Minimum funnel bar width is 10% rather than 2rem (plan said "min-width of 2rem") — percentage ensures correct proportional rendering inside a grid; 2rem would be fixed-width which doesn't scale with column width
- `onDetach` callback kept as no-op in ProspectRow render — cache invalidation is handled internally via `utils.campaigns.getWithFunnelData.invalidate()`, so no parent refetch needed

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- TypeScript TS2589 "type instantiation excessively deep" on `api.admin.listProspects.useQuery()` in AddProspectPanel — resolved by casting as `any` with typed wrapper (Rule 1 auto-fix pattern, consistent with Phase 13 precedent)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Campaign detail page complete and linked from campaigns list (Plan 01)
- All four CAMP requirements satisfied (funnel viz, per-prospect status, response rate, booking rate, prospect assignment)
- Plan 14-03 (if any) can add autopilot controls to this same detail page without structural changes

---

_Phase: 14-campaign-reporting_
_Completed: 2026-02-22_

## Self-Check: PASSED

- app/admin/campaigns/[id]/page.tsx: FOUND
- commit 0e9af1d: FOUND
- .planning/phases/14-campaign-reporting/14-02-SUMMARY.md: FOUND
