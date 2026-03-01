---
phase: 26-quality-calibration
plan: 01
subsystem: api
tags: [quality, thresholds, calibration, evidence, traffic-light, idempotency]

# Dependency graph
requires:
  - phase: 26.1-evidence-pipeline-expansion
    provides: Expanded evidence pipeline with LINKEDIN, NEWS, REVIEWS source types active
  - phase: 25-pipeline-hardening
    provides: Research pipeline and hypothesis generation infrastructure

provides:
  - Centralised quality threshold constants in lib/quality-config.ts (MIN_EVIDENCE_COUNT, AMBER_MIN_SOURCE_TYPES, GREEN_MIN_SOURCE_TYPES, MIN_AVERAGE_CONFIDENCE)
  - computeTrafficLight reads thresholds from quality-config.ts constants (not hardcoded)
  - Hypothesis idempotency via delete-before-insert in executeResearchRun
  - Calibrated thresholds validated against 5 real prospects: 4 GREEN, 1 AMBER, 0 RED

affects:
  - Phase 27 (quality gate UI)
  - Any future plan touching computeTrafficLight or evidence quality scoring

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Threshold constants centralised in dedicated config file (not .env, not DB)
    - delete-before-insert pattern for hypothesis idempotency in research re-runs

key-files:
  created:
    - lib/quality-config.ts
  modified:
    - lib/workflow-engine.ts
    - lib/research-executor.ts

key-decisions:
  - 'MIN_AVERAGE_CONFIDENCE=0.65 kept as meaningful secondary signal after calibration (Brainport Eindhoven had 5 source types but avgConf 0.64 → AMBER)'
  - 'Thresholds approved as-is: GREEN_MIN_SOURCE_TYPES=3, AMBER_MIN_SOURCE_TYPES=2, MIN_EVIDENCE_COUNT=3, MIN_AVERAGE_CONFIDENCE=0.65'
  - 'AMBER is a HARD gate (not soft warn-and-proceed) — send queue blocked unless qualityApproved===true'
  - 'Active source types: WEBSITE, CAREERS, LINKEDIN, NEWS, REVIEWS (KVK/REGISTRY inactive — no API key)'

patterns-established:
  - 'Quality config pattern: threshold constants live in lib/quality-config.ts with JSDoc explaining semantic meaning'
  - 'Idempotency pattern: research re-runs delete existing hypotheses before inserting new ones (deleteMany before createMany)'

requirements-completed: [QUAL-01]

# Metrics
duration: 25min (split across two sessions with checkpoint)
completed: 2026-02-28
---

# Phase 26 Plan 01: Quality Calibration Summary

**Quality threshold constants centralised in lib/quality-config.ts, calibrated against 5 real prospects (4 GREEN, 1 AMBER, 0 RED), with hypothesis idempotency via delete-before-insert**

## Performance

- **Duration:** 25 min (Task 1 + checkpoint approval + Task 2 continuation)
- **Started:** 2026-02-28T00:00:00Z
- **Completed:** 2026-02-28T09:58:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `lib/quality-config.ts` with 4 exported threshold constants and semantic JSDoc comments explaining tier behavior
- Updated `computeTrafficLight` in `lib/workflow-engine.ts` to import and use constants from quality-config.ts (no hardcoded values)
- Fixed hypothesis idempotency bug in `lib/research-executor.ts` — delete-before-insert prevents old templates co-existing with new AI-generated hypotheses on re-run
- Admin reviewed calibration table for 5 real prospects using expanded pipeline and approved thresholds as-is

## Calibration Table (2026-02-28)

Real prospect data with full expanded evidence pipeline (WEBSITE, CAREERS, LINKEDIN, NEWS, REVIEWS active):

| Prospect             | Evidence Count | Source Types | Avg Confidence | Tier  |
| -------------------- | -------------- | ------------ | -------------- | ----- |
| Motion Design Awards | 43             | 5            | 0.68           | GREEN |
| De Ondernemer        | 42             | 5            | 0.68           | GREEN |
| Brainport Eindhoven  | 18             | 5            | 0.64           | AMBER |
| DuckDB               | 45             | 5            | 0.66           | GREEN |
| Mujjo                | 43             | 5            | 0.67           | GREEN |

**Distribution: 4 GREEN, 1 AMBER, 0 RED**

Brainport Eindhoven was classified AMBER because avgConf (0.64) fell below MIN_AVERAGE_CONFIDENCE (0.65) despite having 5 source types. Admin confirmed this is a meaningful distinction and the threshold should stay.

## Approved Threshold Constants

```ts
export const MIN_EVIDENCE_COUNT = 3; // Minimum items to avoid RED
export const AMBER_MIN_SOURCE_TYPES = 2; // 1 type → RED; 2 → AMBER; 3+ → GREEN
export const GREEN_MIN_SOURCE_TYPES = 3; // Must meet or exceed for GREEN
export const MIN_AVERAGE_CONFIDENCE = 0.65; // Secondary signal (meaningful)
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Create quality-config.ts and update computeTrafficLight + hypothesis idempotency** - `ae218ab` (feat)
2. **Task 2: Admin reviews calibration table and approves thresholds** - `7741993` (chore)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `lib/quality-config.ts` — Threshold constants with semantic comments; calibration date and distribution documented in header
- `lib/workflow-engine.ts` — computeTrafficLight now imports GREEN_MIN_SOURCE_TYPES, MIN_EVIDENCE_COUNT, MIN_AVERAGE_CONFIDENCE from quality-config.ts; JSDoc updated to reflect AMBER=hard gate
- `lib/research-executor.ts` — deleteMany({ where: { researchRunId: run.id } }) added before workflowHypothesis.createMany to ensure idempotency on re-run

## Decisions Made

- MIN_AVERAGE_CONFIDENCE=0.65 retained as meaningful secondary signal — Brainport Eindhoven showed that a prospect can have 5 source types but still have borderline evidence quality (avgConf 0.64)
- Thresholds approved without adjustment — the 4 GREEN, 1 AMBER, 0 RED distribution is reasonable: GREEN for solid web presence, AMBER for genuinely thin evidence quality
- AMBER is a hard gate — send queue requires qualityApproved===true for AMBER prospects (aligned with Phase 22 admin-review decision)
- KVK/REGISTRY source type not active (no API key) — not counted in calibration; thresholds set for 5-type pipeline

## Deviations from Plan

None - plan executed exactly as written. The checkpoint approval produced a minor addition: updating the calibration date comment from 2026-02-27 to 2026-02-28 and enriching the header with real calibration data.

## Issues Encountered

None. TypeScript check passed with zero errors on all changes.

## Next Phase Readiness

- Quality threshold system is live and calibrated — ready for Phase 27 quality gate UI work
- computeTrafficLight is now driven by named constants — future threshold adjustments only require changing quality-config.ts
- Hypothesis re-runs are idempotent — re-running research no longer creates duplicate rows

---

_Phase: 26-quality-calibration_
_Completed: 2026-02-28_
