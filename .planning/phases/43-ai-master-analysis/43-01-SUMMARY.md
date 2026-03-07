---
phase: 43-ai-master-analysis
plan: 01
subsystem: ai
tags:
  [
    claude-sonnet,
    anthropic,
    rag,
    intent-extraction,
    partnership,
    prisma,
    structured-output,
  ]

# Dependency graph
requires:
  - phase: 42-extraction-matrix
    provides: IntentVariables type contract and extraction pipeline
provides:
  - MasterAnalysis type contract (context, triggers, tracks)
  - buildMasterPrompt function combining intent vars + RAG + SPV data
  - generateMasterAnalysis Claude Sonnet generation with validation
  - validateMasterAnalysis type-guard for reuse
  - ProspectAnalysis DB model for persistence
affects: [44-discover-rendering, 45-e2e-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      lazy-init-anthropic-client,
      structured-json-output-validation,
      adaptive-tone-prompting,
    ]

key-files:
  created:
    - lib/analysis/types.ts
    - lib/analysis/master-prompt.ts
    - lib/analysis/master-analyzer.ts
    - prisma/migrations/20260307_add_prospect_analysis/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - 'Prompt uses numbered RAG passage references for traceability'
  - 'Adaptive tone: visionary framing when sparse (<2 categories), data-first when rich (>=10 passages)'
  - 'Retry-once strategy with corrective prompt on parse/validation failure, hard fail after 2 attempts'
  - 'JSON extraction supports raw, code blocks, and brace-delimited formats'

patterns-established:
  - 'MasterAnalysis type contract: version, context, triggers, tracks, generatedAt, modelUsed'
  - 'validateMasterAnalysis returns null on invalid (no throw) for reuse in admin/tests'
  - 'Adaptive prompt instructions based on intentVars.sparse and passage count'

requirements-completed: [ANLS-01, ANLS-02, ANLS-03, ANLS-04, ANLS-05]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 43 Plan 01: AI Master Analysis Engine Summary

**Claude Sonnet generation engine producing structured boardroom-Dutch discover content (context + 3 KPIs, 3 trigger cards, 2-3 SPV tracks) from intent variables and RAG passages with adaptive tone**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T16:13:47Z
- **Completed:** 2026-03-07T16:17:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- MasterAnalysis type contract with AnalysisContext, AnalysisTrigger, AnalysisTrack, AnalysisKPI types
- Boardroom Dutch prompt builder with adaptive tone instructions based on data density
- Claude Sonnet generation function with structured JSON validation and retry logic
- ProspectAnalysis DB model with researchRunId unique constraint for 1:1 run mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Analysis types, DB schema, and prompt builder** - `3efee0a` (feat)
2. **Task 2: AI generation function with structured output parsing** - `207ec84` (feat)

## Files Created/Modified

- `lib/analysis/types.ts` - MasterAnalysis output type contract and input types
- `lib/analysis/master-prompt.ts` - Prompt construction with intent vars, RAG passages, SPV data, prospect profile
- `lib/analysis/master-analyzer.ts` - AI generation function with validation and retry
- `prisma/schema.prisma` - ProspectAnalysis model added with relations to Prospect and ResearchRun
- `prisma/migrations/20260307_add_prospect_analysis/migration.sql` - DB migration

## Decisions Made

- Prompt uses numbered RAG passage references so generated content can be traced to source documents
- Adaptive tone based on data density: visionary framing when sparse, data-first when rich passages available
- Retry-once strategy with corrective Dutch prompt on parse/validation failure, hard fail after 2 attempts (analysis quality is critical, no silent degradation)
- JSON extraction handles multiple formats (raw, markdown code blocks, brace-delimited) for robustness
- Trigger categories enforce exactly one of each (market, compliance_esg, capital_derisking) with unique constraint in validation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused INTENT_TO_TRIGGER constant**

- **Found during:** Task 1 (prompt builder)
- **Issue:** TypeScript error for unused variable `INTENT_TO_TRIGGER`
- **Fix:** Removed the constant and unused `TriggerCategory` import from master-prompt.ts
- **Files modified:** lib/analysis/master-prompt.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 3efee0a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor cleanup of unused code. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MasterAnalysis type contract is stable for Phase 44 discover rendering
- generateMasterAnalysis ready to be called from research pipeline
- ProspectAnalysis table ready for persistence
- Phase 43 Plan 02 can integrate this engine into the research execution pipeline

---

_Phase: 43-ai-master-analysis_
_Completed: 2026-03-07_
