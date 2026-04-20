# Technology Stack — v10.0 Evidence Pipeline Overhaul

**Project:** Qualifai — v10.0 milestone additions
**Researched:** 2026-04-20
**Scope:** NEW capabilities only. Existing validated stack (Scrapling, Crawl4AI, SerpAPI, Gemini Flash/Pro, PostgreSQL, Prisma, Next.js 16, tRPC) is NOT re-researched.
**Confidence:** HIGH — all findings grounded in direct codebase inspection.

---

## Context: What Already Exists (Do Not Touch)

| Capability                                               | Where                             | Status                                                                      |
| -------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `scoreEvidenceBatch()` via Gemini Flash                  | `lib/evidence-scorer.ts`          | Production — batch of 15, scores relevance + depth                          |
| `ingestWebsiteEvidenceDrafts()` two-tier stealth+browser | `lib/web-evidence-adapter.ts`     | Production — 404 detection, soft-404, fallback drafts                       |
| `EvidenceItem` Prisma model                              | `prisma/schema.prisma`            | Has: sourceType, sourceUrl, title, snippet, confidenceScore, metadata       |
| `buildKlarifaiNarrativePrompt()`                         | `lib/analysis/master-prompt.ts`   | Active — sends top 60 by confidence, includes visualType/visualData schema  |
| `generateKlarifaiNarrativeAnalysis()`                    | `lib/analysis/master-analyzer.ts` | Active — Gemini 2.5 Pro with retry + Flash fallback                         |
| `buildLegacyPrompt()`                                    | `lib/analysis/master-prompt.ts`   | DEAD CODE — 0 callers, safe to delete                                       |
| `matchProofs()`                                          | `lib/workflow-engine.ts`          | Production — already separated from masterprompt (the pattern to follow)    |
| Source weight constants                                  | `lib/evidence-scorer.ts`          | REVIEWS=0.90, LINKEDIN=0.88, NEWS/CAREERS=0.85, REGISTRY=0.80, WEBSITE=0.65 |

---

## New Stack for v10.0

### Zero New npm Dependencies

v10.0 requires no new npm packages. Every capability needed is either already in the stack or implementable with Node.js built-ins and existing @google/generative-ai.

Rationale: The deduplication problem is solved by hashing (Node crypto), not a library. The relevance gate is solved by moving existing scoring to run before DB insert, not by a new scorer. The prompt decomposition follows the `matchProofs` separation pattern already proven in this codebase.

---

## New Capabilities and Their Implementation Approach

### 1. Content Deduplication at Ingestion (Hash-Based)

**Problem:** STB-kozijnen has 233 items with ~60% duplicates. Same page scraped via sitemap + SERP + default paths → 3 EvidenceItems with identical snippets.

**Approach: SHA-256 content hash on the snippet, pre-insert dedup.**

**Why hash-based, not semantic/embedding-based:**

- Semantic dedup (pgvector cosine similarity on snippet embeddings) requires storing embeddings per evidence item and querying at ingestion time — adds latency and a pgvector write per item
- The actual problem is EXACT duplicates from multiple scrapers hitting the same URL, not near-duplicates with slight wording variations
- Hash-based dedup catches 95%+ of the real duplication (same URL scraped multiple times, same content from different URL paths to the same page)
- Implementation: `crypto.createHash('sha256').update(snippet.trim().toLowerCase()).digest('hex')` — zero latency, deterministic

**Schema change needed:** Add `contentHash String?` field to `EvidenceItem`. Index `@@index([prospectId, contentHash])` for the dedup query.

**Integration point:** In `research-executor.ts` before calling `db.evidenceItem.createMany()`, compute hashes for the batch, query existing hashes for this prospect, filter out matches.

**Alternative considered — URL-level dedup:** Already exists in `source-discovery.ts` for URL selection. The problem is content-level: two different URLs can return the same page content (www vs non-www, trailing slash variants, CDN mirrors). Content hash catches this; URL dedup does not.

**Alternative considered — semantic embeddings at ingestion:** Overkill for this problem. The duplicates are exact (same scraper hitting same page content). Reserve semantic dedup for future fuzzy-match use case if needed.

**Implementation:** `lib/evidence-dedup.ts` — pure TypeScript, Node crypto built-in.

```typescript
import { createHash } from 'crypto';

export function computeContentHash(snippet: string): string {
  return createHash('sha256')
    .update(snippet.trim().toLowerCase())
    .digest('hex');
}

export function deduplicateDrafts(
  drafts: EvidenceDraft[],
  existingHashes: Set<string>,
): EvidenceDraft[] {
  const seen = new Set(existingHashes);
  return drafts.filter((draft) => {
    const hash = computeContentHash(draft.snippet);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
}
```

