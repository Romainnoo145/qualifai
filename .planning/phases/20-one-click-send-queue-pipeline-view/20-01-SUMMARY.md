---
phase: 20-one-click-send-queue-pipeline-view
plan: 01
subsystem: api
tags: [trpc, prisma, idempotency, outreach, send-queue]

# Dependency graph
requires:
  - phase: 19-client-hypothesis-validation
    provides: Completed prospect validation pipeline — Phase 20 builds send UX on top

provides:
  - Idempotency guard on approveDraft (atomic updateMany claim draft→sending, CONFLICT on double-send)
  - Idempotency guard on bulkApproveLowRisk (per-draft atomic claim, silent skip on concurrent claim)
  - Transient send failure recovery (revert to draft instead of manual_review for retryability)

affects:
  - 20-02 (pipeline view UI — depends on idempotency being in place before send buttons built)
  - any UI that calls approveDraft or bulkApproveLowRisk

# Tech tracking
tech-stack:
  added: [TRPCError from @trpc/server]
  patterns:
    - Atomic DB claim pattern (updateMany where status=X → set status=Y, check count=0 for conflict)
    - Transient vs permanent failure distinction (draft revert = transient, manual_review = permanent/quality block)

key-files:
  created: []
  modified:
    - server/routers/outreach.ts

key-decisions:
  - "approveDraft atomic claim uses updateMany(where: {id, status:'draft'}, data: {status:'sending'}) — CONFLICT if count=0"
  - "Transient send failure reverts to 'draft' (retryable in queue); quality block keeps 'manual_review' (permanent)"
  - 'bulkApproveLowRisk silently skips drafts already claimed by concurrent request (continue, not fail)'
  - "Missing contact email in approveDraft reverts to 'draft' (data issue, not a send conflict)"

patterns-established:
  - 'Atomic claim pattern: updateMany with status condition before any external call — count=0 means already claimed'
  - 'Error revert discipline: transient errors (network, send) revert to original state; quality/data errors advance to manual_review'

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 20 Plan 01: Idempotency Guards for Send Queue Summary

**Atomic updateMany claim guards in approveDraft and bulkApproveLowRisk prevent double-sends on concurrent clicks/tabs, with draft revert on transient failures for retryability.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T01:52:45Z
- **Completed:** 2026-02-23T01:55:04Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- approveDraft atomically claims draft as 'sending' via updateMany before calling sendOutreachEmail — second concurrent call gets CONFLICT error immediately without hitting the email provider
- bulkApproveLowRisk claims each draft atomically inside the loop — concurrent bulk send invocations silently skip already-claimed drafts without failing the whole batch
- Transient email send failures now revert status to 'draft' so the item reappears in the queue for retry — previously they were mis-classified as 'manual_review' (permanent), which hid retryable failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Add idempotency guard to approveDraft** — `a0d3b2e` (feat) — same commit as Task 2
2. **Task 2: Add idempotency guard to bulkApproveLowRisk** — `a0d3b2e` (feat) — both mutations in one file

_Note: Tasks 1 and 2 both modified the same file (server/routers/outreach.ts) and were committed together._

## Files Created/Modified

- `server/routers/outreach.ts` — Added TRPCError import; atomic claim in approveDraft with CONFLICT guard; draft-revert on transient failure; atomic per-draft claim in bulkApproveLowRisk with silent skip; catch block cleanup (unused variable removed)

## Decisions Made

- Used `updateMany` with `where: { id, status: 'draft' }` for atomic claim — Prisma's updateMany returns a count that is 0 if no rows matched, which is the idempotency signal without needing a transaction
- Transient errors (network/send failures) revert to 'draft'; quality blocks keep 'manual_review' — distinction makes 'manual_review' mean "needs human judgment" rather than "something went wrong"
- Missing contact email on approveDraft reverts to 'draft' rather than 'manual_review' — data issue may be fixed by admin, so item should stay in queue
- bulkApproveLowRisk uses `continue` (not error accumulation) for concurrent skips — those items weren't actually processed by this invocation, so they don't count as failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `error` variable in bulkApproveLowRisk catch block**

- **Found during:** Task 2 (lint check after implementing catch block)
- **Issue:** Plan's `catch (error)` pattern introduced a lint error — `error` was defined but not used since the catch block no longer builds a message from it
- **Fix:** Changed `catch (error)` to `catch` (bare catch — TypeScript/ESLint approved)
- **Files modified:** server/routers/outreach.ts
- **Verification:** `npm run lint` shows zero errors for outreach.ts
- **Committed in:** a0d3b2e (same task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's catch pattern)
**Impact on plan:** Minor lint fix only. No behavior change. No scope creep.

## Issues Encountered

None — plan executed cleanly. TypeScript check and lint both pass with zero errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Idempotency guards are in place — the send queue UI (Phase 20, Plans 02-03) can now safely add one-click send buttons without risk of double-sends
- Both `approveDraft` and `bulkApproveLowRisk` are safe for concurrent invocation at the database level
- The CONFLICT TRPCError gives the UI a clean signal to show "already sending, please wait" instead of a generic error

---

_Phase: 20-one-click-send-queue-pipeline-view_
_Completed: 2026-02-23_
