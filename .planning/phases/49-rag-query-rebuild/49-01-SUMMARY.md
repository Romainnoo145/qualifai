---
phase: 49-rag-query-rebuild
plan: '01'
subsystem: rag
tags: [rag, query-builder, gemini, ai-driven, fallback]
dependency_graph:
  requires: []
  provides: [lib/rag/query-builder.ts, AI-driven RAG query generation]
  affects: [lib/research-executor.ts, Atlantis pipeline RAG retrieval]
tech_stack:
  added: []
  patterns: [lazy-genai-init, evidence-aware-prompting, graceful-fallback-chain]
key_files:
  created:
    - lib/rag/query-builder.ts
  modified:
    - lib/research-executor.ts
decisions:
  - Use Gemini Flash (not Pro) for query generation — fast utility call, not master analysis
  - Return empty array on failure — no throws, callers apply fallback
  - Three-level fallback: AI queries → intent-driven → keyword packs
  - Cap at 20 top evidence items (by confidence) × 150 chars — stays within ~4000 token budget
metrics:
  duration_seconds: 146
  completed_date: '2026-03-13'
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 49 Plan 01: AI-Driven RAG Query Builder Summary

**One-liner:** Gemini Flash analyzes top-20 prospect evidence items to generate 4-6 semantically targeted RAG queries, replacing hardcoded sector keyword packs with evidence-aware prompting.

## What Was Built

### lib/rag/query-builder.ts (created)

Exports `buildEvidenceAwareQueries(input: QueryBuilderInput): Promise<RagQueryInput[]>`.

- Accepts prospect profile (name, industry, description, SPV) + evidence array
- Sorts evidence by confidence, takes top 20, trims to 150 chars each
- Builds a structured prompt asking Gemini Flash for 4-6 queries covering: sector capabilities, operational pain relief, ESG/compliance, financial fit, strategic partnership value
- Uses `responseMimeType: 'application/json'` + fallback JSON extraction from markdown fences
- Returns empty array on any failure — no throws propagate
- Lazy `getGenAI()` init pattern, `process.env.GOOGLE_AI_API_KEY` (same as master-analyzer.ts)

### lib/research-executor.ts (modified)

Replaced the dual `useIntentQueries ? ... : ...` strategy with a three-level fallback chain:

1. **Primary:** `buildEvidenceAwareQueries` — AI-driven from evidence
2. **Fallback 1:** `buildRagQueryInputsFromIntent` — intent-driven (if populatedCount >= 2)
3. **Fallback 2:** `buildRagQueryInputs` — keyword packs from sector inference

Diagnostic message now identifies which strategy was used: "AI-driven RAG queries (N queries)" or "Fallback: intent-driven ..." or "Fallback: keyword ...".

## Verification

- `lib/rag/query-builder.ts` — no TypeScript errors
- `lib/research-executor.ts` — no TypeScript errors
- `GEMINI_MODEL_FLASH` already existed in `lib/ai/constants.ts`
- `retrieveRagPassages` and `rankRagPassagesForProspect` unchanged (Plan 02 territory)
- All pre-commit hooks passed (eslint + prettier)

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Hash    | Message                                                                   |
| ---- | ------- | ------------------------------------------------------------------------- |
| 1    | f61beae | feat(49-01): create AI-driven RAG query builder module                    |
| 2    | 0cd8683 | feat(49-01): integrate AI query builder into pipeline with fallback chain |

## Self-Check: PASSED

- lib/rag/query-builder.ts: FOUND
- lib/research-executor.ts: modified with import + three-level fallback
- Commits f61beae and 0cd8683: FOUND in git log
- GEMINI_MODEL_FLASH constant: FOUND in lib/ai/constants.ts
