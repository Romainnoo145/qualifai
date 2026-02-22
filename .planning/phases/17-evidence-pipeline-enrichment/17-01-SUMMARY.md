---
phase: 17-evidence-pipeline-enrichment
plan: '01'
subsystem: api
tags: [sitemapper, serpapi, enrichment, sitemap, google-search]

requires: []
provides:
  - discoverSitemapUrls function in lib/enrichment/sitemap.ts (returns filtered, capped URL list from sitemap.xml)
  - SitemapCache interface for snapshot caching pattern
  - discoverGoogleSearchMentions function in lib/enrichment/serp.ts (3 NL Google queries, up to 12 mentions)
  - GoogleSearchMention interface with url, title, snippet fields
affects:
  - 17-evidence-pipeline-enrichment (Plan 03 wires these into executeResearchRun)
  - 18-research-quality-gate (richer evidence pool enables meaningful quality scoring)

tech-stack:
  added: [sitemapper@4.1.4]
  patterns:
    - 'Sitemap discovery: Sitemapper instance with timeout/concurrency/retries, filter by domain + non-content extensions, cap at 25'
    - 'Google Search mentions: 3 sequential NL-targeted queries, per-query try/catch, cap at 12 total'
    - 'SERP_API_KEY guard: check process.env directly (not env.mjs) for testability — consistent with discoverSerpUrls'
    - 'Lazy serpConfig.api_key init before each SERP call'

key-files:
  created:
    - lib/enrichment/sitemap.ts
  modified:
    - lib/enrichment/serp.ts
    - package.json

key-decisions:
  - 'Sitemapper catch block does not log errors — sitemap absence is normal for Dutch SMBs, not a warning condition'
  - 'discoverGoogleSearchMentions placed before discoverSerpUrls in serp.ts for logical grouping (search → maps flow)'
  - 'snippet.length > 30 filter excludes stub results with near-empty snippets from organic_results'

patterns-established:
  - 'Enrichment module guard: return [] / empty result immediately when API key missing — enables offline testing without mocking'
  - 'Per-query try/catch in multi-query functions: one failed query must not abort the others'

duration: 3min
completed: 2026-02-22
---

# Phase 17 Plan 01: Sitemap and Google Search Enrichment Sources Summary

**Sitemapper-based sitemap URL discovery and 3-query NL Google Search mention discovery via SerpAPI, both gated on env vars and returning [] on any failure.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-22T15:47:00Z
- **Completed:** 2026-02-22T15:50:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `lib/enrichment/sitemap.ts` with `discoverSitemapUrls` (domain → filtered URL array) and `SitemapCache` interface
- Extended `lib/enrichment/serp.ts` with `discoverGoogleSearchMentions` (3 NL Google Search queries, up to 12 mention objects) without breaking any existing exports or tests
- Installed `sitemapper` v4.1.4; all 6 existing `serp.test.ts` tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sitemap URL discovery module** - `b97b7a9` (feat)
2. **Task 2: Add Google search mention discovery to serp.ts** - `b761f0d` (feat)

## Files Created/Modified

- `lib/enrichment/sitemap.ts` - Sitemap URL discovery: Sitemapper fetch, domain filter, extension filter, 25-URL cap, silent [] on error
- `lib/enrichment/serp.ts` - Extended with GoogleSearchMention interface and discoverGoogleSearchMentions function (3 sequential Google queries)
- `package.json` / `package-lock.json` - Added sitemapper@4.1.4 dependency

## Decisions Made

- Sitemapper catch block omits `console.error` — sitemap absence is structural for many Dutch SMBs, not a warning condition worth logging
- `snippet.length > 30` filter removes stub organic results that have near-empty snippets
- New function `discoverGoogleSearchMentions` placed before `discoverSerpUrls` in serp.ts for logical grouping (text search before maps/jobs)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required beyond the existing `SERP_API_KEY` already documented.

## Next Phase Readiness

- Both enrichment source functions are type-safe and ready for Plan 03 to wire into `executeResearchRun`
- Plan 02 (LinkedIn + KvK enrichment sources) can proceed independently in wave 1
- No blockers

---

_Phase: 17-evidence-pipeline-enrichment_
_Completed: 2026-02-22_
