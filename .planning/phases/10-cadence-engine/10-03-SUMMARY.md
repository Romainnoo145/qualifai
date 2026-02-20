---
phase: 10-cadence-engine
plan: 03
subsystem: api
tags: [trpc, nextjs, cadence, cron, outreach, prisma]

# Dependency graph
requires:
  - phase: 10-cadence-engine/10-02
    provides: evaluateCadence, processDueCadenceSteps, DEFAULT_CADENCE_CONFIG from lib/cadence/engine

provides:
  - completeTouchTask fires evaluateCadence (fire-and-forget) after every task completion
  - resolveSequenceId helper: metadata-first, DB fallback
  - POST /api/internal/cron/cadence-sweep with x-cron-secret auth calling processDueCadenceSteps
  - tRPC sequences.getCadenceState returning sequences, engagement level, and cadence summary

affects:
  - 10-04-prospect-dashboard (UI that will call getCadenceState)
  - cron scheduler config (needs cadence-sweep endpoint registered)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - fire-and-forget with .catch(console.error) — same pattern as Phase 9 engagement triggers
    - cron auth via x-cron-secret header — same pattern as research-refresh
    - resolveSequenceId: metadata priority, then DB lookup — avoids tight coupling

key-files:
  created:
    - app/api/internal/cron/cadence-sweep/route.ts
  modified:
    - server/routers/outreach.ts
    - server/routers/sequences.ts

key-decisions:
  - 'resolveSequenceId checks metadata.outreachSequenceId first — cadence-created tasks carry this, skips unnecessary DB query'
  - 'getCadenceState includes full sequence+steps+contact include — Phase 10-04 UI needs full structure'
  - 'getCadenceState engagementLevel computed from wizardSession at query time — no persisted field needed'

patterns-established:
  - 'Cron route pattern: isAuthorized via x-cron-secret, call engine function, return {success: true, ...result}'
  - 'Fire-and-forget cadence hook: resolveSequenceId then evaluateCadence().catch(console.error)'

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 10 Plan 03: Cadence Engine Wiring Summary

**Cadence engine wired into application at three points: completeTouchTask fires evaluateCadence, POST /api/internal/cron/cadence-sweep runs processDueCadenceSteps, and tRPC sequences.getCadenceState exposes state to the UI.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T20:18:56Z
- **Completed:** 2026-02-20T20:20:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- completeTouchTask in outreach.ts now triggers cadence evaluation after each touch, using fire-and-forget pattern that cannot block task completion
- resolveSequenceId helper looks up sequenceId from task metadata first (explicit cadence link), then falls back to DB lookup for the contact's most recent active sequence
- Cron endpoint at /api/internal/cron/cadence-sweep authenticates via x-cron-secret, delegates entirely to processDueCadenceSteps, follows exact research-refresh pattern
- sequences.getCadenceState tRPC query returns full sequence history with steps, contact details, engagement level, and a summary object ready for Phase 10-04 UI consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire completeTouchTask to evaluateCadence and add sequence resolution** - `601012a` (feat)
2. **Task 2: Create cadence cron route and getCadenceState tRPC query** - `3b16bfe` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `server/routers/outreach.ts` - Added import, resolveSequenceId helper, fire-and-forget evaluateCadence call in completeTouchTask
- `app/api/internal/cron/cadence-sweep/route.ts` - New cron POST endpoint with x-cron-secret auth
- `server/routers/sequences.ts` - Added metadataAsObject helper and getCadenceState tRPC query

## Decisions Made

- resolveSequenceId checks metadata.outreachSequenceId first — cadence-created touch tasks already carry the sequence ID, so the DB lookup is a fallback only for manually created tasks
- getCadenceState includes full step and contact data inline — the Phase 10-04 dashboard needs the complete structure, not a lightweight summary
- engagementLevel in getCadenceState is computed at query time from wizardSession — no extra persisted field, consistent with how evaluateCadence computes it internally

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript compiled cleanly on first pass. No lint errors on new files.

## User Setup Required

None — no external service configuration required. Cron endpoint uses existing INTERNAL_CRON_SECRET env var (already defined as optional in env.mjs).

## Next Phase Readiness

- All three cadence wiring points complete: task completion hook, cron sweep, tRPC query
- Phase 10-04 (prospect dashboard UI) can call `sequences.getCadenceState` and render cadence history
- Cron scheduler (Vercel cron or external) needs to be configured to hit POST /api/internal/cron/cadence-sweep with x-cron-secret header

## Self-Check: PASSED

- app/api/internal/cron/cadence-sweep/route.ts: FOUND
- server/routers/outreach.ts: FOUND
- server/routers/sequences.ts: FOUND
- Commit 601012a: FOUND
- Commit 3b16bfe: FOUND

---

_Phase: 10-cadence-engine_
_Completed: 2026-02-20_
