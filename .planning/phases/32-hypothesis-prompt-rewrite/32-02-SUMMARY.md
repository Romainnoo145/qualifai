---
phase: 32-hypothesis-prompt-rewrite
plan: 02
subsystem: ai-generation
tags:
  [
    gemini,
    prompt-engineering,
    workflow-engine,
    hypothesis-generation,
    evidence-tiering,
  ]

# Dependency graph
requires:
  - phase: 32-01
    provides: TDD RED scaffold with Gemini mock and 9 failing ANLYS tests
provides:
  - Rewritten generateHypothesisDraftsAI with source tiers, signal summary, anti-parroting, quote mandate, dynamic count, calibrated confidence
  - Updated call site in research-executor.ts passing gate.confirmedPainTags
affects:
  - lib/workflow-engine.ts
  - lib/research-executor.ts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Evidence tier label map: TIER_LABEL Record<string, string> mapping sourceType to diagnostic/registry/marketing-context labels'
    - 'Prompt section order: role -> SOURCE TYPE GUIDE -> ANTI-PARROTING RULE -> signal summary -> company context -> evidence -> output instructions'
    - 'Dynamic count: targetCount = confirmedPainTags.length === 0 ? 1 : Math.min(3, Math.max(1, confirmedPainTags.length))'
    - 'Post-parse quote detection: hasQuote() checks for ASCII/curly double-quote in problemStatement; warns but does not reject'
    - 'Defensive count enforcement: parsed.slice(0, targetCount) before .map() to cap over-generation'
    - 'Confidence table source-before-score: REVIEWS-grounded: 0.80-0.95 pattern matches test regex /REVIEWS.{0,100}0.8[0-9]/'

key-files:
  created: []
  modified:
    - lib/workflow-engine.ts
    - lib/research-executor.ts

key-decisions:
  - 'Source-before-score confidence table format: test regex requires REVIEWS before 0.8x; restructured table as "REVIEWS-grounded: 0.80-0.95" not "0.80-0.95: grounded in REVIEWS"'
  - 'TIER_LABEL covers JOB_BOARD and MANUAL_URL in addition to core types for completeness'
  - 'Confidence clamping floor kept at >= 0.5 (not tightened to 0.60) — prompt calibration handles it; clamp is a safety floor only'
  - 'Fallback function generateFallbackHypothesisDrafts unchanged — still returns 3 (Phase 33+ scope); known inconsistency documented'
  - 'Pre-existing test failure (uses reviews-first evidence ordering) is out of scope — confirmed failing before Plan 32-02 changes'

requirements-completed:
  [ANLYS-01, ANLYS-02, ANLYS-03, ANLYS-04, ANLYS-05, ANLYS-06, ANLYS-07]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 32 Plan 02: Hypothesis Prompt Rewrite Implementation Summary

**Rewritten generateHypothesisDraftsAI with evidence tiering (TIER_LABEL), SOURCE TYPE GUIDE, ANTI-PARROTING RULE, signal summary injection, quote-mandate with post-parse validation, dynamic count from confirmedPainTags, and source-calibrated confidence scoring — all 7 ANLYS tests GREEN**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T11:31:51Z
- **Completed:** 2026-03-02T11:35:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rewrote `generateHypothesisDraftsAI` in-place replacing the old uncalibrated prompt with a structured 6-section prompt
- Added `TIER_LABEL` map classifying source types into diagnostic/registry/marketing-context tiers
- Added `tierCounts` pre-computation and `signalSummary` block injected above evidence in the prompt (ANLYS-05)
- Added `targetCount` derived from `confirmedPainTags.length` with 1-3 clamping (ANLYS-06)
- Prompt includes SOURCE TYPE GUIDE with per-source diagnostic labels (ANLYS-02)
- Prompt includes ANTI-PARROTING RULE prohibiting website-copy derivation (ANLYS-03)
- Confidence calibration table now source-first format: REVIEWS 0.80-0.95, CAREERS/LINKEDIN 0.70-0.80, WEBSITE 0.60-0.65 with explicit cap (ANLYS-07)
- Post-parse `hasQuote()` validation warns on missing quoted snippets (ANLYS-04)
- `parsed.slice(0, targetCount)` defensive count enforcement before mapping
- Updated call site in `research-executor.ts` to pass `gate.confirmedPainTags` as 3rd argument
- All 10 ANLYS test cases (7 requirements, ANLYS-04 has 2 cases) pass GREEN
- TypeScript compiles without errors; ESLint passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite generateHypothesisDraftsAI** - `57f2f96`
2. **Task 2: Update call site in research-executor.ts** - `c6a79cc`

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/workflow-engine.ts` - Rewrote `generateHypothesisDraftsAI` (lines 616-806): added TIER_LABEL, tierCounts, signalSummary, targetCount, restructured 6-section prompt, added hasQuote() post-parse validation and defensive slice
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/research-executor.ts` - Updated `generateHypothesisDraftsAI` call site (line 921) to pass `gate.confirmedPainTags` as 3rd argument

