---
phase: 14-campaign-reporting
plan: 01
subsystem: ui, api
tags: [trpc, prisma, campaigns, funnel, react, nextjs]

# Dependency graph
requires:
  - phase: 13-prospect-story-flow
    provides: Prospect detail page with OutreachSequence, Contact, WizardSession data already loaded
provides:
  - campaigns router getWithFunnelData query returning campaign + prospects with per-prospect funnelStage + aggregate funnel counts + conversion metrics
  - Redesigned campaigns list page with collapsible creation form and clickable campaign cards linking to /admin/campaigns/[id]
affects:
  - 14-02 (campaign detail page consumes getWithFunnelData query)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Separate groupBy queries for counts to avoid Prisma TS2589 deep inference'
    - 'Waterfall funnelStage computation: set lowest stage first, overwrite with higher if condition met'
    - 'Cumulative funnel counts: filter prospects by stagePriority >= threshold'

key-files:
  created: []
  modified:
    - server/routers/campaigns.ts
    - app/admin/campaigns/page.tsx

key-decisions:
  - "nicheKey defaults to 'generic_b2b' when form field left blank (no hardcoded options)"
  - 'getWithFunnelData uses two separate groupBy queries (researchRuns and workflowHypotheses) to avoid TS2589 from deeply nested includes'
  - 'Emailed contact statuses include EMAIL_SENT, OPENED, REPLIED, CONVERTED per plan spec'
  - 'Campaigns page removes autopilot and prospect assignment UI — both belong on campaign detail page (Plan 02)'

patterns-established:
  - 'Pattern 1: stagePriority map with numeric ranks enables clean cumulative funnel aggregation'
  - 'Pattern 2: glass-card-hover cards as Next.js Links — group-hover applied to inner icon container'

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 14 Plan 01: Campaign Reporting — Funnel Data Layer + List Page Summary

**getWithFunnelData tRPC query computing per-prospect funnel stages (booked/replied/emailed/approved/researched/imported) with cumulative counts and conversion metrics; campaigns list page redesigned with collapsible creation form and clickable cards**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T08:19:05Z
- **Completed:** 2026-02-22T08:20:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `getWithFunnelData` query to campaigns router with waterfall funnel stage logic per prospect
- Aggregate funnel object with cumulative counts at each stage (imported through booked)
- Computed `responseRate` and `bookingRate` metrics as percentages
- Campaigns list page rewritten: collapsible creation form, glass-card Links to /admin/campaigns/[id], removed autopilot/assignment UI
- All TypeScript and ESLint checks pass with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getWithFunnelData tRPC query** - `bc77e49` (feat)
2. **Task 2: Redesign campaigns list page** - `ba3ead2` (feat)

**Plan metadata:** `[docs commit]` (docs: complete plan)

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/campaigns.ts` — Added `getWithFunnelData` query (170 lines); all existing procedures unchanged
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/campaigns/page.tsx` — Complete rewrite: collapsible creation form, campaign cards as clickable Links, removed autopilot/assignment sections

## Decisions Made

- `nicheKey` defaults to `'generic_b2b'` when the segment description field is left blank — avoids hardcoded option list while still satisfying the schema minimum length constraint
- Used two separate `groupBy` queries (one for `ResearchRun`, one for `WorkflowHypothesis`) rather than deeply nested includes — sidesteps Prisma TS2589 deep type inference (pattern established in Phase 13)
- `EMAILED_CONTACT_STATUSES` includes `EMAIL_SENT, OPENED, REPLIED, CONVERTED` per plan spec — same as plan's enumeration of emailed contact statuses

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `getWithFunnelData` query ready for consumption by Plan 02 (campaign detail page)
- `/admin/campaigns/[id]` route referenced in card links will be created in Plan 02
- No blockers identified

---

_Phase: 14-campaign-reporting_
_Completed: 2026-02-22_

## Self-Check: PASSED

- server/routers/campaigns.ts: FOUND
- app/admin/campaigns/page.tsx: FOUND
- .planning/phases/14-campaign-reporting/14-01-SUMMARY.md: FOUND
- commit bc77e49 (Task 1): FOUND
- commit ba3ead2 (Task 2): FOUND
