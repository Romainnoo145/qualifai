---
phase: 33-configurable-model-selection
plan: 01
subsystem: testing
tags: [vitest, anthropic-sdk, tdd, hypothesis-generation, model-selection]

# Dependency graph
requires:
  - phase: 32-hypothesis-prompt-rewrite
    provides: generateHypothesisDraftsAI with confirmedPainTags parameter and 7 GREEN ANLYS tests
provides:
  - Configurable mockAnthropicCreate vi.fn() replacing hardcoded rejection stub
  - 5 new test cases (MODEL-01 x3, ANLYS-08 x2) defining pass criteria for Plan 33-02
  - hypothesisModel parameter signature on generateHypothesisDraftsAI (stub, routing in 33-02)
affects: [33-02-implementation, workflow-engine-ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'mockAnthropicCreate module-level vi.fn() mirrors existing mockGenerateContent pattern — configurable per test via beforeEach reset'
    - 'makeClaudeHypothesisResponse factory produces Anthropic Message shape with <reasoning>+JSON content text'
    - "hypothesisModel parameter defaults to 'gemini-flash' for backward compatibility; void stub suppresses TS6133"

key-files:
  created: []
  modified:
    - lib/workflow-engine.test.ts
    - lib/workflow-engine.ts

key-decisions:
  - 'TDD RED: MODEL-01 Claude path test fails because hypothesisModel stub uses void (no routing) — correct RED for Plan 33-02 to go GREEN'
  - 'TDD RED: ANLYS-08 CoT prompt test fails because <reasoning> block not yet in prompt — correct RED for Plan 33-02 to go GREEN'
  - "Pre-existing test failure 'reviews-first evidence ordering' deferred to deferred-items.md (out of scope, predates Phase 33)"
  - 'ANLYS-08 CoT stripping test passes without implementation because existing JSON regex handles text without reasoning block — expected, not a problem'

patterns-established:
  - 'Pattern 1: Claude mock follows Gemini mock pattern — module-level vi.fn() reset in beforeEach, configured per test with mockResolvedValueOnce'
  - "Pattern 2: makeClaudeHypothesisResponse wraps items in Anthropic Message content array (type: 'text') with <reasoning> prefix before JSON"

requirements-completed: [MODEL-01, ANLYS-08]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 33 Plan 01: Configurable Model Selection TDD RED Scaffold Summary

**Configurable Anthropic mock (mockAnthropicCreate vi.fn()) + 5 new MODEL-01/ANLYS-08 failing test cases + hypothesisModel parameter stub on generateHypothesisDraftsAI**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T13:53:08Z
- **Completed:** 2026-03-02T13:55:40Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Replaced hardcoded `mockRejectedValue('test mock')` Anthropic stub with configurable `mockAnthropicCreate = vi.fn()` pattern matching Gemini mock
- Added `makeClaudeHypothesisResponse` factory creating Anthropic Message shape with `<reasoning>` block prefix before JSON array
- Added 3 MODEL-01 test cases: Claude happy path (RED), default=Gemini omitted (GREEN), explicit gemini-flash (GREEN)
- Added 2 ANLYS-08 test cases: CoT prompt instruction (RED), CoT reasoning stripped before parse (GREEN)
- Extended `generateHypothesisDraftsAI` signature with `hypothesisModel: 'gemini-flash' | 'claude-sonnet' = 'gemini-flash'` + void stub

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade Anthropic mock + add MODEL-01 + ANLYS-08 failing test cases** - `8fe400c` (test)

**Plan metadata:** (in final commit below)

_Note: TDD RED phase — test commit only, no feat commit yet (that's Plan 33-02)_

## Files Created/Modified

- `lib/workflow-engine.test.ts` — Anthropic mock upgraded to vi.fn(); makeClaudeHypothesisResponse added; 5 new test cases added; mockAnthropicCreate.mockReset() in beforeEach
- `lib/workflow-engine.ts` — hypothesisModel parameter added with default 'gemini-flash'; void stub suppresses TS6133

## Decisions Made

- Pre-existing "reviews-first evidence ordering" test failure is out of scope — logged to deferred-items.md (it predates Phase 33 and is unrelated to model selection)
- ANLYS-08 CoT stripping test (test 5) passing GREEN without implementation is correct — the existing `text.match(/\[[\s\S]*\]/)` regex handles text without a reasoning block fine; the RED state for CoT is captured by the prompt test (test 4)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failure discovered during verification: `uses reviews-first evidence ordering for construction/install profiles` was already failing before Phase 33 changes. Confirmed via `git stash` verification. Logged to `deferred-items.md` per scope boundary rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RED scaffold is in place — Plan 33-02 (implementation) can begin
- Plan 33-02 must make these 2 RED tests GREEN: MODEL-01 Claude happy path + ANLYS-08 CoT prompt instruction
- Plan 33-02 must NOT regress any of the 7 ANLYS-01 through ANLYS-07 tests that are currently GREEN
- hypothesisModel parameter signature is ready — Plan 33-02 adds routing logic (remove void stub, add if/else branching)

---

_Phase: 33-configurable-model-selection_
_Completed: 2026-03-02_
