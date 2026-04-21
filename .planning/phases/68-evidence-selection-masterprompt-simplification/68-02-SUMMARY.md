---
phase: 68-evidence-selection-masterprompt-simplification
plan: 02
subsystem: analysis
tags:
  [
    visual-generator,
    evidence-selector,
    research-executor,
    tdd,
    prompt-03,
    select-01,
  ]
dependency_graph:
  requires: [68-01]
  provides:
    [
      generateSectionVisuals,
      SectionVisualResult,
      wired-pipeline-select-20,
      sourceBreakdown-in-snapshot,
    ]
  affects: [lib/research-executor.ts, lib/analysis/visual-generator.ts]
tech_stack:
  added: []
  patterns: [TDD-red-green, soft-fail-enrichment, batch-flash-call]
key_files:
  created:
    - lib/analysis/visual-generator.ts
    - lib/analysis/visual-generator.test.ts
  modified:
    - lib/research-executor.ts
decisions:
  - 'vi.hoisted() required for mockGenerateContent so the hoisted const is available inside the vi.mock factory'
  - 'Module-level genaiClient cache in visual-generator.ts is safe across tests because vi.mock replaces the entire module — getGenerativeModel always delegates to the hoisted mockGenerateContent'
  - 'Pre-existing TS error in lib/enrichment/sitemap.test.ts confirmed out-of-scope; our changes introduce zero new errors'
metrics:
  duration: 4m
  completed: 2026-04-21
  tasks_completed: 2
  files_modified: 3
---

# Phase 68 Plan 02: Visual Generator + Pipeline Wiring Summary

**One-liner:** Gemini Flash batch visual enrichment per section + top-20 diversity-capped evidence selection wired into both Atlantis and Klarifai pipeline paths.

## Tasks Completed

| Task | Name                                                    | Commit  | Files                                                                   |
| ---- | ------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| 1    | Visual generator with TDD                               | 9c0862a | lib/analysis/visual-generator.ts, lib/analysis/visual-generator.test.ts |
| 2    | Wire selector + visual generator into research-executor | e50dcba | lib/research-executor.ts                                                |

## What Was Built

### Task 1: Visual Generator

`lib/analysis/visual-generator.ts` exports:

- `generateSectionVisuals(sections, evidence)` — sends all sections in a single Gemini Flash batch call. Returns `SectionVisualResult[]` matching input length. On any error (API failure, malformed JSON, unexpected array shape), returns fallback array with only `sectionId` — never throws.
- `SectionVisualResult` type — `{ sectionId, visualType?, visualData? }`.

Dutch-language prompt guides Flash to choose `quote`, `comparison`, `signals`, or `stats` based on actual evidence. `extractJSON` handles direct JSON, markdown-fenced JSON, and raw array extraction.

4 vitest tests: happy path (3 sections, visual types populated), API failure fallback, malformed JSON fallback, empty sections.

### Task 2: Pipeline Wiring

`lib/research-executor.ts` changes:

1. **Imports added:** `selectEvidenceForPrompt`, `buildSourceBreakdown` from evidence-selector; `generateSectionVisuals` from visual-generator.
2. **Atlantis path (line ~1711):** `.sort().slice(0, 60)` replaced with `selectEvidenceForPrompt(allEvidence)` — top-20, max-5-per-source.
3. **Atlantis visual enrichment:** After `generateNarrativeAnalysis`, Flash enriches sections with visual data. Soft-fail: catches all errors, logs warning, falls back to `finalAnalysis = analysisResult`.
4. **Atlantis inputSnapshot:** Now includes `sourceBreakdown: buildSourceBreakdown(evidenceItems)`.
5. **Klarifai path (line ~1925):** Same `.slice(0, 60)` → `selectEvidenceForPrompt(allEvidence)` replacement.
6. **Klarifai visual enrichment:** After `finalResult` is assembled (post-matchProofs merge), Flash enriches sections. Same soft-fail pattern produces `enrichedResult`.
7. **Klarifai inputSnapshot:** Now includes `sourceBreakdown: buildSourceBreakdown(evidenceItems)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test] Fixed vi.mock factory pattern for Gemini constructor**

- **Found during:** Task 1 GREEN phase (test run)
- **Issue:** `vi.fn().mockImplementation(() => ...)` with an arrow function cannot be called with `new` — Vitest warns "did not use 'function' or 'class'". The `GoogleGenerativeAI` constructor call in `getGenAI()` threw "is not a constructor".
- **Fix:** Rewrote the mock factory to use a plain named `function GoogleGenerativeAI(_key)` inside `vi.mock`. Used `vi.hoisted(() => vi.fn())` for `mockGenerateContent` so the const is available in the hoisted factory scope.
- **Files modified:** lib/analysis/visual-generator.test.ts
- **Commit:** 9c0862a (included in task commit)

## Self-Check: PASSED

- lib/analysis/visual-generator.ts: FOUND
- lib/analysis/visual-generator.test.ts: FOUND
- lib/research-executor.ts: FOUND (modified)
- Commit 9c0862a: FOUND
- Commit e50dcba: FOUND
- All 31 vitest tests: PASS (4 test files in lib/analysis/)
- No `.slice(0, 60)` in evidence paths: CONFIRMED
- Both pipeline paths contain `selectEvidenceForPrompt(allEvidence)`: CONFIRMED
- Both pipeline paths contain `generateSectionVisuals(`: CONFIRMED
- Both inputSnapshot blocks contain `sourceBreakdown: buildSourceBreakdown(evidenceItems)`: CONFIRMED
