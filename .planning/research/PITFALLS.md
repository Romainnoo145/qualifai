# Pitfalls Research

**Domain:** Evidence pipeline overhaul — deduplication, relevance scoring, prompt decomposition
**Researched:** 2026-04-20
**Confidence:** HIGH (based on codebase inspection of real data + verified patterns)

---

## Critical Pitfalls

### Pitfall 1: Over-aggressive Deduplication Removes Valid Content Variants

**What goes wrong:**
Hash-based or near-duplicate deduplication treats re-mentions of the same fact across different source types as duplicates and removes them. A job posting that mentions "wij zoeken iemand die ons Excel-chaos kan oplossen" and a Google Review that independently mentions "altijd gedoe met de administratie" share no text overlap but both validate the same pain signal. Semantic dedup at low similarity thresholds collapses these into one item, losing cross-source validation — exactly what the confidence formula depends on.

For Dutch SMBs specifically: their web presence is thin. STB-kozijnen has 233 items; a 60% perceived duplication rate likely includes legitimate near-duplicates that individually look redundant but collectively establish a pattern. Removing 60% could leave 93 items — which sounds like a win until you realize 40 of those items are now from a single WEBSITE source type, destroying the source diversity signal.

**Why it happens:**
Developers see 427 items and assume the goal is minimization. The real goal is coverage per unique pain signal. Dedup tools optimize for "fewer items" not "maintained signal variety per source type."

**How to avoid:**

- Deduplicate within source type, not across source types. Identical snippets from two WEBSITE crawls of the same URL are true duplicates. A REVIEWS item and a CAREERS item that reference the same operational pain are NOT duplicates — they are corroborating evidence.
- Use URL-normalized hash dedup first (same URL scraped twice = true duplicate).
- Apply content-hash dedup only within the same sourceType bucket.
- Never use semantic similarity dedup unless similarity threshold is above 0.95.
- After dedup, assert a minimum floor: at least 3 items per sourceType that had data. If dedup drops below floor, something is wrong.

**Warning signs:**

- Post-dedup evidence count drops more than 30% for any single sourceType.
- The masterprompt confidence average drops after dedup despite removing "low quality" items (you removed cross-source corroboration).
- Admin review page shows evidence grouped by sourceType with one or two sourceTypes now missing entirely.

**Phase to address:**
Evidence Quality phase (Stream 1). Must be validated against real STB-kozijnen data before deployment.

---

### Pitfall 2: Relevance Score Threshold Too High for Dutch-Language Content

**What goes wrong:**
The Gemini Flash scorer is calibrated on English-language workflow pain signals ("manual processes," "automation needs," "documented process issues"). Dutch SMB content uses indirect, understated language: "wij zijn een no-nonsense bedrijf," "ons team werkt hard," "wij doen alles voor de klant." The scorer reads these as low-relevance generic company descriptions (relevance 0.2-0.3) when they are actually structural signals about manual, relationship-driven operations.

If a hard drop threshold of aiRelevance < 0.50 is applied uniformly, a significant portion of Dutch WEBSITE and REGISTRY content gets discarded even though it contains soft-but-real operational signals. For a Dutch SMB with thin web presence, this can eliminate the only evidence that exists for them.

The existing soft gate philosophy ("Dutch SMBs have thin web presence — hard block unusable") was validated at the quality gate level. The same philosophy must apply at the evidence item level.

**Why it happens:**
The threshold from the existing `quality-gate` logic (MIN_AVERAGE_CONFIDENCE = 0.55) gets cargo-culted into the per-item filter. These are different things: the quality gate aggregates across the full evidence set; the per-item filter decides what enters that set.

**How to avoid:**

- Do not apply a single universal drop threshold. Use source-type-specific thresholds:
  - REVIEWS, LINKEDIN, CAREERS: threshold 0.45 (direct pain signals, even Dutch understated ones)
  - WEBSITE, REGISTRY: threshold 0.25 (context items that support narrative, not pain evidence)
  - Fallback drafts (metadata.fallback === true): never score, always drop — they have no content.
- Add Dutch-language examples to the scoring prompt. The current prompt uses English scoring examples (0.8-0.9: "mentions of manual processes"). Add Dutch equivalents: "wij zoeken iemand voor onze administratie," "ons team coördineert alles handmatig."
- Log every drop with reason. If >20% of a sourceType is dropped, flag for human review before committing.

**Warning signs:**

- After scoring filter, a prospect with known rich WEBSITE content drops from 233 items to under 80.
- All remaining evidence comes from REVIEWS/LINKEDIN with no WEBSITE context — masterprompt loses company description grounding.
- Gemini narrative starts producing generic content rather than company-specific analysis (loss of WEBSITE context items).

