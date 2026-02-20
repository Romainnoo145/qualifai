---
phase: 08-deep-evidence-pipeline
plan: 02
subsystem: enrichment
tags: [crawl4ai, browser-extraction, evidence-drafts, tdd, vitest]

# Dependency graph
requires:
  - phase: 08-01
    provides: SerpDiscoveryResult with reviewUrls and jobUrls to pass as input
provides:
  - Crawl4AI REST API client (extractMarkdown) with 60s timeout and error handling
  - ingestCrawl4aiEvidenceDrafts converts extracted content to EvidenceDraft[]
  - Fallback drafts for pages returning < 80 chars of markdown
  - URL cap at 10 per batch to prevent runaway extraction
affects:
  - 08-03-PLAN.md (pipeline wiring — this is the extraction layer it connects)
  - research-executor.ts (uses ingestCrawl4aiEvidenceDrafts in the full pipeline)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'process.env direct access for CRAWL4AI_BASE_URL (not env.mjs) — keeps module independently testable, same as serp.ts'
    - "Crawl4AI API uses {type: 'ClassName', params: {...}} wrapping format for config objects"
    - 'AbortController with 60s setTimeout for fetch timeout, clearTimeout on both success and error paths'
    - 'Fallback draft pattern for minimal content (< 80 chars) with confidenceScore 0.55'

key-files:
  created:
    - lib/enrichment/crawl4ai.ts
    - lib/enrichment/crawl4ai.test.ts
  modified:
    - lib/enrichment/serp.test.ts

key-decisions:
  - 'Crawl4AI wraps all config objects in {type: ClassName, params: {...}} — required by the REST API, verified by test case 5'
  - 'magic: true and simulate_user: true in crawler_config — handles cookie consent banners automatically'
  - 'Fallback draft uses sourceType REVIEWS regardless of URL — browser extraction minimal content is ambiguous, safer as review signal'
  - '60s AbortController timeout — browser rendering is slow, short timeouts would cause excessive fallbacks'
  - 'URL cap at 10 per batch — prevents runaway extraction costs'

patterns-established:
  - 'extractMarkdown is exported for testing/reuse; ingestCrawl4aiEvidenceDrafts is the pipeline entry point'
  - 'All error paths (network, timeout, non-OK, JSON parse) return empty markdown without throwing'

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 8 Plan 02: Crawl4AI REST API Client Summary

**Crawl4AI browser extraction client with AbortController timeout, cookie consent handling via magic mode, and EvidenceDraft conversion with fallback for minimal content**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T01:58:00Z
- **Completed:** 2026-02-21T02:02:39Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- `extractMarkdown(url)` POSTs to Crawl4AI REST API with correct `{type, params}` wrapped config, 60s timeout, returns `{markdown, title}` without ever throwing
- `ingestCrawl4aiEvidenceDrafts(urls)` converts extracted content to `EvidenceDraft[]` with sourceType REVIEWS for google.com/maps, JOB_BOARD for others, fallback drafts for minimal content
- All 10 TDD test cases pass: successful extraction, empty response, HTTP 500, AbortError, request body format, REVIEWS sourceType, JOB_BOARD sourceType, fallback draft, URL cap at 10, snippet truncation

## Task Commits

Each task was committed atomically:

1. **TDD RED: Crawl4AI test cases** - `2441bd5` (test)
2. **TDD GREEN: Crawl4AI implementation** - `152d628` (feat)
3. **Auto-fix: TS type assertion in serp.test.ts** - `c970f93` (fix — included in staged commit)

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/crawl4ai.ts` - Crawl4AI REST client: extractMarkdown + ingestCrawl4aiEvidenceDrafts
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/crawl4ai.test.ts` - 10 unit tests with mocked fetch
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/serp.test.ts` - Fixed TS2352 type assertion on mock call args

## Decisions Made

- Crawl4AI config uses `{type: 'BrowserConfig', params: {headless: true}}` wrapping — required by the API, not optional
- `magic: true` and `simulate_user: true` handles GDPR cookie consent banners without explicit interaction
- 60s timeout rather than shorter — browser rendering takes time; aggressive timeouts would produce excessive fallbacks
- Fallback drafts for < 80 chars markdown use `sourceType: 'REVIEWS'` always — ambiguous minimal content is safer classified as a review signal for manual review

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2352 type assertion in serp.test.ts**

- **Found during:** Task 1 (after GREEN phase, running `tsc --noEmit`)
- **Issue:** `(call[0] as Record<string, unknown>).engine` caused TS2352 — TypeScript cannot cast from `string` directly to `Record<string, unknown>` without intermediate `unknown`
- **Fix:** Changed to `(call[0] as unknown as Record<string, unknown>).engine`
- **Files modified:** `lib/enrichment/serp.test.ts`
- **Verification:** `tsc --noEmit` exits 0; all 16 enrichment tests still pass
- **Committed in:** `c970f93` (included in staged commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary to achieve clean TypeScript compilation. No scope creep — one-line fix in a test file.

## Issues Encountered

- Implementation files (`crawl4ai.ts` and `crawl4ai.test.ts`) were already committed from prior session (TDD RED in 2441bd5, GREEN in 152d628). Plan 08-02 execution verified their correctness by running all 10 tests, confirming TypeScript compilation, and auto-fixing the pre-existing TS error in serp.test.ts.

## User Setup Required

None — Crawl4AI is accessed via `CRAWL4AI_BASE_URL` env var already added in plan 08-01 (chore commit fc42402).

## Next Phase Readiness

- `extractMarkdown` and `ingestCrawl4aiEvidenceDrafts` are ready for plan 08-03 pipeline wiring
- SerpAPI discovery (08-01) + Crawl4AI extraction (08-02) form the complete URL-to-EvidenceDraft pipeline
- No blockers — both enrichment modules have full test coverage

## Self-Check

- [x] `lib/enrichment/crawl4ai.ts` exists
- [x] `lib/enrichment/crawl4ai.test.ts` exists
- [x] Commits 2441bd5, 152d628, c970f93 exist in git log
- [x] All 10 crawl4ai tests pass
- [x] `tsc --noEmit` clean

---

_Phase: 08-deep-evidence-pipeline_
_Completed: 2026-02-21_
