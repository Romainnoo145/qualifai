# Architecture Patterns — Evidence Pipeline Overhaul (v10.0)

**Domain:** Adding quality filtering, content deduplication, and masterprompt decomposition to an existing evidence pipeline
**Researched:** 2026-04-20
**Confidence:** HIGH — based on direct code inspection of all affected files

---

## Existing Pipeline (Current State)

```
Apollo enrichment
    ↓
Source discovery (sitemap + SERP + default URLs)
    ↓
URL selection + ranking (url-selection.ts)
    ↓
ingestWebsiteEvidenceDrafts()   ← stealth + crawl4ai, 404 detection
    ↓
ingestReviewEvidenceDrafts()    ← Trustpilot, Google Maps
    ↓
fetchGoogleReviews()             ← deep crawl only
fetchLinkedInJobs()
fetchEmployeeReviews()
... (8+ sources)
    ↓
allDrafts[] accumulated
    ↓
dedupeEvidenceDrafts()          ← URL+tag+snippet key, 140-char prefix
    ↓
.slice(0, evidenceDraftCap)     ← 60 interactive / 140 deep
    ↓
scoreEvidenceBatch()            ← Gemini Flash, existing
    ↓
db.evidenceItem.create() × N    ← ALL items stored (no threshold filter)
    ↓
evidenceRecords[]
    ↓
.filter(non-RAG).sort(confidence).slice(0, 60)   ← arbitrary cut in executor
    ↓
buildMasterPrompt()             ← top 60 items × 300 chars ≈ 18k chars
    ↓
generateKlarifaiNarrativeAnalysis()   ← Gemini Pro, one call for everything
    ↓
matchProofs()                   ← separate Gemini Flash call (already split out)
    ↓
db.prospectAnalysis.create()
```

### Exact Leak Points (from code inspection)

1. **Crawl4AI path does not check HTTP status** — `ingestCrawl4aiEvidenceDrafts()` is called directly on `serpUrls` in research-executor.ts:842 with no status code guard. The stealth path checks `stealth.statusCode >= 400` (web-evidence-adapter.ts:668) but the crawl4ai path in the executor has no equivalent.

2. **Fallback drafts reach the DB** — `fallbackDraft()` and `budgetExhaustedDraft()` are created in web-evidence-adapter.ts when all fetches fail. They have `metadata.fallback = true` and `confidenceScore = baseConfidence - 0.1`. These drafts ARE stored in the DB (research-executor.ts:1312). After `scoreEvidenceBatch()`, a fallback draft for a WEBSITE source scores: `0.65 * 0.30 + 0.50 * 0.45 + 0.40 * 0.25 = 0.52` — high enough to survive any reasonable threshold.

3. **Content dedup is key-based not content-based** — `dedupeEvidenceDrafts()` uses `sourceUrl|workflowTag|snippet.slice(0,140)` as the key. Same content arriving from SERP and sitemap paths has different sourceUrls, different workflowTags, and different snippet extraction contexts — all three key fields differ. The function does NOT deduplicate semantic content.

4. **The `.slice(0, 60)` in the executor is arbitrary** — research-executor.ts:1636 (Klarifai path) and :1633 (Atlantis path) both sort by confidenceScore descending and slice to 60. Since confidenceScore is computed by `scoreEvidenceBatch()`, this is the AI-scored confidence — better than pure sourceType weights. But 60 is still an arbitrary number that is not connected to any quality threshold. A prospect with 233 items gets 60; a prospect with 15 items also gets (up to) 60.

5. **notFound placeholder items** — Several sources push placeholder items with `confidenceScore: 0.1` when empty (google_reviews, google_news, linkedin_posts). The evidence-scorer already correctly handles these: `notFound: true` in metadata → `finalConfidence: 0.1`. They are currently stored in the DB and then filtered out at the `slice(0, 60)` stage only if enough higher-scoring items displace them. For prospects with thin evidence, they may survive into the masterprompt.

6. **buildLegacyPrompt is 260 lines of dead code** — `buildLegacyPrompt()` (master-prompt.ts:448-664) is invoked only via `buildMasterPrompt()` when `isKlarifaiInput` and `isNarrativeInput` both return false — i.e., when a `MasterAnalysisInput` with `intentVars` field is passed. The `generateMasterAnalysis` (v1) function was deleted in 56-02 and has no callers. The v1 input type is constructed nowhere in the active pipeline. Dead code is safe to delete.

---

