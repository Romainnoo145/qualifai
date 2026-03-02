---
phase: 32-hypothesis-prompt-rewrite
plan: 01
subsystem: testing
tags: [vitest, tdd, gemini, workflow-engine, prompt-engineering]

# Dependency graph
requires:
  - phase: 31-tech-debt-foundation
    provides: golden baseline JSON + GEMINI_MODEL_FLASH constant + TypeScript cast cleanup
provides:
  - Failing TDD RED scaffold for all 7 ANLYS requirements in workflow-engine.test.ts
  - Gemini mock (vi.mock @google/generative-ai) with prompt-capture capability
  - Optional confirmedPainTags parameter on generateHypothesisDraftsAI signature
affects:
  - 32-02 (implementation plan — these tests define the pass criteria)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Gemini mock pattern: vi.mock with module-level lastCapturedPrompt variable to capture prompt text for assertion'
    - 'Prompt text assertion: call function with mocked Gemini, assert captured prompt matches expected patterns'

key-files:
  created: []
  modified:
    - lib/workflow-engine.test.ts
    - lib/workflow-engine.ts

key-decisions:
  - 'TDD RED: function signature extended with optional confirmedPainTags: string[] = [] now (TypeScript must compile), implementation stub uses void to suppress lint; ANLYS-06 behavior wired in Plan 32-02'
  - 'Gemini mock captures prompt via module-level lastCapturedPrompt string; reset in beforeEach to isolate test cases'
  - '9 test cases for 7 ANLYS requirements (ANLYS-04 has 2 cases: warn=true and warn=false)'

patterns-established:
  - 'Gemini mock pattern: module-level mockGenerateContent vi.fn() + lastCapturedPrompt capture variable, reset in beforeEach'

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 32 Plan 01: Hypothesis Prompt Rewrite TDD RED Scaffold Summary

**Vitest RED scaffold for generateHypothesisDraftsAI with Gemini mock and 9 failing assertions covering ANLYS-01 through ANLYS-07 prompt engineering requirements**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T11:26:21Z
- **Completed:** 2026-03-02T11:28:41Z
- **Tasks:** 1 (TDD RED phase)
- **Files modified:** 2

## Accomplishments

- Added `vi.mock('@google/generative-ai', ...)` with module-level prompt-capture to `workflow-engine.test.ts`
- Added `generateHypothesisDraftsAI` import to test file
- Created `describe('generateHypothesisDraftsAI')` block with 9 test cases covering all 7 ANLYS requirements
- 20 existing tests continue to PASS; 7 new ANLYS tests FAIL RED as expected
- TypeScript compiles without errors (`confirmedPainTags: string[] = []` optional 3rd param)

## Task Commits

Each task was committed atomically:

1. **TDD RED scaffold** - `cfdce4f` (test)

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.test.ts` - Added Gemini mock, `generateHypothesisDraftsAI` import, and 9-test describe block for ANLYS-01 through ANLYS-07
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.ts` - Added optional `confirmedPainTags: string[] = []` 3rd parameter to function signature; void stub until Plan 32-02 implementation

## Decisions Made

- **Function signature extended now (not in 32-02):** `confirmedPainTags: string[] = []` added as optional 3rd parameter so TypeScript compiles. A `void confirmedPainTags` stub prevents TS6133 lint error. The implementation that uses the parameter comes in Plan 32-02.
- **9 test cases for 7 requirements:** ANLYS-04 split into two cases (warn fires without quotes; warn does NOT fire with quotes) to cover both happy path and negative assertion.
- **Module-level lastCapturedPrompt variable:** Mutable module-level string that the Gemini mock writes on each `generateContent` call. `beforeEach` resets it to `''` for test isolation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added optional confirmedPainTags parameter to fix TypeScript TS2554 error**

- **Found during:** TDD RED task (verification step)
- **Issue:** Test calls used `generateHypothesisDraftsAI(evidence, context, confirmedPainTags)` but function signature only accepted 2 arguments — TypeScript error TS2554 "Expected 2 arguments, but got 3"
- **Fix:** Added `confirmedPainTags: string[] = []` as optional 3rd parameter to `generateHypothesisDraftsAI` in `workflow-engine.ts`. Added `void confirmedPainTags` stub to suppress TS6133 unused variable lint error. Implementation uses the parameter in Plan 32-02.
- **Files modified:** `lib/workflow-engine.ts`
- **Verification:** `npx tsc --noEmit` passes; tests still fail RED for correct reasons
- **Committed in:** cfdce4f (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking TypeScript error)
**Impact on plan:** Required to satisfy success criterion "TypeScript compiles without errors (the 3rd parameter is optional with default `[]`)". No scope creep — this is the documented prerequisite from the plan.

## Issues Encountered

None — mock isolation worked cleanly on first implementation. The `void confirmedPainTags` pattern was the only adjustment needed.

## Next Phase Readiness

- Plan 32-02 (implementation) has clear pass criteria: make all 9 tests go GREEN
- Gemini mock infrastructure is in place and tested
- `confirmedPainTags` parameter is wired into the function signature ready for 32-02 to implement the count logic
- Research pitfalls (Pitfall 1-5) documented in 32-RESEARCH.md are all addressed by test design

---

_Phase: 32-hypothesis-prompt-rewrite_
_Completed: 2026-03-02_

## Self-Check: PASSED

- FOUND: lib/workflow-engine.test.ts
- FOUND: lib/workflow-engine.ts
- FOUND: .planning/phases/32-hypothesis-prompt-rewrite/32-01-SUMMARY.md
- FOUND commit: cfdce4f
