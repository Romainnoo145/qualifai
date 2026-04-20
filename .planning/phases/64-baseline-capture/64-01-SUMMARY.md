---
phase: 64-baseline-capture
plan: 01
subsystem: testing
tags: [prisma, typescript, baseline, snapshots, json, validation]

# Dependency graph
requires: []
provides:
  - 8 ProspectAnalysis JSON snapshots in .planning/baselines/analysis/
  - scripts/capture-baseline.ts reusable capture script
  - Timestamped filenames (slug + analysisId + ISO timestamp) for idempotent reruns
affects: [69-e2e-validation, evidence-pipeline-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Baseline capture pattern: dotenv + PrismaPg, query + write per-record JSON'
    - 'Filename pattern: {readableSlug|slug}_{analysisId[-6:]}_{timestamp}.json prevents collision'
    - 'Inline post-capture validation: read-back, parse, check required fields, print summary table'

key-files:
  created:
    - scripts/capture-baseline.ts
    - .planning/baselines/analysis/ (8 JSON files)
  modified: []

key-decisions:
  - 'Include analysisId suffix in filename: prevents collision when a prospect has multiple ProspectAnalysis records (Heijmans had 2)'
  - 'Inline validation in main(): avoids a separate script file while confirming all snapshots are diffable'
  - 'Commit baseline files to git: planning artifacts for Phase 69 comparison, must persist across machines'

patterns-established:
  - 'Baseline capture scripts live in scripts/ and follow tmp-*.ts PrismaPg pattern but are not tmp- prefixed (permanent)'

requirements-completed: [VALID-01]

# Metrics
duration: 12min
completed: 2026-04-21
---

# Phase 64 Plan 01: Baseline Capture Summary

**8 ProspectAnalysis JSON snapshots captured to .planning/baselines/analysis/ with timestamped filenames for before/after pipeline comparison in Phase 69.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-20T22:27:15Z
- **Completed:** 2026-04-20T22:39:00Z
- **Tasks:** 2
- **Files modified:** 9 (1 script + 8 JSON snapshots)

## Accomplishments

- Created scripts/capture-baseline.ts using the established dotenv + PrismaPg pattern
- Captured all 8 ProspectAnalysis records (heijmans x2, mujjo, nedri-spanstaal-bv, marfa, gStHk4OG, qXGQngut, t63pSR0K)
- Post-capture validation inline in script: valid JSON, has content/slug/timestamp, summary table printed
- All snapshots are diffable via standard tools (diff, jq)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Create baseline capture script + validate snapshots** - `74db776` (feat)

**Plan metadata:** _(pending docs commit)_

## Files Created/Modified

- `scripts/capture-baseline.ts` - Standalone capture script, queries ProspectAnalysis with includes, writes timestamped JSON files, validates on completion
- `.planning/baselines/analysis/heijmans_iv3ymf_2026-04-20T22-27-47.json` - Heijmans analysis snapshot #1
- `.planning/baselines/analysis/heijmans_4dyels_2026-04-20T22-27-47.json` - Heijmans analysis snapshot #2
- `.planning/baselines/analysis/mujjo_y5q324_2026-04-20T22-27-47.json` - Mujjo snapshot
- `.planning/baselines/analysis/nedri-spanstaal-bv_7zonhj_2026-04-20T22-27-47.json` - Nedri Spanstaal snapshot
- `.planning/baselines/analysis/marfa_xeazma_2026-04-20T22-27-47.json` - Marfa snapshot
- `.planning/baselines/analysis/gStHk4OG_hfi17q_2026-04-20T22-27-47.json` - Raw slug prospect snapshot
- `.planning/baselines/analysis/qXGQngut_u02hhy_2026-04-20T22-27-47.json` - Raw slug prospect snapshot
- `.planning/baselines/analysis/t63pSR0K_ngtyyj_2026-04-20T22-27-47.json` - Raw slug prospect snapshot

## Decisions Made

- **analysisId suffix in filename:** Heijmans had 2 ProspectAnalysis records — naive slug + timestamp would overwrite. Added `id.slice(-6)` to guarantee uniqueness per analysis record.
- **Inline validation:** Task 2 called for validation; implemented it as a post-capture block within the same main() function to keep the codebase lean (no second script).
- **Commit snapshots to git:** Plan explicitly says "do NOT add to .gitignore" — files are planning artifacts needed on any machine for Phase 69 comparison.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added analysisId suffix to prevent filename collision**

- **Found during:** Task 1 (running the script)
- **Issue:** Two HeijMans ProspectAnalysis records both used readableSlug "heijmans" — second run silently overwrote first file
- **Fix:** Appended `id.slice(-6)` to filename: `{slug}_{analysisId[-6:]}_{timestamp}.json`
- **Files modified:** scripts/capture-baseline.ts
- **Verification:** Rerun produced 8 distinct files (confirmed with ls count)
- **Committed in:** 74db776 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix — without it, only 7 files would exist and one Heijmans analysis would be silently lost. No scope creep.

## Issues Encountered

- TypeScript error in validation block: `version` property missing from inline type annotation. Fixed immediately by adding `version?: string` to the parsed type.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- VALID-01 satisfied: all existing ProspectAnalysis records frozen as JSON baselines
- Phase 69 (E2E Validation) can diff any new analysis against these snapshots using `diff` or `jq`
- scripts/capture-baseline.ts is reusable — run again after v10.0 pipeline ships to capture "after" state
- 3 raw-slug prospects (gStHk4OG, qXGQngut, t63pSR0K) have no readableSlug — not a blocker but worth noting

---

_Phase: 64-baseline-capture_
_Completed: 2026-04-21_
