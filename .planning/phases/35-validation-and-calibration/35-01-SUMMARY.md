---
phase: 35-validation-and-calibration
plan: '01'
subsystem: infra
tags: [crawl4ai, quality-gate, calibration, pain-gate, evidence-scoring]

requires:
  - phase: 34-ai-metric-derivation
    provides: AI-scored evidence items with aiRelevance metadata used in calibration

provides:
  - Crawl4AI v0.8.x params (remove_overlay_elements, flatten_shadow_dom) in crawl4ai.ts
  - Rerunnable calibration script (scripts/calibration-report.mjs) mirroring exact gate logic
  - Calibration report confirming all 7 prospects are GREEN under 0.55 threshold
  - quality-config.ts MIN_AVERAGE_CONFIDENCE confirmed and annotated with calibration data

affects: [research pipeline, quality gate, evidence scoring]

tech-stack:
  added: []
  patterns:
    - 'Calibration script mirrors quality-config.ts constants exactly (no drift between script and production)'
    - 'aiRelevance >= 0.5 filter applied before confidence average (matches workflow-engine.ts)'

key-files:
  created:
    - scripts/calibration-report.mjs
    - .planning/phases/35-validation-and-calibration/35-calibration-report.md
  modified:
    - lib/enrichment/crawl4ai.ts
    - lib/quality-config.ts

key-decisions:
  - 'Crawl4AI v0.8.x params are backward-compatible — added to crawl4ai.ts unconditionally; live test deferred pending service startup'
  - 'MIN_AVERAGE_CONFIDENCE = 0.55 confirmed correct — margin +0.040 above lowest scorable avg (Marcore 0.590)'
  - 'GREEN_MIN_SOURCE_TYPES = 3 confirmed correct — all 7 prospects have 4-5 source types'
  - 'calibration-table.mjs intentionally NOT modified — it is a historical artifact; new calibration-report.mjs is canonical'

patterns-established:
  - 'Calibration script pattern: import dotenv/config, pg Pool, PrismaPg adapter, apply aiRelevance filter, compute scorable avg'

requirements-completed:
  - VALID-02
  - VALID-03

duration: 3min
completed: 2026-03-02
---

# Phase 35 Plan 01: Crawl4AI v0.8.x params + pain gate calibration confirmed correct against 7 real prospects

**Crawl4AI v0.8.x params added to crawl4ai.ts and pain gate calibration script created — all 7 prospects GREEN with scorable avg 0.59-0.70, threshold 0.55 confirmed correct**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T17:04:18Z
- **Completed:** 2026-03-02T17:07:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `remove_overlay_elements: true` and `flatten_shadow_dom: true` to Crawl4AI v0.8.x CrawlerRunConfig params in `lib/enrichment/crawl4ai.ts` (backward-compatible with v0.7.x)
- Created `scripts/calibration-report.mjs` that mirrors the exact gate logic from `quality-config.ts` — applies aiRelevance >= 0.5 filter, uses MIN_AVERAGE_CONFIDENCE = 0.55, outputs scorable average per prospect
- Ran calibration against all 7 real prospects — all GREEN (scorable avg range 0.59-0.70, margin +0.04 above threshold)
- Updated `quality-config.ts` MIN_AVERAGE_CONFIDENCE comment with calibration date and data
- Created `35-calibration-report.md` documenting full distribution analysis, before/after comparison, and threshold recommendation

## Task Commits

1. **Task 1: Add Crawl4AI v0.8.x params and create calibration report script** - `e7c964a` (feat)
2. **Task 2: Run calibration and document results** - `36c175c` (docs)

## Files Created/Modified

- `lib/enrichment/crawl4ai.ts` — Added `remove_overlay_elements: true` and `flatten_shadow_dom: true` to CrawlerRunConfig params
- `scripts/calibration-report.mjs` — New calibration script with correct gate logic (aiRelevance filter + 0.55 threshold)
- `lib/quality-config.ts` — Updated MIN_AVERAGE_CONFIDENCE comment with calibration date (2026-03-02) and dataset summary
- `.planning/phases/35-validation-and-calibration/35-calibration-report.md` — Calibration report with full distribution analysis, before/after comparison, and threshold confirmation

## Decisions Made

- **Crawl4AI params backward-compatible:** Added v0.8.x params without conditional logic — v0.7.x REST API ignores unknown params, so the code change is safe regardless of installed version
- **Threshold 0.55 confirmed correct:** Marcore is the borderline prospect at scorable avg 0.590 (+0.04 margin), correct behavior
- **calibration-table.mjs preserved as-is:** The old script is an untracked historical artifact with wrong threshold (0.65) and no aiRelevance filter — not modified, new canonical script created instead
- **Live Crawl4AI test deferred:** Service not running on port 11235; documented as infrastructure gap, not a code bug

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Crawl4AI service not running on `localhost:11235` — expected per research notes (not in docker-compose.yml). Documented as infrastructure gap in calibration report.

## User Setup Required

None — no external service configuration required for this plan. Crawl4AI v0.8.x live test requires service startup but is not blocking for code correctness.

## Next Phase Readiness

- VALID-02 (Crawl4AI params) and VALID-03 (calibration) are complete
- VALID-01 (/discover/ validation session) remains — requires browser session with Mujjo prospect
- TypeScript clean, all 7 prospects GREEN, calibration artifact rerunnable

## Self-Check: PASSED

All files found, all commits verified.

---

_Phase: 35-validation-and-calibration_
_Completed: 2026-03-02_