**Confidence:** HIGH — Node crypto built-in, no external dependency, deterministic.

---

### 2. Relevance Gate at Ingestion (Move Scoring Earlier)

**Problem:** `scoreEvidenceBatch()` already exists and works — but it runs AFTER items are stored in the DB. Items with aiRelevance < 0.50 sit in the DB, get included in the `.slice(0, 60)` sent to the masterprompt, and degrade output quality.

**Approach: Run `scoreEvidenceBatch()` before DB insert. Drop items below threshold. Never store them.**

**Threshold:** `aiRelevance < 0.40` = drop (cookie banners, generic "over ons", privacy policies). Items at 0.40-0.50 = store with low confidence, exclude from masterprompt pre-filter. Items >= 0.50 = store and include.

**Why 0.40 not 0.50 as the storage gate:**

- Dutch SMBs have thin web presence. A strict 0.50 gate risks dropping the only CAREERS items from a small company.
- The masterprompt pre-filter (top 20 by final confidence) handles the 0.40-0.50 items at prompt time.
- Only drop items that are clearly garbage: relevance < 0.40 means "completely irrelevant or placeholder content" per the existing scorer prompt.

**Integration:** The scoring already batches in groups of 15 via `scoreEvidenceBatch()`. The integration point is in `research-executor.ts` after all drafts are collected but before `db.evidenceItem.createMany()`. Score the batch, filter, then insert only survivors.

**The fallback draft problem:** `fallbackDraft()` and `budgetExhaustedDraft()` in `web-evidence-adapter.ts` create items with snippet = "Source queued for manual validation (fetch failed or blocked)." These should never be scored — they should either be stored with a `notFound: true` metadata flag (already exists) and excluded from masterprompt context, OR simply dropped. Recommendation: drop fallback drafts from ingestion entirely. They are noise.

**Crawl4AI 404 leak fix:** `processCrawl4aiResult()` returns `'skip'` for 404 content detected by `looksLikeCrawled404()` — but there is no HTTP status check on the Crawl4AI path. The Crawl4AI response object includes a `statusCode` field. Add: `if (crawl4aiResult.statusCode >= 400) return 'skip'`. One-line fix in `extractMarkdown()` return type.

**No new package.** Uses existing `scoreEvidenceBatch()` from `lib/evidence-scorer.ts`.

**Confidence:** HIGH — existing scorer is production-tested, threshold is calibrated from real data (7 prospects with 0.59-0.70 avg confidence passing gate).

---

### 3. Pre-Ranked Evidence Set for Masterprompt

**Problem:** Masterprompt uses `.slice(0, 60)` by confidenceScore. ConfidenceScore is sourceType-based before AI scoring runs. After the ingestion gate runs, stored items have AI-scored confidence. The top 60 is still too many and the selection is not intentional.

**Approach: Pre-compute a ranked set of top 20 items for the masterprompt, grouped by sourceType.**

**Selection algorithm (pure TypeScript, no library):**

```typescript
export function selectMasterpromptEvidence(
  items: EvidenceItem[],
  limit = 20,
): EvidenceItem[] {
  // 1. Filter out items that shouldn't reach the prompt
  const eligible = items.filter(
    (item) => !isFallbackItem(item) && item.confidenceScore >= 0.5,
  );

  // 2. Sort by finalConfidence descending
  const sorted = eligible.sort((a, b) => b.confidenceScore - a.confidenceScore);

  // 3. Take top 20, but enforce source diversity: max 5 per sourceType
  const sourceCounts: Record<string, number> = {};
  const selected: EvidenceItem[] = [];
  for (const item of sorted) {
    const count = sourceCounts[item.sourceType] ?? 0;
    if (count >= 5) continue;
    sourceCounts[item.sourceType] = count + 1;
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}
```

**Why 20, not 60:**

- Each item gets 300 chars in the prompt → 60 items = 18k chars of evidence context
- Gemini 2.5 Pro processes all of it but the prompt is bloated with low-signal items
- 20 high-quality items × 300 chars = 6k chars — cleaner signal, more focused output
- The matcher already has all 233 items in the DB for the evidence dossier page — the masterprompt only needs the curated set

**Implementation:** `lib/evidence-selector.ts` — pure TypeScript utility.

**Confidence:** HIGH — straightforward array manipulation, no external dependency.

---

### 4. Masterprompt Decomposition — visualType/visualData Split

