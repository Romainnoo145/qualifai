---
phase: 08-deep-evidence-pipeline
verified: 2026-02-21T02:12:00Z
status: passed
score: 13/13 must-haves verified
---

# Phase 8: Deep Evidence Pipeline Verification Report

**Phase Goal:** Admin can trigger deep research that discovers review URLs and job listings via SerpAPI and extracts JS-rendered content via managed browser API, with results cached and routed through the existing approval gate.
**Verified:** 2026-02-21T02:12:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                              | Status   | Evidence                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `discoverSerpUrls` returns reviewUrls and jobUrls arrays for a given prospect                                                      | VERIFIED | `lib/enrichment/serp.ts` L36-121, 6/6 tests pass                                                                         |
| 2   | When SERP_API_KEY is missing, `discoverSerpUrls` returns empty arrays without throwing                                             | VERIFIED | serp.ts L40-48 early-return guard, test case 1 passes                                                                    |
| 3   | Google Maps two-step flow fetches data_id first, then reviews using that data_id                                                   | VERIFIED | serp.ts L58-93, test case 2 + 3 pass                                                                                     |
| 4   | Google Jobs discovery returns job listing URLs from jobs_results                                                                   | VERIFIED | serp.ts L96-113, test case 4 passes                                                                                      |
| 5   | Result includes discoveredAt timestamp and optional mapsDataId for cache persistence                                               | VERIFIED | serp.ts L115-121, SerpDiscoveryResult interface L3-8                                                                     |
| 6   | `extractMarkdown` fetches page content from Crawl4AI REST API and returns markdown + title                                         | VERIFIED | `lib/enrichment/crawl4ai.ts` L18-64, test cases 1-5 pass                                                                 |
| 7   | Crawl4AI request body uses the required {type: ClassName, params: {...}} wrapping format                                           | VERIFIED | crawl4ai.ts L28-45, test case 5 verifies exact body format                                                               |
| 8   | Cookie consent handled via magic: true and simulate_user: true parameters                                                          | VERIFIED | crawl4ai.ts L38-39, confirmed by test case 5                                                                             |
| 9   | `ingestCrawl4aiEvidenceDrafts` returns EvidenceDraft[] with correct sourceType (REVIEWS for google.com/maps, JOB_BOARD for others) | VERIFIED | crawl4ai.ts L87-89, test cases 6+7 pass                                                                                  |
| 10  | Pages with empty or minimal content produce fallback drafts instead of being silently dropped                                      | VERIFIED | crawl4ai.ts L75-85, test case 8 verifies confidenceScore 0.55 and metadata.fallback=true                                 |
| 11  | `startRun` mutation accepts optional deepCrawl boolean flag and triggers full deep evidence pipeline                               | VERIFIED | research.ts L16, deepCrawl wired to executeResearchRun L24                                                               |
| 12  | SerpAPI cache persisted in ResearchRun.inputSnapshot and read on retry within 24 hours                                             | VERIFIED | research-executor.ts L155-191, extractSerpCache helper L45-49, 24h TTL check L166-169                                    |
| 13  | Deep crawl evidence flows through the existing approval gate without bypass                                                        | VERIFIED | All evidence creates EvidenceItem with isApproved=false (DB default), approveEvidence/rejectEvidence mutations unchanged |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact                          | Expected                                                    | Status   | Details                                                                                                       |
| --------------------------------- | ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `lib/enrichment/serp.ts`          | SerpAPI URL discovery client with discoverSerpUrls function | VERIFIED | 122 lines, exports discoverSerpUrls + SerpDiscoveryResult, imports from serpapi package                       |
| `lib/enrichment/serp.test.ts`     | Unit tests for SerpAPI discovery with mocked API responses  | VERIFIED | 163 lines, 6 test cases, all pass                                                                             |
| `env.mjs`                         | SERP_API_KEY and CRAWL4AI_BASE_URL env var declarations     | VERIFIED | Both declared as optional server vars (L36-37, L76-77)                                                        |
| `lib/enrichment/crawl4ai.ts`      | Crawl4AI REST API client and evidence draft ingestion       | VERIFIED | 103 lines, exports extractMarkdown + ingestCrawl4aiEvidenceDrafts, imports EvidenceDraft from workflow-engine |
| `lib/enrichment/crawl4ai.test.ts` | Unit tests for Crawl4AI client with mocked fetch            | VERIFIED | 241 lines, 10 test cases, all pass                                                                            |
| `lib/research-executor.ts`        | executeResearchRun with deepCrawl branch                    | VERIFIED | deepCrawl field at L72, deepCrawl branch L155-199, allDrafts accumulator pattern                              |
| `server/routers/research.ts`      | startRun input with deepCrawl flag                          | VERIFIED | deepCrawl: z.boolean().default(false) at L16, passed through to executor L24                                  |

