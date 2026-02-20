---
phase: 10-cadence-engine
plan: 02
subsystem: api
tags: [vitest, tdd, cadence, outreach, typescript, prisma]

# Dependency graph
requires:
  - phase: 10-cadence-engine/10-01
    provides: OutreachStep.scheduledAt, triggeredBy, nextStepReadyAt columns and DB index

provides:
  - lib/cadence/engine.ts with buildCadenceState (pure), evaluateCadence (DB), processDueCadenceSteps (cron sweep)
  - DEFAULT_CADENCE_CONFIG constant with configurable thresholds
  - CadenceConfig, CadenceState, ContactChannels, EngagementSignals TypeScript types
  - 14 unit tests covering all cadence engine behaviors

affects: [10-03, 10-04, cadence-cron, outreach-sequences]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pure core + DB wrapper pattern: buildCadenceState is pure (testable without mocks), evaluateCadence wraps it with DB I/O'
    - 'Cron sweep pattern: processDueCadenceSteps queries nextStepReadyAt <= NOW() with take:50 batch limit'
    - 'Channel availability filtering: contact channels filtered before rotation, no channels falls back to email'

key-files:
  created:
    - lib/cadence/engine.ts
    - lib/cadence/engine.test.ts
  modified: []

key-decisions:
  - 'buildCadenceState is a pure function (no DB) — enables deterministic unit testing without mocks'
  - 'Email opens (openedAt) explicitly excluded from EngagementSignals interface — enforced at type level, not just convention'
  - 'nextChannel = availableChannels[touchCount % availableChannels.length] — simple round-robin, position-agnostic rotation'
  - 'nextScheduledAt = null when lastTouchAt is null (no prior touches) — cron sweep does not create tasks for sequences with no history'
  - 'evaluateCadence uses steps with status IN (SENT, QUEUED) as completedCount — DRAFTED steps are pending, not completed'

patterns-established:
  - 'TDD execution: test file committed first (RED), implementation committed second (GREEN), refactor skipped when code is already clean'
  - 'Cron sweep batch limit: take:50 + orderBy nextStepReadyAt asc — deterministic ordering prevents starvation'

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 10 Plan 02: Cadence Engine Summary

**Three-function cadence engine with pure buildCadenceState, DB evaluateCadence, and cron processDueCadenceSteps — 14 unit tests, email opens excluded at type level**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T20:14:08Z
- **Completed:** 2026-02-20T20:16:33Z
- **Tasks:** 1 (TDD: 2 commits — RED + GREEN)
- **Files modified:** 2

## Accomplishments

- `buildCadenceState` pure function: computes next channel, delay, and exhaustion state from completed touches and engagement signals — no DB calls, fully testable
- `evaluateCadence` DB function: loads sequence data, calls buildCadenceState, creates OutreachStep (DRAFTED) or marks sequence CLOSED_LOST when maxTouches reached
- `processDueCadenceSteps` cron sweep: queries `nextStepReadyAt <= now AND status=DRAFTED`, creates OutreachLog touch tasks (FOLLOW_UP/touch_open), promotes steps to QUEUED — batch limit of 50
- Email opens explicitly absent from `EngagementSignals` interface — enforced at compile time, not just by convention
- All 14 tests pass; TypeScript clean with Prisma client regenerated

## Task Commits

TDD task with two commits (RED then GREEN):

1. **RED: Failing tests for cadence engine** - `5d70d8a` (test)
2. **GREEN: Cadence engine implementation** - `7ba1746` (feat)

**Plan metadata:** _(docs commit follows)_

_Note: TDD tasks have RED + GREEN commits. No REFACTOR commit needed — implementation was clean._

## Files Created/Modified

- `lib/cadence/engine.ts` - Full cadence engine: types, DEFAULT_CADENCE_CONFIG, buildCadenceState, evaluateCadence, processDueCadenceSteps
- `lib/cadence/engine.test.ts` - 14 unit tests covering all 13 required scenarios plus one additional rotation edge case

## Decisions Made

- `buildCadenceState` is a pure function — avoids DB coupling in the core decision logic; evaluateCadence wraps it with DB I/O. This matches the pattern in `matchProofs` (Phase 6) of passing PrismaClient as explicit parameter.
- `EngagementSignals` interface has no `openedAt` field — email opens are excluded at the type level, making the locked decision impossible to accidentally violate at any call site.
- `evaluateCadence` counts steps with status `SENT` or `QUEUED` as completed touches — `DRAFTED` steps are scheduled but not yet actioned, so they don't count toward exhaustion.
- `nextScheduledAt` returns `null` when no prior touches exist — prevents the cron sweep from immediately firing on brand-new sequences with no history.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Prisma client was not regenerated after Phase 10-01 added the cadence columns, causing TypeScript errors (`scheduledAt`, `nextStepReadyAt` not recognized). Fixed by running `npx prisma generate`. This was expected — Rule 3 (blocking issue resolved inline).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Cadence engine core is complete and tested — Plans 10-03 and 10-04 can build directly on these functions
- `processDueCadenceSteps` is ready to wire into a cron route (Plan 10-03)
- `evaluateCadence` is ready to call from outreach sequence creation and webhook handlers
- `DEFAULT_CADENCE_CONFIG` thresholds (3-day base, 1-day engaged, 4 max touches) remain pending product owner sign-off per STATE.md blocker

---

_Phase: 10-cadence-engine_
_Completed: 2026-02-20_

## Self-Check: PASSED

- `lib/cadence/engine.ts` — FOUND
- `lib/cadence/engine.test.ts` — FOUND
- `.planning/phases/10-cadence-engine/10-02-SUMMARY.md` — FOUND
- Commit `5d70d8a` (RED: failing tests) — FOUND
- Commit `7ba1746` (GREEN: implementation) — FOUND
