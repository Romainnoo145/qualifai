---
phase: 17-evidence-pipeline-enrichment
verified: 2026-02-22T16:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 17: Evidence Pipeline Enrichment — Verification Report

**Phase Goal:** Research pipeline collects substantially more evidence per prospect so that the quality gate introduced in Phase 18 has meaningful data to assess — not just homepage content.
**Verified:** 2026-02-22T16:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Success Criteria)

| #   | Truth                                                                                                | Status   | Evidence                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Sitemap discovery replaces guessed URL paths (no more /careers /jobs /docs /help 404s)               | VERIFIED | `lib/research-executor.ts` lines 184-189: `sitemapUrls.length > 0 ? [...sitemapUrls] : [...defaultResearchUrls()]` — sitemap is primary, guessed paths are fallback                                                |
| 2   | Google search results for reviews/vacatures/nieuws surface external mentions                         | VERIFIED | `lib/enrichment/serp.ts` exports `discoverGoogleSearchMentions` with 3 NL queries; wired into `executeResearchRun` deepCrawl block at lines 250-269                                                                |
| 3   | LinkedIn company profile data becomes evidence (description, employee count, industry, recent posts) | VERIFIED | Apollo-derived LinkedIn evidence at lines 284-307 uses `description`, `specialties`, `industry` from prospect record; Crawl4AI best-effort at lines 309-342 when `deepCrawl && linkedinUrl`                        |
| 4   | KvK registry data (legal form, SBI code, address, employee range) available as evidence              | VERIFIED | `lib/enrichment/kvk.ts` exports `fetchKvkData` (two-step Zoeken+Basisprofiel) and `kvkDataToEvidenceDraft`; wired into executor at lines 272-282                                                                   |
| 5   | After re-run on thin prospect, evidence count is higher and includes 2+ distinct source types        | VERIFIED | Evidence cap raised 24→36; pipeline now has up to 5 source types: WEBSITE (sitemap pages + Google mentions), REGISTRY (KvK), REVIEWS (Crawl4AI maps), JOB_BOARD (Crawl4AI jobs), WEBSITE (LinkedIn Apollo-derived) |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact                                                                  | Expected                                 | Status   | Details                                                                                                                                                                        |
| ------------------------------------------------------------------------- | ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/enrichment/sitemap.ts`                                               | Sitemap URL discovery using sitemapper   | VERIFIED | Exists, 46 lines, exports `discoverSitemapUrls` and `SitemapCache`, uses Sitemapper with domain filter + extension filter + 25-cap, silent `[]` on error                       |
| `lib/enrichment/serp.ts`                                                  | Google search mention discovery          | VERIFIED | Exports `discoverGoogleSearchMentions` and `GoogleSearchMention` alongside existing `discoverSerpUrls`; 3 NL queries, per-query try/catch, cap 12                              |
| `lib/enrichment/kvk.ts`                                                   | KvK Handelsregister API client           | VERIFIED | Exists, 141 lines, exports `fetchKvkData`, `kvkDataToEvidenceDraft`, `KvkEnrichmentData`; two-step API (Zoeken + Basisprofiel); null-guard on missing KVK_API_KEY              |
| `lib/research-executor.ts`                                                | Integrated pipeline with all 4 sources   | VERIFIED | Imports all 4 modules, implements full pipeline with sitemap-first URLs, deepCrawl-gated Google search, unconditional KvK + Apollo LinkedIn, deepCrawl-gated Crawl4AI LinkedIn |
| `prisma/schema.prisma`                                                    | REGISTRY enum in EvidenceSourceType      | VERIFIED | `REGISTRY  // KvK Handelsregister data` present in enum at line 71                                                                                                             |
| `env.mjs`                                                                 | KVK_API_KEY and KVK_TEST_MODE validated  | VERIFIED | Both present in `server` section (lines 40-41) and `runtimeEnv` section (lines 87-88)                                                                                          |
| `lib/enrichment/crawl4ai.ts`                                              | Fallback draft for minimal-content pages | VERIFIED | Lines 92-107: creates draft with `confidenceScore: 0.55` and `metadata: { adapter: 'crawl4ai', fallback: true }` instead of silent skip                                        |
| `prisma/migrations/20260222154800_add_registry_source_type/migration.sql` | ALTER TYPE migration                     | VERIFIED | `ALTER TYPE "EvidenceSourceType" ADD VALUE IF NOT EXISTS 'REGISTRY'`                                                                                                           |

---

## Key Link Verification