## Decisions Made

- **Source-before-score confidence table format:** The ANLYS-07 test regex `/REVIEWS.{0,100}0\.8[0-9]/` requires REVIEWS to appear before the score range. First attempt wrote "0.80-0.95: Hypothesis grounded in REVIEWS" which failed. Fixed to "REVIEWS-grounded: 0.80-0.95" — passes the regex.
- **Confidence clamping floor kept at >= 0.5:** Plan explicitly says do NOT tighten floor to 0.60 — let prompt calibration handle it. The >= 0.5 clamp is a safety floor only.
- **Fallback function unchanged:** `generateFallbackHypothesisDrafts` still hardcodes 3 hypotheses. This is a known inconsistency (fallback always returns 3; AI path returns 1-3). Out of scope for Phase 32.
- **TIER_LABEL includes JOB_BOARD and MANUAL_URL** for completeness beyond the core types in the plan spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reordered confidence table entries to satisfy ANLYS-07 regex**

- **Found during:** Task 1 verification (first test run after implementation)
- **Issue:** ANLYS-07 test regex `/REVIEWS.{0,100}0\.8[0-9]/` requires REVIEWS to precede the score. Initial implementation wrote `0.80-0.95: Hypothesis grounded in REVIEWS` — score appears before REVIEWS, failing the regex match.
- **Fix:** Restructured table format to `REVIEWS-grounded (customer/employee pain — direct signal): 0.80-0.95` so REVIEWS appears first.
- **Files modified:** `lib/workflow-engine.ts`
- **Commit:** Part of 57f2f96

**2. [Out of Scope] Pre-existing test failure: uses reviews-first evidence ordering**

- **Found during:** Task 2 final verification
- **Issue:** `generateEvidenceDrafts` test at line 223 (`uses reviews-first evidence ordering for construction/install profiles`) fails with `expected 'WEBSITE' to be 'REVIEWS'`. This is NOT caused by Plan 32-02 changes — confirmed failing in original state before any Plan 32-02 edits.
- **Action:** Logged as deferred item. Not fixed — out of scope per deviation rules (pre-existing, unrelated code path).
- **Impact:** 26/27 tests pass; the 1 failing test is pre-existing and unrelated to ANLYS requirements.

## Issues Encountered

- ANLYS-07 regex required source-before-score table ordering (iteration required on first attempt)
- Pre-existing test failure in `generateEvidenceDrafts` (`uses reviews-first` test) is not caused by this plan and is deferred

## Next Phase Readiness

- Phase 32-03 (verification run on real prospects) has clear input: rewritten prompt with source tiers and calibrated confidence
- The ANLYS-07 success criterion for live AI output (WEBSITE-only → 0.60-0.65) requires a real prospect re-run (STB-kozijnen or Marcore)
- `generateFallbackHypothesisDrafts` inconsistency (always 3) documented for future phase

---

_Phase: 32-hypothesis-prompt-rewrite_
_Completed: 2026-03-02_

## Self-Check: PASSED

- FOUND: lib/workflow-engine.ts
- FOUND: lib/research-executor.ts
- FOUND: .planning/phases/32-hypothesis-prompt-rewrite/32-02-SUMMARY.md
- FOUND commit: 57f2f96
- FOUND commit: c6a79cc
