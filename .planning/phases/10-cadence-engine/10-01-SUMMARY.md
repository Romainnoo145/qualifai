---
phase: 10-cadence-engine
plan: 01
subsystem: database
tags: [prisma, postgresql, schema, migration, cadence]

# Dependency graph
requires:
  - phase: 09-engagement-triggers
    provides: OutreachStep model used as base for cadence columns
provides:
  - OutreachStep.scheduledAt column (when step was scheduled by cadence engine)
  - OutreachStep.triggeredBy column (manual | cadence | TriggerSource values)
  - OutreachStep.nextStepReadyAt column (cron-queryable timestamp for step promotion)
  - DB index on OutreachStep.nextStepReadyAt for efficient cron sweep queries
affects: [10-02, 10-03, 10-04, cadence-engine-cron, sequence-automation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Cadence timestamps stored as real DB columns (not JSON metadata) — enables efficient WHERE nextStepReadyAt <= NOW() cron queries'
    - 'Purely additive migration — all nullable columns, no backfill, zero downtime'

key-files:
  created:
    - prisma/migrations/20260220201059_cadence_engine_columns/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - 'Cadence timestamps in DB columns (OutreachStep.scheduledAt, nextStepReadyAt), not JSON metadata — locked decision from Phase 9 planning'
  - 'nextStepReadyAt indexed via @@index([nextStepReadyAt]) — enables efficient cron sweep without full table scan'
  - 'triggeredBy stored as String? not enum — accommodates TriggerSource values (wizard_step3, pdf_download, interested_reply) plus future values without migrations'

patterns-established:
  - 'Cadence columns pattern: scheduledAt/triggeredBy/nextStepReadyAt as the standard three-column set for cadence-managed steps'

# Metrics
duration: 1min
completed: 2026-02-20
---

# Phase 10 Plan 01: Cadence Engine Columns Summary

**Three nullable cadence columns added to OutreachStep with a DB index on nextStepReadyAt enabling efficient cron sweep queries for the cadence engine**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T20:10:35Z
- **Completed:** 2026-02-20T20:11:45Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added `scheduledAt DateTime?` to OutreachStep — records when the cadence engine scheduled each step
- Added `triggeredBy String?` to OutreachStep — tracks origin source (manual, cadence, or TriggerSource enum values)
- Added `nextStepReadyAt DateTime?` to OutreachStep with `@@index` — the cron target column that powers `WHERE nextStepReadyAt <= NOW()` sweep queries
- Applied migration `20260220201059_cadence_engine_columns` to live database
- Prisma Client regenerated via `migrate dev`; TypeScript type-check passes clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cadence columns to OutreachStep and run migration** - `b4aad89` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `prisma/schema.prisma` - Added scheduledAt, triggeredBy, nextStepReadyAt columns + @@index([nextStepReadyAt]) to OutreachStep
- `prisma/migrations/20260220201059_cadence_engine_columns/migration.sql` - ALTER TABLE adding 3 columns + CREATE INDEX

## Decisions Made

- `triggeredBy` stored as `String?` not a new Prisma enum — allows the existing `TriggerSource` TypeScript type (wizard_step3, pdf_download, interested_reply) to be used without requiring a parallel Prisma enum, and accommodates future sources without new migrations
- All three columns are nullable with no defaults — purely additive, no backfill, safe zero-downtime deployment

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- OutreachStep now has full cadence column support for Plans 10-02 through 10-04
- The cron query pattern (`WHERE nextStepReadyAt <= NOW() AND nextStepReadyAt IS NOT NULL`) is ready to use — index exists
- Prisma Client is regenerated; all downstream TypeScript can reference `scheduledAt`, `triggeredBy`, `nextStepReadyAt` immediately

---

_Phase: 10-cadence-engine_
_Completed: 2026-02-20_

## Self-Check: PASSED

- `prisma/schema.prisma` — FOUND (contains scheduledAt, triggeredBy, nextStepReadyAt, @@index([nextStepReadyAt]))
- `prisma/migrations/20260220201059_cadence_engine_columns/migration.sql` — FOUND
- Commit `b4aad89` — FOUND
