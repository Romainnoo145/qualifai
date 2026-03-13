# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service the sender actually delivers. No spray-and-pray.
**Current focus:** v7.0 Atlantis Discover Pipeline Rebuild — Master Prompt Rebuild (Phase 50)

## Current Position

Phase: 50-master-prompt-rebuild
Plan: 02 of 2 complete
Status: Executing — plan 50-02 done, Phase 50 complete
Last activity: 2026-03-13 — 50-02 (research-executor narrative analysis wiring) complete

Progress: [██████░░░░░░░░░░░░░░░░░░░░░░░░░░] 25% (4 plans complete in v7.0, Phase 51 next)

## Milestones Shipped

- v1.0 MVP — 2026-02-20 (Phases 1-5)
- v1.1 Evidence-Backed Multi-Touch Outreach — 2026-02-21 (Phases 6-11)
- v1.2 Autopilot with Oversight — 2026-02-22 (Phases 12-15)
- v2.0 Streamlined Flow — 2026-02-23 (Phases 17-22)
- v2.1 Production Bootstrap — 2026-03-02 (Phases 23-27.1)
- v2.2 Verified Pain Intelligence — 2026-03-02 (Phases 28-30)
- v3.0 Sharp Analysis — 2026-03-05 (Phases 31-35)
- v4.0 Atlantis Partnership Outreach — 2026-03-07 (Phases 36-39, 40-41 deferred)
- v5.0 Atlantis Intelligence — 2026-03-08 (Phases 42-45)
- v6.0 Outreach Simplification — 2026-03-08 (Phases 46-47, Phase 48 deferred)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v7.0:

- Evidence collection pipeline (scrapers, 83 items for Nedri) is GOOD — don't touch it
- Problem is everything AFTER evidence collection: intent extraction, RAG retrieval, master prompt, discover UI
- Eliminate lossy intent extraction middle-layer — feed evidence + RAG directly to master prompt
- Master prompt produces narrative content, not rigid JSON categories (triggers/tracks)
- Discover UI should be a flowing document, not a 4-step wizard
- CTA drives NDA signing, not generic "intake"
- Hand-written Nedri example is the gold standard for auto-generated output
- Phase 48 (SERP API Replacement) deferred from v6.0
- [Phase 49-rag-query-rebuild]: Use Gemini Flash for AI RAG query generation with three-level fallback: AI → intent → keyword
- [49-02]: Extract rankRagPassagesForProspect to ranker.ts (file was 707 lines); re-export from retriever.ts to preserve callers
- [49-02]: Evidence scoring is additive (+25 max) on top of profile overlap (+20) and focus lens (+18) — steel manufacturers boost groenstaal passages
- [50-01]: MasterAnalysisInput.intentVars typed as `any` to keep types.ts self-contained (avoids circular import from extraction/types)
- [50-01]: buildMasterPrompt dispatches on isNarrativeInput() type guard — v2 narrative path feeds raw evidence + sourceLabel-attributed RAG passages
- [Phase 50-02]: generateMasterAnalysis removed from research-executor — replaced entirely by generateNarrativeAnalysis (analysis-v2)
- [Phase 50-02]: Intent extraction block preserved for RAG query fallback chain (AI → intent → keyword) — not passed to analysis engine

### Pending Todos

None.

### Blockers/Concerns

- Heijmans has a stuck research run (CRAWLING since Mar 7) — needs rerun with Gemini Pro

## Session Continuity

Last session: 2026-03-13
Stopped at: Completed 50-02-PLAN.md (research-executor narrative analysis wiring — Phase 50 complete)
Resume command: `/gsd:execute-phase 51` (Phase 51: Discover Page Redesign)