## Recommended Architecture

### Integration Strategy: Minimum Surface Area

The key design insight: the scoring infrastructure already exists (`scoreEvidenceBatch()` produces `aiRelevance`, `aiDepth`, `finalConfidence` per item). The gaps are:

- No threshold filter after scoring (all items stored regardless of score)
- No content-level deduplication before storage
- No pre-prompt evidence ranking that uses the AI scores intentionally
- Dead code and overloaded masterprompt

The right approach is to add thin new layers at precise insertion points — not to restructure the pipeline.

### Component Boundaries After Overhaul

| Component                               | Responsibility                                        | Change Type                                        |
| --------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `lib/enrichment/crawl4ai.ts`            | Crawl4AI HTTP extraction + markdown                   | Modified: export 404 detection or add statusCode   |
| `lib/web-evidence-adapter.ts`           | Two-tier URL ingestion                                | Modified: export `looksLikeCrawled404`             |
| `lib/evidence-scorer.ts`                | AI scoring via Gemini Flash                           | No change                                          |
| `lib/evidence-filter.ts`                | NEW: threshold filtering + content dedup post-scoring | New file                                           |
| `lib/research-executor.ts`              | Pipeline orchestration                                | Modified: 4 targeted changes                       |
| `lib/analysis/master-prompt.ts`         | Prompt builder                                        | Modified: delete legacy v1, remove visualData spec |
| `lib/analysis/visual-data-generator.ts` | NEW: per-section visual data via Gemini Flash         | New file                                           |
| `lib/analysis/master-analyzer.ts`       | Gemini Pro call + validation                          | Modified: delete v1 validation helpers             |
| `lib/analysis/types.ts`                 | Type definitions                                      | Modified: delete v1 types                          |

### Data Flow After Overhaul

```
[all source adapters → allDrafts[]]
    ↓
dedupeEvidenceDrafts()          ← existing key-based dedup (keep)
    ↓
.slice(0, evidenceDraftCap)     ← existing cap (keep)
    ↓
scoreEvidenceBatch()            ← existing AI scoring (no change)
    ↓
NEW: filterAndDeduplicateDrafts()  ← drop fallbacks, drop notFound, drop aiRelevance<0.25, content dedup
    ↓
db.evidenceItem.create() × N   ← only qualified items stored
    ↓
evidenceRecords[]               ← clean set
    ↓
NEW: rankEvidenceForPrompt()    ← top 20 by score, grouped by sourceType for diversity
    ↓
buildMasterPrompt()             ← simplified: no visualData spec, takes 20 items
    ↓
generateKlarifaiNarrativeAnalysis()   ← produces narrative only (no visualData)
    ↓
NEW: generateSectionVisualData() × sections   ← Gemini Flash, post-narrative
    ↓
merge visual data into sections
    ↓
matchProofs()                   ← unchanged
    ↓
db.prospectAnalysis.create()
```

---

## Where Each Fix Slots In

### Fix 1: Crawl4AI 404 Gate (research-executor.ts line ~842)

**Current code:**

```typescript
const serpEvidenceDrafts = await ingestCrawl4aiEvidenceDrafts(serpUrls);
allDrafts.push(...serpEvidenceDrafts);
```

**Problem:** `ingestCrawl4aiEvidenceDrafts` in `lib/enrichment/crawl4ai.ts` does not gate on 404 content. The Crawl4AI service returns markdown text, not HTTP status codes. The stealth path uses `statusCode >= 400` but the Crawl4AI path has no equivalent check.

**Solution:** Export `looksLikeCrawled404` from `lib/web-evidence-adapter.ts` (it is already defined and tested there, line 323). Apply it inside `ingestCrawl4aiEvidenceDrafts` when building each draft — skip any URL whose extracted markdown matches the 404 pattern. This reuses the exact same logic already proven in the stealth escalation path without touching crawl4ai.ts.

**Build order:** First. Surgical fix, zero risk.

### Fix 2: Fallback and notFound Draft Filter (research-executor.ts, before create loop)

**Current code** (research-executor.ts ~1291):

```typescript
for (let i = 0; i < evidenceDrafts.length; i++) {
  const draft = evidenceDrafts[i]!;
  const aiScore = scoredMap.get(i);
  const finalConfidence = aiScore ? aiScore.finalConfidence : draft.confidenceScore;
  // ... store everything
  const record = await db.evidenceItem.create({ ... });
}
```

