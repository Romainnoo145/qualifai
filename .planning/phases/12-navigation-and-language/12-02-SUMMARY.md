---
phase: 12-navigation-and-language
plan: 02
subsystem: ui
tags: [terminology, language, jargon, admin, prospects, campaigns, settings]

# Dependency graph
requires:
  - phase: 12-01
    provides: Sidebar restructured to 6 flat nav items
provides:
  - All user-visible jargon removed from admin UI (TERM-01 pass)
  - Plain-language labels in prospect detail, command center, campaigns, briefs, settings, contacts, login
affects: [13-dashboard-redesign, 14-outreach-pipeline, 15-campaign-reporting]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - components/features/prospects/command-center.tsx
    - app/admin/prospects/[id]/page.tsx
    - app/admin/campaigns/page.tsx
    - app/admin/briefs/page.tsx
    - app/admin/settings/page.tsx
    - app/admin/contacts/[id]/page.tsx
    - app/admin/layout.tsx

key-decisions:
  - 'Only user-visible string literals changed — variable/prop names (latestLossMap, generateLossMap, etc.) left intact'
  - "Briefs page title changed from 'Workflow Loss Maps' to 'Workflow Reports' — consistent with tab rename"

patterns-established:
  - 'TERM-01 pattern: change visible strings only, never internal identifiers'

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 12 Plan 02: Terminology Cleanup (TERM-01) Summary

**All spy/military jargon removed from admin UI — 29 user-facing labels replaced with plain language across 7 files, TypeScript clean**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T17:51:04Z
- **Completed:** 2026-02-21T17:55:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Removed "Loss Map", "Call Prep", "Sprint Intelligence", "Personnel Nodes", "Precision Intelligence Engine" and 24 other jargon terms from user-facing strings
- Prospect detail tabs now read "Workflow Report" and "Call Brief" instead of "Loss Map" and "Call Prep"
- Settings page completely plain: "Usage Overview", "Credits Used", "Companies", "Contacts", "Signals", "Data Export", "System Info"
- Login subtitle changed from "Precision Intelligence Engine" to "Sales Intelligence"
- All internal variable/prop names preserved (latestLossMap, generateLossMap, CallPrepTab, etc.)

## Task Commits

1. **Task 1: Replace jargon in prospect detail and command center** - `dbb80a6` (feat)
2. **Task 2: Replace jargon in campaigns, briefs, contacts, settings, login** - `98f10e9` (feat)

## Files Created/Modified

- `components/features/prospects/command-center.tsx` - Status text and button labels for report generation
- `app/admin/prospects/[id]/page.tsx` - Tab labels (Loss Map → Workflow Report, Call Prep → Call Brief), generate button, helper text
- `app/admin/campaigns/page.tsx` - Section heading, select placeholder, stat count label, processing section heading
- `app/admin/briefs/page.tsx` - Page heading, badge, empty state text, loading text, export button, lineage label
- `app/admin/settings/page.tsx` - All 4 section headings, all 4 stat labels, both export buttons, helper text, all 5 system info labels/values
- `app/admin/contacts/[id]/page.tsx` - Button state text when no report exists
- `app/admin/layout.tsx` - Login page subtitle

## Decisions Made

- Variable/prop names left unchanged throughout (latestLossMap, generateLossMap, runLossMapGeneration, CallPrepTab, LossMapTab, etc.) — internal identifiers are not user-facing, renaming them would risk regressions with no UX benefit
- "Workflow Reports" used consistently for the briefs page heading to match the tab rename in prospect detail

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TERM-01 pass complete — all four banned terms ("Loss Map", "Call Prep", "Nodes" as label, "Sprint Intelligence") removed from user-visible text
- Ready for Phase 13 dashboard redesign with clean language baseline established
- TERM-02 (planned for Phase 13) can proceed without conflicts

---

_Phase: 12-navigation-and-language_
_Completed: 2026-02-21_
