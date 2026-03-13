---
phase: 50-master-prompt-rebuild
plan: '02'
subsystem: analysis
tags:
  [
    research-executor,
    narrative-analysis,
    evidence-pipeline,
    cross-prospect,
    pipeline-wiring,
  ]
dependency_graph:
  requires: [50-01]
  provides: [analysis-v2-pipeline-wiring, cross-prospect-detection]
  affects:
    - lib/research-executor.ts
tech_stack:
  added: []
  patterns: [raw-evidence-passthrough, sourceLabel-mapping, cross-prospect-scan]
key_files:
  created: []
  modified:
    - lib/research-executor.ts
decisions:
  - generateMasterAnalysis (analysis-v1) removed from research-executor imports — no longer called, replaced entirely by generateNarrativeAnalysis
  - crossConnections uses const (not let) because push() mutates the array, not reassigns the variable
  - cross_prospect added to SourceDiagnostic union type to satisfy strict literal type
  - Intent extraction block (Phase 42) preserved unchanged — still drives RAG query fallback chain
metrics:
  duration: '10 minutes'
  completed_date: '2026-03-13'
  tasks_completed: 1
  files_modified: 1
---

# Phase 50 Plan 02: Wire Narrative Analysis into Research Executor Summary

**One-liner:** Research executor now feeds raw evidence + sourceLabel-attributed RAG passages + cross-prospect connections directly to generateNarrativeAnalysis, persisting analysis-v2 content to ProspectAnalysis table.

## What Was Built

### Task 1: Wire narrative analysis into research executor with cross-prospect detection

Updated `lib/research-executor.ts` to replace the Phase 43 `generateMasterAnalysis` call with the new Phase 50 `generateNarrativeAnalysis` pipeline.

**Cross-prospect detection (PIPE-05):**

Added a detection block before the master analysis try block. It queries all other prospects in the same Atlantis project, then scans current prospect's evidence snippets and titles for name mentions. Any match produces a `CrossProspectConnection` entry (companyName, relationship='prospect', evidenceSnippet truncated to 200 chars). Short names (< 3 chars) are skipped to avoid false positives. Results logged to `cross_prospect` diagnostic source.

**Evidence mapping (PIPE-01):**

Evidence records are filtered to exclude RAG_DOCUMENT entries, sorted by `confidenceScore` descending, sliced to top 60 items, and mapped to `EvidenceItem[]` — raw snippets with sourceType, sourceUrl, title, confidenceScore, and workflowTag. No intent extraction compression in this path.

**RAG passage mapping (PIPE-02):**

Ranked RAG passages from Phase 49's `rankRagPassagesForProspect` are mapped to `RagPassageInput[]` using the `sourceLabel` field built by the Phase 49 ranker (format: `"{volume} — {title} (SPV: {name})"`). The `spvName` field is coerced from `undefined` to `null` for type safety.

**Narrative analysis generation:**

`NarrativeAnalysisInput` is constructed with all four ingredients: evidence, passages, prospect profile, SPVs (fetched from DB), and crossConnections. `generateNarrativeAnalysis()` is called, and the result is persisted to `ProspectAnalysis` with:

- `version: 'analysis-v2'`
- `content`: the full `NarrativeAnalysis` JSON
- `modelUsed`: from the result (Gemini 2.5 Pro)
- `inputSnapshot`: `{ evidenceCount, passageCount, crossConnectionCount, spvCount }`

Diagnostic message: `"Narrative analysis generated: N sections, N SPV recommendations"`

**Intent extraction preserved:**

The Phase 42 intent extraction block (lines ~1324-1382) was not touched. `intentVars` is still populated and used in the three-level RAG query fallback chain: AI → intent → keyword. It is no longer passed to the analysis engine.

**Imports cleaned:**

- `generateMasterAnalysis` removed (no longer called)
- `MasterAnalysisInput` removed (no longer used)
- Added: `generateNarrativeAnalysis`, `NarrativeAnalysisInput`, `EvidenceItem`, `RagPassageInput`, `CrossProspectConnection`

## Verification

- `npx tsc --noEmit` — zero errors in lib/research-executor.ts; pre-existing errors in scripts/tmp-run-analysis-nedri.ts and lib/enrichment/sitemap.test.ts unchanged
- `npx eslint lib/research-executor.ts` — clean (0 errors, 0 warnings)
- generateNarrativeAnalysis imported and called in the Atlantis RAG block
- Evidence items passed directly as raw EvidenceItem[] (no intent compression)
- RAG passages mapped with sourceLabel from Phase 49
- Cross-prospect connections detected and passed as CrossProspectConnection[]
- ProspectAnalysis created with version 'analysis-v2'
- Intent extraction block still present for RAG query fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added 'cross_prospect' to SourceDiagnostic union type**

- **Found during:** Task 1
- **Issue:** Plan's cross-prospect code used `source: 'cross_prospect'` in diagnostics.push() but SourceDiagnostic.source had a closed union that didn't include this value, causing TS2322.
- **Fix:** Added `| 'cross_prospect'` to the SourceDiagnostic interface source union.
- **Files modified:** lib/research-executor.ts
- **Commit:** 29c8922

**2. [Rule 1 - Bug] Changed `let crossConnections` to `const crossConnections`**

- **Found during:** Task 1 (ESLint prefer-const)
- **Issue:** Plan used `let crossConnections = []` but since the variable is never reassigned (only mutated via push), ESLint's prefer-const rule fires as an error.
- **Fix:** `let` → `const`.
- **Files modified:** lib/research-executor.ts
- **Commit:** 29c8922

## Commits

| Task   | Commit  | Files                    |
| ------ | ------- | ------------------------ |
| Task 1 | 29c8922 | lib/research-executor.ts |

## Self-Check: PASSED

- lib/research-executor.ts — FOUND
- .planning/phases/50-master-prompt-rebuild/50-02-SUMMARY.md — FOUND
- commit 29c8922 — FOUND
