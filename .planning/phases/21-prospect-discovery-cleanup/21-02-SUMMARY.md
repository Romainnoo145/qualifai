---
phase: 21-prospect-discovery-cleanup
plan: 02
subsystem: ui
tags: [nextjs, app-router, cleanup]

# Dependency graph
requires: []
provides:
  - HTTP 404 for /admin/hypotheses (dead admin page removed)
  - HTTP 404 for /admin/research (dead admin page removed)
  - HTTP 404 for /admin/briefs (dead admin page removed)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Dead route removal: server component stub with notFound() preserves git history and signals intent without deleting directories'

key-files:
  created: []
  modified:
    - app/admin/hypotheses/page.tsx
    - app/admin/research/page.tsx
    - app/admin/briefs/page.tsx

key-decisions:
  - 'notFound() stubs preserve directories (git history intact) rather than deleting files — explicit about intent'
  - "Removed 'use client' from all three stubs — notFound() must run in a server component to produce HTTP 404"

patterns-established:
  - "Dead route stub pattern: import { notFound } from 'next/navigation'; export default function RemovedPage() { notFound(); }"

# Metrics
duration: 1min
completed: 2026-02-23
---

# Phase 21 Plan 02: Dead Admin Pages Cleanup Summary

**Three stale admin pages (/admin/hypotheses, /admin/research, /admin/briefs) replaced with server-component notFound() stubs that return HTTP 404 on direct access.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-23T02:25:15Z
- **Completed:** 2026-02-23T02:25:49Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- /admin/hypotheses returns 404 — hypothesis review workflow now lives in prospect detail analysis section
- /admin/research returns 404 — research run management now handled through prospect detail flow
- /admin/briefs returns 404 — workflow reports now accessed through prospect detail outreach section
- TypeScript type-check passes clean with no errors introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace dead admin pages with notFound() stubs** - `c7fe77b` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `app/admin/hypotheses/page.tsx` - Server component stub returning 404; replaced 236 lines of stale hypothesis review UI
- `app/admin/research/page.tsx` - Server component stub returning 404; replaced 323 lines of stale research run management UI
- `app/admin/briefs/page.tsx` - Server component stub returning 404; replaced 153 lines of stale workflow reports UI

## Decisions Made

- **notFound() stubs over file deletion:** Directories kept with stub files rather than deleting them entirely. This preserves git history of what was there and makes the "removed intentionally" intent explicit to future readers.
- **Server component (no 'use client'):** All three pages previously had `'use client'` directive. `notFound()` from `next/navigation` must execute in a server component to produce an actual HTTP 404 response — calling it from a client component does not propagate the 404 status code to the browser.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 21 Plan 02 complete. Dead admin pages are no longer accessible.
- tRPC routers (hypotheses, research, assets) remain intact — prospect detail sections still consume them.
- Phase 21 continues with Plan 03 (if planned) or phase is complete.

---

_Phase: 21-prospect-discovery-cleanup_
_Completed: 2026-02-23_

## Self-Check: PASSED

- app/admin/hypotheses/page.tsx: FOUND, contains notFound()
- app/admin/research/page.tsx: FOUND, contains notFound()
- app/admin/briefs/page.tsx: FOUND, contains notFound()
- 21-02-SUMMARY.md: FOUND
- Commit c7fe77b: FOUND
- npx tsc --noEmit: PASSED (no errors)
