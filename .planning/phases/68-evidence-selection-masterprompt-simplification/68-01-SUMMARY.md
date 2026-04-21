---
phase: 68-evidence-selection-masterprompt-simplification
plan: 01
subsystem: analysis
tags: [evidence-selector, masterprompt, tdd, diversity-cap]
dependency_graph:
  requires: []
  provides:
    [selectEvidenceForPrompt, buildSourceBreakdown, simplified-masterprompt]
  affects: [lib/analysis/master-analyzer.ts, downstream plan 68-02]
tech_stack:
  added: []
  patterns: [TDD-red-green, diversity-cap-selector]
key_files:
  created:
    - lib/analysis/evidence-selector.ts
    - lib/analysis/evidence-selector.test.ts
    - lib/analysis/master-prompt.test.ts
  modified:
    - lib/analysis/master-prompt.ts
decisions:
  - "Test for 'exactly 20 items' required 4 source types (not 3) because maxPerSource=5 × 3 sources = 15 < 20 limit"
  - 'Pre-existing TS error in lib/enrichment/sitemap.test.ts confirmed out-of-scope; our changes introduce zero new errors'
  - 'Internal sort+slice replaced with identity assignment — callers (Plan 68-02+) responsible for pre-selecting via selectEvidenceForPrompt'
metrics:
  duration: 15m
  completed: 2026-04-21
  tasks_completed: 2
  files_modified: 4
---

# Phase 68 Plan 01: Evidence Selector + Masterprompt Simplification Summary

**One-liner:** Reusable top-20 evidence selector with max-5-per-source diversity cap; visual spec stripped from both masterprompt builders.

## Tasks Completed

| Task | Name                                         | Commit  | Files                                                                     |
| ---- | -------------------------------------------- | ------- | ------------------------------------------------------------------------- |
| 1    | Evidence selector utility with TDD           | 3c342ec | lib/analysis/evidence-selector.ts, lib/analysis/evidence-selector.test.ts |
| 2    | Strip visual spec from masterprompt builders | 91c5c70 | lib/analysis/master-prompt.ts, lib/analysis/master-prompt.test.ts         |

## What Was Built

### Task 1: Evidence Selector Utility

`lib/analysis/evidence-selector.ts` exports two functions:

- `selectEvidenceForPrompt(items, opts?)` — sorts by confidenceScore descending, then greedily selects up to `limit` (default 20) items while capping each `sourceType` at `maxPerSource` (default 5). Ensures diversity across sources without rejecting high-confidence items.
- `buildSourceBreakdown(items)` — returns `{ sourceType: count }` map for logging/headers.

10 vitest tests covering: exact count (20), per-source cap (5), under-limit pass-through, empty input, same-sourceType cap, sort order, custom opts, large input ceiling, and breakdown correctness.

### Task 2: Masterprompt Visual Spec Removal

Both `buildNarrativePrompt` (Atlantis) and `buildKlarifaiNarrativePrompt` (Klarifai) had:

1. `visualType` + `visualData` bullet-point specification blocks — **deleted**
2. `"visualType"` and `"visualData"` keys in the JSON example — **deleted**
3. Internal `[...evidence].sort(...).slice(0, 60)` — **replaced** with `const sortedEvidence = evidence` (trust pre-selected input)

JSON section example now ends at `"punchline"` only.

10 vitest tests verifying: absence of "visualType"/"visualData" strings, presence of "punchline"/"citations", and that all 25 evidence items appear in prompt output when 25 are passed (no internal truncation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test] Corrected evidence count math in test**

- **Found during:** Task 1 GREEN phase
- **Issue:** First test "returns exactly 20 items from 30 mixed inputs" used 3 source types × max 5 = 15, not 20. Test expected 20 but algorithm correctly returned 15.
- **Fix:** Changed test to use 4 source types × 10 items each (4×5=20 satisfies limit). Custom opts test similarly updated to 4 sources to reach limit=10.
- **Files modified:** lib/analysis/evidence-selector.test.ts
- **Commit:** 3c342ec (included in task commit)

## Self-Check: PASSED

- lib/analysis/evidence-selector.ts: FOUND
- lib/analysis/evidence-selector.test.ts: FOUND
- lib/analysis/master-prompt.ts: FOUND (modified)
- lib/analysis/master-prompt.test.ts: FOUND
- Commit 3c342ec: FOUND
- Commit 91c5c70: FOUND
- All 20 vitest tests: PASS