**Phase to address:**
Evidence Quality phase (Stream 1). Requires calibration run on STB-kozijnen and Mujjo before threshold is locked.

---

### Pitfall 3: Masterprompt Decomposition Loses Citation Thread

**What goes wrong:**
The masterprompt currently produces `sections[{id, title, body, citations, punchline}]` in one call. When split into: (1) narrative sections, then (2) a separate visualType/visualData call per section, the second call receives only the section body text — not the full evidence set. The visual data call cannot know which evidence items the narrative referenced, so it generates plausible-looking visualData that doesn't match the actual citations.

This creates a silent correctness bug: the discover brochure renders charts or tables that look authoritative but are hallucinated relative to the evidence actually cited in the body.

**Why it happens:**
Decomposition naively splits by output field ("narrative then visuals") rather than by input dependency. The visual data generator needs the same evidence items the narrative used, not just the narrative text.

**How to avoid:**

- The narrative call must return citation indices alongside the body (which it already does via `citations`).
- The visualData call must receive: section body + the specific evidence items referenced by citation index, not all 60 evidence items.
- Alternatively, generate visualData in the same narrative call but as a last step with a simple schema: `{"type": "table"|"metric"|"quote", "data": [...]}`. Keep the two together until there is a proven quality problem with combined output.
- If splitting, validate that chart values in visualData can be traced back to at least one citation in the evidence set. Reject and regenerate if no match.

**Warning signs:**

- Visual data call returns numbers that do not appear anywhere in the evidence snippets.
- Chart titles reference concepts not in the narrative body.
- `citations` array in the narrative section is empty even though the body makes specific claims.

**Phase to address:**
Masterprompt Simplification phase (Stream 2). The visualData split is optional — only attempt if narrative-only output quality is validated first.

---

### Pitfall 4: Backfill of Existing Evidence Items Locks the Table

**What goes wrong:**
STB-kozijnen has 233 evidence items across 5 research runs. Mujjo has 427. When the new dedup + scoring logic is introduced, there is pressure to backfill existing items: run dedup against old data, update `confidenceScore` for all existing items, mark duplicates as deleted/hidden.

Backfilling 427 rows with individual UPDATE statements inside a migration transaction will lock the `EvidenceItem` table. While small at current scale (7 prospects = ~2000 items total), this pattern becomes a production incident when the system has 50+ prospects.

The deeper problem: `confidenceScore` in the schema is currently both the AI-scored confidence AND the source-type-based static default. After the overhaul, these will mean different things for old vs. new items. No schema field distinguishes "scored by AI" from "static default."

**Why it happens:**
The instinct is to make all data consistent by backfilling. But adding a discriminating field (e.g., `aiScored: Boolean`) requires a migration, and the backfill vs. new-data distinction is important for understanding system state.

**How to avoid:**

- Add `aiScored Boolean @default(false)` and `aiRelevance Float?` and `aiDepth Float?` as nullable fields on EvidenceItem. Old items keep their static confidenceScore; new items get AI scores.
- Apply migration via manual `ALTER TABLE` on the Docker container (existing project pattern) + create migration file manually.
- Backfill in batches of 100 via a CLI script, not inside a migration. Script must be idempotent: `WHERE aiScored = false AND snippet IS NOT NULL`.
- Masterprompt pre-filter should prefer items where `aiScored = true` when available. Fall back to static confidence for old items.
- Do NOT backfill all 7 prospects at once as first action. Run on 1 prospect, verify output, then proceed.

**Warning signs:**

- Migration file contains UPDATE statements affecting more than 10 rows — move to a post-migration script.
- After backfill, masterprompt receives 0 evidence items for a prospect (scoring threshold + old static scores = all filtered out).
- Discover page renders "geen bewijs gevonden" for a prospect that had working analysis.

**Phase to address:**
Evidence Quality phase (Stream 1) — schema migration component. Must precede any backfill or scoring logic.

---

### Pitfall 5: Crawl4AI Fallback Drafts Enter Scoring with No Content

**What goes wrong:**
When Crawl4AI extracts less than 80 characters of markdown, `ingestCrawl4aiEvidenceDrafts` creates a fallback stub:

```
snippet: 'Pagina bestaat maar leverde minimale inhoud op bij browser-extractie.'
confidenceScore: 0.55
metadata: { adapter: 'crawl4ai', fallback: true }
```

