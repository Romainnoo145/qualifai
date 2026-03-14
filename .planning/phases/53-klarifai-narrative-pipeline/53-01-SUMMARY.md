---
phase: 53-klarifai-narrative-pipeline
plan: '01'
subsystem: ai
tags: [gemini, analysis, narrative, typescript, prompt-engineering]

# Dependency graph
requires:
  - phase: 50-master-prompt-rebuild
    provides: NarrativeAnalysisInput, buildMasterPrompt, generateNarrativeAnalysis patterns
provides:
  - KlarifaiNarrativeInput, UseCaseInput, UseCaseRecommendation, KlarifaiNarrativeAnalysis types
  - buildKlarifaiNarrativePrompt function in master-prompt.ts
  - generateKlarifaiNarrativeAnalysis function in master-analyzer.ts
  - validateKlarifaiNarrativeAnalysis function in master-analyzer.ts
affects: [53-02, discover-page, research-executor, use-case-routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - buildMasterPrompt three-way dispatch: isKlarifaiInput (useCases) → isNarrativeInput (evidence+passages) → legacy
    - Use Cases as domain knowledge source replaces RAG passages for Klarifai prospects
    - useCaseRecommendations replaces spvRecommendations in output shape

key-files:
  created: []
  modified:
    - lib/analysis/types.ts
    - lib/analysis/master-prompt.ts
    - lib/analysis/master-analyzer.ts

key-decisions:
  - 'KlarifaiNarrativeInput uses useCases (UseCaseInput[]) not passages (RagPassageInput[]) as domain knowledge'
  - "isKlarifaiInput checks for 'useCases' in input — checked before isNarrativeInput to avoid overlap"
  - "isNarrativeInput updated to explicitly exclude useCases ('evidence' in input && !('useCases' in input))"
  - 'KLARIFAI_SYSTEM_PREAMBLE uses workflow-consultant framing; Atlantis SYSTEM_PREAMBLE uses strategic-advisor framing'
  - 'useCaseRecommendations allows 1-6 items (vs spvRecommendations 1-4) to match broader Use Case catalog'

patterns-established:
  - 'Three-way dispatch in buildMasterPrompt: Klarifai (useCases) → Atlantis (evidence+passages) → legacy'
  - 'Klarifai section suggestions: Operationele Bottlenecks, Handmatige Processen, Data & Rapportage, Groeibelemmeringen'

requirements-completed: [KNAR-01, KNAR-04]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 53 Plan 01: Klarifai Narrative Pipeline — Types and Prompt Builder Summary

**Klarifai-specific analysis-v2 pipeline: UseCaseInput as domain knowledge replaces RAG passages, generating useCaseRecommendations instead of spvRecommendations via new buildKlarifaiNarrativePrompt and generateKlarifaiNarrativeAnalysis**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T08:19:55Z
- **Completed:** 2026-03-14T08:23:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added four new types to types.ts: UseCaseInput, UseCaseRecommendation, KlarifaiNarrativeAnalysis, KlarifaiNarrativeInput
- Added buildKlarifaiNarrativePrompt using KLARIFAI_SYSTEM_PREAMBLE and Use Cases section replacing RAG passages
- Updated buildMasterPrompt three-way dispatch: isKlarifaiInput first, then isNarrativeInput, then legacy
- Added validateKlarifaiNarrativeAnalysis and generateKlarifaiNarrativeAnalysis to master-analyzer.ts
- All TypeScript and ESLint checks pass with zero errors in modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Klarifai narrative types and prompt builder** - `b061496` (feat)
2. **Task 2: Extend master analyzer for Klarifai narrative validation and generation** - `9628a8f` (feat)

## Files Created/Modified

- `lib/analysis/types.ts` - Added UseCaseInput, UseCaseRecommendation, KlarifaiNarrativeAnalysis, KlarifaiNarrativeInput types
- `lib/analysis/master-prompt.ts` - Added KLARIFAI_SYSTEM_PREAMBLE, buildKlarifaiNarrativePrompt, isKlarifaiInput; updated buildMasterPrompt dispatch
- `lib/analysis/master-analyzer.ts` - Added validateUseCaseRecommendation, validateKlarifaiNarrativeAnalysis, generateKlarifaiNarrativeAnalysis

## Decisions Made

- KlarifaiNarrativeInput uses `useCases: UseCaseInput[]` as domain knowledge (replaces `passages: RagPassageInput[]`)
- `isKlarifaiInput` checks for `'useCases' in input` and is checked before `isNarrativeInput` in dispatch
- `isNarrativeInput` updated to explicitly exclude Klarifai inputs: `'evidence' in input && !('useCases' in input)`
- KLARIFAI_SYSTEM_PREAMBLE uses workflow-consultant framing (process automation); Atlantis uses strategic-advisor framing (partnership)
- `useCaseRecommendations` allows 1-6 items to match broader Use Case catalog (vs spvRecommendations 1-4)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Klarifai narrative pipeline types, prompt builder, and generation function are complete
- Ready for Plan 02: wire up Use Cases from DB into KlarifaiNarrativeInput and call generateKlarifaiNarrativeAnalysis from research executor

---

_Phase: 53-klarifai-narrative-pipeline_
_Completed: 2026-03-14_
