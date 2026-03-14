---
phase: 53-klarifai-narrative-pipeline
plan: '02'
subsystem: pipeline
tags: [research-executor, discover-page, narrative, use-cases, typescript]

# Dependency graph
requires:
  - phase: 53-01
    provides: generateKlarifaiNarrativeAnalysis, KlarifaiNarrativeInput, KlarifaiNarrativeAnalysis types
provides:
  - Research executor Klarifai narrative analysis block (non-ATLANTIS)
  - Discover page fetches and renders narrative for all project types
  - DashboardClient renders use case recommendations with category badges and outcome pills
affects: [discover-page, research-executor, prospect-dashboard-client]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Research executor else-branch (non-ATLANTIS) runs Klarifai narrative analysis after RAG skip diagnostic
    - Use Cases fetched from DB (isActive + isShipped, capped at 20, ordered by updatedAt)
    - prospectAnalysis fetch unified for all project types (no projectType guard)
    - hasNarrative + activeNarrative computed vars unify Atlantis/Klarifai narrative render paths
    - Step 2 three-way dispatch: Atlantis (spvRecommendations) → Klarifai (useCaseRecommendations) → legacy

key-files:
  created: []
  modified:
    - lib/research-executor.ts
    - app/discover/[slug]/page.tsx
    - components/public/prospect-dashboard-client.tsx

key-decisions:
  - 'Remove redundant `!== ATLANTIS` guard inside else-branch — TypeScript already narrows type to KLARIFAI'
  - 'klarifaiCrossConnections uses separate variable name to avoid shadowing the ATLANTIS crossConnections'
  - 'hasNarrative and activeNarrative computed at component top-level to unify all four step sections'
  - 'Three-way dispatch in Step 2: Atlantis narrative → Klarifai narrative → legacy use case cards'

patterns-established:
  - 'Non-ATLANTIS research runs now produce analysis-v2 narrative in ProspectAnalysis table'
  - 'parseKlarifaiNarrativeAnalysis validates useCaseRecommendations array (vs spvRecommendations for Atlantis)'

requirements-completed: [KNAR-02, KNAR-03]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 53 Plan 02: Klarifai Narrative Pipeline — Executor Wiring and Discover Rendering Summary

**End-to-end Klarifai narrative pipeline: research executor generates analysis-v2 with use case recommendations for non-ATLANTIS prospects, discover page renders the narrative in all four wizard steps**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T08:25:36Z
- **Completed:** 2026-03-14T08:29:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Wired generateKlarifaiNarrativeAnalysis into research executor non-ATLANTIS else-branch
- Fetch active isShipped use cases (capped at 20) from DB as domain knowledge
- Cross-prospect connection detection mirrors Atlantis path (separate variable to avoid shadowing)
- Persist analysis-v2 to ProspectAnalysis table with modelUsed and inputSnapshot
- Changed prospectAnalysis fetch in page.tsx to work for all project types
- Added parseKlarifaiNarrativeAnalysis (validates useCaseRecommendations array)
- Added klarifaiNarrativeAnalysis prop to DashboardClientProps and destructuring
- Computed hasNarrative and activeNarrative to unify render logic across 4 wizard steps
- Step 0: opening hook, title, date label, executive summary use hasNarrative
- Step 1: heading uses 'Geidentificeerde Pijnpunten' for Klarifai, 'Strategische Kansen' for Atlantis
- Step 2: three-way dispatch renders useCaseRecommendations with category badges and outcome pills
- All legacy fallback rendering (hypothesis cards, use case cards) preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Klarifai narrative analysis into research executor** - `d9569bf` (feat)
2. **Task 2: Update discover page to render Klarifai narrative analysis** - `a366bcc` (feat)

## Files Created/Modified

- `lib/research-executor.ts` - Added generateKlarifaiNarrativeAnalysis import + Klarifai analysis block in non-ATLANTIS path
- `app/discover/[slug]/page.tsx` - Added KlarifaiNarrativeAnalysis import, parseKlarifaiNarrativeAnalysis, unified prospectAnalysis fetch, klarifaiNarrativeAnalysis prop
- `components/public/prospect-dashboard-client.tsx` - Added KlarifaiNarrativeAnalysis import, prop, hasNarrative/activeNarrative computed vars, updated all 4 step sections

## Decisions Made

- Removed redundant `!== 'ATLANTIS'` guard inside else-branch — TypeScript already narrows type to KLARIFAI at that point
- Used separate `klarifaiCrossConnections` variable inside the Klarifai block to avoid shadowing outer `crossConnections` from ATLANTIS path
- `hasNarrative` and `activeNarrative` computed at component top-level to cleanly unify Atlantis and Klarifai narrative rendering
- Three-way dispatch in Step 2: Atlantis narrative SPVs first, then Klarifai use case recommendations, then legacy cards

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete Klarifai narrative pipeline is now wired end-to-end
- Phase 53 (2 of 2 plans) is complete
- Ready for E2E validation: run a research run on a Klarifai prospect and verify analysis-v2 appears on /discover/

---

_Phase: 53-klarifai-narrative-pipeline_
_Completed: 2026-03-14_

## Self-Check: PASSED

- lib/research-executor.ts: FOUND
- app/discover/[slug]/page.tsx: FOUND
- components/public/prospect-dashboard-client.tsx: FOUND
- .planning/phases/53-klarifai-narrative-pipeline/53-02-SUMMARY.md: FOUND
- Commit d9569bf: FOUND
- Commit a366bcc: FOUND