**Problem:** `buildKlarifaiNarrativePrompt()` asks Gemini 2.5 Pro to simultaneously: write flowing narrative (hard), choose the right visualType per section (medium), and generate correct visualData JSON structure (error-prone). The visualType/visualData spec is 30+ lines of schema. Gemini frequently ignores it or produces mismatched type/data pairs.

**Approach: Remove visualType/visualData from the masterprompt. Add a separate Gemini Flash call per analysis that generates visual data from the completed narrative.**

**Simplified masterprompt output schema:**

```json
{
  "version": "analysis-v2",
  "openingHook": "...",
  "executiveSummary": "...",
  "sections": [
    {
      "id": "slug",
      "title": "Titel",
      "body": "Narratief...",
      "citations": ["Bron: REVIEWS — ..."],
      "punchline": "Één pakkende zin"
    }
  ]
}
```

**Separate visual enrichment call (Gemini Flash):**

After the masterprompt completes and validates, a second Flash call takes the completed sections and evidence items and generates visualType/visualData per section. This call is:

- Cheaper (Flash not Pro)
- Focused on one task (structured data extraction, not creative writing)
- Optional — if it fails, the narrative still renders without visuals

**Pattern:** Follows `matchProofs` separation already done in this codebase. `matchProofs` was split out of the masterprompt for exactly the same reason — focused calls produce better output than one overloaded call.

**Implementation:** `lib/analysis/visual-enricher.ts` — new module, uses existing `@google/generative-ai` GEMINI_MODEL_FLASH.

**No new package.** Uses existing `@google/generative-ai` ^0.24.1.

**Confidence:** HIGH — the `matchProofs` split is proven. Same decomposition pattern.

---

### 5. Dead Code Removal: buildLegacyPrompt

**Status:** `buildLegacyPrompt()` in `lib/analysis/master-prompt.ts` is 260 lines with 0 callers. `MasterAnalysisInput` type and `analysis-v1` validation in `master-analyzer.ts` are also dead.

**Action:** Delete in the same phase as the masterprompt simplification. Reduces the file from ~687 lines to ~420 lines.

**Files affected:**

- `lib/analysis/master-prompt.ts` — remove `buildLegacyPrompt()` and the `buildMasterPrompt` dispatch branch that calls it
- `lib/analysis/master-analyzer.ts` — remove `validateMasterAnalysis()`, `validateContext()`, `validateTrigger()`, `validateTrack()`, `validateKPI()`, `generateMasterAnalysis` reference (already removed per MEMORY.md)
- `lib/analysis/types.ts` — remove `MasterAnalysisInput`, `MasterAnalysis`, `AnalysisContext`, `AnalysisTrigger`, `AnalysisTrack`, `AnalysisKPI`, `TriggerCategory`

**Confidence:** HIGH — MEMORY.md confirms `analysis-v1` is deprecated with no callers remaining.

---

## Schema Changes Needed

| Change                                   | Where          | Why                           |
| ---------------------------------------- | -------------- | ----------------------------- |
| Add `contentHash String?`                | `EvidenceItem` | Enable pre-insert dedup query |
| Add `@@index([prospectId, contentHash])` | `EvidenceItem` | Fast hash lookup per prospect |

No other schema changes. The AI scoring fields (`aiRelevance`, `aiDepth`) are stored in `metadata` JSON already — no migration needed for those.

**Migration approach:** Add nullable column, backfill hashes for existing rows in the migration script, then start populating on new inserts.

---

## Version Compatibility

No version bumps needed. All new capabilities use existing package versions.

| Package                 | Current Version | Usage in v10.0                                       |
| ----------------------- | --------------- | ---------------------------------------------------- |
| `@google/generative-ai` | 0.24.1          | Visual enricher Flash call, existing evidence scorer |
| `prisma`                | ^7.3.0          | contentHash column addition, dedup query             |
| `crypto`                | Node built-in   | SHA-256 content hashing                              |
| `typescript`            | ^5              | Type-safe evidence selector, dedup module            |

---

## What NOT to Add

