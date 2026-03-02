---
phase: 31-tech-debt-foundation
plan: 03
subsystem: testing, baselines
tags: [tRPC, vitest, quality-gate, golden-baseline, DEBT-03]
dependency_graph:
  requires: [31-01, 31-02]
  provides: [tRPC-quality-gate-test, golden-baselines]
  affects: [lib/outreach/send-email.test.ts, .planning/baselines/baselines.json]
tech_stack:
  added: []
  patterns:
    [
      appRouter.createCaller,
      vi.mock module-level mocking,
      main()-wrap for top-level await,
    ]
key_files:
  created:
    - lib/outreach/send-email.test.ts
    - scripts/export-baselines.ts
    - .planning/baselines/baselines.json
  modified: []
decisions:
  - Wrapped baseline export in main() function to avoid top-level await CJS incompatibility (established project pattern, not top-level await)
  - Used appRouter.createCaller with partial mock DB (as never cast — established project pattern)
  - Mocked sendOutreachEmail at module level so gate logic runs but Resend is not called
metrics:
  duration: 2m 18s
  completed: 2026-03-02
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 31 Plan 03: tRPC Quality Gate Test and Golden Baseline Capture Summary

**One-liner:** tRPC-based quality gate E2E test with PRECONDITION_FAILED rejection + golden baseline JSON for all 7 prospects captured post-Gemini-2.5 swap.

## What Was Built

### Task 1: tRPC Quality Gate E2E Test

Created `lib/outreach/send-email.test.ts` exercising the full `outreach.sendEmail` tRPC procedure path, including the quality gate logic.

The test uses `appRouter.createCaller` (tRPC v11 pattern) with a partial mock DB and module-level `vi.mock` for `sendOutreachEmail`. This ensures the gate logic in `outreach.ts` runs for real — only the Resend delivery call is mocked.

Two test cases:

1. **GREEN gate**: `evidenceCount=10, sourceTypeCount=4, avgConf=0.72` → `computeTrafficLight` returns `green` → `sendOutreachEmail` is called and result returned.
2. **RED gate**: `evidenceCount=1, sourceTypeCount=0, avgConf=0.0` → `computeTrafficLight` returns `red` → `TRPCError` with `code: PRECONDITION_FAILED` thrown, `sendOutreachEmail` NOT called.

Both tests pass. This replaces the previous E2E bypass that called Resend directly (DEBT-03 fix).

### Task 2: Golden Baseline Capture

Created `scripts/export-baselines.ts` — a one-shot DB export script using the established project pattern (`Pool` + `PrismaPg` adapter, `main()` wrapper).

Generated `.planning/baselines/baselines.json` with all 7 prospects:

- Motion Design Awards
- De Ondernemer
- Brainport Eindhoven
- DuckDB
- Mujjo
- Marcore
- STB-kozijnen

All 7 prospects have non-empty `workflowHypotheses` arrays. Baseline captured AFTER Gemini 2.5 Flash swap (Plan 31-01) and TS type fixes (Plan 31-02), so Phase 32 prompt comparisons isolate prompt changes only.

## Commits

| Hash      | Message                                                                   |
| --------- | ------------------------------------------------------------------------- |
| `13c5bbc` | feat(31-03): add tRPC quality gate E2E send test                          |
| `d76a345` | feat(31-03): add export-baselines script and capture golden baseline JSON |

## Verification Results

- `npx vitest run lib/outreach/send-email.test.ts`: 2 tests, 2 passed
- `npx tsc --noEmit`: zero errors
- `baselines.json | python3 -m json.tool`: valid JSON
- Pre-existing failure in `lib/workflow-engine.test.ts` (unrelated, logged to deferred items)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed top-level await CJS incompatibility in export-baselines.ts**

- **Found during:** Task 2
- **Issue:** Top-level `await` not supported with CJS output format in tsx
- **Fix:** Wrapped all async operations in a `main()` function with `main().catch(...)` — this is the established pattern used in `scripts/rerun-hypotheses.ts` and other project scripts
- **Files modified:** `scripts/export-baselines.ts`
- **Commit:** `d76a345`

## Deferred Items

**Pre-existing test failure (out of scope):**

- `lib/workflow-engine.test.ts`: test expects `sourceType='REVIEWS'` but receives `'WEBSITE'` — pre-dates this plan, confirmed by reverting all changes. Not caused by this plan's work.

## Self-Check: PASSED
