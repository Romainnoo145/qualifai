# Feature Landscape — Evidence Pipeline Overhaul

**Domain:** Evidence quality pipeline for B2B sales prospecting AI (Qualifai v10.0)
**Researched:** 2026-04-20
**Confidence:** HIGH (first-party codebase analysis + verified external patterns)

---

## Context: What Already Exists vs. What This Milestone Adds

### Already built and working (do not redesign)

- 8-source scraping pipeline (Scrapling stealth + Crawl4AI browser rendering)
- AI scoring formula: `sourceWeight*0.30 + relevance*0.45 + depth*0.25` via Gemini Flash
- Static source weights (REVIEWS 0.90, LINKEDIN 0.88, NEWS/CAREERS 0.85, REGISTRY 0.80, WEBSITE 0.65)
- URL-level deduplication in `source-discovery.ts`
- HTTP 4xx/5xx skip in the Scrapling stealth path
- `looksLikeCrawled404()` heuristic for Crawl4AI path
- `inferSourceType()` pattern matching (vacatures, werken-bij, etc.)
- Traffic-light quality gate (GREEN/AMBER/RED) with soft override and audit trail
- Use case matching (`matchProofs`) split into a separate Gemini Flash call
- Sector-aware use case fetching (15 sector-matched + 5 cross-sector)

### The problems this milestone fixes (real numbers)

- STB-kozijnen: 233 evidence items, ~60% estimated duplicates, only 60 arbitrary items sent to AI
- Mujjo: 427 evidence items at same structural problem
- Masterprompt doing: narrative writing + visual data selection + citation threading + JSON structuring simultaneously
- visualType/visualData spec (~30 lines of JSON schema) frequently wrong or hallucinated
- `buildLegacyPrompt` (~260 lines) has zero callers — dead code in production
- Crawl4AI path: no HTTP status check before storing items — still leaks 404 content
- Fallback drafts: when stealth fails AND browser budget exhausted, creates EvidenceItem with URL and no content
- `confidenceScore` is static per sourceType, not content-quality based

---

## Table Stakes

Features that must be in this milestone. Missing = the overhaul is incomplete.

| Feature                                            | Why Required                                                                                  | Complexity | Notes                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Crawl4AI 404 fix**                               | Stealth path fixed, browser path still leaks                                                  | Low        | Add HTTP status check parallel to stealth path; Crawl4AI returns response metadata                                           |
| **Fallback draft suppression**                     | Items with no content stored as EvidenceItem pollute every query                              | Low        | Add `hasContent` guard before `createEvidenceItem` in `research-executor.ts`                                                 |
| **Content deduplication at ingestion**             | Same page from sitemap + SERP + default paths = 3 identical items                             | Medium     | Hash-based exact dedup first, then similarity threshold for near-dupes                                                       |
| **Content-quality relevance score per item**       | Static sourceType weights give all WEBSITE items 0.65 regardless of content                   | Medium     | Gemini Flash binary/ternary classification per item at ingestion — not a full scoring call                                   |
| **Drop sub-threshold items before storing**        | Garbage in, garbage out — irrelevant items currently stored and passed to AI                  | Low        | Threshold check after relevance score; don't store items that fail                                                           |
| **Pre-rank evidence set for masterprompt**         | `.slice(0, 60)` by sourceType weight is arbitrary — 173 items ignored with no guarantee       | Medium     | Pre-compute ranked set at analysis time, pass top 20 best items (not top 60 by static weight)                                |
| **Delete dead v1 prompt**                          | 260 lines of `buildLegacyPrompt` with no callers clutters the file                            | Trivial    | Delete, update exports, run typecheck                                                                                        |
| **Remove visualType/visualData from masterprompt** | Gemini frequently ignores or gets the schema wrong when combined with narrative generation    | Medium     | Separate downstream Gemini Flash call per section — input: section body + source citations → output: visualType + visualData |
| **Simplify masterprompt JSON output schema**       | Current schema includes spvRecommendations, visualType, visualData, citations all in one pass | Low        | Output: `{ openingHook, executiveSummary, sections[{id, title, body, punchline, citations}] }` — no visual fields            |