This stub enters the DB as a real EvidenceItem. The AI scorer receives it with the placeholder snippet and scores it — but the placeholder text about "browser-extractie mislukt" may actually score 0.3-0.5 on relevance (it describes a technical process) and 0.2 on depth, resulting in a finalConfidence around 0.50-0.52. This is above any reasonable drop threshold, so the fallback survives into the masterprompt.

The masterprompt then cites "Pagina bestaat maar leverde minimale inhoud op bij browser-extractie" as evidence for a prospect claim. The existing `scoreEvidenceBatch` already handles `metadata.notFound === true` by assigning finalConfidence 0.1, but fallback stubs use `metadata.fallback: true`, which is NOT in the skip check.

**Why it happens:**
The `notFound` check was added for a specific 404 case. The `fallback` case was added later and not synchronized with the scorer skip logic.

**How to avoid:**

- In `scoreEvidenceBatch`, extend the skip check: `if (meta?.notFound === true || meta?.fallback === true)` — assign finalConfidence 0.05.
- Better: filter out fallback items before they reach the scorer entirely. Add a pre-score filter in `research-executor.ts` that drops items where `metadata.fallback === true` OR `metadata.notFound === true`.
- Best: remove the fallback creation in `ingestCrawl4aiEvidenceDrafts` entirely. Return no draft for failed extractions. There is no value in storing "extraction failed" as evidence.

**Warning signs:**

- Evidence admin page shows items with snippet "Pagina bestaat maar..." with confidence > 0.4.
- Masterprompt context contains the Dutch phrase "browser-extractie mislukt."
- Evidence count includes items with no meaningful content and non-zero confidence.

**Phase to address:**
Evidence Quality phase (Stream 1) — fix this before scoring logic is implemented, not after.

---

### Pitfall 6: `.slice(0, 60)` Replacement Creates Regression on Current Working Prospects

**What goes wrong:**
The current `.slice(0, 60)` in `master-prompt.ts` (sorted by confidenceScore descending) sends the 60 highest-static-confidence items to Gemini. This works adequately for the 7 existing prospects because their analysis has been tuned and approved.

When the slice is replaced with "top 20 highest-quality items grouped by sourceType," the composition of what Gemini sees changes dramatically. Even if the new 20 are objectively better items, the narrative output will differ from what was previously generated and reviewed. If the E2E validation phase compares "new output" against the discover page and finds visual regressions, there is pressure to revert — losing the quality gains.

**Why it happens:**
Output quality is subjectively assessed by reading the narrative. Developers change the evidence selection and see a different narrative structure, assume it is worse, and revert. The actual quality gain (fewer hallucinations, more grounded citations) is harder to see than "this sounds different."

**How to avoid:**

- Before changing evidence selection, capture a baseline: run masterprompt for all 7 prospects with current code, save raw JSON output.
- Define objective quality metrics to compare: citation depth (how many unique evidence items are cited in sections), specificity (presence of prospect-specific facts like company name, KvK number, employee count), and hallucination proxy (claims not traceable to any evidence item).
- Compare new output against baseline on these metrics, not subjective "sounds better."
- Run validation on one prospect first. Only expand to all 7 after first prospect passes.

**Warning signs:**

- New narrative omits the prospect's company name or uses generic industry framing.
- Citations array in sections becomes shorter (evidence not being cited = context not landing).
- Gemini produces "Geen bewijs beschikbaar" disclaimers in narrative body despite evidence being present in context.

**Phase to address:**
E2E Validation phase (Stream 3). Baseline capture must happen before any Stream 2 changes deploy.

---

### Pitfall 7: Latency Budget Blown by Per-Item AI Scoring at Ingestion

**What goes wrong:**
The current `scoreEvidenceBatch` batches 15 items per Gemini Flash call. A fresh pipeline run for Mujjo (427 items) would require ~29 Gemini Flash calls. At 1-3 seconds per call, that is 30-90 seconds of additional latency added to the research pipeline — which already takes several minutes for browser-rendered extraction.

If scoring is applied at ingestion time (before storing to DB), this latency adds to every research run. Users in the admin panel triggering "re-run research" will experience much longer wait times with no visible progress indicator.

**Why it happens:**
Evidence scoring was designed for post-ingestion scoring (on existing items), not pre-storage filtering. Moving it to ingestion time changes the pipeline shape: previously evidence was stored fast, then scored async. Now scoring blocks storage.

**How to avoid:**

