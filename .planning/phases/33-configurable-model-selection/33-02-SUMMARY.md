---
phase: 33-configurable-model-selection
plan: 02
subsystem: api
tags:
  [
    anthropic-sdk,
    gemini,
    hypothesis-generation,
    model-selection,
    chain-of-thought,
    tdd,
  ]

# Dependency graph
requires:
  - phase: 33-configurable-model-selection
    provides: hypothesisModel parameter stub + MODEL-01/ANLYS-08 RED test scaffold (Plan 33-01)
  - phase: 32-hypothesis-prompt-rewrite
    provides: generateHypothesisDraftsAI with confirmedPainTags parameter and 7 GREEN ANLYS tests
provides:
  - Claude Sonnet path via Anthropic SDK in generateHypothesisDraftsAI (model branching)
  - extractHypothesisJson() helper — CoT reasoning strip + JSON array extraction (shared Gemini+Claude)
  - Chain-of-thought <reasoning> block in prompt for both models
  - hypothesisModel parameter threading from tRPC startRun input → executeResearchRun → generateHypothesisDraftsAI
  - hypothesisModel persisted in inputSnapshot at all 4 write locations for retryRun consistency
affects:
  [
    33-03-ui-model-selector,
    34-metric-derivation,
    research-executor,
    workflow-engine,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'getAnthropicClient() lazy init follows getGenAI() pattern — module-level singleton, initialized on first call'
    - 'extractHypothesisJson() shared helper strips <reasoning>...</reasoning> before JSON parse — works for both Gemini and Claude paths'
    - 'Model branching: hypothesisModel === claude-sonnet → Anthropic SDK; else → Gemini (backward-compatible default)'
    - 'hypothesisModel persisted in inputSnapshot alongside deepCrawl — retryRun reads both from snapshot (not tRPC input)'

key-files:
  created: []
  modified:
    - lib/ai/constants.ts
    - lib/workflow-engine.ts
    - lib/research-executor.ts
    - server/routers/research.ts

key-decisions:
  - 'CLAUDE_MODEL_SONNET = claude-sonnet-4-5 (not claude-3-5-sonnet) — specific version pinned in constant'
  - 'extractHypothesisJson is shared for Gemini and Claude paths — both models produce same <reasoning>+JSON structure'
  - 'CoT reasoning logged at max 300 chars (console.log) — observable in server output without noise'
  - 'hypothesisModel defaults to gemini-flash in all 4 inputSnapshot writes — retryRun never gets undefined'

patterns-established:
  - 'Pattern 1: Model-branching — if (hypothesisModel === claude-sonnet) { Anthropic } else { Gemini } wraps identical pre/post logic'
  - 'Pattern 2: CoT extraction — extractHypothesisJson() strips reasoning block before JSON parse; reasoning field logged for observability'

requirements-completed: [MODEL-01, ANLYS-08]

# Metrics
duration: 8min
completed: 2026-03-02
---

# Phase 33 Plan 02: Configurable Model Selection Implementation Summary

**Claude Sonnet path via Anthropic SDK + chain-of-thought <reasoning> prompt + extractHypothesisJson helper + full hypothesisModel threading from tRPC to function with inputSnapshot persistence**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-02T14:52:00Z
- **Completed:** 2026-03-02T15:00:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `CLAUDE_MODEL_SONNET = 'claude-sonnet-4-5'` constant to lib/ai/constants.ts
- Implemented `getAnthropicClient()` lazy init + model branching in generateHypothesisDraftsAI (claude-sonnet → Anthropic SDK, else → Gemini)
- Added `extractHypothesisJson()` shared helper that strips `<reasoning>...</reasoning>` block and extracts JSON array — used by both Gemini and Claude paths
- Added CoT prompt instruction: before JSON, produce `<reasoning>` block with top signals, confirmed pains, website exclusions
- Threaded `hypothesisModel` from tRPC `startRun` input → `executeResearchRun` → `generateHypothesisDraftsAI`
- `retryRun` reads `hypothesisModel` from `inputSnapshot` (not tRPC input — consistent with `deepCrawl` pattern)
- `hypothesisModel` persisted in all 4 `inputSnapshot` write locations (initial create, initial update, deepCrawl cache-miss, deepCrawl cache-hit)
- All 5 MODEL-01 + ANLYS-08 tests GREEN; all 7 ANLYS-01 through ANLYS-07 tests remain GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CLAUDE_MODEL_SONNET constant + CoT prompt + extractHypothesisJson + Claude path** - `c5f7555` (feat)
2. **Task 2: Thread hypothesisModel through tRPC router and research-executor** - `886122a` (feat)

**Plan metadata:** (in final commit below)

## Files Created/Modified

- `lib/ai/constants.ts` — Added `CLAUDE_MODEL_SONNET = 'claude-sonnet-4-5' as const`
- `lib/workflow-engine.ts` — Added Anthropic SDK imports, `getAnthropicClient()`, `extractHypothesisJson()`, CoT prompt block, model branching if/else
- `lib/research-executor.ts` — Added `hypothesisModel` to executeResearchRun input type; persisted in all 4 inputSnapshot writes; passed to generateHypothesisDraftsAI
- `server/routers/research.ts` — Added `hypothesisModel` z.enum to startRun input; retryRun reads from inputSnapshot; both pass through to executeResearchRun

## Decisions Made

- `CLAUDE_MODEL_SONNET = 'claude-sonnet-4-5'` — specific model ID pinned as const for traceability
- `extractHypothesisJson` is shared for both Gemini and Claude — both models receive the same CoT prompt instruction and produce the same `<reasoning>+JSON` structure
- CoT reasoning is logged at 300 char max — visible in server output for observability without flooding logs
- `hypothesisModel` defaults to `'gemini-flash'` at all 4 inputSnapshot write sites — `retryRun` never encounters `undefined` when reading from snapshot

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled cleanly on first attempt, all tests passed as expected.

## User Setup Required

None - `@anthropic-ai/sdk` was already a project dependency (`^0.73.0`). No new env vars required (ANTHROPIC_API_KEY was already present).

## Next Phase Readiness

- MODEL-01 and ANLYS-08 requirements fully implemented and GREEN
- Full call chain wired: `tRPC startRun → executeResearchRun → generateHypothesisDraftsAI → Anthropic SDK`
- `retryRun` restores `hypothesisModel` from `inputSnapshot` — retry consistency guaranteed
- Plan 33-03 can add UI model selector (dropdown in research run form) using the `hypothesisModel` tRPC parameter now available
- Pre-existing test failure `uses reviews-first evidence ordering for construction/install profiles` remains deferred (out of scope, predates Phase 33, logged in deferred-items.md)

---

_Phase: 33-configurable-model-selection_
_Completed: 2026-03-02_
