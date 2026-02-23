---
phase: 20-one-click-send-queue-pipeline-view
plan: "02"
subsystem: admin-ui
tags: [pipeline, ui-component, prospects, status]
dependency_graph:
  requires: []
  provides: [lib/pipeline-stage.ts, components/features/prospects/pipeline-chip.tsx]
  affects: [app/admin/prospects/page.tsx, app/admin/prospects/[id]/page.tsx, server/routers/admin.ts]
tech_stack:
  added: []
  patterns: [pure-function-stage-derivation, chip-component-color-map]
key_files:
  created:
    - lib/pipeline-stage.ts
    - components/features/prospects/pipeline-chip.tsx
  modified:
    - server/routers/admin.ts
    - app/admin/prospects/page.tsx
    - app/admin/prospects/[id]/page.tsx
decisions:
  - listProspects sessions include filtered by callBooked:true (take:1) — minimal data for booked detection, avoids loading full session history in list query
  - statusColors const map removed entirely — no longer needed once PipelineChip handles display
  - detail page uses p.sessions?.some(s => s.callBooked) for hasBookedSession — getProspect returns all sessions unfiltered so must check each for callBooked flag
metrics:
  duration: "~2 min"
  completed: "2026-02-23"
  tasks_completed: 2
  files_created: 2
  files_modified: 3
---

# Phase 20 Plan 02: Pipeline Stage Chip Summary

**One-liner:** Human-readable pipeline stage chips (Imported/Researching/Reviewed/Ready/Sending/Engaged/Booked) replacing raw ProspectStatus enum labels on list and detail views, derived from a pure `computePipelineStage` function.

## What Was Built

### computePipelineStage (lib/pipeline-stage.ts)

Pure function that maps prospect state to one of 7 human-readable pipeline stages. Takes a `ProspectForStage` interface (status, researchRun, hasSession, hasBookedSession) and returns a `PipelineStage` string literal. Priority order: Booked → Engaged → Sending → Ready → Reviewed → Researching → Imported.

### PipelineChip (components/features/prospects/pipeline-chip.tsx)

React component rendering a colored pill chip. Uses a `STAGE_COLORS` record to map each `PipelineStage` to Tailwind color classes (slate/blue/indigo/emerald/amber/purple/yellow). Matches the existing chip visual pattern (9px font, font-black, px-3 py-1, rounded-full, uppercase, tracking-widest, border).

### listProspects extension (server/routers/admin.ts)

Added `sessions: { where: { callBooked: true }, take: 1, select: { id: true } }` to the `include` block. This provides the `hasBookedSession` signal needed by `computePipelineStage` without loading full session data.

### Companies list (app/admin/prospects/page.tsx)

- Removed `statusColors` Record const
- Replaced raw status `<span>` with `<PipelineChip stage={computePipelineStage({...})} />`
- Added imports for `PipelineChip` and `computePipelineStage`

### Prospect detail header (app/admin/prospects/[id]/page.tsx)

- Replaced `<StatusBadge status={p.status} />` with `<PipelineChip>` using `computePipelineStage`
- Removed `StatusBadge` import
- Added imports for `PipelineChip` and `computePipelineStage`

## Verification Results

1. `npx tsc --noEmit` — PASS (zero errors)
2. `lib/pipeline-stage.ts` exists, exports `PipelineStage` type and `computePipelineStage` function
3. `components/features/prospects/pipeline-chip.tsx` exists, exports `PipelineChip`
4. No `statusColors` references remain in `app/admin/prospects/page.tsx`
5. `PipelineChip` imported and used in both `app/admin/prospects/page.tsx` and `app/admin/prospects/[id]/page.tsx`
6. No `StatusBadge` references remain in `app/admin/prospects/[id]/page.tsx`

## Commits

| Task | Name                                                             | Commit  |
| ---- | ---------------------------------------------------------------- | ------- |
| 1    | Create computePipelineStage, PipelineChip, extend listProspects  | 50bc938 |
| 2    | Wire PipelineChip into Companies list and prospect detail header | 59f5c3a |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:

- FOUND: /home/klarifai/Documents/klarifai/projects/qualifai/lib/pipeline-stage.ts
- FOUND: /home/klarifai/Documents/klarifai/projects/qualifai/components/features/prospects/pipeline-chip.tsx

Commits verified:

- 50bc938 — feat(20-02): add computePipelineStage, PipelineChip, and booked-session include
- 59f5c3a — feat(20-02): wire PipelineChip into Companies list and prospect detail header
