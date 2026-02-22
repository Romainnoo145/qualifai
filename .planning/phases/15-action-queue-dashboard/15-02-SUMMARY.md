---
phase: 15-action-queue-dashboard
plan: 02
subsystem: ui
tags: [dashboard, action-queue, trpc, lucide, next-link]

# Dependency graph
requires:
  - phase: 15-01
    provides: getActionQueue tRPC query
provides:
  - app/admin/page.tsx as action queue dashboard hub
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CountCard component: compact card linking to anchor section with opacity-50 when empty
    - ActionRow component: glass-card row with overdue red left-border and OVERDUE badge
    - ActionSection component: renders only when items.length > 0, uses anchor id for scroll
    - timeAgo helper: inline function returning Xm/Xh/Xd ago strings
    - ChannelIcon component: maps channel string to matching lucide icon

key-files:
  created: []
  modified:
    - app/admin/page.tsx

key-decisions:
  - 'Single getActionQueue.useQuery() call — no getDashboardStats, no vanity KPIs'
  - 'Hypothesis rows deep-link to /admin/prospects/[id]#analysis for direct action context'
  - 'Draft/task/reply rows link to /admin/outreach (no deep-link tab support yet)'
  - 'CountCard uses anchor href (#hypotheses etc.) for same-page scroll navigation'
  - 'Page stays action-queue-only — no pipeline charts, no recent sessions'

patterns-established:
  - 'Inline helper components (CountCard, ActionRow, ActionSection) before default export for sub-300-line target'
  - 'Empty sections hidden via ActionSection early return (items.length === 0)'

# Metrics
duration: ~1min
completed: 2026-02-22
---

# Phase 15 Plan 02: Action Queue Dashboard UI Summary

**Rewrote app/admin/page.tsx as a queue-first hub: count strip with four action types, grouped sections with direct-action links, overdue urgency indicators, and empty state — replacing vanity KPI dashboard**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-22T08:45:18Z
- **Completed:** 2026-02-22T08:46:51Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced "Command Center" KPI dashboard with action queue hub at `/admin`
- `api.admin.getActionQueue.useQuery()` is the sole data source — no `getDashboardStats` calls
- Header: "Dashboard" h1 + Dutch locale date + amber attention badge when `counts.total > 0`
- Count strip: 4 `CountCard` components (Review, Approve, Tasks, Replies) with opacity-50 when empty
- Tasks card shows red pulse dot + `{overdueTasks} overdue` sub-badge when overdue items exist
- Four action sections (hypotheses, drafts, tasks, replies) with anchor `id` attributes
- Each section rendered only when items exist (`ActionSection` returns `null` if empty)
- Hypothesis rows → `/admin/prospects/[id]#analysis` deep link
- Draft/task/reply rows → `/admin/outreach`
- Overdue task rows: red left border (`border-l-4 border-red-500`) + OVERDUE badge
- Empty state: `CheckCircle2` icon + "All caught up!" when `counts.total === 0`
- Loading skeleton: 4 count card skeletons + 6 row skeletons (animate-pulse)
- `timeAgo()` helper for relative timestamps (Xm/Xh/Xd ago)
- `ChannelIcon` component maps call/linkedin/whatsapp/email to lucide icons

## Task Commits

1. **Task 1: Replace dashboard with action queue hub** — `3756feb` (feat)

## Files Created/Modified

- `app/admin/page.tsx` — Fully rewritten as action queue hub (312 lines after prettier)

## Decisions Made

- Used `api.admin.getActionQueue.useQuery()` only — `getDashboardStats` not called (vanity metrics removed)
- Hypothesis items deep-link to `#analysis` anchor since that's where admins accept/reject hypotheses
- Draft/task/reply items link to `/admin/outreach` — no tab deep-link support yet (noted in plan)
- Count strip cards use anchor hrefs (`#hypotheses`, `#drafts`, `#tasks`, `#replies`) for same-page scroll
- Page slightly exceeds 300-line target (312 lines) due to prettier vertical whitespace expansion — logic density is correct

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript and ESLint passed on first pass. Pre-commit hooks (eslint --fix + prettier) ran without errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard at `/admin` is now the action queue hub
- Phase 16 (Draft Queue Redesign) can proceed — it targets `/admin/outreach` not this page

---

_Phase: 15-action-queue-dashboard_
_Completed: 2026-02-22_

## Self-Check: PASSED

- app/admin/page.tsx: FOUND
- .planning/phases/15-action-queue-dashboard/15-02-SUMMARY.md: FOUND
- commit 3756feb: FOUND