---

## Differentiators

Features that improve output quality significantly but are not blocking.

| Feature                                                   | Value Proposition                                                                                     | Complexity | Notes                                                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| **Source diversity enforcement in top-20 selection**      | Pure relevance ranking can over-select from one source type (e.g., 15 WEBSITE items)                  | Medium     | Group by sourceType, apply per-source caps before final ranking — MMR-lite without embeddings         |
| **Cookie banner / boilerplate filter at ingestion**       | Cookie consent text, privacy policy boilerplate, and "over ons" generic text stored as evidence noise | Low        | Keyword heuristic filter: Dutch cookie/privacy/GDPR patterns + minimum informational density check    |
| **Snippet quality signal (length + information density)** | Current threshold is `>500 chars` — cookie banners pass this easily                                   | Low        | Add information density check: ratio of unique tokens to total tokens; filter items where ratio < 0.4 |
| **Content hash stored on EvidenceItem**                   | Enables future re-dedup runs, change detection, and diff-based signal generation                      | Low        | Store SHA-256 of normalized snippet on `EvidenceItem`; add DB column                                  |
| **Evidence set summary pre-computed for masterprompt**    | Instead of raw items, pass a structured summary: N items per sourceType, themes found                 | Medium     | Intermediate summarization step using Gemini Flash before masterprompt; reduces prompt size by 40-60% |

---

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature                                | Why Avoid                                                                                                                                | What to Do Instead                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Semantic/embedding-based deduplication**  | Requires vector similarity search infrastructure not present in this stack; overkill for 20-400 item sets                                | Use SHA-256 hash of normalized text for exact dedup + Jaccard coefficient on shingled text for near-dedup; no embeddings needed |
| **Re-ranker model or fine-tuned scorer**    | LLM-as-reranker costs $25-30/1000 queries for pointwise scoring; purpose-built rerankers (BGE, Cohere) outperform LLMs on NDCG@10 anyway | Use existing Gemini Flash binary classification (relevant/not-relevant) at ingestion — cheap, sufficient                        |
| **Real-time evidence quality UI**           | Admin dossier page already shows evidence grouped by sourceType; adding quality overlays is scope creep                                  | Surface the content-quality score as a numeric field on existing evidence admin page — no new page                              |
| **Global minimum evidence count hard gate** | Already validated that Dutch SMBs have thin web presence; hard blocking makes system unusable                                            | The existing AMBER soft-gate + quality score average handles this — don't add new hard blocking                                 |
| **Rewrite the scraping infrastructure**     | Scrapling + Crawl4AI work well (83+ items for Nedri); the problem is post-scraping filtering                                             | Fix the funnel, not the sources                                                                                                 |
| **Parallel masterprompt calls per section** | Tempting to parallelize section generation for speed, but coherence between sections requires a single context                           | Keep one narrative generation call; split only the downstream visual data extraction into parallel Flash calls                  |

---

## Feature Dependencies

```
Crawl4AI 404 fix → can ship independently
Fallback draft suppression → can ship independently
Delete dead v1 prompt → can ship independently (no dependencies)

Content-quality relevance score per item
  → requires: Gemini Flash call at ingestion point in web-evidence-adapter.ts
  → unlocks: Drop sub-threshold items before storing

Drop sub-threshold items before storing
  → requires: Content-quality relevance score
  → unlocks: Pre-rank evidence set for masterprompt (cleaner input)

Content deduplication at ingestion
  → requires: Hash normalization on EvidenceItem (trivial schema change)
  → can run in parallel with relevance scoring
  → unlocks: Pre-rank evidence set (fewer items to rank)

Pre-rank evidence set for masterprompt (top 20)
  → requires: Content-quality relevance score + deduplication both complete
  → this is the gate that unlocks masterprompt simplification

Remove visualType/visualData from masterprompt
  → requires: Simplified masterprompt schema (delete visual fields from output)
  → unlocks: Separate downstream visual data call

Simplify masterprompt JSON output schema
  → requires: Remove visualType/visualData
  → can ship before downstream visual call is built (discover page needs update)

Source diversity enforcement in top-20
  → requires: Pre-rank evidence set mechanism
  → nice-to-have, not blocking

Cookie banner / boilerplate filter
  → can ship at ingestion alongside relevance scoring
  → reduces load on Gemini Flash relevance call
```

