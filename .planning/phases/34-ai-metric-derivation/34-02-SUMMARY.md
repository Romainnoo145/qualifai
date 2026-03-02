---
phase: 34-ai-metric-derivation
plan: 02
subsystem: workflow-engine
tags:
  [
    vitest,
    tdd,
    workflow-engine,
    hypothesis,
    metrics,
    primarySourceType,
    prisma,
    ui,
  ]

# Dependency graph
requires:
  - phase: 34-ai-metric-derivation
    plan: 01
    provides: RED test scaffold for MODEL-03 and ANLYS-09; HypothesisDraft interface with primarySourceType stub
provides:
  - AI-derived metric ranges (hoursSavedWeekMid/revenueLeakageRecoveredMid/etc.) extracted from LLM response with clamp/sort validation
  - primarySourceType persisted to WorkflowHypothesis DB column and surfaced in admin FindingCard badge
  - All 5 MODEL-03 and ANLYS-09 tests GREEN
affects:
  - 34-03 (final integration / baseline validation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'clampInt/clampFloat helpers: typeof guard + isNaN + Math.round/min/max with METRIC_DEFAULTS as per-field fallback'
    - 'Tuple cast pattern: .sort().as [number, number, number] to satisfy TypeScript non-undefined destructure'
    - 'VALID_SOURCE_TYPES Set: whitelist validation before assigning primarySourceType (unknown string falls back to null)'
    - 'METRIC_DEFAULTS retained as last-resort fallback — not deleted, used as def parameter in each clampInt/clampFloat call'

key-files:
  created:
    - prisma/migrations/20260302200000_add_hypothesis_primary_source_type/migration.sql
  modified:
    - lib/workflow-engine.ts
    - lib/research-executor.ts
    - prisma/schema.prisma
    - components/features/prospects/analysis-section.tsx

key-decisions:
  - 'Tuple cast .sort() as [number, number, number] used to avoid number|undefined inference from array destructure — cleaner than non-null assertion per element'
  - 'primarySourceType column placed before status in WorkflowHypothesis (not after revenueLeakageRecoveredHigh) — avoids merge conflict with AutomationOpportunity which has identical trailing fields'
  - 'Pre-existing test failure ("uses reviews-first evidence ordering") is out of scope and was already failing before Plan 34-02'

patterns-established:
  - 'Per-field clamp + METRIC_DEFAULTS fallback pattern: AI value validated first, METRIC_DEFAULTS used only when AI value missing or invalid'

requirements-completed: [MODEL-03, ANLYS-09]

# Metrics
duration: 25min
completed: 2026-03-02
---

# Phase 34 Plan 02: AI Metric Derivation Implementation Summary

**AI-derived metric ranges (hoursSavedWeek, revenueLeakageRecovered, etc.) extracted from LLM response with clamp/sort validation; primarySourceType persisted to DB and shown as blue badge in admin FindingCard**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-02T15:57:00Z
- **Completed:** 2026-03-02T16:04:00Z
- **Tasks:** 3
- **Files modified:** 4 (+ 1 migration created)

## Accomplishments

- Extended `AIHypothesisItem` interface with 8 optional metric fields and `primarySourceType?`
- Added `clampInt`, `clampFloat`, and `VALID_SOURCE_TYPES` inside `generateHypothesisDraftsAI`
- Added instruction 6 to AI prompt: estimate hoursSavedWeek/handoffSpeedGainPct/errorReductionPct/revenueLeakageRecovered/primarySourceType per hypothesis
- Extended JSON schema example in prompt with all new metric fields
- Replaced unconditional `...METRIC_DEFAULTS` spread with per-field clamped AI values; METRIC_DEFAULTS retained as last-resort fallback `def` parameter
- Low/mid/high triples sorted ascending (tuple cast `as [number, number, number]` to satisfy TypeScript)
- Added `primarySourceType String?` column to `WorkflowHypothesis` in prisma/schema.prisma
- Created migration file and applied to running Docker DB
- Regenerated Prisma client
- Added `primarySourceType: hypothesis.primarySourceType` to `workflowHypothesis.create` in research-executor.ts
- Added `primarySourceType: string | null` to `Finding` type in analysis-section.tsx
- Updated `toFinding()` to extract `primarySourceType` for hypothesis kind (null for opportunities)
- Added blue source attribution badge in `FindingCard` pill row (renders only when primarySourceType is non-null)

## Task Commits

1. **Task 1: Extend types, add clamp helpers, update prompt and mapping in workflow-engine.ts** - `e930342` (feat)
2. **Task 2: Add primarySourceType DB column, migration, and update research-executor write** - `b1c5fd7` (feat)
3. **Task 3: Add source attribution badge to FindingCard in analysis-section.tsx** - `f434844` (feat)

## Files Created/Modified

- `lib/workflow-engine.ts` - AIHypothesisItem extended; clampInt/clampFloat/VALID_SOURCE_TYPES added; prompt updated with instruction 6 + schema example; METRIC_DEFAULTS spread replaced with per-field clamped mapping
- `prisma/schema.prisma` - primarySourceType String? added to WorkflowHypothesis model
- `prisma/migrations/20260302200000_add_hypothesis_primary_source_type/migration.sql` - ALTER TABLE migration (created)
- `lib/research-executor.ts` - primarySourceType added to workflowHypothesis.create data
- `components/features/prospects/analysis-section.tsx` - Finding type extended; toFinding extracts primarySourceType; FindingCard renders blue badge

## Decisions Made

- Tuple cast `.sort() as [number, number, number]` to avoid `number | undefined` TypeScript inference from array destructure — cleaner than non-null assertion on each element
- `primarySourceType` column placed between `revenueLeakageRecoveredHigh` and `status` in schema to avoid merge conflict with `AutomationOpportunity` which has identical trailing field patterns
- Pre-existing test failure ("uses reviews-first evidence ordering") confirmed out of scope — was already failing before Plan 34-02 (verified with `git stash`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type error from array destructure of sorted triple**

- **Found during:** Task 1 (TypeScript check after replacing METRIC_DEFAULTS spread)
- **Issue:** TypeScript inferred `[hLow, hMid, hHigh]` from `.sort()` as `number | undefined` because it does not know the array has exactly 3 elements. This caused TS2322 on `hoursSavedWeekLow: hLow`.
- **Fix:** Changed destructure to indexed access with explicit tuple cast: `.sort((a, b) => a - b) as [number, number, number]` with `hSorted[0]`, `hSorted[1]`, `hSorted[2]`.
- **Files modified:** `lib/workflow-engine.ts`
- **Commit:** e930342 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 TypeScript type inference bug)
**Impact on plan:** Fix was a minor implementation detail. No scope creep. All tests still GREEN.

## Issues Encountered

- None beyond the TypeScript type inference issue documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 MODEL-03/ANLYS-09 tests GREEN
- All 32 previously-passing tests still pass (36 total pass, 1 pre-existing failure out of scope)
- TypeScript compiles clean (zero errors)
- DB column deployed to Docker DB
- Prisma client regenerated
- UI badge ready for live display once research runs populate primarySourceType from AI

## Self-Check: PASSED

- `lib/workflow-engine.ts` — FOUND
- `prisma/schema.prisma` — FOUND
- `prisma/migrations/20260302200000_add_hypothesis_primary_source_type/migration.sql` — FOUND
- `lib/research-executor.ts` — FOUND
- `components/features/prospects/analysis-section.tsx` — FOUND
- Commit `e930342` (Task 1) — FOUND
- Commit `b1c5fd7` (Task 2) — FOUND
- Commit `f434844` (Task 3) — FOUND
- DB column primarySourceType on WorkflowHypothesis — FOUND (1 row returned)

---

_Phase: 34-ai-metric-derivation_
_Completed: 2026-03-02_