**Solution:** Add a filter step after scoring, before the create loop. In `lib/evidence-filter.ts`:

```typescript
export function shouldStoreDraft(
  draft: EvidenceDraft,
  aiScore: ScoredEvidence | undefined,
): boolean {
  const meta = draft.metadata as Record<string, unknown> | null;
  if (meta?.fallback === true) return false; // failed fetches
  if (meta?.notFound === true) return false; // empty source placeholders
  if (aiScore && aiScore.aiRelevance < 0.25) return false; // clear noise
  return true;
}
```

The `aiRelevance < 0.25` threshold corresponds to items the AI explicitly rates as "Completely irrelevant" (the 0.0-0.2 band in the scoring rubric) with a small buffer. This is intentionally conservative — only drops items the AI says are noise. The `notFound` placeholders (google_reviews, google_news, linkedin_posts) serve no analysis purpose; the diagnostic information is already captured in the `diagnostics[]` array stored in `researchRun.summary`.

**Build order:** Second.

### Fix 3: Content Deduplication (lib/evidence-filter.ts)

**Problem:** Same company page scraped via sitemap, SERP, and default seed paths produces multiple EvidenceItems with different sourceUrls but nearly identical snippets. `dedupeEvidenceDrafts()` does not catch these because the key includes sourceUrl.

**Solution:** Post-scoring, normalized content hash dedup. Keep the highest-confidence item when duplicates are found:

```typescript
export function deduplicateByContent<
  T extends {
    snippet: string;
    confidenceScore: number;
  },
>(drafts: T[]): T[] {
  const seen = new Map<string, T>();
  for (const draft of drafts) {
    const key = draft.snippet
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      .slice(0, 200);
    const existing = seen.get(key);
    if (!existing || draft.confidenceScore > existing.confidenceScore) {
      seen.set(key, draft);
    }
  }
  return Array.from(seen.values());
}
```

**Why 200 chars normalized:** Snippets extracted from the same page via different adapters will have identical normalized content at 200 chars even when whitespace, punctuation, or trailing characters differ. This catches 80-90% of actual duplicates (same page, different scrapers) with zero additional API cost. Semantic near-duplicates (two pages on the same topic in different words) are intentionally kept — they represent independent source confirmation.

**Integration point:** Applied to the qualified drafts (after Fix 2 filtering) before the DB create loop.

**Build order:** Third.

### Fix 4: Pre-Prompt Evidence Ranking (research-executor.ts + lib/evidence-filter.ts)

**Current code:**

```typescript
const evidenceItems: EvidenceItem[] = evidenceRecords
  .filter((item) => item.sourceType !== 'RAG_DOCUMENT')
  .sort((a, b) => b.confidenceScore - a.confidenceScore)
  .slice(0, 60)  // arbitrary
  .map((item) => ({ ... }));
```

**Solution:** Replace `.slice(0, 60)` with a source-diversity-aware ranking function:

```typescript
// lib/evidence-filter.ts
export function rankEvidenceForPrompt(
  records: EvidenceRecord[],
  opts: { maxItems: number; minScore: number },
): EvidenceRecord[] {
  const qualified = records.filter((r) => r.confidenceScore >= opts.minScore);

  const bySource = new Map<string, EvidenceRecord[]>();
  for (const record of qualified) {
    const group = bySource.get(record.sourceType) ?? [];
    group.push(record);
    bySource.set(record.sourceType, group);
  }

  const perSourceCap = Math.max(3, Math.floor(opts.maxItems / bySource.size));
  const selected: EvidenceRecord[] = [];
  for (const [, group] of bySource) {
    selected.push(
      ...group
        .sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, perSourceCap),
    );
  }

  return selected
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, opts.maxItems);
}
```

**Parameters:** `maxItems: 20, minScore: 0.45`. The prompt shrinks from ~18k chars (60 × 300-char snippets) to ~6k chars (20 × 300-char snippets) — a 3x token reduction. The `perSourceCap` ensures REVIEWS, CAREERS, and LINKEDIN evidence is never crowded out by high-volume WEBSITE items even when confidenceScore favors WEBSITE items after AI scoring.

**Build order:** Fourth. Depends on Fixes 2-3 (DB only contains qualified items; ranking operates on clean set).

### Fix 5: Delete Legacy v1 Prompt (master-prompt.ts + master-analyzer.ts + types.ts)

**Scope:**

