---
phase: 34-ai-metric-derivation
plan: 01
subsystem: testing
tags: [vitest, tdd, workflow-engine, hypothesis, metrics, primarySourceType]

# Dependency graph
requires:
  - phase: 33-configurable-model-selection
    provides: generateHypothesisDraftsAI with Claude/Gemini model branching and makeClaudeHypothesisResponse factory
provides:
  - Failing RED test suite for MODEL-03 (AI-derived metrics vs METRIC_DEFAULTS) and ANLYS-09 (primarySourceType resolution)
  - HypothesisDraft interface extended with primarySourceType: string | null field
  - Mock factories (makeHypothesisResponse, makeClaudeHypothesisResponse) extended with all metric and primarySourceType fields
affects:
  - 34-02 (implementation plan will turn these RED tests GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'TDD RED scaffold: mock default values (hoursSavedWeekMid: 12) differ from METRIC_DEFAULTS (8) to enable RED assertions'
    - 'Interface-first: add primarySourceType to HypothesisDraft before implementation to make TypeScript compile cleanly'
    - 'Stub pattern: primarySourceType: null in all return sites as placeholder pending Phase 34-02 implementation'

key-files:
  created: []
  modified:
    - lib/workflow-engine.test.ts
    - lib/workflow-engine.ts

key-decisions:
  - 'MODEL-03 clamping test assertion changed from toBeLessThanOrEqual(80) to toBe(80) — original plan assertion was coincidentally satisfied by METRIC_DEFAULTS (8 <= 80), which would not drive the correct implementation'
  - 'primarySourceType: null stubs added to all HypothesisDraft return sites in generateFallbackHypothesisDrafts to fix TS2339 type errors caused by adding the field to the interface'
  - 'ANLYS-09 test 5 (invalid primarySourceType falls back to null) coincidentally passes with the null stub; tests 1-4 remain genuinely RED'

patterns-established:
  - 'Model-03 RED tests: assert specific AI-derived value (e.g. toBe(12)) not range (e.g. toBeLessThan(80)) to catch METRIC_DEFAULTS fallback'

requirements-completed: [MODEL-03, ANLYS-09]

# Metrics
duration: 20min
completed: 2026-03-02
---

# Phase 34 Plan 01: AI Metric Derivation RED Test Scaffold Summary

**TDD RED scaffold for MODEL-03 and ANLYS-09: 5 failing tests proving hoursSavedWeekMid/revenueLeakageRecoveredMid are still METRIC_DEFAULTS and primarySourceType is not yet extracted from AI output**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-02T15:37:00Z
- **Completed:** 2026-03-02T15:57:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `makeHypothesisResponse` and `makeClaudeHypothesisResponse` factories to accept optional metric fields and `primarySourceType`; default mock values (hoursSavedWeekMid: 12, revenueLeakageRecoveredMid: 1200) intentionally differ from METRIC_DEFAULTS (8, 900)
- Added 5 new tests: 3 MODEL-03 (AI-derived metrics not overwritten by METRIC_DEFAULTS; clamping to bounds), 2 ANLYS-09 (primarySourceType resolved from AI output; invalid value falls back to null)
- Extended `HypothesisDraft` interface with `primarySourceType: string | null` field; added null stubs in all 7 return sites of `generateFallbackHypothesisDrafts`
- TypeScript compiles cleanly with zero errors

## Task Commits

1. **Task 1: Extend mock factories with metric fields and primarySourceType** - `5b7f5bd` (test)
2. **Task 2: Add MODEL-03 and ANLYS-09 failing RED tests** - `e1aba62` (test)

## Files Created/Modified

- `lib/workflow-engine.test.ts` - Extended mock factories + 5 new RED test cases appended after ANLYS-08 tests
- `lib/workflow-engine.ts` - HypothesisDraft interface extended with primarySourceType; null stubs added in all fallback return sites

## Decisions Made

- MODEL-03 clamping test assertion changed to `toBe(80)` (not `toBeLessThanOrEqual(80)` from plan) — the original range check would be trivially satisfied by METRIC_DEFAULTS returning 8, which would not drive a genuine implementation of value clamping
- `primarySourceType: null` stubs added to all `HypothesisDraft` return sites as necessary TypeScript fix; ANLYS-09 test 5 coincidentally passes (null satisfies toBeNull()), test 4 still fails RED

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected MODEL-03 clamping test assertion to require exactly 80, not just ≤ 80**

- **Found during:** Task 2 (Add MODEL-03 and ANLYS-09 failing RED tests)
- **Issue:** Plan specified `expect(result[0]?.hoursSavedWeekMid).toBeLessThanOrEqual(80)` for the clamping test. METRIC_DEFAULTS returns `hoursSavedWeekMid: 8`, which is already `<= 80`, so the test would pass (GREEN) without any clamping implementation — defeating the purpose of a RED test.
- **Fix:** Changed assertion to `expect(result[0]?.hoursSavedWeekMid).toBe(80)` — fails RED (8 !== 80) under METRIC_DEFAULTS, and will pass GREEN when the implementation correctly clamps the out-of-range LLM value of 200 to the max bound of 80.
- **Files modified:** `lib/workflow-engine.test.ts`
- **Verification:** Test fails with `expected 8 to be 80`; correct RED failure for correct reason
- **Committed in:** e1aba62 (Task 2 commit)

**2. [Rule 3 - Blocking] Added primarySourceType: string | null to HypothesisDraft interface and null stubs in all return sites**

- **Found during:** Task 2 (Add MODEL-03 and ANLYS-09 failing RED tests)
- **Issue:** ANLYS-09 tests reference `result[0]?.primarySourceType` which TypeScript rejected with TS2339 because the field did not exist on `HypothesisDraft`. The test file would not compile.
- **Fix:** Added `primarySourceType: string | null` to `HypothesisDraft` interface in `workflow-engine.ts`. Added `primarySourceType: null` to all 7 `HypothesisDraft` return objects in `generateFallbackHypothesisDrafts` (3 construction path + 3 generic path) and the main `generateHypothesisDraftsAI` return.
- **Files modified:** `lib/workflow-engine.ts`
- **Verification:** `npx tsc --noEmit` exits 0; ANLYS-09 test 4 fails RED with "expected object to have property 'primarySourceType'" is now resolved — test 4 fails RED with `null !== 'REVIEWS'` instead
- **Committed in:** e1aba62 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 test bug, 1 blocking TypeScript compile error)
**Impact on plan:** Both auto-fixes necessary for test correctness and TypeScript compilation. No scope creep. Plan 02 implementation is unaffected.

