---
phase: 22-hypothesis-flow-fix
plan: 01
subsystem: api
tags: [trpc, prisma, hypothesis, research, cache-invalidation, react-query]

# Dependency graph
requires:
  - phase: 18-research-quality-gate
    provides: approveQuality mutation and QualityChip component with onSuccess callback
  - phase: 19-client-hypothesis-validation
    provides: PENDING/DRAFT/ACCEPTED/DECLINED HypothesisStatus enum values and /voor/ validation flow
provides:
  - DRAFT→PENDING hypothesis transition wired into approveQuality mutation
  - Hypothesis cache invalidation on quality approval so admin UI reflects status immediately
affects: [23-any-future-voor-enhancements, pipeline-observability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'approveQuality mutation uses await+assign pattern before side-effects, then returns original result'
    - 'updateMany status guards (DRAFT only / PENDING only) prevent overwriting terminal states (ACCEPTED/DECLINED)'
    - 'Broad cache invalidation (no prospectId arg) in QualityChip — only active subscribers refetch'

key-files:
  created: []
  modified:
    - server/routers/research.ts
    - components/features/prospects/quality-chip.tsx

key-decisions:
  - "status: 'DRAFT' guard in approval branch prevents overwriting ACCEPTED/DECLINED hypotheses already actioned by prospect"
  - "status: 'PENDING' guard in rejection branch only reverts quality-approved hypotheses, not terminal states"
  - 'updateMany result ({ count }) discarded — return type remains ResearchRun unchanged'
  - 'Broad hypotheses.listByProspect.invalidate() (no arg) used because QualityChip only receives runId, not prospectId'

patterns-established:
  - 'Hypothesis status transition: DRAFT→PENDING on quality approval, PENDING→DRAFT on quality rejection'

# Metrics
duration: 1min
completed: 2026-02-23
---

# Phase 22 Plan 01: Hypothesis Flow Fix Summary

**DRAFT→PENDING hypothesis transition wired into approveQuality mutation with React Query cache invalidation completing the E2E hypothesis flow**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-23T03:25:04Z
- **Completed:** 2026-02-23T03:26:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `approveQuality` mutation now transitions all DRAFT hypotheses for a research run to PENDING on approval, unblocking the /voor/ validation dashboard
- On rejection, PENDING hypotheses revert to DRAFT so they disappear from /voor/ if an admin reverses approval
- `QualityChip` `onSuccess` now invalidates `hypotheses.listByProspect` cache so the Analysis section status badges update immediately without a page refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DRAFT→PENDING transition to approveQuality mutation** - `26bbeb1` (feat)
2. **Task 2: Add hypothesis cache invalidation to quality-chip onSuccess** - `820a72d` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `server/routers/research.ts` - `approveQuality` mutation extended with conditional `workflowHypothesis.updateMany` calls for both approval and rejection paths
- `components/features/prospects/quality-chip.tsx` - Added `void utils.hypotheses.listByProspect.invalidate()` to `approveQuality` `onSuccess` callback

## Decisions Made

- `status: 'DRAFT'` guard in the approval `updateMany` ensures only hypotheses still in DRAFT get promoted — ACCEPTED/DECLINED hypotheses (already actioned by prospect) are untouched
- `status: 'PENDING'` guard in the rejection `updateMany` ensures only quality-approved-but-not-yet-validated hypotheses revert — terminal states preserved
- `updateMany` result (`{ count }`) is intentionally discarded — the mutation return type remains `ResearchRun` as required
- Broad `hypotheses.listByProspect.invalidate()` (no prospectId argument) used because `QualityChip` only receives `runId` as a prop; React Query will only refetch queries with active subscribers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm run check` script does not exist in this project — `npx tsc --noEmit` used as equivalent TypeScript verification. Lint and format handled automatically by husky/lint-staged pre-commit hook (confirmed running on each commit).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- E2E hypothesis flow is now complete: discovery → research → quality approval → PENDING → /voor/ validation → ACCEPTED/DECLINED → admin visibility
- The v2.0 milestone audit gap (HYPO-GAP-01) is closed
- Existing PENDING/ACCEPTED hypotheses in the database are unaffected — the fix is additive-only at the application layer

## Self-Check: PASSED

- FOUND: server/routers/research.ts
- FOUND: components/features/prospects/quality-chip.tsx
- FOUND: 22-01-SUMMARY.md
- FOUND: commit 26bbeb1 (Task 1)
- FOUND: commit 820a72d (Task 2)

---

_Phase: 22-hypothesis-flow-fix_
_Completed: 2026-02-23_