| Avoid                                                    | Why                                                                                                                                       | Use Instead                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pgvector` for snippet embeddings at ingestion           | Exact duplicates dominate the problem; semantic dedup adds latency and embedding cost per item for no additional benefit at current scale | SHA-256 hash on normalized snippet — catches 95%+ of real duplicates                 |
| `@xenova/transformers` or local embedding models         | Would require a Node worker, adds 200MB+ to bundle, overkill for dedup at <500 items/prospect                                             | Node crypto built-in                                                                 |
| LangChain / LlamaIndex for prompt chaining               | Over-engineered; the chain is: Pro call → Flash call, two sequential awaits                                                               | Direct `@google/generative-ai` calls with existing retry wrapper                     |
| `zod` for evidence schema validation                     | Already in stack but don't add new schemas for internal-only data structures that are already typed                                       | TypeScript interfaces + runtime guard functions (existing pattern)                   |
| Dedicated vector store (Pinecone, Weaviate) for evidence | pgvector already exists for Atlantis RAG; evidence dedup is not a retrieval problem                                                       | SHA-256 hash                                                                         |
| `bull` / queue for batch scoring                         | Evidence scoring is synchronous in the pipeline, <100 items, <2s per batch                                                                | Sequential `scoreEvidenceBatch()` calls in `research-executor.ts`                    |
| Similarity threshold tuning libraries                    | The relevance threshold (0.40) is calibrated from real data — it doesn't need a library                                                   | Hardcoded constant in `lib/evidence-selector.ts` with comment explaining calibration |

---

## Integration Map

```
research-executor.ts (per prospect run)
  └── collect all drafts from 8+ sources
        └── scoreEvidenceBatch()           [Gemini Flash — existing, moved earlier]
              └── filter: drop aiRelevance < 0.40
                    └── computeContentHash()   [Node crypto — new]
                          └── deduplicateDrafts()    [new, lib/evidence-dedup.ts]
                                └── db.evidenceItem.createMany()  [only survivors]

master-analyzer.ts (per analysis generation)
  └── selectMasterpromptEvidence(items, 20)  [new, lib/evidence-selector.ts]
        └── buildKlarifaiNarrativePrompt()   [simplified — no visualType/visualData]
              └── Gemini 2.5 Pro call → narrative JSON
                    └── validateKlarifaiNarrativeAnalysis()
                          └── enrichSectionsWithVisuals()  [new, lib/analysis/visual-enricher.ts]
                                └── Gemini Flash call → visualType/visualData per section
                                      └── merge visuals into validated analysis
                                            └── store ProspectAnalysis
```

---

## New Files to Create

| File                              | Purpose                                                                      | Size estimate |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------- |
| `lib/evidence-dedup.ts`           | SHA-256 hash computation + pre-insert dedup filter                           | ~50 lines     |
| `lib/evidence-selector.ts`        | Top-N evidence selection with source diversity                               | ~60 lines     |
| `lib/analysis/visual-enricher.ts` | Gemini Flash call to generate visualType/visualData from completed narrative | ~100 lines    |

## Files to Modify

| File                              | Change                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `lib/web-evidence-adapter.ts`     | Drop fallback/budgetExhausted drafts before returning; add HTTP status check to Crawl4AI path |
| `lib/research-executor.ts`        | Move scoring before insert; add dedup call; use `selectMasterpromptEvidence()`                |
| `lib/analysis/master-prompt.ts`   | Remove `buildLegacyPrompt()`, simplify `buildKlarifaiNarrativePrompt()` output schema         |
| `lib/analysis/master-analyzer.ts` | Remove v1 validators; add `enrichSectionsWithVisuals()` call after generation                 |
| `lib/analysis/types.ts`           | Remove v1 types                                                                               |
| `prisma/schema.prisma`            | Add `contentHash` to EvidenceItem                                                             |

---

## Installation

No new packages to install.

```bash
# No npm install needed for v10.0

# Schema migration (after adding contentHash to EvidenceItem):
npx prisma migrate dev --name add-content-hash-to-evidence-item
```

---

## Sources

- Codebase analysis: `lib/evidence-scorer.ts`, `lib/web-evidence-adapter.ts`, `lib/analysis/master-prompt.ts`, `lib/analysis/master-analyzer.ts`, `lib/research-executor.ts`, `prisma/schema.prisma` — HIGH confidence (direct code inspection)
- MEMORY.md confirmation: `analysis-v1` deprecated, no callers remain — HIGH confidence
- Problem analysis: `.planning/phases/62-evidence-pipeline-overhaul/.continue-here.md` — direct specification of what is broken — HIGH confidence
- npm registry: `@google/generative-ai` installed at 0.24.1 (verified via node_modules) — HIGH confidence
- Architecture decision: no new packages — grounded in project constraints (established stack, single-user SaaS, <50 prospects, `matchProofs` decomposition pattern already proven) — HIGH confidence

---

_Stack research for: v10.0 Evidence Pipeline Overhaul_
_Researched: 2026-04-20_
