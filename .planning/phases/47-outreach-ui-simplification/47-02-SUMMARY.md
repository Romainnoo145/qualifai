---
phase: 47-outreach-ui-simplification
plan: 02
subsystem: ui
tags: [react, outreach, reminders, rename]

requires:
  - phase: 47-outreach-ui-simplification
    plan: 01
    provides: 3-tab outreach page without Multi-touch Tasks
provides:
  - ReminderSection component in Drafts Queue
  - getReminders endpoint (renamed from getTouchTaskQueue)
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - app/admin/outreach/page.tsx
    - server/routers/outreach.ts

key-decisions:
  - 'Reminders render above email drafts with indigo-tinted background for visual distinction'
  - 'Compact single-row layout per reminder (not full card like email drafts)'
  - 'Done/Skip actions invalidate both getReminders and getDecisionInbox'

patterns-established: []

requirements-completed: [UICL-03]

duration: 2min
completed: 2026-03-08
---

# Phase 47 Plan 02: Inline Reminders in Drafts Queue Summary

**Added ReminderSection component to Drafts Queue showing non-email reminders (call/LinkedIn/WhatsApp) with Done/Skip actions, and renamed backend endpoint from getTouchTaskQueue to getReminders**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08
- **Completed:** 2026-03-08
- **Tasks:** 1 (+ human verify checkpoint)
- **Files modified:** 2

## Accomplishments

- Created ReminderSection component with compact indigo-tinted cards above email drafts
- Channel pills (call/linkedin/whatsapp) with appropriate icons (Phone, Linkedin, MessageSquare)
- Done (emerald) and Skip (slate) action buttons per reminder
- Renamed getTouchTaskQueue to getReminders in outreach router
- Reminders render nothing when empty (no empty state clutter)

## Task Commits

1. **Task 1: Rename endpoint + add ReminderSection** - `c6da064` (feat)

## Files Created/Modified

- `app/admin/outreach/page.tsx` - Added ReminderSection component (~155 lines), renders above email drafts in DraftQueue
- `server/routers/outreach.ts` - Renamed getTouchTaskQueue to getReminders

## Decisions Made

- Indigo-tinted background (`bg-indigo-50/30 border-indigo-100`) for visual distinction from white email draft cards
- Compact flex-row layout — no email preview section, just contact + channel + actions

## Deviations from Plan

None.

## Issues Encountered

None.

## User Setup Required

None.

## Self-Check: PASSED

All files exist, commit verified.

---

_Phase: 47-outreach-ui-simplification_
_Completed: 2026-03-08_
