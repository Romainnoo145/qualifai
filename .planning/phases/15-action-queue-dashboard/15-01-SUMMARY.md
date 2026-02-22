---
phase: 15-action-queue-dashboard
plan: 01
subsystem: api
tags: [trpc, prisma, admin-router, action-queue, outreach, hypotheses]

# Dependency graph
requires:
  - phase: 14-campaign-reporting
    provides: campaign and prospect data layer patterns
  - phase: 10-cadence-engine
    provides: touch tasks (outreachLog with status touch_open)
  - phase: 7-evidence-approval-gate
    provides: workflowHypothesis model with DRAFT status
provides:
  - getActionQueue tRPC query in admin router aggregating all pending admin decisions
affects:
  - 15-02-PLAN.md (dashboard UI consumes getActionQueue)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - parseDueAt helper: duplicated from outreach.ts pattern (not imported, avoids circular dependency)
    - Promise.all for four parallel Prisma queries avoids waterfall loading
    - urgency field: 'overdue' | 'normal' — overdue derived from dueAt metadata vs now

key-files:
  created: []
  modified:
    - server/routers/admin.ts

key-decisions:
  - "parseDueAt helper duplicated in admin.ts (not imported from outreach.ts) to avoid circular dependency"
  - "getActionQueue fetches all four types in parallel via Promise.all — single tRPC call for dashboard"
  - "Items sorted: overdue first, then createdAt ascending (oldest = most urgent)"
  - "touch_open + channel in ['call','linkedin','whatsapp','email'] identifies task items correctly"

patterns-established:
  - "Action queue pattern: single aggregated query with type discriminant for UI routing"

# Metrics
duration: 1min
completed: 2026-02-22
---

# Phase 15 Plan 01: Action Queue Data Layer Summary

**Single getActionQueue tRPC query aggregates DRAFT hypotheses, draft outreach logs, open touch tasks (with overdue detection), and pending replies into one typed response with counts**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-22T08:42:04Z
- **Completed:** 2026-02-22T08:43:20Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `getActionQueue` adminProcedure query to `server/routers/admin.ts`
- Four parallel Prisma queries via `Promise.all` (no waterfall loading)
- `parseDueAt` helper extracts ISO date from metadata JSON for overdue detection
- Touch tasks with `dueAt` in the past marked `urgency: 'overdue'`
- Items sorted: overdue first, then oldest createdAt first
- Returns `items` array (discriminated union by `type`) and `counts` object

## Task Commits

1. **Task 1: Add getActionQueue tRPC query to admin router** - `25f7e1b` (feat)

## Files Created/Modified

- `server/routers/admin.ts` - Added `parseDueAt` helper and `getActionQueue` adminProcedure query

## Decisions Made

- `parseDueAt` helper duplicated from outreach.ts pattern — importing from there would create circular dependency risk since both files import from the same trpc module
- `getActionQueue` uses `Promise.all` for four queries — avoids waterfall and keeps dashboard load fast
- Items sorted overdue-first, then oldest-first — matches "autopilot with oversight" workflow where overdue tasks need immediate attention

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript passed with no errors on first pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `api.admin.getActionQueue.useQuery()` is callable from any admin page
- Returns typed `items` array with `type: 'hypothesis' | 'draft' | 'task' | 'reply'`
- Returns `counts` object with per-type totals and `overdueTasks` count
- Plan 02 (Dashboard UI) can consume this data source directly

---

_Phase: 15-action-queue-dashboard_
_Completed: 2026-02-22_

## Self-Check: PASSED

- server/routers/admin.ts: FOUND
- .planning/phases/15-action-queue-dashboard/15-01-SUMMARY.md: FOUND
- commit 25f7e1b: FOUND
