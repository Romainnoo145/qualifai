---
phase: 57-signal-diff-detector
plan: 01
subsystem: signals
tags: [prisma, vitest, evidence-diff, signal-detection]

requires: []
provides:
  - detectSignalsFromDiff function comparing EvidenceItem arrays across research runs
  - NEW_JOB_LISTING signal detection from novel CAREERS/JOB_BOARD evidence titles
  - HEADCOUNT_GROWTH signal detection from REGISTRY metadata werkzamePersonen delta
  - Aggregation guard (one signal per type per run-pair)
  - Lookback dedup (skip re-firing within LOOKBACK_DAYS window)
  - 11 unit tests covering all detection paths
affects:
  - 58-signal-wiring
  - 59-signal-queue

tech-stack:
  added: []
  patterns:
    - Inject PrismaClient as parameter for testability (no singleton import)
    - Mock DB with vi.fn() objects matching Prisma method shape
    - Prisma.InputJsonValue cast for dynamic metadata objects

key-files:
  created:
    - lib/signals/detect.ts
    - lib/signals/detect.test.ts
  modified: []

key-decisions:
  - 'detectSignalsFromDiff receives db as parameter (not singleton) — enables unit testing without DB'
  - 'One candidate per SignalType enforced before dedup loop — aggregation guard built into detection'
  - 'HEADCOUNT_GROWTH fires on delta>=5 OR percent>=10% — OR logic handles both large and small companies'
  - 'LOOKBACK_DAYS per type: NEW_JOB_LISTING=30, HEADCOUNT_GROWTH=60 — job listings refresh faster than headcount'

patterns-established:
  - 'Signal creation: db.signal.create with isProcessed: false, prospectId, signalType, title, description, metadata'
  - 'Dedup: signal.findFirst with detectedAt gte lookback window before create'

requirements-completed:
  - SGNL-01
  - SGNL-02
  - SGNL-03

duration: 3min
completed: 2026-03-16
---

# Phase 57 Plan 01: Signal Diff Detector Summary

**Evidence-diff signal detector writing NEW_JOB_LISTING and HEADCOUNT_GROWTH Signal records by comparing EvidenceItem arrays across consecutive research runs, with aggregation guard and 30/60-day lookback dedup.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T06:05:21Z
- **Completed:** 2026-03-16T06:08:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `detectSignalsFromDiff()` — the missing upstream that unblocks Phase 58 wiring and Phase 59 queue
- NEW_JOB_LISTING: compares normalized job titles across CAREERS/JOB_BOARD evidence, aggregates all novel titles into one Signal per run-pair
- HEADCOUNT_GROWTH: reads `werkzamePersonen` from REGISTRY metadata (fallback: snippet regex), fires on absolute delta>=5 OR percent>=10%
- Lookback dedup: queries `signal.findFirst` before creation to prevent re-firing within configurable window
- 11 unit tests pass covering happy paths, threshold edges, dedup skip, title normalization, empty evidence

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/signals/detect.ts** - `bc5dfa7` (feat)
2. **Task 2: Create lib/signals/detect.test.ts** - `e83e7ef` (test)

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/signals/detect.ts` - Main diff detection module with detectSignalsFromDiff, constants, and helpers
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/signals/detect.test.ts` - 11 unit tests with mock PrismaClient

## Decisions Made

- detectSignalsFromDiff receives `db: PrismaClient` as parameter — no singleton import, making unit tests trivial with vi.fn() mocks
- Aggregation guard built into detection: one candidate per SignalType created before the dedup loop, so `signal.create` is called at most once per type per invocation
- HEADCOUNT_GROWTH threshold is OR logic: delta>=5 absolute OR delta/prev>=10% percent — handles both large companies (absolute) and small companies (percentage)
- LOOKBACK_DAYS map uses 30 days for NEW_JOB_LISTING (job postings change frequently) and 60 days for HEADCOUNT_GROWTH (headcount changes slower)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type errors in Prisma Json field assignment**

- **Found during:** Task 1 (type-check verification)
- **Issue:** `Record<string, unknown>` not assignable to `Prisma.NullableJsonNullValueInput | InputJsonValue` — Prisma has specific Json type constraints
- **Fix:** Changed `SignalCandidate.metadata` to `Prisma.InputJsonValue`, cast metadata literals with `as Prisma.InputJsonValue`
- **Files modified:** lib/signals/detect.ts
- **Verification:** `npx tsc --noEmit --skipLibCheck` passes with zero errors in lib/signals/
- **Committed in:** bc5dfa7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 type error)
**Impact on plan:** Required for correct TypeScript compilation. No scope creep.

## Issues Encountered

Pre-existing TypeScript errors exist in `scripts/tmp-*.ts` files (temporary debug scripts) — out of scope, not fixed.

## Next Phase Readiness

- Phase 58 (signal wiring): `detectSignalsFromDiff` is ready to be called after each research run completes
- Phase 59 (signal queue): Signal records will be written with `isProcessed: false`, ready for queue processing
- No new npm dependencies added

---

_Phase: 57-signal-diff-detector_
_Completed: 2026-03-16_