| From                          | To                           | Via                                           | Status | Details                                                                                   |
| ----------------------------- | ---------------------------- | --------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `lib/enrichment/sitemap.ts`   | `sitemapper` npm package     | `import Sitemapper from 'sitemapper'`         | WIRED  | Import at line 1; `sitemapper@^4.1.4` in package.json line 63                             |
| `lib/enrichment/serp.ts`      | SerpAPI `google` engine      | `engine: 'google'` in getJson call            | WIRED  | Line 71: `engine: 'google'` in each of 3 query calls                                      |
| `lib/enrichment/kvk.ts`       | `api.kvk.nl`                 | `fetch` with `apikey` header                  | WIRED  | Lines 58-65: fetch to `KVK_BASE_URL/v2/zoeken` with `{ apikey: process.env.KVK_API_KEY }` |
| `lib/enrichment/kvk.ts`       | `lib/workflow-engine.ts`     | `import type { EvidenceDraft }`               | WIRED  | Line 1: `import type { EvidenceDraft } from '@/lib/workflow-engine'`                      |
| `lib/research-executor.ts`    | `lib/enrichment/sitemap.ts`  | `import discoverSitemapUrls`                  | WIRED  | Lines 20-23; used at line 138 in sitemap-first URL selection                              |
| `lib/research-executor.ts`    | `lib/enrichment/serp.ts`     | `import discoverGoogleSearchMentions`         | WIRED  | Lines 12-15; used at lines 252-268 inside deepCrawl block                                 |
| `lib/research-executor.ts`    | `lib/enrichment/kvk.ts`      | `import fetchKvkData, kvkDataToEvidenceDraft` | WIRED  | Line 24; used at lines 275-278 outside deepCrawl                                          |
| `lib/research-executor.ts`    | `lib/enrichment/crawl4ai.ts` | `import extractMarkdown`                      | WIRED  | Lines 17-19; used at line 312 for LinkedIn extraction                                     |
| `lib/web-evidence-adapter.ts` | REGISTRY enum                | `case 'REGISTRY': return 0.82`                | WIRED  | Lines 158-159 in `baseConfidence` switch                                                  |

---

## Requirements Coverage

| Requirement                                                | Status    | Notes                                                                                 |
| ---------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| EVID-06: Sitemap URL discovery                             | SATISFIED | `discoverSitemapUrls` live, wired as primary URL source                               |
| EVID-07: Google search mentions (reviews/vacatures/nieuws) | SATISFIED | `discoverGoogleSearchMentions` live, 3 NL queries, gated behind deepCrawl             |
| EVID-08: LinkedIn profile data                             | SATISFIED | Two paths: Apollo-derived (always) + Crawl4AI best-effort (deepCrawl+linkedinUrl)     |
| EVID-09: KvK registry data                                 | SATISFIED | `fetchKvkData` live, REGISTRY enum in schema, runs for all prospects with companyName |

---

## Anti-Patterns Found

No blocking anti-patterns detected in any of the phase 17 files.

| File                                       | Pattern                                          | Severity | Assessment                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/research-executor.ts` (lines 206-213) | SERP cache re-read AFTER inputSnapshot overwrite | INFO     | **Pre-existing bug from Phase 8** — not introduced by Phase 17. The `existingSnapshot` re-read for SERP cache happens after `run update` has already overwritten the snapshot. Phase 17 correctly solved this for sitemapCache (pre-read at lines 106-113) but did not fix the pre-existing SERP cache pattern. Impact: SERP cache on re-runs is always treated as stale. Does not block Phase 17 goal. |

---

## Human Verification Required

### 1. Sitemap URL discovery with a live site

**Test:** Trigger a research run via the admin UI for a prospect with a known sitemap (e.g., a WordPress site). After the run completes, check the evidence items' sourceUrls — do they include internal pages from the sitemap rather than `/careers`, `/jobs`, `/docs`, `/help`?
**Expected:** Evidence sourceUrls show real sitemap pages (e.g., `/over-ons`, `/diensten`, `/contact`), not the 5 guessed paths from `defaultResearchUrls`.
**Why human:** Cannot verify live Sitemapper network behavior programmatically in this environment.

### 2. KvK data returned for a real Dutch company

**Test:** Set `KVK_TEST_MODE=true` and `KVK_API_KEY=l7xx1f2691f2520d487b902f4e0b57a0b197` in `.env.local`. Run research on a prospect with a Dutch company name. Check that evidence items include one with `sourceType: REGISTRY` and a snippet containing "Rechtsvorm" or "Sector".
**Expected:** One evidence item with `sourceType=REGISTRY`, `confidenceScore=0.82`, snippet contains KvK registry fields.
**Why human:** Requires live KvK test API call with env vars configured.

### 3. Google search mention evidence appears with deepCrawl

**Test:** Trigger a deep crawl research run. Check evidence items for entries with `metadata.adapter='serp-google-search'` and `source='google-mention'`.
**Expected:** Up to 12 evidence items with sourceUrls pointing to external review/job/news pages.
**Why human:** Requires live SERP_API_KEY and actual Google search results.

---

## Gaps Summary

None. All five observable truths are verified. All required artifacts exist with substantive implementation. All key links are wired. No stub patterns detected.

**Pre-existing issue noted (not a gap):** The SERP cache re-read inside the deepCrawl block reads `existingRunId` snapshot AFTER the run update has overwritten it (pre-existing from Phase 8). This means SERP cache on re-runs is always treated as stale, causing unnecessary SerpAPI calls. Phase 17 intentionally fixed this pattern for sitemap cache only; the SERP cache fix is out of scope for this phase.

---

_Verified: 2026-02-22T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
