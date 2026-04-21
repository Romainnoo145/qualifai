---
phase: 65-surgical-funnel-fixes-dead-code
verified: 2026-04-21T11:55:40Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 65: Surgical Funnel Fixes + Dead Code Verification Report

**Phase Goal:** Three one-line corrections eliminate 404 evidence pollution and URL-only stubs from the pipeline, and 260 lines of legacy v1 prompt code are deleted from the codebase — all with zero AI cost and zero schema changes.
**Verified:** 2026-04-21T11:55:40Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                          | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Crawl4AI HTTP 4xx/5xx responses produce zero EvidenceItem rows | VERIFIED | `statusCode >= 400` gate in `crawl4ai.ts:96` and `web-evidence-adapter.ts:543`. Test `ingestCrawl4aiEvidenceDrafts > returns empty array for a URL that returns HTTP 404 status` passes (12/12 tests green).                                                                                                                                                                                                                                                 |
| 2   | Fallback/notFound drafts are never stored in the database      | VERIFIED | `research-executor.ts:1240-1245` filters `meta?.fallback === true` and `meta?.notFound === true` from `rawDrafts` BEFORE AI scoring and DB insert loop. Filter variable named `evidenceDrafts` replaces the raw array throughout scoring and create loop.                                                                                                                                                                                                    |
| 3   | `buildLegacyPrompt` function does not exist in the codebase    | VERIFIED | `grep -r "buildLegacyPrompt" lib/` returns zero results. `scripts/tmp-run-analysis-nedri.ts` deleted. All v1 types (`AnalysisKPI`, `AnalysisContext`, `TriggerCategory`, `AnalysisTrigger`, `AnalysisTrack`, `MasterAnalysis`, `MasterAnalysisInput`) absent from `lib/analysis/types.ts`. All v1 validators (`validateKPI`, `validateContext`, `validateTrigger`, `validateTrack`, `validateMasterAnalysis`) absent from `lib/analysis/master-analyzer.ts`. |
| 4   | TypeScript compiles cleanly after all changes                  | VERIFIED | `npx tsc --noEmit` produces one error in `lib/enrichment/sitemap.test.ts:29` (pre-existing, unrelated to this phase — Buffer type mismatch in test mock). Zero errors in any file modified by this phase.                                                                                                                                                                                                                                                    |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                            | Expected                                                 | Status   | Details                                                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/enrichment/crawl4ai.ts`        | HTTP status code parsing + skip on 4xx/5xx               | VERIFIED | `status_code?: number` in `Crawl4AiResult` interface; `statusCode` extracted at line 61, returned at line 63; gate at line 96                                                |
| `lib/web-evidence-adapter.ts`       | `processCrawl4aiResult` receives and checks `statusCode` | VERIFIED | Function signature updated with `statusCode: number` param (line 541); gate `if (statusCode >= 400) return 'skip'` at line 543; callers at lines 653-660 and 688-695 pass it |
| `lib/research-executor.ts`          | Fallback/notFound draft filter before DB insert          | VERIFIED | Filter at lines 1240-1245, applied before `scoreEvidenceBatch` call at line 1260 — indices stay aligned                                                                      |
| `lib/analysis/master-prompt.ts`     | Clean prompt builder without legacy v1 code              | VERIFIED | No `buildLegacyPrompt`, no `MasterAnalysisInput` import, no `IntentCategory` import                                                                                          |
| `lib/analysis/types.ts`             | No v1 types                                              | VERIFIED | `analysis-v1`, `AnalysisKPI`, `MasterAnalysis` grep returns zero results                                                                                                     |
| `lib/analysis/master-analyzer.ts`   | No v1 validation functions                               | VERIFIED | `validateKPI/Context/Trigger/Track/MasterAnalysis` grep returns zero results                                                                                                 |
| `scripts/tmp-run-analysis-nedri.ts` | File deleted                                             | VERIFIED | File does not exist                                                                                                                                                          |

### Key Link Verification

| From                         | To                            | Via                                                  | Status | Details                                                                                                                                             |
| ---------------------------- | ----------------------------- | ---------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/enrichment/crawl4ai.ts` | `lib/web-evidence-adapter.ts` | `extractMarkdown` return value includes `statusCode` | WIRED  | `web-evidence-adapter.ts:653` destructures `{ markdown, title, statusCode }` from `extractMarkdown`; passes `statusCode` to `processCrawl4aiResult` |
| `lib/research-executor.ts`   | EvidenceItem create loop      | Filter applied before `db.evidenceItem.create`       | WIRED  | `evidenceDrafts` (filtered variable) is used at line 1250 for scoring and line 1296 for the create loop — filter at 1240 is upstream of both        |

### Requirements Coverage

| Requirement | Source Plan   | Description                                                                                   | Status    | Evidence                                                                                                                                                   |
| ----------- | ------------- | --------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FUNNEL-01   | 65-01-PLAN.md | Crawl4AI path checks HTTP status and skips 4xx/5xx pages before storing evidence              | SATISFIED | `statusCode >= 400` guard in both `crawl4ai.ts` and `web-evidence-adapter.ts:processCrawl4aiResult`; test confirms empty array for 404 URL                 |
| FUNNEL-02   | 65-01-PLAN.md | Fallback/notFound drafts suppressed — no URL-only EvidenceItems stored                        | SATISFIED | `research-executor.ts:1240-1245` filter removes drafts with `metadata.fallback === true` or `metadata.notFound === true` before scoring                    |
| PROMPT-01   | 65-01-PLAN.md | Legacy v1 prompt (`buildLegacyPrompt`, ~260 lines) and associated v1 types/validators deleted | SATISFIED | Zero grep results for `buildLegacyPrompt`, `MasterAnalysisInput`, all v1 type names, all v1 validator names in `lib/`; `tmp-run-analysis-nedri.ts` deleted |

All 3 requirements marked Complete in `REQUIREMENTS.md` phase tracking table.

### Anti-Patterns Found

None detected in modified files.

### Human Verification Required

None — all success criteria are programmatically verifiable.

### Gaps Summary

No gaps. All four must-haves are verified against actual code. The one TypeScript error reported by `tsc --noEmit` (`lib/enrichment/sitemap.test.ts:29`) is pre-existing and unrelated to this phase — it involves a `Buffer` type in a test mock and exists in the repository history prior to these commits.

---

_Verified: 2026-04-21T11:55:40Z_
_Verifier: Claude (gsd-verifier)_
