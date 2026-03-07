---
phase: 42-extraction-matrix
plan: 01
subsystem: ai, database
tags: [gemini-flash, prisma, intent-extraction, pgvector, evidence-pipeline]

# Dependency graph
requires:
  - phase: 36-39 (v4.0 Atlantis Partnership Outreach)
    provides: Atlantis research pipeline with RAG retrieval and evidence scoring
provides:
  - IntentVariables type contract (5 core categories + extras) for Phase 43
  - IntentExtraction Prisma model persisting extraction results per ResearchRun
  - extractIntentVariables function using Gemini Flash for evidence classification
  - intent_extraction diagnostic source in research pipeline
affects:
  [
    42-02 (RAG query construction from intent vars),
    43 (AI master analysis),
    44 (discover rendering),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns: [intent-extraction-pipeline, structured-intermediate-representation]

key-files:
  created:
    - lib/extraction/types.ts
    - lib/extraction/intent-extractor.ts
  modified:
    - prisma/schema.prisma
    - lib/research-executor.ts

key-decisions:
  - 'Gemini Flash for extraction (same pattern as hypothesis generation) with lazy client init'
  - 'Pre-filter evidence to confidenceScore >= 0.50 and exclude RAG_DOCUMENT before extraction'
  - 'Graceful degradation: extraction failure logs warning diagnostic, does not block pipeline'
  - 'intentVars stored in local scope for Plan 02 to use for smarter RAG queries'

patterns-established:
  - 'Intent extraction pipeline: evidence -> AI classification -> structured IntentVariables -> DB persistence'
  - 'Extraction runs before RAG retrieval so intent variables can drive query construction'

requirements-completed: [EXTR-01, EXTR-03]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 42 Plan 01: Extraction Matrix Summary

**Gemini Flash-powered intent extraction classifying scraped evidence into 5 core categories (sector fit, operational pains, ESG/CSRD, investment/growth, workforce) with source attribution, persisted via IntentExtraction model**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T15:04:57Z
- **Completed:** 2026-03-07T15:08:57Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created stable IntentVariables type contract with 5 core categories + optional extras for Phase 43 consumption
- Implemented extractIntentVariables using Gemini Flash that classifies evidence items with per-signal confidence and source attribution
- Added IntentExtraction Prisma model linked to ResearchRun (1:1) and Prospect (1:many)
- Integrated extraction into Atlantis research pipeline before RAG retrieval with graceful degradation

## Task Commits

Each task was committed atomically:

1. **Task 1: Intent variable types + schema + extraction module** - `6c064d2` (feat)
2. **Task 2: Integrate intent extraction into Atlantis research pipeline** - `704baa0` (feat)

## Files Created/Modified

- `lib/extraction/types.ts` - IntentSignal, IntentCategory, IntentVariables type contract with INTENT_CATEGORIES constant
- `lib/extraction/intent-extractor.ts` - extractIntentVariables function using Gemini Flash for evidence classification
- `prisma/schema.prisma` - IntentExtraction model with relations to ResearchRun and Prospect
- `lib/research-executor.ts` - Integration of extraction step in ATLANTIS block before RAG retrieval

## Decisions Made

- Used same lazy GoogleGenerativeAI init pattern as workflow-engine.ts for consistency
- Pre-filter evidence to confidenceScore >= 0.50 and exclude RAG_DOCUMENT sources before sending to AI
- Return empty IntentVariables on parse failure rather than throwing (resilient extraction)
- Added intent_extraction to SourceDiagnostic union type for pipeline diagnostics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added intent_extraction to SourceDiagnostic source union type**

- **Found during:** Task 2 (Research pipeline integration)
- **Issue:** TypeScript error TS2322 — 'intent_extraction' not assignable to SourceDiagnostic source type
- **Fix:** Added 'intent_extraction' to the source union type in SourceDiagnostic interface
- **Files modified:** lib/research-executor.ts
- **Verification:** npx tsc --noEmit passes (only pre-existing sitemap.test.ts error remains)
- **Committed in:** 704baa0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary type union extension for new diagnostic source. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- IntentVariables are available in scope for Plan 02 to use for intent-driven RAG query construction
- IntentExtraction model ready for admin inspection UI (Phase 44)
- Phase 43 (AI Master Analysis) can consume IntentVariables type contract directly

---

_Phase: 42-extraction-matrix_
_Completed: 2026-03-07_
