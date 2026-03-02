---
phase: 29-browser-rendered-evidence-extraction
plan: 01
subsystem: api
tags: [vitest, crawl4ai, scrapling, evidence-extraction, tdd]

# Dependency graph
requires:
  - phase: 28-source-discovery-with-provenance
    provides: detectJsHeavy() and jsHeavyHint field on DiscoveredUrl
  - phase: existing
    provides: extractMarkdown() from crawl4ai.ts, fetchStealth() from scrapling.ts

provides:
  - Two-tier extraction routing in ingestWebsiteEvidenceDrafts with browser budget cap
  - BROWSER_BUDGET_MAX = 5 exported constant for test and caller access
  - buildCrawl4aiDraft helper with detectWorkflowTag (not default workflow-context)
  - budgetExhaustedDraft helper for budget-exhausted fallback differentiation
  - processCrawl4aiResult shared handler (empty/404/80-char/draft logic)
  - Backwards-compatible optional jsHeavyHints options parameter

affects:
  - lib/research-executor.ts (caller that will pass jsHeavyHints map)
  - Any future phase that calls ingestWebsiteEvidenceDrafts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-tier extraction routing: stealth-first with Crawl4AI escalation at 500-char threshold
    - Browser budget shared across full URL batch (not per-URL), initialized before loop
    - Raw inferred sourceType (inferSourceType) used for routing, mapped type for storage
    - 404 detection before 80-char minimum in Crawl4AI result processing
    - processCrawl4aiResult returns EvidenceDraft | 'skip' discriminated union

key-files:
  created:
    - lib/web-evidence-adapter.test.ts (expanded from 36 to 379 lines)
  modified:
    - lib/web-evidence-adapter.ts (complete rewrite of ingestWebsiteEvidenceDrafts)

key-decisions:
  - 'REVIEWS routing uses inferSourceType() (raw inferred type) not sourceTypeForUrl() (storage-mapped type) — sourceTypeForUrl maps REVIEWS to MANUAL_URL for DB storage but routing must distinguish Google Maps/Trustpilot URLs'
  - "404 detection runs before 80-char minimum check — a short 'page not found' page should be skipped entirely, not produce a fallback draft"
  - "processCrawl4aiResult returns 'skip' sentinel not null — enables clean discriminated union without optional chaining"
  - 'Raw fetch() fallback removed — escalation chain is now StealthyFetcher → Crawl4AI → fallback draft (avoids Pitfall 5 double-budget)'
  - 'Budget cap applies only to website extraction path (ingestWebsiteEvidenceDrafts), not SERP deepCrawl path (ingestCrawl4aiEvidenceDrafts) per EXTR-03 interpretation'

patterns-established:
  - 'Two-tier URL routing: check sourceType/jsHeavyHint upfront, avoid stealth for known JS-heavy platforms'
  - 'Budget counter initialized once before URL loop, decremented inside both Tier 1 and Tier 2 escalation paths'
  - 'Shared processCrawl4aiResult helper for consistent empty/404/content-length/draft logic across both paths'

requirements-completed: [EXTR-01, EXTR-02, EXTR-03]

# Metrics
duration: 7min
completed: 2026-03-02
---

# Phase 29 Plan 01: Two-Tier Extraction Routing Summary

**Two-tier Crawl4AI escalation in ingestWebsiteEvidenceDrafts: stealth-first with 500-char threshold and 5-URL browser budget cap, replacing raw fetch() fallback**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-02T02:32:54Z
- **Completed:** 2026-03-02T02:40:24Z
- **Tasks:** 1 TDD task (RED + GREEN + REFACTOR commits)
- **Files modified:** 2

## Accomplishments

- Implemented two-tier extraction routing: direct Crawl4AI for REVIEWS URLs and jsHeavyHint=true, stealth-first with Crawl4AI escalation for all others
- Added 5-URL browser budget shared across both tiers, with budgetExhaustedDraft fallback when exhausted
- Removed raw fetch() fallback tier (replaced by Crawl4AI escalation, eliminating double-budget risk)
- Achieved full test coverage: 17 tests covering direct-route, escalation, budget cap, budget sharing, workflowTag detection, backwards compatibility, 404 detection, short markdown, and raw fetch removal
- All tests pass, zero TypeScript errors, zero lint errors

## Task Commits

Each TDD phase committed atomically:

1. **RED: Failing test suite** - `edb8302` (test)
2. **GREEN: Full implementation** - `232dbb3` (feat)
3. **REFACTOR: processCrawl4aiResult helper** - `36bf331` (refactor)

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/web-evidence-adapter.ts` - Added BROWSER_BUDGET_MAX, shouldUseBrowserDirect, buildCrawl4aiDraft, budgetExhaustedDraft, processCrawl4aiResult helpers; rewrote ingestWebsiteEvidenceDrafts with two-tier routing
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/web-evidence-adapter.test.ts` - Complete test suite for two-tier routing (17 tests, expanded from 1 existing test)

## Decisions Made

- REVIEWS routing uses `inferSourceType()` (raw type) not `sourceTypeForUrl()` (storage-mapped type): `sourceTypeForUrl` maps REVIEWS → MANUAL_URL for Prisma storage, but routing needs to distinguish Google Maps / Trustpilot URLs. Discovered during GREEN phase when Google Maps URLs were falling into stealth path.
- 404 detection runs before 80-char minimum: a short "page not found" page (e.g., 42 chars) should be skipped entirely, not produce a fallback draft. This is semantically correct — 404 is not the same as "extraction failed."
- `processCrawl4aiResult` returns `EvidenceDraft | 'skip'` sentinel union (not `null | EvidenceDraft`) for a clean discriminated union that TypeScript can fully type-check.
- Budget cap applies only to `ingestWebsiteEvidenceDrafts`, not `ingestCrawl4aiEvidenceDrafts` (SERP deepCrawl path). EXTR-03 is interpreted as website-path-only per research recommendation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed REVIEWS URL routing using raw inferSourceType instead of mapped sourceType**

- **Found during:** GREEN phase (implementation)
- **Issue:** `sourceTypeForUrl()` maps REVIEWS → MANUAL_URL for DB storage. `shouldUseBrowserDirect(sourceType, ...)` checking `sourceType === 'REVIEWS'` never matched Google Maps/Trustpilot URLs.
- **Fix:** Changed `shouldUseBrowserDirect` signature from `(sourceType, jsHeavyHint)` to `(url, jsHeavyHint)`, calling `inferSourceType(url) === 'REVIEWS'` internally for routing.
- **Files modified:** `lib/web-evidence-adapter.ts`
- **Verification:** `direct-route: REVIEWS url routes to extractMarkdown without calling fetchStealth` test passes
- **Committed in:** `232dbb3` (GREEN commit)

**2. [Rule 1 - Bug] Fixed 404 detection order (before 80-char check, not after)**

- **Found during:** GREEN phase, `404-detection` test failure
- **Issue:** Short "page not found" markdown (42 chars) hit the `length < 80` check first, producing a fallback draft instead of being skipped.
- **Fix:** Moved `looksLikeCrawled404` check before the 80-char minimum check in `processCrawl4aiResult`.
- **Files modified:** `lib/web-evidence-adapter.ts`
- **Verification:** `404-detection: crawl4ai markdown with page not found → draft is skipped` test passes
- **Committed in:** `232dbb3` (GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs in routing and check ordering)
**Impact on plan:** Both bugs discovered and fixed during TDD cycle as expected. No scope creep. Plan executed correctly after fixes.

## Issues Encountered

- Test markdown strings for `crawl4ai-draft` tests were initially too short (< 80 chars) — tests would never exercise the `buildCrawl4aiDraft` path because the 80-char minimum check would intercept first. Fixed by using longer, more realistic test strings.

## User Setup Required

None - no external service configuration required. Crawl4AI service must be running at `http://localhost:11235` (unchanged from before this plan, `extractMarkdown()` handles service-down gracefully by returning empty markdown → fallback draft).

## Next Phase Readiness

- `ingestWebsiteEvidenceDrafts` is backwards-compatible: existing callers continue to work without modification
- `lib/research-executor.ts` can optionally pass `jsHeavyHints` map from Phase 28 sourceSet to avoid re-running detectJsHeavy pattern matching
- Phase 29 Plan 02 (if exists) or Phase 30 can proceed

## Self-Check: PASSED

- lib/web-evidence-adapter.ts: FOUND
- lib/web-evidence-adapter.test.ts: FOUND
- 29-01-SUMMARY.md: FOUND
- edb8302 (test/RED): FOUND
- 232dbb3 (feat/GREEN): FOUND
- 36bf331 (refactor): FOUND

---

_Phase: 29-browser-rendered-evidence-extraction_
_Completed: 2026-03-02_