---

## Stream Breakdown (Implementation Order)

### Stream 1: Funnel Fixes (Fast wins first)

1. Delete dead v1 prompt (trivial)
2. Crawl4AI HTTP status check (Low)
3. Fallback draft suppression (Low)
4. Cookie/boilerplate heuristic filter (Low)
5. Content deduplication — exact hash + near-dedup (Medium)

### Stream 2: Relevance Scoring at Ingestion

6. Gemini Flash relevance classification per item (Medium)
7. Drop sub-threshold items before storing (Low — depends on 6)
8. Store content hash on EvidenceItem (Low)

### Stream 3: Masterprompt Simplification

9. Pre-rank top-20 evidence set with source diversity cap (Medium — depends on 5+7)
10. Remove visualType/visualData from masterprompt output schema (Low)
11. Simplify masterprompt JSON output (Low)
12. Separate downstream Gemini Flash call for visual data per section (Medium)

### Stream 4: E2E Validation

13. Re-run full pipeline for STB-kozijnen and Mujjo with new filtering
14. Before/after comparison of evidence count and output narrative quality
15. Verify discover page renders correctly with simplified analysis output

---

## Complexity Assessment

### Content Deduplication — Chosen Approach

**Exact dedup (SHA-256 on normalized text):** Hash the snippet after lowercasing, stripping whitespace and HTML entities. Check against existing hashes in the same `prospectId` partition. O(1) lookup.

**Near-dedup (Jaccard on 5-shingles):** Split text into overlapping 5-word windows, compute Jaccard similarity between candidate and existing items. If Jaccard > 0.7, discard the new item. No external dependency — pure TypeScript. For 20-400 item sets this runs in milliseconds.

**Why not MinHash/LSH:** MinHash/LSH is designed for trillion-scale datasets. At 20-400 items per prospect, naive O(n²) Jaccard comparison over shingled sets is faster and simpler with no infrastructure cost.

**Why not semantic/embedding dedup:** Requires vector search infrastructure not in the current stack. Content-level dedup (same page scraped twice) is solved by Jaccard — semantic dedup (two different pages making the same point) is a nice-to-have, not a table stake.

### Relevance Scoring at Ingestion — Chosen Approach

**Gemini Flash binary classification:** Single call per item, prompt: "Is dit fragment nuttig voor het analyseren van workflow-problemen bij een bedrijf? Antwoord: JA of NEE." Cost at Gemini 2.5 Flash-lite ($0.10/M input): ~50 tokens per item × 400 items = 20k tokens = $0.002 per prospect. Negligible.

**Why not a reranker model:** Purpose-built rerankers (BGE-reranker-v2, Cohere Rerank) outperform Gemini Flash on NDCG@10 (0.74 vs 0.68) but require a separate service deployment. For binary keep/drop classification (not ranking), Gemini Flash is sufficient.

**Threshold:** Items scoring below relevance threshold are dropped before storage, not after. This keeps the DB clean rather than storing then filtering at query time.

### Evidence Ranking for Masterprompt — Chosen Approach

**Top-N with source diversity caps:** Select top 20 items by combined score (existing `confidenceScore` + new content-quality score), but cap per sourceType: max 5 WEBSITE, max 4 REVIEWS, max 3 LINKEDIN, max 3 CAREERS, max 3 NEWS, max 2 REGISTRY. This prevents any single source from dominating context even when that source has the most items.

**Why not MMR (Maximal Marginal Relevance):** MMR requires embedding vectors to compute inter-document similarity. The source diversity caps achieve the same goal (diverse, non-redundant context) without embeddings, at zero cost.

**Top 20 not top 60:** Research consistently shows LLMs degrade with more context chunks. Top-100 hurts accuracy even with long context windows. 20 high-quality items with 300-char snippets = ~6k chars — well within Gemini Flash's sweet spot for reliable JSON generation.

