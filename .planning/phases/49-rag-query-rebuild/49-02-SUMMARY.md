---
phase: 49-rag-query-rebuild
plan: 02
subsystem: api
tags: [rag, retriever, ranking, passage, scoring, evidence, attribution]

# Dependency graph
requires:
  - phase: 49-01
    provides: AI-driven RAG query builder with three-level fallback strategy
provides:
  - Evidence-aware passage ranking with up to +25 score boost for evidence-overlapping passages
  - sourceLabel field on RagRetrievedPassage for ready-to-use downstream rendering
  - Extracted lib/rag/ranker.ts with EvidenceSignal type and enhanced rankRagPassagesForProspect
affects: [49-03, master-prompt, research-executor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Extract large functions from over-limit files into dedicated modules, re-export to preserve callers'
    - 'Layer evidence-aware scoring on top of existing scoring — additive, not replacement'
    - 'Optional parameter pattern for backward-compatible function enhancement'

key-files:
  created:
    - lib/rag/ranker.ts
  modified:
    - lib/rag/retriever.ts
    - lib/research-executor.ts

key-decisions:
  - 'Extract rankRagPassagesForProspect to lib/rag/ranker.ts since retriever.ts was already 707 lines (plan threshold: 300)'
  - 'Re-export from retriever.ts to keep all existing callers (scripts, research-executor) working without import changes'
  - 'evidenceSignals is optional — steel manufacturer gets +25 boost, callers without evidence get unchanged behavior'

patterns-established:
  - 'sourceLabel: computed once at retrieval time, format is volume + title + SPV name'
  - 'Evidence scoring: top 10 signals by confidence, 4+ char tokens, up to +25 via Math.min(25, overlap * 2.5)'

requirements-completed:
  - RAG-02
  - RAG-03

# Metrics
duration: 25min
completed: 2026-03-13
---

# Phase 49 Plan 02: RAG Passage Ranking Summary

**Evidence-aware RAG passage ranker with sourceLabel attribution — steel manufacturer prospects now boost groenstaal/DRI passages up to +25 over generic hydrogen/wind results using actual evidence signal overlap**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-13T09:47:00Z
- **Completed:** 2026-03-13T10:12:00Z
- **Tasks:** 1
- **Files modified:** 3 (+ 1 created)

## Accomplishments

- Added `sourceLabel: string` to `RagRetrievedPassage` type — format: `"{volume} — {title} (SPV: {name})"` or shorter variants when fields are absent
- Extracted `rankRagPassagesForProspect` from 707-line retriever.ts into dedicated `lib/rag/ranker.ts` with `EvidenceSignal` type
- Added evidence-aware scoring: top 10 evidence snippets (by confidence, 80 chars each) tokenized → passage overlap → up to +25 boost, layered on top of existing profile overlap (+20), focus lens (+18), SPV match (+14)
- Updated `research-executor.ts` to pass non-RAG evidence records as evidence signals when calling the ranker
- Preserved backward compatibility: `evidenceSignals` is optional, all existing callers (tmp scripts) continue to work unmodified

## Task Commits

1. **Task 1: Add source attribution and evidence-aware ranking** - `f163513` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/rag/ranker.ts` - New module: rankRagPassagesForProspect with EvidenceSignal type and evidence-aware scoring
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/rag/retriever.ts` - Added sourceLabel to RagRetrievedPassage, populated in retrieveRagPassages, re-exports from ranker.ts
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/research-executor.ts` - Passes evidence signals (filtered non-RAG) to rankRagPassagesForProspect

## Decisions Made

- Extracted ranker to separate file since retriever.ts was already 707 lines — plan explicitly instructed this if it would exceed 300 lines
- Re-exported `rankRagPassagesForProspect` from retriever.ts to avoid breaking existing tmp script callers that import from `lib/rag/retriever`
- Evidence scoring is additive: max +25 on top of the existing +20 profile overlap and +18 focus lens, ensuring steel-specific passages reliably outrank generic ones for steel manufacturer prospects

## Deviations from Plan

None — plan executed exactly as written. The file extraction to ranker.ts was explicitly specified in the plan as the required approach when file would exceed 300 lines.

## Issues Encountered

- `scripts/tmp-run-analysis-nedri.ts` imports `retrieveRagChunks` which never existed — pre-existing bug, out of scope, logged to deferred items
- `lib/enrichment/sitemap.test.ts` has a pre-existing Buffer BodyInit type error — out of scope

## Next Phase Readiness

- `sourceLabel` is available on all retrieved passages — 49-03 (master prompt) can reference it directly without reconstruction
- Evidence-aware ranking is active — Nedri/Heijmans reruns will benefit from steel-specific evidence boosting groenstaal passages
- 49-03: Update master-prompt.ts to use sourceLabel in passage citations and remove any manual label reconstruction

---

_Phase: 49-rag-query-rebuild_
_Completed: 2026-03-13_
