# Pitfalls — v4.0 Atlantis Partnership Outreach

**Project:** Qualifai — v4.0 milestone additions
**Researched:** 2026-03-03
**Scope:** Common mistakes when adding RAG + multi-project to existing outreach system

## Critical Pitfalls

### P1: Chunk Size Wrong for Financial/Technical Documents

**Risk:** HIGH | **Phase:** 37

The Atlantis documents are dense with specific metrics (EUR 4.673 trillion CAPEX, 100Mt/year steel, PUE ≤1.2). Generic 500-token chunking splits tables mid-row and breaks metric references.

**Prevention:** Split on `## ` headers, keep tables atomic, include parent section header in every chunk. Test retrieval with metric-specific queries before moving to opportunity generation.

### P2: RAG Retrieval Returns Topically Similar But Wrong Passages

**Risk:** HIGH | **Phase:** 38

pgvector returns passages about "energy storage capacity" when asked about "datacenter capacity" because both mention "GW" and "capacity." Wrong metrics in opportunity cards destroy credibility.

**Prevention:** Filter by SPV/document ID BEFORE similarity search. Set minimum cosine threshold (>0.75). AI opportunity generator must validate cited metrics match the retrieved passage (same anti-parroting pattern as existing hypothesis generation).

### P3: Breaking Existing Klarifai Pipeline

**Risk:** MEDIUM-HIGH | **Phase:** 38, 41

Adding RAG to research-executor.ts introduces bugs in the battle-tested Klarifai flow. A Klarifai prospect accidentally triggers RAG, or RAG errors kill the entire research run.

**Prevention:** RAG matching is a SEPARATE function called AFTER existing pipeline. Guard: `if (projectType !== 'atlantis') return;`. RAG failure = graceful degradation (log warning, skip). Regression test: run all 7 existing prospects, verify identical results.

### P4: /discover/ Template Divergence

**Risk:** MEDIUM | **Phase:** 39

Partnership template becomes a completely separate codebase. Bug fixes applied twice. UI inconsistency.

**Prevention:** Extract shared components (`WizardShell`, `TrustBar`, `CTASection`, `SessionTracker`). Only card content differs: `HypothesisCard` vs `OpportunityCard`. Shared `DiscoverLayout` wrapper.

### P5: Scope Creep — Building a RAG Platform

**Risk:** MEDIUM | **Phase:** All

RAG ingestion expands to: document upload UI, version control, real-time editing, search playground, embedding dashboard. The 34-document corpus needs none of this.

**Prevention:** CLI script only. No document management UI. No embedding dashboard. Time-box ingestion to 1 phase. Done = "34 docs ingested, retrieval returns relevant passages."

### P6: Nullable projectId Query Leaks

**Risk:** LOW-MEDIUM | **Phase:** 36

New admin features filter by projectId but miss null (legacy prospects). Queries return empty or crash.

**Prevention:** Backfill migration: create Klarifai seed project, assign all existing prospects, then make projectId non-nullable.

### P7: Opportunity Cards for Non-Matching Industries

**Risk:** MEDIUM | **Phase:** 38

Prospect doesn't fit 4 defined target groups. Poor RAG matches produce weak opportunity cards that show misunderstanding.

**Prevention:** Quality gate for RAG matches (minimum similarity threshold + minimum document matches). Fallback to general Europe's Gate overview docs. Initially: only create Atlantis prospects for the 4 defined target groups.

### P8: Embedding Cost Surprise

**Risk:** LOW | **Phase:** 37

One-time ingestion: 34 docs × ~50 chunks × ~500 tokens = ~850K tokens ≈ $0.02. Per-prospect queries: negligible. Total lifecycle: under $1. Not a real risk, but log costs during ingestion for transparency.

## Summary

| #   | Pitfall                    | Risk     | Phase  | Key Prevention                            |
| --- | -------------------------- | -------- | ------ | ----------------------------------------- |
| P1  | Financial chunk splitting  | HIGH     | 37     | Header-aware splitting, atomic tables     |
| P2  | Wrong passage retrieval    | HIGH     | 38     | SPV filter + threshold + quote validation |
| P3  | Breaking Klarifai pipeline | MED-HIGH | 38, 41 | Separate function + graceful degradation  |
| P4  | Template divergence        | MED      | 39     | Shared components, differ only in cards   |
| P5  | Scope creep                | MED      | All    | CLI-only, no document management UI       |
| P6  | Nullable FK queries        | LOW-MED  | 36     | Backfill migration                        |
| P7  | Non-matching industries    | MED      | 38     | Quality gate + restricted target groups   |
| P8  | Embedding cost             | LOW      | 37     | Under $1 total, log for transparency      |

---

_Researched: 2026-03-03 for v4.0 Atlantis Partnership Outreach_