## Issues Encountered

- ANLYS-09 test 5 ("invalid primarySourceType falls back to null") coincidentally passes with the null stub — this is an acceptable state because test 4 ("valid primarySourceType is returned") still fails RED. Together they define the correct contract for Plan 02 implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 4 new tests fail RED for correct reasons (hoursSavedWeekMid is METRIC_DEFAULTS 8 not AI-derived 12; revenueLeakageRecoveredMid is 900 not 1200; clamped value is 8 not 80; primarySourceType is null not 'REVIEWS')
- 1 new test coincidentally passes (ANLYS-09 test 5: null stub satisfies toBeNull())
- HypothesisDraft interface ready for Plan 02 implementation
- Plan 02 must: replace `...METRIC_DEFAULTS` spread with AI-derived metric extraction + clamping logic; extract primarySourceType from AIHypothesisItem and validate against allowed enum values

## Self-Check: PASSED

- `lib/workflow-engine.test.ts` — FOUND
- `lib/workflow-engine.ts` — FOUND
- `.planning/phases/34-ai-metric-derivation/34-01-SUMMARY.md` — FOUND
- Commit `5b7f5bd` (Task 1) — FOUND
- Commit `e1aba62` (Task 2) — FOUND

---

_Phase: 34-ai-metric-derivation_
_Completed: 2026-03-02_
