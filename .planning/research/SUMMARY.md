# Research Summary — v4.0 Atlantis Partnership Outreach

**Project:** Qualifai — v4.0 milestone additions
**Researched:** 2026-03-03
**Confidence:** HIGH — based on direct analysis of existing codebase architecture, Europe's Gate RAG document corpus (34 files, 8 volumes), and conversation-driven design exploration.

## Stack Additions

| Addition          | Package               | Rationale                                     |
| ----------------- | --------------------- | --------------------------------------------- |
| pgvector          | PostgreSQL extension  | In-database vectors, no external infra needed |
| OpenAI Embeddings | `openai` ^4.x         | Best price/performance, $0.05 one-time cost   |
| Custom Chunker    | ~120 LOC              | Markdown-aware, preserves tables and metrics  |
| **Total:**        | **1 new npm package** | Everything else covered by existing stack     |

**Explicitly excluded:** LangChain, LlamaIndex, Pinecone, ChromaDB, local embedding models. All overkill for 34 well-structured documents.

## Feature Table Stakes

1. **Project/SPV data model** — Project, SPV, ProjectDocument, DocumentChunk entities
2. **RAG ingestion** — CLI script, markdown chunking, OpenAI embedding, pgvector storage
3. **Dual evidence pipeline** — existing external research + new RAG matching (projectType-gated)
4. **Opportunity generation** — AI bridges external findings with RAG passages → 2-4 cards per prospect
5. **Partnership /discover/ template** — different from pain-hypothesis wizard, shared shell components
6. **Admin project filter** — sidebar selector, prospect list filtering by project

## Key Differentiators

- **Dual evidence bridge:** "We found your problem (external research) + Here's our solution (RAG documents)" — this is the unique value proposition, not just RAG retrieval
- **SPV routing:** Prospect industry → SPV → filtered document corpus → targeted opportunity cards
- **Metric attribution:** Every metric on an opportunity card cites a specific document and section

## Architecture Summary

- **~1,500 LOC new code** across 9 new modules
- **6 phases** suggested build order: Schema → RAG Ingestion → Retrieval/Integration → /discover/ Template → Admin → E2E Testing
- **Clean separation:** projectType determines pipeline additions and template rendering. Shared infrastructure untouched.
- **Migration strategy:** Nullable projectId → backfill → non-nullable

## Watch Out For

1. **P1 (HIGH):** Financial table chunking — must keep tables atomic, test with metric queries
2. **P2 (HIGH):** RAG hallucination via similarity — filter by SPV before search, validate quotes
3. **P3 (MED-HIGH):** Breaking Klarifai pipeline — separate RAG function, graceful degradation, regression test
4. **P5 (MED):** Scope creep to RAG platform — CLI only, no document UI, time-box to 1 phase

## Build Order

| Phase | Focus                                  | Dependencies           |
| ----- | -------------------------------------- | ---------------------- |
| 36    | Schema + Seed Data                     | None (foundation)      |
| 37    | RAG Ingestion Pipeline                 | Phase 36 schema        |
| 38    | Retrieval + Evidence Integration       | Phase 37 data          |
| 39    | Partnership /discover/ Template        | Phase 38 opportunities |
| 40    | Admin Project Management               | Phase 36 schema        |
| 41    | Integration Test + First Real Prospect | All above              |

**Note:** Phases 36 and 40 could potentially run in parallel (schema + admin UI are somewhat independent of RAG pipeline), but sequential is safer for a first-time pattern.

## Research Files

- `.planning/research/STACK.md` — Technology additions (pgvector, OpenAI embeddings)
- `.planning/research/FEATURES.md` — Feature categories with table stakes/differentiators/anti-features
- `.planning/research/ARCHITECTURE.md` — Schema design, module plan, data flow, build order
- `.planning/research/PITFALLS.md` — 8 pitfalls with risk levels and prevention strategies

---

_Synthesized: 2026-03-03 for v4.0 Atlantis Partnership Outreach_
