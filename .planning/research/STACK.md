# Technology Stack — v4.0 Atlantis Partnership Outreach

**Project:** Qualifai — v4.0 milestone additions
**Researched:** 2026-03-03
**Scope:** NEW capabilities only. Existing validated stack (Next.js 16, tRPC 11, Prisma 7, PostgreSQL, Anthropic Claude SDK ^0.73.0, @google/generative-ai 0.24.0, Apollo API, SerpAPI, Crawl4AI REST, Scrapling, Resend, Cal.com) is NOT re-researched here.

## New Stack Additions

### 1. pgvector — Vector Storage in PostgreSQL

**What:** PostgreSQL extension for vector similarity search.
**Version:** pgvector 0.8.x (latest as of 2026)
**Why:** Already running PostgreSQL via Docker. Adding pgvector avoids external vector DB (Pinecone, Weaviate) — no new infra, no new billing, no new auth. Prisma supports raw SQL for vector queries.

**Integration:**

- Add to Docker Compose: `CREATE EXTENSION IF NOT EXISTS vector;`
- Prisma: use `Unsupported("vector(1536)")` column type + raw `$queryRaw` for similarity queries
- Index: `CREATE INDEX ON document_chunk USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`

**What NOT to add:** No Pinecone, ChromaDB, Weaviate, Qdrant. These add external infrastructure for a corpus of only 34 documents (~1,700 chunks). pgvector handles this trivially in-process.

### 2. Embedding Model — OpenAI text-embedding-3-small

**What:** Converts text chunks into 1536-dimensional vectors for semantic search.
**Package:** `openai` npm package (^4.x)
**Why:** Best price/performance for embedding. $0.02 per 1M tokens. For 34 docs (~1.8M words ≈ 2.4M tokens), initial embedding cost is ~$0.05. Re-embedding is rare.
**Alternative considered:** Gemini embedding (already have @google/generative-ai) — but OpenAI embeddings have better retrieval benchmarks and ecosystem tooling.

**Cost note:** One-time ingestion: ~$0.05. Per-prospect query: ~$0.0002. Total lifecycle: under $1.

**What NOT to add:** No local embedding models (sentence-transformers, Ollama). Corpus is small, API cost is trivial, local models add deployment complexity.

### 3. Document Chunking — Custom markdown-aware splitter

**What:** Custom chunking logic for structured markdown with frontmatter, headers, tables, and financial data.
**Package:** No dependency needed. Custom `chunkMarkdown()` function (~120 lines).
**Why:** The RAG documents have clear `## ` section boundaries, rich frontmatter, and tables with financial metrics. Generic splitters (LangChain, LlamaIndex) would break tables and lose metadata.

**Chunking strategy:**

- Split on `## ` headers (section boundaries)
- Keep frontmatter as metadata on every chunk (document_id, title, volume, target_audience)
- Target chunk size: 500-1000 tokens
- Tables: keep as atomic chunks (financial data loses meaning when split)
- Include parent section header in each chunk for context

**What NOT to add:** No LangChain, LlamaIndex, or Unstructured. These are heavy frameworks for a well-structured markdown corpus.

### 4. No Other New Dependencies

**Already covered by existing stack:**

- AI generation: Claude SDK or Gemini (existing)
- Database: PostgreSQL + Prisma (existing, just add pgvector extension)
- File reading: Node.js fs (existing)
- Admin UI: React + Tailwind (existing)

**Explicitly excluded:**

- LangChain/LlamaIndex — over-engineered for 34 well-structured documents
- Redis for caching embeddings — PostgreSQL handles vector storage directly
- Elasticsearch — corpus too small
- Separate frontend framework — existing Next.js handles everything

## Summary

| Addition           | Package                     | Why                                    | Est. Cost      |
| ------------------ | --------------------------- | -------------------------------------- | -------------- |
| Vector storage     | pgvector (Docker extension) | In-database vectors, no external infra | Free           |
| Embeddings         | openai ^4.x                 | Best price/performance for retrieval   | ~$0.05 initial |
| Chunking           | Custom ~120 LOC             | Markdown-aware, preserves structure    | Zero           |
| **Total new deps** | **1 npm package**           |                                        |                |

## Integration Points

1. **Docker Compose:** Add `CREATE EXTENSION vector` to PostgreSQL init script
2. **Prisma schema:** Add DocumentChunk model with `Unsupported("vector(1536)")` column
3. **Ingestion script:** `scripts/ingest-rag-documents.mjs` — reads markdown, chunks, embeds, stores
4. **Retrieval function:** `lib/rag/retriever.ts` — cosine similarity search with SPV/document metadata filtering
5. **Opportunity generation:** New function parallel to existing `generateHypothesisDraftsAI()` — takes external evidence + RAG passages → opportunity cards

---

_Researched: 2026-03-03 for v4.0 Atlantis Partnership Outreach_
