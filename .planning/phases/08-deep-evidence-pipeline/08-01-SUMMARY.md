---
phase: 08-deep-evidence-pipeline
plan: 01
subsystem: api
tags: [serpapi, google-maps, google-jobs, tdd, url-discovery, enrichment]

# Dependency graph
requires:
  - phase: 07-evidence-approval-gate
    provides: Evidence approval gate ensuring SerpAPI results go through review before use
provides:
  - SerpAPI URL discovery client (discoverSerpUrls) for review and job listing URL discovery
  - SerpDiscoveryResult interface with reviewUrls, jobUrls, mapsDataId, discoveredAt
  - SERP_API_KEY and CRAWL4AI_BASE_URL env var configuration
affects: [08-02-crawl4ai-client, 08-deep-evidence-pipeline]

# Tech tracking
tech-stack:
  added: [serpapi@^2.2.1]
  patterns:
    - process.env.SERP_API_KEY direct access (not env.mjs) for test isolation
    - Lazy API key init via serpConfig.api_key before each call
    - Two-step SerpAPI flow (google_maps -> google_maps_reviews via data_id)
    - Per-engine try/catch with console.error, non-blocking failures
    - Result capping (slice(0, 5)) to control downstream scraping cost

key-files:
  created:
    - lib/enrichment/serp.ts
    - lib/enrichment/serp.test.ts
  modified:
    - env.mjs
    - .env.example
    - package.json

key-decisions:
  - 'discoverSerpUrls accesses process.env.SERP_API_KEY directly (not env.mjs) to keep module testable without full env setup'
  - 'Google Maps uses two-step flow: fetch data_id from google_maps, then reviews from google_maps_reviews using that data_id'
  - 'Each SerpAPI engine call wrapped in independent try/catch - failures are logged but non-blocking, returns partial results'
  - 'Results capped at 5 reviewUrls and 5 jobUrls to control Crawl4AI scraping cost downstream'
  - 'mapsDataId included in result for cache persistence - allows skipping google_maps call on re-enrichment'

patterns-established:
  - 'URL Discovery pattern: SerpAPI finds URLs, Crawl4AI extracts content (discovery and extraction are separate concerns)'
  - 'Optional API key guard: check key at function start, return empty result without throwing when missing'

# Metrics
duration: ~15min
completed: 2026-02-21
---

# Phase 8 Plan 01: SerpAPI URL Discovery Client Summary

**SerpAPI client with two-step Google Maps review discovery and Google Jobs URL extraction, capped at 5 results each, with graceful degradation when API key is absent**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-21T01:50:00Z
- **Completed:** 2026-02-21T02:05:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- SerpAPI npm package installed and both SERP_API_KEY and CRAWL4AI_BASE_URL declared as optional env vars
- `discoverSerpUrls` function implemented with full TDD (RED -> GREEN -> passing) and 6 test cases
- Two-step Google Maps flow: first call fetches `data_id` from `google_maps`, second call uses `data_id` to fetch reviews from `google_maps_reviews`
- Google Jobs discovery extracts `link` or `apply_options[0].link` from each job result
- Graceful degradation: missing SERP_API_KEY returns empty arrays without throwing; each engine call is independently try/caught

## Task Commits

Each task was committed atomically:

1. **Task 1: Install serpapi package and add env vars** - `fc42402` (chore)
2. **Task 2 RED: Add failing tests for SerpAPI URL discovery client** - `217ca8f` (test)
3. **Task 2 GREEN: Implement SerpAPI URL discovery client** - `c970f93` (feat)

_Note: TDD task had two commits (test RED -> feat GREEN)._

## Files Created/Modified

- `lib/enrichment/serp.ts` - SerpAPI URL discovery client, exports `discoverSerpUrls` and `SerpDiscoveryResult`
- `lib/enrichment/serp.test.ts` - 6 unit tests with mocked serpapi, covers all plan-specified behaviors
- `env.mjs` - Added `SERP_API_KEY` and `CRAWL4AI_BASE_URL` as optional server env vars
- `.env.example` - Documented both vars under "Deep evidence pipeline (Phase 8)" section
- `package.json` - Added serpapi ^2.2.1 dependency

## Decisions Made

- Used `process.env.SERP_API_KEY` directly (not via env.mjs import) to keep the module testable without full env setup. This is consistent with the lazy init pattern used for Anthropic client.
- `mapsDataId` is returned in the result for future cache optimization - callers can store it and skip the first google_maps call on re-enrichment.
- Results capped at 5 per type to control downstream Crawl4AI scraping cost, which compounds fast.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External service requires manual configuration.**

To use SerpAPI URL discovery, set the following environment variable:

```bash
SERP_API_KEY="your-serpapi-key"
```

Get your API key from: [serpapi.com Dashboard -> API Key](https://serpapi.com/dashboard) (free tier: 250 searches/month)

## Next Phase Readiness

- `discoverSerpUrls` is ready for integration into the evidence enrichment pipeline
- `SerpDiscoveryResult.reviewUrls` and `jobUrls` arrays are ready for Crawl4AI content extraction (Plan 08-02)
- CRAWL4AI_BASE_URL env var is declared and ready for Plan 08-02 to use
- No blockers for Phase 8 Plan 02

---

_Phase: 08-deep-evidence-pipeline_
_Completed: 2026-02-21_

## Self-Check: PASSED

- FOUND: lib/enrichment/serp.ts
- FOUND: lib/enrichment/serp.test.ts
- FOUND: env.mjs
- FOUND: .env.example
- FOUND commit: fc42402 (chore - Task 1)
- FOUND commit: 217ca8f (test - Task 2 RED)
- FOUND commit: c970f93 (feat - Task 2 GREEN)
