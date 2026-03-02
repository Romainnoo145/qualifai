---
phase: 29-browser-rendered-evidence-extraction
plan: 02
subsystem: api
tags:
  [
    crawl4ai,
    scrapling,
    evidence-extraction,
    source-discovery,
    research-executor,
  ]

# Dependency graph
requires:
  - phase: 29-01
    provides: ingestWebsiteEvidenceDrafts with optional jsHeavyHints parameter (backwards-compatible)
  - phase: 28-source-discovery-with-provenance
    provides: jsHeavyHint field on DiscoveredUrl in SourceSet

provides:
  - research-executor passes pre-computed jsHeavyHints map to ingestWebsiteEvidenceDrafts
  - Phase 28 sourceSet jsHeavyHint values now flow through to extraction routing without re-computation

affects:
  - lib/web-evidence-adapter.ts (receives jsHeavyHints — no change needed, already accepts it)
  - Any re-run of research executor will use the persisted sourceSet hints

# Tech tracking
tech-stack:
  added: []
  patterns:
    - jsHeavyHints map constructed from initialSourceSet.urls via Map constructor + Array.map
    - Pre-computed hints from Phase 28 flow end-to-end without detectJsHeavy() re-execution

key-files:
  created: []
  modified:
    - lib/research-executor.ts (3-line addition: jsHeavyHints map + options pass-through)

key-decisions:
  - 'jsHeavyHints map uses all initialSourceSet.urls (not just non-serp filtered ones) — coverage is broader, but only researchUrls (non-serp) are passed to ingestWebsiteEvidenceDrafts so excess map entries are silently ignored'
  - 'deepCrawl ingestCrawl4aiEvidenceDrafts call left untouched — EXTR-03 budget applies only to website extraction path per Phase 29 research open question 2'

patterns-established:
  - 'Build hints map from sourceSet.urls before calling ingestion function — avoids pattern-matching re-computation in tight extraction loops'

requirements-completed: [EXTR-01, EXTR-02, EXTR-03]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 29 Plan 02: jsHeavyHints Wiring Summary

**research-executor passes pre-computed jsHeavyHints map from Phase 28 sourceSet into ingestWebsiteEvidenceDrafts, completing the Phase 28 → Phase 29 data flow without detectJsHeavy() re-execution**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T02:44:05Z
- **Completed:** 2026-03-02T02:49:22Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Wired jsHeavyHints map from `initialSourceSet.urls` into `ingestWebsiteEvidenceDrafts` call
- Phase 28 jsHeavyHint values now flow end-to-end through to extraction routing decisions
- Backwards-compatible: existing callers without sourceSet continue to work (detectJsHeavy() fallback in web-evidence-adapter.ts unchanged)
- Build passes cleanly, all 17 web-evidence-adapter tests still pass, zero lint errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire jsHeavyHints map from sourceSet into ingestWebsiteEvidenceDrafts** - `86e7978` (feat)

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/research-executor.ts` - Added jsHeavyHints Map construction from initialSourceSet.urls and passed via options to ingestWebsiteEvidenceDrafts (3-line addition at line 264)

## Decisions Made

- The jsHeavyHints map is built from all `initialSourceSet.urls` (not only the non-serp filtered subset passed to `ingestWebsiteEvidenceDrafts`). This is intentional: the Map may contain SERP-sourced URL hints, but since those URLs are never passed to `ingestWebsiteEvidenceDrafts` (researchUrls filters out serp provenance), the extra entries are silently ignored. Using the full set is simpler and covers any edge case where a URL appears in multiple provenances.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This is a pure code wiring change.

## Next Phase Readiness

- Phase 29 is now complete: two-tier extraction routing (Plan 01) + jsHeavyHints wiring (Plan 02)
- Phase 30 (pain confirmation gate + audit) can proceed
- Schema migration for painGatePassed/painGateDetails on ResearchRun and GateOverrideAudit model deferred to Phase 30 as planned

## Self-Check: PASSED

- lib/research-executor.ts: FOUND (jsHeavyHints map + options parameter verified at lines 264-269)
- 86e7978 (feat): FOUND
- 29-02-SUMMARY.md: FOUND

---

_Phase: 29-browser-rendered-evidence-extraction_
_Completed: 2026-03-02_