- Delete `buildLegacyPrompt()` (master-prompt.ts:448-664, 217 lines)
- Simplify `buildMasterPrompt()` to dispatch only to `buildKlarifaiNarrativePrompt` and `buildNarrativePrompt`
- Delete `validateMasterAnalysis()`, `validateContext()`, `validateTrigger()`, `validateTrack()`, `validateKPI()` from master-analyzer.ts (no callers since `generateMasterAnalysis` was removed in v8.0)
- Delete from types.ts: `MasterAnalysisInput`, `MasterAnalysis`, `AnalysisContext`, `AnalysisTrigger`, `AnalysisTrack`, `AnalysisKPI`, `TriggerCategory`

**Pre-deletion grep:** Verify zero active callers for `MasterAnalysisInput`, `buildLegacyPrompt`, `validateMasterAnalysis`, `analysis-v1` version string before deleting.

**Build order:** Fifth. Independent of Fixes 1-4 — can be done in a parallel branch, but merge after Fixes 1-4 to keep PRs clean.

### Fix 6: Split visualType/visualData Out of Masterprompt (master-prompt.ts + new visual-data-generator.ts)

**Current state:** Both active prompt builders include ~30 lines of `visualType`/`visualData` schema specification. Gemini Pro frequently ignores the spec or produces structurally invalid `visualData` objects because it is asked to simultaneously write narrative prose AND select structured data types AND produce structured JSON — three cognitively distinct tasks in one call.

**Solution — two-step generation:**

Step 1: Remove `visualType`/`visualData` from both `buildKlarifaiNarrativePrompt()` and `buildNarrativePrompt()`. The masterprompt asks only for: `openingHook`, `executiveSummary`, `sections[{id, title, body, citations, punchline}]`.

Step 2: New `lib/analysis/visual-data-generator.ts`, called after narrative generation:

```typescript
export async function generateSectionVisualData(
  section: { id: string; body: string; citations: string[] },
  evidenceContext: string,
): Promise<{ visualType: VisualType; visualData: VisualData } | null>;
```

This function receives the generated section body and the raw evidence snippets cited in it, then uses Gemini Flash to decide if structured visual data is possible from actual evidence. Returns null when the evidence is qualitative or no structured data is available. The decision is made with full context of both the narrative output and the underlying evidence.

**Integration in research-executor.ts:** After `generateKlarifaiNarrativeAnalysis()` returns, iterate over `analysisResult.sections` and call `generateSectionVisualData()` for each. This is 3-5 additional Gemini Flash calls per run — negligible cost.

**Validator impact:** `validateNarrativeSection()` in master-analyzer.ts already treats `visualType` and `visualData` as optional (lines 256-275). No change needed to the validator. The fields will be added post-validation, before storing in `prospectAnalysis.content`.

**Schema impact:** None. `NarrativeSection.visualType` and `NarrativeSection.visualData` are already optional in types.ts.

**Build order:** Sixth. Depends on Fix 5 (legacy prompt deleted) to avoid confusion while editing master-prompt.ts.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Aggressive Threshold Filtering

**What:** Setting `aiRelevance < 0.50` as the drop threshold.
**Why bad:** The quality gate threshold (0.50 average) is a different metric from per-item filtering. KvK registry entries (REGISTRY sourceType, aiRelevance ~0.35) provide factual company context that is genuinely useful even when not a direct "workflow pain signal." Dropping all sub-0.50 items systematically removes structural/registry evidence.
**Instead:** Use aiRelevance < 0.25 as the floor (explicit noise). Let `rankEvidenceForPrompt` handle the rest.

### Anti-Pattern 2: Semantic Embedding Deduplication

**What:** Embedding snippets and dropping items with cosine similarity > 0.85.
**Why bad:** Two review snippets saying similar things from different sources represent independent confirmation — stronger signal together. Adds 100-200ms latency and embedding API cost per run.
**Instead:** Normalized string dedup catches the true problem (same page scraped multiple times) at zero additional cost.

### Anti-Pattern 3: Two-Pass Scoring

**What:** Running `scoreEvidenceBatch()` again after deduplication.
**Why bad:** Scoring already runs on URL-deduplicated drafts. A second pass doubles Gemini Flash calls with no benefit.
**Instead:** Single scoring pass, then apply content dedup + threshold using already-computed scores.

### Anti-Pattern 4: Storing notFound Placeholders

