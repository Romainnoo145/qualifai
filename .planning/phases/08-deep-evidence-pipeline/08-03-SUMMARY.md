---
phase: 08-deep-evidence-pipeline
plan: '03'
subsystem: api
tags: [serp, crawl4ai, research, evidence, trpc, pipeline]

# Dependency graph
requires:
  - phase: 08-deep-evidence-pipeline/08-01
    provides: discoverSerpUrls function and SerpDiscoveryResult type from lib/enrichment/serp.ts
  - phase: 08-deep-evidence-pipeline/08-02
    provides: ingestCrawl4aiEvidenceDrafts function from lib/enrichment/crawl4ai.ts
provides:
  - executeResearchRun with deepCrawl branch — SerpAPI + Crawl4AI triggered when deepCrawl:true
  - startRun tRPC mutation accepts deepCrawl boolean flag
  - retryRun reads deepCrawl from inputSnapshot, preserves it across retries
  - SerpAPI 24h result cache stored in ResearchRun.inputSnapshot
  - SERP-discovered evidence deduped before persistence via existing dedupeEvidenceDrafts
affects: [09-engagement-triggers, 10-cadence-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'deepCrawl flag as opt-in enrichment gate — default false, no side effects when absent'
    - 'allDrafts accumulator pattern — collect all evidence sources before single dedup+cap pass'
    - 'SerpAPI cache in inputSnapshot JSON — 24h TTL checked at execution start, written on cache miss'
    - 'extractSerpCache helper — typed extraction of SerpDiscoveryResult from JSON snapshot'

key-files:
  created: []
  modified:
    - lib/research-executor.ts
    - server/routers/research.ts

key-decisions:
  - 'deepCrawl branch placed after base evidence collection, before dedup — cleanest integration point'
  - 'allDrafts accumulator replaces immediate dedup — allows SERP drafts to merge naturally before slice(0, 24)'
  - 'Cache stored in inputSnapshot alongside manualUrls/campaignId — no new DB column needed'
  - 'Cache read from existingRunId snapshot, not run.id — avoids reading the just-written update'

patterns-established:
  - 'Optional pipeline enrichment: check flag first, no calls if false — preserves zero-cost default path'
  - 'Snapshot cache pattern: read before API call, write after miss, skip write on hit'

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 8 Plan 03: Deep Evidence Pipeline Wiring Summary

**deepCrawl:true on startRun triggers SerpAPI URL discovery + Crawl4AI extraction, merging up to 10 additional evidence drafts into the existing approval pipeline with 24h SerpAPI result caching**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T19:05:15Z
- **Completed:** 2026-02-20T19:07:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `startRun` and `retryRun` mutations both accept and forward `deepCrawl` flag
- `executeResearchRun` wires SerpAPI discovery + Crawl4AI extraction when `deepCrawl: true`
- SERP results cached in `ResearchRun.inputSnapshot` with 24h TTL — retries reuse cache
- SERP-discovered evidence merges into existing draft collection before single dedup+cap pass
- When `deepCrawl` is absent or false, function executes identically to pre-Phase-8 behavior
- All 43 existing tests pass, TypeScript type check clean, 0 lint errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deepCrawl flag to tRPC mutation and executor input** - `a6e35bc` (feat)
2. **Task 2: Wire SerpAPI discovery and Crawl4AI extraction into executeResearchRun** - `25fa881` (feat)

## Files Created/Modified

- `server/routers/research.ts` - Added `deepCrawl: z.boolean().default(false)` to startRun schema; reads deepCrawl from inputSnapshot in retryRun
- `lib/research-executor.ts` - Added deepCrawl input field, imports for serp/crawl4ai modules, extractSerpCache helper, allDrafts accumulator pattern, deepCrawl branch with cache logic

## Decisions Made

- `allDrafts` accumulator replaces immediate dedup — existing evidence sources collected first, SERP sources appended if deepCrawl, single `dedupeEvidenceDrafts().slice(0, 24)` call at end. Clean zero-overhead default path.
- Cache stored in `inputSnapshot` JSON alongside `manualUrls`/`campaignId` — no schema migration needed, consistent with existing snapshot pattern.
- Cache read from `existingRunId` snapshot (fetched fresh), not from `run` — `run` was just updated in the update branch so its snapshot would contain the stale pre-deepCrawl data.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- TypeScript showed "unused imports" after Task 1 in isolation (expected, as imports are consumed in Task 2). Implemented both tasks before committing to ensure clean type check.

## User Setup Required

None - no external service configuration required. SERP_API_KEY and CRAWL4AI_BASE_URL env vars were added in Phase 8 Plan 01.

## Next Phase Readiness

- Deep evidence pipeline is fully wired end-to-end: SerpAPI discovery -> Crawl4AI extraction -> evidence draft merge -> approval gate (Phase 7) -> hypothesis/opportunity generation
- Phase 9 (Engagement Triggers) can now include deepCrawl runs as a signal source
- SerpAPI caching ensures Phase 9 re-runs of the same prospect within 24h are cost-free on the SERP side

## Self-Check: PASSED

All files confirmed present on disk. All task commits verified in git log.

---

_Phase: 08-deep-evidence-pipeline_
_Completed: 2026-02-21_
