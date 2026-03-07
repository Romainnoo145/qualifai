---
phase: 42-extraction-matrix
plan: 02
subsystem: ai, ui
tags: [rag, intent-extraction, pgvector, trpc, react]

# Dependency graph
requires:
  - phase: 42-01
    provides: IntentVariables type contract, extractIntentVariables function, IntentExtraction Prisma model
provides:
  - buildRagQueryInputsFromIntent function for targeted semantic RAG queries
  - Intent Signals admin tab for Atlantis prospect detail
  - getIntentExtraction tRPC endpoint
affects:
  [
    43 (AI master analysis consumes intent-driven RAG passages),
    44 (discover rendering uses intent-aware content),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns: [intent-driven-rag-queries, category-card-ui]

key-files:
  created:
    - components/features/prospects/intent-signals-section.tsx
  modified:
    - lib/rag/retriever.ts
    - lib/research-executor.ts
    - server/routers/research.ts
    - app/admin/prospects/[id]/page.tsx

key-decisions:
  - 'Intent-driven queries use top 2-3 signals per category for concise semantic queries (max 200 chars)'
  - 'Fallback to keyword-stuffed queries when intent extraction has < 2 populated categories'
  - 'rag_query_strategy diagnostic tracks which query mode was used per run'
  - 'Intent Signals tab only shown for ATLANTIS projectType prospects'

patterns-established:
  - 'Intent-driven RAG: extract signals -> build targeted queries per category -> retrieve relevant passages'
  - 'Conditional tab visibility: filter tab array by projectType before rendering'

requirements-completed: [EXTR-02, EXTR-03]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 42 Plan 02: Intent-Driven RAG & Admin UI Summary

**Intent-variable-driven RAG queries replacing keyword-stuffed blobs with targeted per-category semantic queries, plus admin Intent Signals tab showing extracted categories with confidence scores**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T15:11:21Z
- **Completed:** 2026-03-07T15:15:13Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Built buildRagQueryInputsFromIntent that generates one concise semantic query per populated intent category
- Research executor selects intent-driven or keyword-fallback strategy based on extraction quality (>= 2 categories)
- Created IntentSignalsSection component with category cards, confidence badges, source type chips, and external links
- Added Intent Signals tab to admin prospect detail (Atlantis only) between Evidence and Analysis

## Task Commits

Each task was committed atomically:

1. **Task 1: Intent-driven RAG query builder + research executor integration** - `6e78769` (feat)
2. **Task 2: Admin Intent Signals UI section** - `a61eadc` (feat)

## Files Created/Modified

- `lib/rag/retriever.ts` - Added buildRagQueryInputsFromIntent function with CATEGORY_LABELS and MAX_INTENT_QUERY_LENGTH
- `lib/research-executor.ts` - Conditional intent-driven vs keyword-fallback RAG query strategy with rag_query_strategy diagnostic
- `server/routers/research.ts` - Added getIntentExtraction tRPC query endpoint
- `components/features/prospects/intent-signals-section.tsx` - Intent Signals UI component with category cards and sparse warning
- `app/admin/prospects/[id]/page.tsx` - Intent Signals tab added to BASE_TABS, filtered to ATLANTIS projectType

## Decisions Made

- Used top 2-3 signals sorted by confidence per category to build semantic queries (concise, not keyword-stuffed)
- Threshold of >= 2 populated categories for intent-driven queries; below that falls back to keyword strategy
- Added rag_query_strategy to SourceDiagnostic union for tracking query mode in pipeline diagnostics
- Used `as any` cast for intentQuery.data due to tRPC v11 deep inference issue (TS2589), consistent with existing pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added rag_query_strategy to SourceDiagnostic source union type**

- **Found during:** Task 1 (Research executor integration)
- **Issue:** TypeScript error — 'rag_query_strategy' not assignable to SourceDiagnostic source type
- **Fix:** Added 'rag_query_strategy' to the source union type in SourceDiagnostic interface
- **Files modified:** lib/research-executor.ts
- **Verification:** npx tsc --noEmit passes (only pre-existing sitemap.test.ts error)
- **Committed in:** 6e78769 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TS2589 deep inference on getIntentExtraction query result**

- **Found during:** Task 2 (Intent Signals component)
- **Issue:** TypeScript TS2589 "Type instantiation excessively deep" on tRPC query .data access
- **Fix:** Applied `as any` cast with `// TODO: tRPC v11 inference` comment, consistent with existing codebase pattern
- **Files modified:** components/features/prospects/intent-signals-section.tsx
- **Verification:** npx tsc --noEmit passes
- **Committed in:** a61eadc (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both necessary for TypeScript compilation. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Intent-driven RAG passages are now available for Phase 43 (AI Master Analysis) consumption
- IntentSignalsSection provides admin visibility into extraction quality before AI content generation
- Phase 44 (Discover Rendering) can reference intent categories for section organization

---

_Phase: 42-extraction-matrix_
_Completed: 2026-03-07_