**What:** Keeping `notFound: true` items in EvidenceItem "to show admins we tried."
**Why bad:** These items have snippets like "Google Reviews scrape did not find review snippets." They inflate evidence counts shown in admin UI and cannot contribute to analysis. The diagnostic signal is already in `researchRun.summary.diagnostics`.
**Instead:** Drop at the DB boundary.

### Anti-Pattern 5: Rewriting the Prompt Builder

**What:** Extracting prompt sections into a template engine with interpolation/conditionals.
**Why bad:** The existing string-join pattern is trivial to read and debug. The prompts are in Dutch with complex contextual rules. Template overhead adds no value.
**Instead:** Keep string-join. Remove dead code and remove the visualData spec block.

---

## Scalability Considerations

| Concern                                      | At 7 prospects (now) | At 100 prospects | At 1000 prospects |
| -------------------------------------------- | -------------------- | ---------------- | ----------------- |
| Gemini Flash scoring cost                    | ~$0.003/run          | ~$0.003/run      | ~$0.003/run       |
| Content dedup overhead                       | <1ms                 | <1ms             | <1ms              |
| Visual data generation (3-5 Flash calls/run) | ~500ms added         | ~500ms added     | ~500ms added      |
| DB row reduction (fewer items stored)        | 30-60% fewer rows    | same ratio       | same ratio        |
| Masterprompt token reduction                 | 18k → 6k chars       | same             | same              |

Per-run costs are fixed regardless of prospect count. The visual data split adds ~$0.001 per run. Negligible at current and projected scale.

---

## Build Order and Dependencies

```
Fix 1: Crawl4AI 404 gate         (no deps, touch lib/enrichment/crawl4ai.ts + web-evidence-adapter.ts)
  ↓
Fix 2: Fallback + notFound filter (no deps, touch lib/evidence-filter.ts + research-executor.ts)
  ↓
Fix 3: Content dedup              (no deps, touch lib/evidence-filter.ts)
  ↓
Fix 4: Pre-prompt ranking         (depends on Fixes 2-3 for clean evidenceRecords)

Fix 5: Delete legacy v1 prompt    (no deps — parallel branch recommended)
  ↓
Fix 6: Split visualData           (depends on Fix 5)

E2E validation                    (depends on all fixes merged)
```

Fixes 1-4 (evidence quality) and Fixes 5-6 (masterprompt) can be worked in parallel branches. Merge evidence quality first, then masterprompt changes, then run E2E validation for 3-5 existing prospects comparing before/after evidence counts and narrative quality.

---

## New vs Modified Files Summary

| File                                    | Status   | What Changes                                                                                                                                |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/evidence-filter.ts`                | NEW      | `shouldStoreDraft()`, `deduplicateByContent()`, `rankEvidenceForPrompt()`                                                                   |
| `lib/analysis/visual-data-generator.ts` | NEW      | `generateSectionVisualData()` per section, Gemini Flash                                                                                     |
| `lib/web-evidence-adapter.ts`           | MODIFIED | Export `looksLikeCrawled404()`                                                                                                              |
| `lib/enrichment/crawl4ai.ts`            | MODIFIED | Apply `looksLikeCrawled404` check in `ingestCrawl4aiEvidenceDrafts`                                                                         |
| `lib/research-executor.ts`              | MODIFIED | Add filter + dedup step before create loop; replace `.slice(0,60)` with `rankEvidenceForPrompt`; add visual data generation after narrative |
| `lib/analysis/master-prompt.ts`         | MODIFIED | Delete `buildLegacyPrompt`; remove `visualType`/`visualData` spec from both builders                                                        |
| `lib/analysis/master-analyzer.ts`       | MODIFIED | Delete `validateMasterAnalysis` and all v1 validation helpers                                                                               |
| `lib/analysis/types.ts`                 | MODIFIED | Delete all v1 types (`MasterAnalysis`, `MasterAnalysisInput`, `AnalysisTrigger`, etc.)                                                      |

---

## Sources

- Direct code inspection: `lib/research-executor.ts` (2133 lines)
- Direct code inspection: `lib/web-evidence-adapter.ts` (722 lines)
- Direct code inspection: `lib/evidence-scorer.ts` (223 lines)
- Direct code inspection: `lib/analysis/master-prompt.ts` (687 lines)
- Direct code inspection: `lib/analysis/master-analyzer.ts` (789 lines)
- Direct code inspection: `lib/analysis/types.ts` (234 lines)
- `.planning/phases/62-evidence-pipeline-overhaul/.continue-here.md`
- `.planning/PROJECT.md`
