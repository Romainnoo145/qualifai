---
phase: 28-source-discovery-with-provenance
plan: 02
subsystem: api
tags:
  [source-discovery, provenance, research-executor, trpc, serp-cache, snapshot]

requires:
  - phase: 28-01
    provides: buildSourceSet, defaultResearchUrls, extractSourceSet, SourceSet type from source-discovery.ts

provides:
  - executeResearchRun now builds and persists sourceSet to inputSnapshot on every run
  - researchUrls derived from sourceSet.urls (provenance-tagged, deduped, capped)
  - deepCrawl block rebuilds sourceSet with SERP URLs after SERP discovery completes
  - rediscoverSources tRPC mutation with 24h SERP cache guard and force bypass
  - Single canonical SERP cache check via serpDiscoveredAt (sourceSet-level)

affects:
  - 28-03 (UI can read sourceSet.urls with provenance, rawCounts from inputSnapshot)
  - 29 (browser extraction pipeline reads jsHeavyHint from sourceSet.urls)

tech-stack:
  added: []
  patterns:
    - 'Dual-phase sourceSet: initial (sitemap+default) at run create, full (sitemap+serp+default) after deepCrawl SERP'
    - 'SERP cache guard at sourceSet level (serpDiscoveredAt) as primary; legacy serpCache as fallback'
    - 'Spread-existing-snapshot pattern: toJson({ ...existingFields, sourceSet }) preserves all prior fields'
    - 'nonReviewManualUrls included in default bucket of sourceSet — provenance "default", not a separate bucket'

key-files:
  created: []
  modified:
    - lib/research-executor.ts
    - server/routers/research.ts

key-decisions:
  - 'sourceSet built in two phases: initial (no SERP) at run create, fullSourceSet (with SERP) after deepCrawl runs — avoids restructuring the existing pipeline flow'
  - 'researchUrls derived from sourceSet.urls filtered to non-serp provenance — SERP URLs go to Crawl4AI, not website ingestion'
  - 'rediscoverSources mutation defines toJson inline (research-executor does not export it) — simple 1-line cast'
  - 'deepCrawl isCacheValid uses useSerpFromSourceSet (sourceSet-level) OR legacy serpCache — backward compatible with pre-28 runs'

patterns-established:
  - 'sourceSet persisted to inputSnapshot alongside sitemapCache/serpCache — both maintained for backward compatibility until Phase 29 deprecation'
  - 'extractSourceSet() used in both executor and tRPC mutation to safely read prior sourceSet from JSON blob'

requirements-completed: [DISC-01, DISC-03]

duration: 5min
completed: 2026-03-02
---

# Phase 28 Plan 02: Wire buildSourceSet into Executor and Add rediscoverSources Summary

**buildSourceSet() integrated into executeResearchRun with dual-phase sourceSet persistence and a rediscoverSources tRPC mutation with 24h SERP cache guard — provenance flows from discovery through to inputSnapshot on every research run.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-01T22:28:16Z
- **Completed:** 2026-03-01T22:33:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Integrated `buildSourceSet()` into `executeResearchRun` — every run now builds and persists a `sourceSet` to `inputSnapshot`, removing the ad-hoc URL assembly
- Removed local `defaultResearchUrls` function from `research-executor.ts` — now imported from `source-discovery.ts` (single source of truth)
- `researchUrls` derived from `initialSourceSet.urls` (non-SERP provenance bucket) instead of the prior sitemapUrls/defaultUrls ad-hoc logic
- Added `rediscoverSources` tRPC mutation to `research.ts` router — allows admin to refresh sourceSet independently of a full research run, with 24h SERP cache guard and `force` bypass

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate buildSourceSet into research executor** - `ed840ed` (feat)
2. **Task 2: Add rediscoverSources tRPC mutation** - `d5ea104` (feat)

## Files Created/Modified

- `lib/research-executor.ts` — Added buildSourceSet import, removed local defaultResearchUrls, added priorSourceSet extraction, builds initialSourceSet + fullSourceSet (deepCrawl), derives researchUrls from sourceSet.urls
- `server/routers/research.ts` — Added imports for discoverSitemapUrls, discoverSerpUrls, buildSourceSet, defaultResearchUrls, extractSourceSet; added rediscoverSources mutation

## Decisions Made

- **Dual-phase sourceSet:** Initial sourceSet (sitemap + default, no SERP) built at run create time; full sourceSet (sitemap + SERP + default) built inside deepCrawl block after SERP runs. Avoids restructuring the existing pipeline; preserves the natural flow where SERP is gated behind deepCrawl.
- **researchUrls filtered to non-serp:** `initialSourceSet.urls.filter(u => u.provenance !== 'serp')` — SERP URLs feed Crawl4AI (deepCrawl), not the website ingestion pipeline. Matches existing behavior.
- **Backward-compatible isCacheValid:** deepCrawl block checks `useSerpFromSourceSet` (sourceSet-level) first, then falls back to legacy `serpCache` — runs that predate the sourceSet field still benefit from serpCache.
- **toJson inline in research.ts:** `research-executor.ts` does not export `toJson`; defining it inline in the router is the simplest approach (single 1-line cast).

## Deviations from Plan

None — plan executed exactly as written. The dual-phase sourceSet approach (initial at run create, full after deepCrawl SERP) was an implementation detail within the spirit of the plan — the plan described building sourceSet "after sitemap + SERP discovery completes" which naturally maps to the two-phase approach given the existing pipeline structure.

## Issues Encountered

None — TypeScript strict mode passed cleanly on first attempt for both tasks.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `inputSnapshot.sourceSet` is now populated on every research run (new runs) — Plan 28-03 can read `rawCounts` and `provenance` from the sourceSet for the UI panel
- `rediscoverSources` mutation is callable from UI (Plan 28-03) to trigger re-discovery
- `jsHeavyHint` on `DiscoveredUrl` entries is available for Phase 29 browser extraction routing
- `sitemapCache` and `serpCache` still written alongside `sourceSet` — Phase 29 can deprecate them safely

---

_Phase: 28-source-discovery-with-provenance_
_Completed: 2026-03-02_

## Self-Check: PASSED

- FOUND: lib/research-executor.ts
- FOUND: server/routers/research.ts
- FOUND: .planning/phases/28-source-discovery-with-provenance/28-02-SUMMARY.md
- FOUND: commit ed840ed (feat: buildSourceSet integration in research-executor.ts)
- FOUND: commit d5ea104 (feat: rediscoverSources mutation in research.ts)
