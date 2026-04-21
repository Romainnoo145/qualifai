---
phase: 65-surgical-funnel-fixes-dead-code
plan: '01'
subsystem: evidence-pipeline
tags: [evidence, crawl4ai, dead-code, cleanup, funnel]
dependency_graph:
  requires: []
  provides: [FUNNEL-01, FUNNEL-02, PROMPT-01]
  affects:
    [
      lib/enrichment/crawl4ai.ts,
      lib/web-evidence-adapter.ts,
      lib/research-executor.ts,
      lib/analysis/master-prompt.ts,
      lib/analysis/types.ts,
      lib/analysis/master-analyzer.ts,
    ]
tech_stack:
  added: []
  patterns: [HTTP status gate, fallback filter, dead code deletion]
key_files:
  created: []
  modified:
    - lib/enrichment/crawl4ai.ts
    - lib/enrichment/crawl4ai.test.ts
    - lib/web-evidence-adapter.ts
    - lib/research-executor.ts
    - lib/analysis/master-prompt.ts
    - lib/analysis/types.ts
    - lib/analysis/master-analyzer.ts
  deleted:
    - scripts/tmp-run-analysis-nedri.ts
decisions:
  - Filter fallback/notFound before scoring (not after) to keep scoredMap indices aligned
  - statusCode: 0 used for unknown/error states (catch block, non-ok HTTP responses)
  - buildMasterPrompt now throws implicitly via TypeScript union narrowing (no explicit throw needed)
metrics:
  duration_minutes: 20
  completed_date: '2026-04-21'
  tasks_completed: 2
  tasks_total: 2
  files_modified: 7
  files_deleted: 1
---

# Phase 65 Plan 01: Surgical Funnel Fixes + Dead Code Summary

**One-liner:** HTTP 4xx/5xx gate on Crawl4AI, fallback/notFound stub filter before DB, and 465-line v1 legacy deletion.

## What Was Built

Three surgical fixes to the evidence pipeline with zero new dependencies and zero schema changes:

1. **FUNNEL-01 — Crawl4AI HTTP status gate:** Extended `Crawl4AiResult` interface with `status_code?: number` (v0.8.x field). `extractMarkdown` now returns `statusCode` alongside `markdown` and `title`. Both `ingestCrawl4aiEvidenceDrafts` and `processCrawl4aiResult` in `web-evidence-adapter.ts` skip URLs that return HTTP 4xx/5xx, preventing 404 pages from generating evidence items.

2. **FUNNEL-02 — Fallback/notFound filter:** In `research-executor.ts`, added a filter after `dedupeEvidenceDrafts` that removes any draft with `metadata.fallback === true` or `metadata.notFound === true` before AI scoring and DB insert. These URL-only stubs are noise, not evidence.

3. **PROMPT-01 — Legacy v1 deletion:** Removed `buildLegacyPrompt` (~220 lines), all v1 output/input types (`AnalysisKPI`, `AnalysisContext`, `TriggerCategory`, `AnalysisTrigger`, `AnalysisTrack`, `MasterAnalysis`, `MasterAnalysisInput`), all v1 validation functions (`validateKPI`, `validateContext`, `validateTrigger`, `validateTrack`, `validateMasterAnalysis`), and deleted `scripts/tmp-run-analysis-nedri.ts`.

## Commits

| Task | Commit    | Description                                 |
| ---- | --------- | ------------------------------------------- |
| 1    | `5653857` | HTTP status gate + fallback/notFound filter |
| 2    | `f7e9eda` | Delete v1 prompt code, types, validation    |

## Tests

- 12/12 tests pass in `lib/enrichment/crawl4ai.test.ts`
- Updated 3 existing `extractMarkdown` assertions to include `statusCode`
- Added 2 new tests: statusCode 404 propagation, empty array for 404 URL
- TypeScript compiles with zero errors in modified files (1 pre-existing error in `lib/enrichment/sitemap.test.ts` — unrelated, out of scope)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files exist:

- `lib/enrichment/crawl4ai.ts` ✓ (contains statusCode)
- `lib/web-evidence-adapter.ts` ✓ (contains statusCode >= 400)
- `lib/research-executor.ts` ✓ (contains fallback === true filter)
- `lib/analysis/master-prompt.ts` ✓ (no buildLegacyPrompt)
- `lib/analysis/types.ts` ✓ (no v1 types)
- `lib/analysis/master-analyzer.ts` ✓ (no v1 validation functions)

Commits exist:

- `5653857` ✓
- `f7e9eda` ✓

## Self-Check: PASSED
