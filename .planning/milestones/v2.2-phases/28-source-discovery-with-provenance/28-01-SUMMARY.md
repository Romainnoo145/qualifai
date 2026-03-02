---
phase: 28-source-discovery-with-provenance
plan: 01
subsystem: api
tags:
  [
    source-discovery,
    url-dedup,
    provenance,
    js-heavy-detection,
    pure-functions,
    vitest,
    tdd,
  ]

requires: []
provides:
  - DiscoveredUrl, SourceSet, UrlProvenance types for URL discovery pipeline
  - buildSourceSet() pure function: cap → merge → dedup (first-wins) → jsHeavyHint → rawCounts
  - normalizeUrlForDedup() for scheme/www/trailing-slash normalisation
  - detectJsHeavy() matching 12 JS-heavy domain/pattern rules
  - defaultResearchUrls() extracted from research-executor.ts (19 Dutch + English paths)
  - extractSourceSet() for safe extraction of SourceSet from inputSnapshot JSON
  - CAPS constants (sitemap:25, serp:15, default:20)
affects:
  - 28-02 (research executor imports buildSourceSet, defaultResearchUrls, extractSourceSet)
  - 28-03 (UI reads rawCounts and provenance from SourceSet)

tech-stack:
  added: []
  patterns:
    - 'Pure module pattern: zero side effects, no Prisma, no network — import only stdlib URL'
    - 'First-wins dedup: sitemap > serp > default provenance order on collision'
    - 'Cap-before-merge: each source sliced to CAPS limit before merging to keep rawCounts accurate'

key-files:
  created:
    - lib/enrichment/source-discovery.ts
    - lib/enrichment/source-discovery.test.ts
  modified: []

key-decisions:
  - 'defaultResearchUrls has 19 paths (not 17 as plan stated) — copied verbatim from research-executor.ts'
  - 'CAPS.serp=15 covers 5 review + 5 job + 5 google-search-mentions matching serp.ts behaviour'
  - 'detectJsHeavy uses regex array with case-insensitive flag — simple and readable'
  - 'extractSourceSet validates presence of urls (array), discoveredAt, and rawCounts fields before returning'

patterns-established:
  - 'source-discovery.ts: pure module with zero side effects, safe to test without mocking'
  - 'Non-null assertions (!) on array index access in tests after explicit length assertions'

requirements-completed: [DISC-01, DISC-02, DISC-04, DISC-05]

duration: 5min
completed: 2026-03-02
---

# Phase 28 Plan 01: Source Discovery with Provenance Summary

**Pure source-discovery.ts module with buildSourceSet(), cap/dedup/provenance/jsHeavyHint logic, 55 Vitest unit tests, all passing — zero side effects, typed foundation for Phase 28 Plans 02 and 03.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-01T22:20:02Z
- **Completed:** 2026-03-01T22:25:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `lib/enrichment/source-discovery.ts` — pure module with all types, constants, and functions the research executor and UI depend on
- Extracted `defaultResearchUrls()` verbatim from `research-executor.ts` (19 Dutch + English paths) — executor can now import from single source
- Created `lib/enrichment/source-discovery.test.ts` with 55 tests covering cap enforcement, dedup (trailing slash, scheme, www), provenance order, jsHeavyHint detection, rawCounts, extractSourceSet, and normalizeUrlForDedup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create source-discovery.ts with types and pure functions** - `e23062a` (feat)
2. **Task 2: TDD tests for buildSourceSet — cap, dedup, provenance, jsHeavyHint** - `463895d` (test)

## Files Created/Modified

- `lib/enrichment/source-discovery.ts` — DiscoveredUrl, SourceSet, UrlProvenance types; CAPS constants; buildSourceSet(), normalizeUrlForDedup(), detectJsHeavy(), defaultResearchUrls(), extractSourceSet()
- `lib/enrichment/source-discovery.test.ts` — 55 unit tests across 9 describe blocks

## Decisions Made

- `defaultResearchUrls` has 19 paths (plan stated 17) — copied verbatim from `research-executor.ts`, plan count was an approximation
- `CAPS.serp = 15` aligns with 5 review + 5 job + 5 google-search-mentions from `serp.ts`
- `extractSourceSet` validates three fields (`urls` as array, `discoveredAt` as truthy, `rawCounts` as truthy) before returning to avoid silent bad data propagation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict-mode errors on array index access in test file**

- **Found during:** Task 2 (TDD tests) — post-write tsc check
- **Issue:** Array indexing `result.urls[0]` returns `T | undefined` under strict TypeScript; 12 TS2532 errors
- **Fix:** Added non-null assertions `!` (`result.urls[0]!`) at all array index access sites where test context guarantees the element exists
- **Files modified:** `lib/enrichment/source-discovery.test.ts`
- **Verification:** `npx tsc --noEmit` exits with 0 errors; 55 tests still pass
- **Committed in:** `463895d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript strict-mode correctness)
**Impact on plan:** Minimal — test file only, no behaviour change. Required for project's strict TypeScript config.

## Issues Encountered

None — plan executed cleanly. `defaultResearchUrls` path count discrepancy (19 vs 17 in plan) was a documentation approximation in the plan, not an error.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `source-discovery.ts` exports all types and functions needed by Plan 02 (research executor) and Plan 03 (UI)
- Zero Prisma/DB imports — safe to use in both server and edge contexts
- 55 tests passing, TypeScript strict clean
- `research-executor.ts` still has its own copy of `defaultResearchUrls` — Plan 02 should update the import

---

_Phase: 28-source-discovery-with-provenance_
_Completed: 2026-03-02_

## Self-Check: PASSED

- FOUND: lib/enrichment/source-discovery.ts
- FOUND: lib/enrichment/source-discovery.test.ts
- FOUND: .planning/phases/28-source-discovery-with-provenance/28-01-SUMMARY.md
- FOUND: commit e23062a (feat: source-discovery.ts)
- FOUND: commit 463895d (test: 55 unit tests)