- Keep scoring async. Store evidence items first (current behavior), then run scoring as a separate step that updates `aiRelevance`, `aiDepth`, `aiScored` fields.
- Add a UI indicator in the admin: "Scoring evidence..." as a separate pipeline stage after "Evidence collected."
- Set a batch ceiling: score at most 80 items per research run. If more than 80 items entered the DB, score the top 80 by static confidenceScore (source weight) first. Items beyond 80 get static scores as fallback.
- For the masterprompt pre-filter: only use AI scores if `aiScored = true` for more than 50% of items. Otherwise fall back to source-weight sort.

**Warning signs:**

- Research pipeline takes more than 5 minutes for a single prospect.
- Admin "run research" button appears stuck with no progress feedback.
- Gemini Flash quota exceeded mid-pipeline (429 error) causing partial scoring with no recovery path.

**Phase to address:**
Evidence Quality phase (Stream 1) — architecture decision on sync vs. async scoring must be made before implementation begins.

---

## Technical Debt Patterns

| Shortcut                                            | Immediate Benefit       | Long-term Cost                                                               | When Acceptable                                              |
| --------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Score at masterprompt time, not ingestion           | No pipeline latency     | Evidence DB has unscored items; quality gate sees raw static confidence      | Never — quality gate should reflect real quality             |
| Universal drop threshold (0.50 for all sourceTypes) | Simpler code            | Over-filters Dutch WEBSITE/REGISTRY content, narrative loses company context | Never for Dutch NL market                                    |
| Hash dedup across all sourceTypes                   | Maximum dedup ratio     | Destroys cross-source validation that drives confidence scores               | Never                                                        |
| Keep `.slice(0, 60)` as-is for safe migration       | No regressions          | Arbitrary count remains, quality problem not fixed                           | Acceptable as phase 1 while scoring is validated             |
| Skip backfill, only score new research runs         | No migration risk       | Existing 7 prospects keep inconsistent evidence sets                         | Acceptable for initial release with explicit `aiScored` flag |
| Store fallback stubs in DB                          | Simpler ingestion logic | Fallbacks leak into masterprompt as phantom citations                        | Never — filter before storage                                |

---

## Integration Gotchas

