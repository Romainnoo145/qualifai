---
phase: 57-signal-diff-detector
plan: 02
subsystem: automation
tags: [signals, idempotency, automation-rules, prisma, concurrency]

# Dependency graph
requires:
  - phase: 57-01
    provides: Signal model with isProcessed field, processSignal function
provides:
  - Atomic claim guard in processSignal using updateMany (prevents duplicate drafts under concurrent cron runs)
  - NEW_JOB_LISTING automation rule with SIGNAL_TRIGGERED emailType
affects: [automation, signal-processing, outreach-drafts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Atomic claim via updateMany with status guard — count=0 means concurrent worker already processed'

key-files:
  created: []
  modified:
    - lib/automation/processor.ts
    - lib/automation/rules.ts

key-decisions:
  - 'Atomic claim at START of processSignal (not end) — signal is marked processed before any draft creation, preventing double-processing even on errors mid-loop'
  - 'Return {draftsCreated: 0} immediately on claimed.count===0 — no rules check, no DB work'
  - 'NEW_JOB_LISTING uses SIGNAL_TRIGGERED emailType matching job listing context'

patterns-established:
  - 'Idempotency: atomic updateMany with status guard before any side-effectful work'

requirements-completed:
  - SGNL-06

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 57 Plan 02: Signal Diff Detector — Atomic Claim + NEW_JOB_LISTING Rule Summary

**Atomic claim guard added to processSignal via updateMany idempotency pattern, plus NEW_JOB_LISTING automation rule added so job-listing signals trigger SIGNAL_TRIGGERED email drafts**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-16T06:01:00Z
- **Completed:** 2026-03-16T06:06:10Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- processSignal now atomically claims signals with `updateMany where isProcessed=false` before any processing
- count===0 early return prevents duplicate draft creation under concurrent cron runs
- Removed the final `signal.update` at end of function (redundant after atomic claim at start)
- Added `new-job-listing` rule to AUTOMATION_RULES: triggers DRAFT_EMAIL with SIGNAL_TRIGGERED emailType for NEW_JOB_LISTING signal type

## Task Commits

1. **Task 1: Atomic claim guard + NEW_JOB_LISTING rule** - `0efd46f` (feat)

## Files Created/Modified

- `lib/automation/processor.ts` - Added updateMany atomic claim at function start, removed final signal.update
- `lib/automation/rules.ts` - Added new-job-listing automation rule after headcount-growth

## Decisions Made

- Atomic claim placed at the TOP of processSignal (before rules/drafts) so any concurrent worker hitting the same signal after the first claim will get count=0 and abort, even if the first worker crashes mid-processing (signal stays marked processed — acceptable trade-off, avoids duplicate drafts)
- NEW_JOB_LISTING uses SIGNAL_TRIGGERED (not INTRO_EMAIL) because job-listing signals reference specific hiring context that generateSignalEmail is designed to use

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in `scripts/tmp-*.ts` files are out of scope (untracked dev scripts with stale imports, not related to the modified files).

## Next Phase Readiness

- Signal processor is now idempotent and safe for concurrent cron execution
- Job-listing signals detected in phase 57-01 will now trigger email draft creation via the new-job-listing rule
- Ready for phase 57-03 (integration test or E2E validation if planned)

---

_Phase: 57-signal-diff-detector_
_Completed: 2026-03-16_
