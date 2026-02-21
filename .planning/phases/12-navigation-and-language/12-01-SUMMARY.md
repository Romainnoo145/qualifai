---
phase: 12-navigation-and-language
plan: 01
subsystem: ui
tags: [react, next.js, sidebar, navigation, lucide-react]

# Dependency graph
requires: []
provides:
  - Flat 6-item admin sidebar (Dashboard, Companies, Campaigns, Draft Queue, Use Cases, Signals)
  - Removed 4 nav items (Hypotheses, Research runs, Product Briefs, Contacts) from sidebar only
affects:
  - 12-02 (terminology cleanup — same layout.tsx)
  - 13 (dashboard restructure — relies on new nav shape)

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - app/admin/layout.tsx

key-decisions:
  - 'Nav is a flat NavItem[] array — no group wrappers, no section labels'
  - 'Removed pages stay accessible via direct URL — only removed from sidebar'
  - "Signals label stays as 'Signals' (not 'Signals feed') for consistency"

patterns-established:
  - 'navItems: NavItem[] flat array pattern — iterate directly without group wrappers'

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 12 Plan 01: Navigation Restructure Summary

**Admin sidebar reduced from 10 items in 3 labeled groups to 6 flat items with no section headers**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-21T16:47:41Z
- **Completed:** 2026-02-21T16:49:56Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced grouped navItems (`{ group, items }[]`) with flat `NavItem[]` array
- Desktop and mobile sidebars now render 6 items directly with no group labels
- Removed unused Lucide imports: `Users`, `Beaker`, `FileText`, `Lightbulb`
- TypeScript compiles cleanly; ESLint/Prettier pass via pre-commit hook

## Task Commits

1. **Task 1: Restructure sidebar to 6 flat items** - `20390ad` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/admin/layout.tsx` - navItems changed from grouped array to flat NavItem[]; both desktop and mobile nav rendering updated; 4 unused icon imports removed

## Decisions Made

- Nav label for Signals stays as "Signals" (the plan spec said "Signals" without "feed" suffix)
- Pages removed from nav (Hypotheses, Research runs, Product Briefs, Contacts) are still accessible by direct URL — no routes deleted

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Sidebar is clean and ready for Phase 12 Plan 02 (terminology cleanup in the same layout.tsx and other pages)
- No blockers identified

---

_Phase: 12-navigation-and-language_
_Completed: 2026-02-21_
