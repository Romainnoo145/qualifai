---
phase: 59-unified-draft-queue-cadence
plan: 02
subsystem: ui
tags: [react, nextjs, trpc, outreach, drafts, queue]

# Dependency graph
requires:
  - phase: 59-unified-draft-queue-cadence/59-01
    provides: kind metadata on OutreachLog (intro_draft/cadence_draft/signal_draft) enabling chip rendering
provides:
  - Date-grouped DraftQueue with Dutch section headers (Vandaag/Morgen/weekday)
  - Prospect company name as Next.js Link to /admin/prospects/[id] in each draft card
  - Kind chips (Intro/Follow-up/Signaal) with color coding per draft type
  - Outreach status panel on prospect detail with pending drafts count + queue link
  - "Geen actieve outreach" empty state on prospect detail
affects:
  - 59-unified-draft-queue-cadence/59-03
  - any phase touching outreach queue UI or prospect detail outreach section

# Tech tracking
tech-stack:
  added: []
  patterns:
    - groupByDate generic helper for date-bucket grouping with Dutch labels
    - KIND_LABELS map for translating draft kind metadata to display labels
    - admin-state-pill with amber-50/amber-700 for pending count callout

key-files:
  created: []
  modified:
    - app/admin/outreach/page.tsx
    - components/features/prospects/outreach-preview-section.tsx

key-decisions:
  - "groupByDate buckets by day (midnight-normalised) not raw timestamp — avoids false splits on same-day drafts"
  - "Link inside button for prospect name uses stopPropagation to prevent expand toggle interference"
  - "pendingDrafts computed from draftsForProspect.data length (already scoped per-prospect) — no new query needed"
  - "Status panel shows all three states: sequence only, drafts only, both, or empty — covers every combination"

patterns-established:
  - "Dutch date headers: Vandaag / Morgen / capitalized weekday+date for older items"
  - "Kind chip colors: purple=signal_draft, blue=cadence_draft, slate=intro_draft/fallback"

requirements-completed: [PIPE-02, PIPE-03, PIPE-04, CDNC-03]

# Metrics
duration: 12min
completed: 2026-03-16
---

# Phase 59 Plan 02: Unified Draft Queue — Date Grouping, Prospect Links, Kind Chips

**Date-grouped outreach queue with Dutch section headers, prospect navigation links, kind chips, and prospect-level outreach status panel with pending draft count**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-16T07:10:00Z
- **Completed:** 2026-03-16T07:22:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- DraftQueue now groups drafts by date with Dutch headers (Vandaag, Morgen, or weekday+date for older)
- Each draft card shows prospect company name as a clickable Next.js Link to /admin/prospects/[id]
- Kind chips distinguish intro/follow-up/signal drafts with per-type color coding
- Prospect detail outreach section shows a richer status panel: sequence status pill, amber draft-count pill linking to queue, and "Geen actieve outreach" empty state

## Task Commits

Each task was committed atomically:

1. **Task 1: Date-grouped DraftQueue with prospect links and kind chips** - `a6df231` (feat)
2. **Task 2: Outreach status panel on prospect detail with pending drafts count** - `9e5bca2` (feat)

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/outreach/page.tsx` - Added groupByDate helper, KIND_LABELS constant, replaced flat draft map with date-grouped rendering, added Link prospect nav, added kind chips
- `/home/klarifai/Documents/klarifai/projects/qualifai/components/features/prospects/outreach-preview-section.tsx` - Added Link import, pendingDrafts computation, replaced sequence status dot with full status panel, upgraded View in Queue to Next.js Link

## Decisions Made

- groupByDate normalises dates to midnight to ensure same-day items land in one bucket regardless of creation time
- Prospect Link inside the expand button uses stopPropagation so clicking the company name does not toggle the email preview
- pendingDrafts derived from the existing draftsForProspect query (no extra tRPC call) — cost-free addition
- Status panel covers all four states: (seq + drafts), (seq only), (drafts only), (neither) — avoids incomplete UI

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Queue UI now reads like a scheduled inbox with date context and draft type labels
- Prospect detail gives at-a-glance outreach status without navigating away
- Ready for 59-03: cadence sequence management or further queue enhancements

---

_Phase: 59-unified-draft-queue-cadence_
_Completed: 2026-03-16_