### Key Link Verification

| From                         | To                           | Via                                                                                  | Status | Details                                        |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ | ------ | ---------------------------------------------- |
| `lib/enrichment/serp.ts`     | `serpapi` npm package        | `import { getJson, config as serpConfig } from 'serpapi'`                            | WIRED  | L1 of serp.ts                                  |
| `lib/enrichment/serp.ts`     | env var SERP_API_KEY         | `process.env.SERP_API_KEY` guard                                                     | WIRED  | L40 of serp.ts                                 |
| `lib/enrichment/crawl4ai.ts` | Crawl4AI Docker API          | `fetch POST to CRAWL4AI_BASE_URL/crawl`                                              | WIRED  | L25 of crawl4ai.ts                             |
| `lib/enrichment/crawl4ai.ts` | `lib/workflow-engine.ts`     | `import type { EvidenceDraft } from '@/lib/workflow-engine'`                         | WIRED  | L1 of crawl4ai.ts                              |
| `lib/research-executor.ts`   | `lib/enrichment/serp.ts`     | `import { discoverSerpUrls, type SerpDiscoveryResult } from '@/lib/enrichment/serp'` | WIRED  | L12-14 of research-executor.ts, called at L173 |
| `lib/research-executor.ts`   | `lib/enrichment/crawl4ai.ts` | `import { ingestCrawl4aiEvidenceDrafts } from '@/lib/enrichment/crawl4ai'`           | WIRED  | L15, called at L196                            |
| `server/routers/research.ts` | `lib/research-executor.ts`   | `deepCrawl: input.deepCrawl` passed to executeResearchRun                            | WIRED  | L24 and L52 (startRun and retryRun)            |

### Requirements Coverage

| Requirement                                          | Status    | Notes                                                                                         |
| ---------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| Admin triggers deep research via SerpAPI             | SATISFIED | startRun mutation accepts deepCrawl:true                                                      |
| Discovers review URLs (Google Maps)                  | SATISFIED | Two-step Maps flow, capped at 5                                                               |
| Discovers job listing URLs                           | SATISFIED | Google Jobs discovery, capped at 5                                                            |
| Extracts JS-rendered content via managed browser API | SATISFIED | Crawl4AI client with magic:true, simulate_user:true                                           |
| Results cached                                       | SATISFIED | SerpAPI results in inputSnapshot with 24h TTL                                                 |
| Routed through existing approval gate                | SATISFIED | EvidenceItem.isApproved defaults to false, approveEvidence/rejectEvidence mutations unchanged |

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments found in any phase 8 files. No empty implementations or stub handlers detected.

### Human Verification Required

#### 1. Admin UI trigger for deepCrawl

**Test:** In the admin research panel for a prospect, verify there is a UI element (checkbox, toggle, or button) that sends `deepCrawl: true` with the startRun mutation.
**Expected:** A "Deep Research" or equivalent control is visible and triggers the deep crawl pipeline.
**Why human:** Phase 8 plans only modified backend files. The UI trigger for deepCrawl was not in scope for this phase — the backend accepts the flag but no front-end component was specified to expose it.

#### 2. Crawl4AI sidecar reachability

**Test:** With `CRAWL4AI_BASE_URL` set and the Crawl4AI Docker container running, trigger a deep crawl run and verify evidence items with `metadata.adapter = 'crawl4ai'` appear in the evidence list.
**Expected:** Browser-extracted evidence drafts created with correct sourceType (REVIEWS or JOB_BOARD).
**Why human:** Integration with the actual Crawl4AI Docker service cannot be verified from file inspection alone.

#### 3. SerpAPI 24h cache reuse on retry

**Test:** Run a deep crawl for a prospect, then immediately retry the run. Verify the second run does not make additional SerpAPI calls (check logs or SerpAPI usage counter).
**Expected:** Cache hit message logged, no new SerpAPI charges for the retry.
**Why human:** Cache TTL logic requires a running DB and live run to test end-to-end.

### Gaps Summary

No gaps found. All 13 observable truths are verified by concrete code evidence and passing tests. The 3 human verification items are integration/UI concerns that cannot be verified programmatically but do not block the core goal — the backend pipeline is fully wired and correct.

The only notable observation: the admin UI trigger for `deepCrawl:true` was not part of the phase scope (plans 08-01, 08-02, 08-03 all targeted library and server files only). The tRPC mutation is ready to accept the flag from any caller.

---

_Verified: 2026-02-21T02:12:00Z_
_Verifier: Claude (gsd-verifier)_
