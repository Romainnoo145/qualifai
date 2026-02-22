---
phase: 17-evidence-pipeline-enrichment
plan: '03'
subsystem: api
tags: [research-executor, sitemap, serp, kvk, linkedin, enrichment, integration]

# Dependency graph
requires:
  - phase: 17-01
    provides: discoverSitemapUrls (sitemap.ts) and discoverGoogleSearchMentions (serp.ts)
  - phase: 17-02
    provides: fetchKvkData and kvkDataToEvidenceDraft (kvk.ts), extractMarkdown (crawl4ai.ts)
provides:
  - executeResearchRun wired to all four enrichment sources (EVID-06, EVID-07, EVID-08, EVID-09)
  - Sitemap-first URL discovery with 24h cache in inputSnapshot
  - Google search mentions gated behind deepCrawl
  - KvK registry enrichment running for all prospects with companyName
  - Apollo-derived LinkedIn evidence always when any data exists
  - Crawl4AI LinkedIn best-effort gated behind deepCrawl + linkedinUrl
affects:
  - 18-research-quality-gate: richer evidence pool (cap raised to 36) enables meaningful quality scoring
  - all research runs: sitemap URLs replace guessed /careers /jobs /docs /help paths

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'priorSnapshot pre-read pattern: read existingRunId snapshot BEFORE run create/update to preserve cache'
    - 'freshSitemapCache computed once, spread into both create and update inputSnapshot paths'
    - 'deepCrawl gate: SERP discovery + Crawl4AI + Google mentions all inside if (input.deepCrawl)'
    - 'Apollo-derived evidence: no network call, always runs when any of description/specialties/industry present'
    - 'Authwall detection: length < 200 OR keyword match in lowercase markdown'

key-files:
  created: []
  modified:
    - lib/research-executor.ts

key-decisions:
  - 'priorSnapshot must be read BEFORE run create/update — otherwise the update overwrites the snapshot and cache is lost'
  - 'freshSitemapCache stored as undefined (not null) when sitemap returns empty — avoids writing empty cache'
  - 'evidence cap raised from 24 to 36 — 4 new sources add up to 15+ drafts, 24 would drop useful evidence'
  - 'Apollo-derived LinkedIn always runs (no gate) — it uses existing DB data with no API cost'
  - 'Crawl4AI LinkedIn gated behind both deepCrawl AND linkedinUrl — expensive operation, often blocked'

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 17 Plan 03: Evidence Pipeline Integration Summary

**executeResearchRun integrated with sitemap-first URL discovery, Google search mentions, KvK registry enrichment, and Apollo-derived + Crawl4AI LinkedIn evidence — evidence cap raised from 24 to 36.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T15:53:49Z
- **Completed:** 2026-02-22T15:56:00Z
- **Tasks:** 2 (implemented in single file pass)
- **Files modified:** 1

## Accomplishments

- Wired `discoverSitemapUrls` as primary URL source; sitemap URLs replace guessed `/careers /jobs /docs /help` paths
- Added `extractSitemapCache` helper and priorSnapshot pre-read pattern to preserve 24h sitemap cache across re-runs
- Added `linkedinUrl` to prospect select query (required for EVID-08)
- Integrated `discoverGoogleSearchMentions` inside `deepCrawl` block (EVID-07) — 3 NL queries, up to 12 mentions
- Integrated `fetchKvkData + kvkDataToEvidenceDraft` outside deepCrawl block for all prospects with `companyName` (EVID-09)
- Added Apollo-derived LinkedIn evidence using existing DB fields (`description`, `specialties`, `industry`) — always runs when any data present (EVID-08 reliable path)
- Added Crawl4AI LinkedIn browser extraction with authwall detection — gated behind `deepCrawl && linkedinUrl` (EVID-08 best-effort)
- Raised evidence cap from 24 to 36 to accommodate expanded source pool
- Persisted `sitemapCache` in both create and update `inputSnapshot` paths (including deepCrawl serpCache update)

## Task Commits

Each plan task was implemented atomically:

1. **Task 1 + Task 2: Integrate all four enrichment sources** - `7d0bd86` (feat)
   - Both tasks modify the same file `lib/research-executor.ts` and were implemented in a single cohesive pass

## Files Created/Modified

- `lib/research-executor.ts` — Integrated evidence pipeline: sitemap-first URLs, Google search mentions, KvK registry, Apollo LinkedIn, Crawl4AI LinkedIn

## Decisions Made

- `priorSnapshot` must be read BEFORE `run create/update` — the update overwrites `inputSnapshot`, losing any previously cached sitemap URLs. The pre-read happens right after the prospect query, before any DB writes.
- `freshSitemapCache` stored as `undefined` (not `null`) when sitemap returns empty array — avoids writing a zero-URL cache entry that would suppress future sitemap attempts.
- Evidence cap raised from 24 to 36 — with up to 25 sitemap URLs + 12 Google mentions + 1 KvK + 1-2 LinkedIn drafts, the old cap of 24 would drop meaningful evidence.
- Apollo-derived LinkedIn always runs (no deepCrawl gate) — it uses only existing DB data (`description`, `specialties`, `industry`) with zero API cost.
- Crawl4AI LinkedIn gated behind both `input.deepCrawl && prospect.linkedinUrl` — browser extraction is expensive and LinkedIn authwalls mean it often produces no usable content.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript passed on first attempt. All 57 tests continue to pass.

## User Setup Required

No new setup required beyond what Plans 01 and 02 already documented:

- `SERP_API_KEY` — for Google search mentions (EVID-07, gated behind deepCrawl)
- `KVK_API_KEY` or `KVK_TEST_MODE=true` — for KvK registry enrichment (EVID-09)

## Next Phase Readiness

- Phase 17 is complete — all four enrichment sources (EVID-06 through EVID-09) are now live in the pipeline
- Phase 18 (Research Quality Gate) can now be built against a meaningfully richer evidence pool
- The evidence cap of 36 and REGISTRY source type provide Phase 18 with sufficient variety for traffic-light scoring

---

_Phase: 17-evidence-pipeline-enrichment_
_Completed: 2026-02-22_

## Self-Check: PASSED

- lib/research-executor.ts — FOUND
- .planning/phases/17-evidence-pipeline-enrichment/17-03-SUMMARY.md — FOUND (this file)
- Commit 7d0bd86 — FOUND
- discoverSitemapUrls import — FOUND (line 21)
- discoverGoogleSearchMentions import — FOUND (line 13)
- fetchKvkData import — FOUND (line 24)
- extractMarkdown import — FOUND (line 18)
- priorSnapshot read before run create/update — FOUND (lines 106-118)
- sitemapUrls used in researchUrls — FOUND (lines 136-188)
- Google search mentions inside deepCrawl — FOUND (lines 250-269)
- KvK enrichment outside deepCrawl — FOUND (lines 272-282)
- Apollo-derived LinkedIn outside deepCrawl — FOUND (lines 284-307)
- Crawl4AI LinkedIn inside deepCrawl — FOUND (lines 309-342)
- Evidence cap .slice(0, 36) — FOUND (line 344)
- All 57 tests pass — CONFIRMED
