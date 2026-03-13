---
phase: 50-master-prompt-rebuild
plan: '01'
subsystem: analysis
tags: [master-prompt, narrative-analysis, evidence-pipeline, types, gemini]
dependency_graph:
  requires: [49-02]
  provides: [NarrativeAnalysis, generateNarrativeAnalysis, buildMasterPrompt-v2]
  affects:
    [
      lib/analysis/types.ts,
      lib/analysis/master-prompt.ts,
      lib/analysis/master-analyzer.ts,
    ]
tech_stack:
  added: []
  patterns: [input-shape-dispatch, type-guard, validator-chain]
key_files:
  created: []
  modified:
    - lib/analysis/types.ts
    - lib/analysis/master-prompt.ts
    - lib/analysis/master-analyzer.ts
decisions:
  - MasterAnalysisInput.intentVars typed as `any` to preserve backward compat without circular import from extraction/types
  - Both tasks committed atomically (types change caused immediate master-prompt errors)
  - isNarrativeInput type guard dispatches buildMasterPrompt to v1 or v2 builder
metrics:
  duration: '15 minutes'
  completed_date: '2026-03-13'
  tasks_completed: 2
  files_modified: 3
---

# Phase 50 Plan 01: Rebuild Analysis Types and Master Prompt for Narrative Output Summary

**One-liner:** New analysis-v2 type contract with NarrativeAnalysis, raw EvidenceItem input, and boardroom narrative JSON replacing rigid trigger/track KPI structure.

## What Was Built

### Task 1: Rebuild analysis types for narrative output with raw evidence input

Rewrote `lib/analysis/types.ts` to introduce the analysis-v2 contract alongside deprecated analysis-v1 types.

New types exported:

- `NarrativeSection` — a single narrative paragraph with id, title, body, citations
- `NarrativeAnalysis` — complete v2 output: openingHook, executiveSummary, sections[], spvRecommendations[]
- `SPVRecommendation` — replaces AnalysisTrack with relevanceNarrative instead of scope/relevance
- `EvidenceItem` — raw evidence item with sourceType, snippet, confidenceScore, sourceUrl
- `RagPassageInput` — RAG passage with sourceLabel from Phase 49
- `CrossProspectConnection` — PIPE-05 cross-prospect connection structure
- `NarrativeAnalysisInput` — complete v2 input bundling evidence + passages + prospect + spvs + crossConnections

Legacy analysis-v1 types (`MasterAnalysis`, `AnalysisTrigger`, `AnalysisTrack`, `AnalysisContext`, `AnalysisKPI`, `TriggerCategory`, `MasterAnalysisInput`) kept with `@deprecated` JSDoc. `MasterAnalysisInput.intentVars` typed as `any` to avoid re-introducing the `IntentVariables` import that was removed.

### Task 2: Rewrite master prompt to feed raw evidence + RAG passages for narrative generation

Rewrote `lib/analysis/master-prompt.ts` to dispatch on input shape via `isNarrativeInput()` type guard.

v2 narrative prompt (`buildNarrativePrompt`):

- Prospect profile section (unchanged)
- Raw evidence section: `=== BEWIJS UIT EXTERN ONDERZOEK (N items) ===` — items sorted by confidence descending, up to 60 items, with snippet + source URL (PIPE-01)
- RAG passages section: uses `passage.sourceLabel` from Phase 49 directly (PIPE-02)
- Cross-prospect connections section: `=== KRUISVERBANDEN MET ANDERE PROSPECTS ===` (PIPE-05 structure)
- SPV selection section (unchanged)
- Adaptive instructions (evidence-count based, no more intentVars.sparse)
- Output format: analysis-v2 JSON with openingHook, executiveSummary, sections[], spvRecommendations[]

Updated `lib/analysis/master-analyzer.ts`:

- Added `validateNarrativeAnalysis()` — validates analysis-v2 structure (2-7 sections, 1-4 SPV recs)
- Added `generateNarrativeAnalysis()` — new primary function for v2 callers
- Legacy `generateMasterAnalysis()` preserved unchanged for research-executor.ts compat

## Verification

- `npx tsc --noEmit` — 9 pre-existing errors in `scripts/tmp-run-analysis-nedri.ts` and `lib/enrichment/sitemap.test.ts`, zero new errors from these changes
- `lib/analysis/*.ts` files compile cleanly
- Legacy callers (`lib/research-executor.ts`, `components/public/atlantis-discover-client.tsx`) continue to compile
- `buildMasterPrompt` accepts both `NarrativeAnalysisInput` and `MasterAnalysisInput`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MasterAnalysisInput.intentVars typed as `any` instead of keeping IntentVariables import**

- **Found during:** Task 1
- **Issue:** Plan said to remove `import type { IntentVariables }` from types.ts, but keeping `MasterAnalysisInput.intentVars: IntentVariables` in the deprecated type would require keeping the import. Removing the import and typing as `any` keeps types.ts self-contained and avoids the circular dependency question.
- **Fix:** `intentVars: any` with eslint-disable comment; `buildLegacyPrompt` in master-prompt.ts casts to known shape via local inline type
- **Files modified:** lib/analysis/types.ts, lib/analysis/master-prompt.ts
- **Commit:** acb9722

**2. [Rule 3 - Blocking] Tasks 1 and 2 committed atomically**

- **Found during:** Task 1
- **Issue:** Changing `MasterAnalysisInput.intentVars` from `IntentVariables` to `any` immediately broke master-prompt.ts (TS18046: 'signals' is of type 'unknown' from Object.entries). Both tasks needed to land together.
- **Fix:** Executed Task 2 immediately after Task 1 and committed both atomically.
- **Files modified:** lib/analysis/master-prompt.ts, lib/analysis/master-analyzer.ts
- **Commit:** acb9722

## Commits

| Task            | Commit  | Files                                                                                 |
| --------------- | ------- | ------------------------------------------------------------------------------------- |
| Task 1 + Task 2 | acb9722 | lib/analysis/types.ts, lib/analysis/master-prompt.ts, lib/analysis/master-analyzer.ts |

## Self-Check: PASSED

- lib/analysis/types.ts — FOUND
- lib/analysis/master-prompt.ts — FOUND
- lib/analysis/master-analyzer.ts — FOUND
- .planning/phases/50-master-prompt-rebuild/50-01-SUMMARY.md — FOUND
- commit acb9722 — FOUND