### Prompt Decomposition — Chosen Approach

**Split visualType/visualData into a downstream call:** Narrative generation (creative, long-form) and visual data extraction (structured, factual) require different output modes from the LLM. Combining them in one prompt forces the model into inconsistent behavior — it tries to write flowing narrative AND generate structured JSON simultaneously.

**Pattern:** Masterprompt generates `{openingHook, executiveSummary, sections[{id, title, body, punchline, citations}]}`. Then, for each section, a separate Gemini Flash call receives the section body + citations and returns `{visualType, visualData}`. These section calls can run in parallel (Promise.all) since they have no inter-dependencies.

**Why not per-section parallel narrative generation:** Sections need coherence — they reference each other, build on themes, avoid repetition. This requires a single shared context. Only the visual extraction step is truly independent per section.

---

## MVP Recommendation

Build in this order for fastest path to clean output:

**Phase 1 (fastest wins, no AI calls):**

- Delete dead v1 prompt
- Crawl4AI HTTP status check
- Fallback draft suppression
- Cookie/boilerplate heuristic filter
- Content deduplication (hash + Jaccard)

**Phase 2 (quality gate at ingestion):**

- Gemini Flash relevance classification per item
- Drop sub-threshold items before storing

**Phase 3 (masterprompt simplification):**

- Pre-rank top-20 with source diversity caps
- Remove visualType/visualData from masterprompt
- Simplify output schema

**Phase 4 (restore visual layer):**

- Downstream per-section Gemini Flash call for visual data
- Update discover page to handle sections without visualType/visualData gracefully

**Phase 5 (validation):**

- Re-run STB-kozijnen (target: <80 evidence items, >80% relevant)
- Re-run Mujjo (target: <150 items)
- Compare narrative quality before/after

**Defer:**

- Evidence set pre-summarization (reduces prompt size further, nice-to-have)
- Content hash storage on EvidenceItem (useful for future signal detection, not blocking)
- Source diversity enforcement (Phase 3 can ship without it; add in Phase 3 if time allows)

---

## Sources

- First-party codebase: `lib/web-evidence-adapter.ts`, `lib/analysis/master-prompt.ts`, `lib/enrichment/` (HIGH confidence)
- First-party problem analysis: `.planning/phases/62-evidence-pipeline-overhaul/.continue-here.md` (HIGH confidence)
- SimHash/near-dedup: [Google SimHash paper](https://research.google.com/pubs/archive/33026.pdf), [near-duplicate detection blog](https://naman.so/blog/simhash-web-crawl-caching) (MEDIUM confidence)
- LLM context window research: [ICLR 2025 Long-context LLMs meet RAG](https://proceedings.iclr.cc/paper_files/paper/2025/file/5df5b1f121c915d8bdd00db6aac20827-Paper-Conference.pdf), [Neo4j Advanced RAG](https://neo4j.com/blog/genai/advanced-rag-techniques/) (HIGH confidence)
- LLM reranker benchmarks: [ZeroEntropy LLM as reranker](https://zeroentropy.dev/articles/llm-as-reranker-guide/) (MEDIUM confidence)
- MMR for evidence diversity: [Elastic MMR](https://www.elastic.co/search-labs/blog/maximum-marginal-relevance-diversify-results), [Full Stack Retrieval MMR](https://community.fullstackretrieval.com/retrieval-methods/maximum-marginal-relevance) (HIGH confidence)
- Prompt decomposition: [DecomP paper](https://openreview.net/forum?id=_nGgzQjzaRy), [LearnPrompting decomposition](https://learnprompting.org/docs/advanced/decomposition/decomp) (HIGH confidence)
- Cookie banner detection: [Apify cookie modal blocking](https://blog.apify.com/how-to-block-cookie-modals/), [CHI 2025 GDPR cookie analysis](https://dl.acm.org/doi/10.1145/3706598.3713648) (MEDIUM confidence)
- Gemini Flash pricing: [Galileo Gemini 2.5 Flash Lite overview](https://galileo.ai/model-hub/gemini-2-5-flash-lite-overview) (MEDIUM confidence — verify current pricing before billing estimates)