| Integration                | Common Mistake                                                                                               | Correct Approach                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Gemini Flash scoring       | Sending full 300-char snippet to scorer — scorer sees same text masterprompt sees                            | Trim to 200 chars for scoring (cost), use full snippet in masterprompt (quality)           |
| Prisma EvidenceItem upsert | Using `create` instead of `upsert` on (prospectId, sourceUrl) — creates duplicate items across research runs | Add `@@unique([prospectId, sourceUrl])` constraint, use upsert with content update         |
| Crawl4AI HTTP status       | Assuming Crawl4AI 200 means content was found — Crawl4AI returns 200 even for 404 pages                      | Check `looksLikeCrawled404()` AND content length. Crawl4AI has no HTTP status passthrough. |
| Gemini JSON output         | Scorer prompt says "no markdown fences" but Gemini sometimes wraps in ```json anyway                         | The existing `jsonMatch = text.match(/\[[\s\S]*\]/)` handles this. Do not remove it.       |
| Batch size for scoring     | Processing all items in one Gemini call — context window fills, scores become unreliable                     | Keep batch size at 15. Above 20 items per batch, scoring quality degrades measurably.      |

---

## Performance Traps

| Trap                                                      | Symptoms                                                             | Prevention                                                                                        | When It Breaks                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Scoring 400+ items synchronously at ingestion             | Research pipeline stalls 90+ seconds, admin appears hung             | Async scoring via separate `scoreEvidenceForProspect` call triggered post-ingestion               | At 200+ items per prospect                             |
| Full table scan for dedup check                           | `SELECT * FROM EvidenceItem WHERE prospectId = ?` on every ingestion | Use `@@unique([prospectId, sourceUrl])` DB constraint + upsert (DB enforces, no application scan) | At 500+ items                                          |
| Sending all evidence to masterprompt for baseline capture | 18k chars per prompt, context rot on long inputs                     | Pre-filter to 20-25 items before sending, never raise this ceiling                                | Already at scale — current 60-item slice is borderline |
| Re-running scoring on already-scored items                | 29 Gemini calls for Mujjo on every research refresh                  | Check `aiScored = true` before scoring; skip scored items                                         | At 50+ prospects                                       |

---

## "Looks Done But Isn't" Checklist

- [ ] **Dedup scope:** Verify dedup is source-type-scoped, not cross-type. Check that post-dedup evidence set still has items from 4+ source types for any prospect with prior full pipeline run.
- [ ] **Relevance scoring calibration:** Run scorer on 20 Dutch WEBSITE items from STB-kozijnen manually, verify none scored below 0.20 are items a human would consider relevant.
- [ ] **Fallback stub filtering:** Search codebase for `metadata.fallback` and verify all paths that create fallback stubs either drop them before DB storage or mark them as finalConfidence 0.05.
- [ ] **Crawl4AI 404 leak:** Verify `ingestCrawl4aiEvidenceDrafts` checks both `looksLikeCrawled404()` AND content length before creating any EvidenceItem.
- [ ] **Backfill idempotency:** Run backfill script twice on same prospect. Verify no duplicate score updates, no confidence changes on second run.
- [ ] **Discover page rendering:** After new masterprompt format deploys, open discover brochure for STB-kozijnen and verify all 4 steps render without missing fields.
- [ ] **Legacy v1 prompt deletion:** After deletion, run `grep -r "buildLegacyPrompt\|analysis-v1\|generateMasterAnalysis" lib/` and verify zero results.
- [ ] **Baseline comparison:** Before any Stream 2 changes, capture raw Gemini JSON output for all 7 prospects. Store in `scripts/baseline-analysis/` for regression comparison.

---

## Recovery Strategies

| Pitfall                                                           | Recovery Cost | Recovery Steps                                                                                                                                                       |
| ----------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Over-aggressive dedup removed valid evidence                      | MEDIUM        | Restore evidence from previous research run (items are scoped to researchRunId, old runs exist); adjust dedup scope to source-type-only; re-run masterprompt         |
| Threshold too high, prospect has 0 scored items                   | LOW           | Drop threshold for that sourceType; scoring is stored as separate fields, rerun scoring only (not full pipeline)                                                     |
| Masterprompt narrative regression after evidence selection change | LOW           | Restore `.slice(0, 60)` temporarily; compare baseline JSON to identify which evidence items drove quality                                                            |
| Backfill locked table                                             | HIGH          | Stop backfill script; run in smaller batches (50 rows max); add `pg_sleep(0.1)` between batches; monitor `pg_stat_activity`                                          |
| Discover page renders blank after schema change                   | MEDIUM        | Check for nullable fields added to `ProspectAnalysis` JSON that brochure expects — add optional chaining in renderer; do not re-run analysis until renderer is fixed |

---

## Pitfall-to-Phase Mapping

| Pitfall                                    | Prevention Phase                                    | Verification                                                        |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------- |
| Over-aggressive dedup                      | Stream 1 (Evidence Quality)                         | Post-dedup sourceType count >= 4 for STB-kozijnen                   |
| Dutch threshold miscalibration             | Stream 1 (Evidence Quality)                         | Manual review of 20 Dutch WEBSITE items before threshold locks      |
| Fallback stubs surviving into masterprompt | Stream 1 (Evidence Quality) — fix first             | Search for "browser-extractie mislukt" in masterprompt context      |
| Backfill table lock                        | Stream 1 (Evidence Quality) — schema migration      | Run migration on dev DB, check query duration                       |
| Citation loss on prompt decomposition      | Stream 2 (Masterprompt)                             | visualData values traceable to at least one evidence citation       |
| Slice replacement regression               | Stream 3 (E2E Validation) — baseline first          | Objective metrics: citation depth, specificity, hallucination proxy |
| Latency budget blown                       | Stream 1 (Evidence Quality) — architecture decision | Research run for Mujjo completes in under 5 minutes with scoring    |

---

## Sources

- Codebase inspection: `lib/evidence-scorer.ts`, `lib/enrichment/crawl4ai.ts`, `lib/analysis/master-prompt.ts`, `lib/web-evidence-adapter.ts`, `.planning/phases/62-evidence-pipeline-overhaul/.continue-here.md`
- Real data: STB-kozijnen 233 items / 5 runs, Mujjo 427 items — documented in `.continue-here.md`
- Dedup patterns: RAG architecture scaling research — semantic dedup after RRF ranking preserves holistic relevance; deduplicating after ranking preserves the best holistic measure
- Backfill risk: Schema migration production post-mortem — 4.5M row table lock in single transaction caused outage; batch in 1,000 rows max with explicit pauses
- Scoring latency: Gemini API optimization docs (ai.google.dev/gemini-api/docs/optimization) — batch requests reduce tokenization costs; Flash-Lite for high-QPS classification workloads
- Prompt decomposition: Context rot research (ACL Anthology 2025 EMNLP findings) — retrieval accuracy decreases for longer context; decomposition adds cascading error propagation risk
- Dutch DPA scraping guidance: AP 2024 — noted for awareness; internal prospecting tool with manual review gates reduces GDPR risk

---

_Pitfalls research for: Evidence pipeline overhaul — Qualifai v10.0_
_Researched: 2026-04-20_
