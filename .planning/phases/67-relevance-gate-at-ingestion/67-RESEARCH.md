# Phase 67: Relevance Gate at Ingestion - Research

**Researched:** 2026-04-21
**Domain:** Evidence pipeline — AI relevance scoring + drop gate before DB insert
**Confidence:** HIGH

---

## Summary

Phase 67 adds a hard-drop filter to the evidence insert loop in `lib/research-executor.ts`. The mechanism is already 90% built: `lib/evidence-scorer.ts` scores every item via Gemini Flash and returns `aiRelevance` (0-1). What doesn't exist yet is the threshold check that DROPS items instead of storing them. Currently all scored items are stored regardless of their `aiRelevance` value — the score only affects `confidenceScore` and is buried in `metadata`.

The change required is minimal: after `scoreEvidenceBatch` runs and populates `scoredMap`, add a threshold lookup in the insert loop that skips the `db.evidenceItem.create` call for items below the source-type-specific threshold. No new AI calls, no schema changes, no new library. The thresholds are defined in STATE.md decisions: WEBSITE/REGISTRY at 0.25, REVIEWS/CAREERS at 0.45.

The 90-second timing constraint is already satisfied at the current batch size. `scoreEvidenceBatch` processes 80 items in 6 sequential batches of 15 (ceil(80/15)). Empirically, each Gemini Flash call is ~3-5 seconds, so 6 batches = 18-30 seconds total — well inside the cap. No architecture change to scoring is needed for timing compliance. The Dutch-language concern requires one prompt-level change: add Dutch-aware calibration examples to `scoreBatch`'s prompt so WEBSITE/REGISTRY items containing Dutch text are not penalized for non-English content.

**Primary recommendation:** Hook the threshold check into the existing insert loop in `research-executor.ts`, export thresholds from `evidence-scorer.ts` as a constant map, and update the `scoreBatch` prompt with Dutch examples. No schema change needed — `aiRelevance` already exists in `metadata`; success criterion 1 requires it there, not as a first-class column.

---

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                                      | Research Support                                                                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FUNNEL-04 | AI relevance scoring at ingestion via Gemini Flash with source-type-specific thresholds drops irrelevant items before DB storage | Existing `scoreEvidenceBatch` function already scores all items; need to add threshold-check + drop in insert loop; thresholds defined in STATE.md decisions |

</phase_requirements>

---

## Standard Stack

### Core

| Library                 | Version           | Purpose              | Why Standard                           |
| ----------------------- | ----------------- | -------------------- | -------------------------------------- |
| `@google/generative-ai` | Already installed | Gemini Flash scoring | Already used in `evidence-scorer.ts`   |
| `@prisma/client`        | Already installed | EvidenceItem insert  | Already used in `research-executor.ts` |

### Supporting

| Library | Version | Purpose | When to Use             |
| ------- | ------- | ------- | ----------------------- |
| N/A     | —       | —       | No new libraries needed |

**Installation:** None required.

---

## Architecture Patterns

### Existing Flow (Post Phase 66)

```
allDrafts
  → dedupeEvidenceDrafts()          # in-memory dedup
  → .slice(0, evidenceDraftCap)      # cap at 60 (interactive) or 140 (deep)
  → filter fallback/notFound stubs   # Phase 65
  → scoreEvidenceBatch()             # returns scoredMap<index, ScoredEvidence>
  → for loop: insert each draft      # checks contentHash dedup (Phase 66), then creates
```

### Target Flow (Phase 67)

```
allDrafts
  → dedupeEvidenceDrafts()
  → .slice(0, evidenceDraftCap)
  → filter fallback/notFound stubs
  → scoreEvidenceBatch()             # scoredMap<index, ScoredEvidence>
  → for loop:
      getThreshold(draft.sourceType) # NEW: WEBSITE/REGISTRY=0.25, REVIEWS/CAREERS=0.45
      if aiScore.aiRelevance < threshold → continue  # NEW: drop, never insert
      check contentHash dedup
      db.evidenceItem.create
```

### Pattern 1: Source-Type Threshold Constant Map

**What:** A `Record<EvidenceSourceType, number>` exported from `evidence-scorer.ts` that maps each sourceType to its minimum `aiRelevance` to pass the gate.

**When to use:** Looked up in the insert loop for every item with an aiScore.

```typescript
// In lib/evidence-scorer.ts — export alongside SOURCE_WEIGHTS
export const RELEVANCE_THRESHOLDS: Partial<Record<string, number>> = {
  WEBSITE: 0.25,
  MANUAL_URL: 0.25,
  REGISTRY: 0.25,
  REVIEWS: 0.45,
  CAREERS: 0.45,
  JOB_BOARD: 0.45,
  LINKEDIN: 0.35, // between the two tiers — external but often sparse
  NEWS: 0.35,
  DOCS: 0.25,
  HELP_CENTER: 0.25,
};

export const DEFAULT_RELEVANCE_THRESHOLD = 0.3; // fallback for unmapped types
```

Note: STATE.md decisions specify only WEBSITE/REGISTRY=0.25 and REVIEWS/CAREERS=0.45. All other types (LINKEDIN, NEWS, JOB_BOARD) are CLAUDE'S DISCRETION — the values above are calibration recommendations.

### Pattern 2: Drop Check in Insert Loop

**What:** One guard in the per-draft insert loop, after retrieving the aiScore from scoredMap.

**When to use:** Every insert, when aiScore is present. If aiScore is missing (scorer failure fallback), do NOT drop — fallback items still get inserted.

```typescript
// In research-executor.ts insert loop, after: const aiScore = scoredMap.get(i);
if (aiScore) {
  const threshold =
    RELEVANCE_THRESHOLDS[draft.sourceType as string] ??
    DEFAULT_RELEVANCE_THRESHOLD;
  if (aiScore.aiRelevance < threshold) {
    continue; // Drop below-threshold item — never reaches DB
  }
}
```

**Critical:** Only drop when `aiScore` is truthy. If scoring failed (scoredMap has no entry for index `i`), the item passes through. This preserves the existing fallback behavior.

### Pattern 3: Dutch-Aware Prompt Additions

**What:** Add NL-specific calibration examples to the `scoreBatch` prompt in `evidence-scorer.ts`.

**Why:** Gemini Flash's training may score Dutch text lower if it misidentifies it as "low quality" text. The prompt must explicitly tell the model that Dutch is expected and valid.

```typescript
// Add to the prompt in scoreBatch(), after the existing instructions:
`NOTE: Evidence may be in Dutch. Dutch-language content is valid — do not penalize for language.
Examples of Dutch evidence that should score HIGH on relevance:
- "Wij verwerken dagelijks 500 facturen handmatig" (manual invoicing → relevance 0.85)
- "Onze medewerkers besteden veel tijd aan het kopiëren van data tussen systemen" (manual data transfer → 0.80)
Examples of Dutch evidence that should score LOW on relevance:
- "Welkom bij Bedrijf X. Wij zijn actief in de bouw." (generic about page → 0.15)
- "KvK nummer: 12345678, gevestigd te Amsterdam" (registry metadata → 0.20)`;
```

### Anti-Patterns to Avoid

- **Dropping when aiScore is absent:** If the scoring call fails entirely, the fallback returns synthetic scores with aiRelevance=0.5 for all items. Dropping based on those fallback values is fine (they pass 0.25/0.45). But if `scoredMap.get(i)` returns undefined (scorer threw before populating the map), do NOT drop.
- **Adding an `aiRelevance` column to the schema:** The success criteria state that `aiRelevance` is in the stored EvidenceItem — it already IS, stored in `metadata.aiRelevance` as a JSON field (confirmed in research-executor.ts lines 1317-1327). No migration needed.
- **Parallel batch execution for timing:** Not needed. Current sequential 6-batch approach for 80 items takes ~18-30s. Only if item counts exceed ~180 post-dedup would parallelization become necessary.
- **Changing the existing batch size of 15:** Leave it. Larger batches can confuse Gemini's index alignment.

---

## Don't Hand-Roll

| Problem                      | Don't Build                  | Use Instead                                      | Why                                        |
| ---------------------------- | ---------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Gemini client initialization | New AI client setup          | Existing `getGenAI()` in evidence-scorer.ts      | Already handles lazy init + key validation |
| Score computation            | Recalculate formula          | Existing `scoreEvidenceBatch` + `scoredMap`      | Already built and tested                   |
| Threshold lookup             | Per-sourceType if/else chain | `RELEVANCE_THRESHOLDS` record + fallback default | Maintainable, extensible                   |

---

## Common Pitfalls

### Pitfall 1: Dropping when Scorer Fails

**What goes wrong:** If `scoreEvidenceBatch` throws (API key missing, network error), `scoredMap` will be empty. A naive check `if (aiScore.aiRelevance < threshold)` would TypeError on undefined, or if guarded incorrectly, would drop ALL items.
**Why it happens:** The try/catch around scoring in research-executor.ts (lines 1286-1293) continues execution even on failure — scoredMap stays empty.
**How to avoid:** Only apply threshold gate when `aiScore` is truthy: `if (aiScore && aiScore.aiRelevance < threshold) { continue; }`
**Warning signs:** After a pipeline run, evidenceRecords is empty.

### Pitfall 2: Off-by-One Index Mapping

**What goes wrong:** `scoreEvidenceBatch` uses `item.index` (the original position in `evidenceDrafts`), but `scoredMap.set(s.index, s)` uses that index. When the insert loop does `scoredMap.get(i)`, `i` must match the original array position.
**Why it happens:** If any pre-scoring filter changes array length or reorders items, indices misalign.
**How to avoid:** The existing code (post Phase 65) filters fallback/notFound BEFORE building the `toScore` array — the indices are already aligned. Do not add any filtering step between the scoring call and the insert loop.
**Warning signs:** Items from wrong source types being gated.

### Pitfall 3: Dutch Scoring Penalty

**What goes wrong:** Dutch registry items (KvK data) scoring below 0.25 due to model treating short Dutch legal text as noise.
**Why it happens:** Gemini Flash may under-score structured Dutch administrative text ("Rechtsvorm: B.V., Activiteiten: kozijnen").
**How to avoid:** Add Dutch-language examples to the prompt (Pattern 3 above). Set REGISTRY threshold at 0.25 (not higher) to give Dutch administrative data room to pass.
**Warning signs:** All REGISTRY items being dropped post-gate.

### Pitfall 4: Timing Spike on Deep Crawl

**What goes wrong:** Deep crawl mode cap is 140 items. ceil(140/15) = 10 sequential Flash batches.
**Why it happens:** Deep crawl is enabled for large prospects.
**How to avoid:** For interactive mode (60 items = 4 batches), no problem. For deep crawl (140 items = 10 batches), worst-case ~50s — still within 90s. No action needed today, but document the boundary: if deep cap rises above ~200, revisit parallel batching.
**Warning signs:** Pipeline run time exceeds 90s in deep mode.

---

## Code Examples

### Current Insert Loop (Reference — lib/research-executor.ts ~line 1308)

```typescript
// Source: lib/research-executor.ts lines 1308-1369 (post Phase 66)
for (let i = 0; i < evidenceDrafts.length; i++) {
  const draft = evidenceDrafts[i]!;
  const aiScore = scoredMap.get(i);

  const finalConfidence = aiScore
    ? aiScore.finalConfidence
    : draft.confidenceScore;

  const metadata = {
    ...(draft.metadata as Record<string, unknown> | undefined),
    ...(aiScore
      ? {
          aiRelevance: aiScore.aiRelevance,   // already stored in metadata
          aiDepth: aiScore.aiDepth,
          aiReason: aiScore.aiReason,
        }
      : {}),
  };

  const contentHash = computeContentHash(draft.snippet);

  // Dedup: skip if same content already exists (Phase 66)
  const existingEvidence = await db.evidenceItem.findFirst({ ... });
  if (existingEvidence) { continue; }

  const record = await db.evidenceItem.create({ data: { ... } });
  evidenceRecords.push(record);
}
```

### Target Insert Loop Delta (Phase 67 addition)

```typescript
for (let i = 0; i < evidenceDrafts.length; i++) {
  const draft = evidenceDrafts[i]!;
  const aiScore = scoredMap.get(i);

  // PHASE 67: Relevance gate — drop below-threshold items before DB
  if (aiScore) {
    const threshold =
      RELEVANCE_THRESHOLDS[draft.sourceType as string] ??
      DEFAULT_RELEVANCE_THRESHOLD;
    if (aiScore.aiRelevance < threshold) {
      continue; // Never reaches DB
    }
  }

  // ... rest unchanged ...
}
```

### Threshold Constants (lib/evidence-scorer.ts addition)

```typescript
// Source-type-specific minimum aiRelevance to pass the gate
// WEBSITE/REGISTRY are lenient (Dutch thin content); REVIEWS/CAREERS are strict (should be signal-dense)
export const RELEVANCE_THRESHOLDS: Partial<Record<string, number>> = {
  WEBSITE: 0.25,
  MANUAL_URL: 0.25,
  DOCS: 0.25,
  HELP_CENTER: 0.25,
  REGISTRY: 0.25,
  LINKEDIN: 0.35,
  NEWS: 0.35,
  REVIEWS: 0.45,
  CAREERS: 0.45,
  JOB_BOARD: 0.45,
};

export const DEFAULT_RELEVANCE_THRESHOLD = 0.3;
```

---

## State of the Art

| Old Approach                 | Current Approach                         | When Changed | Impact                                                   |
| ---------------------------- | ---------------------------------------- | ------------ | -------------------------------------------------------- |
| All scored items stored      | Drop below threshold                     | Phase 67     | Fewer items reach masterprompt; higher average relevance |
| aiRelevance in metadata only | aiRelevance in metadata + gate at insert | Phase 67     | Gate is now enforced, not just diagnostic                |

**What exists already (no change needed):**

- `aiRelevance` stored in `metadata` JSON field per item — SUCCESS CRITERION 1 is already met for new runs
- `scoreEvidenceBatch` with 15-item batches, sequential — timing is fine
- `GEMINI_MODEL_FLASH` constant — correct model

---

## Open Questions

1. **LINKEDIN and NEWS threshold values**
   - What we know: STATE.md specifies WEBSITE/REGISTRY=0.25 and REVIEWS/CAREERS=0.45 only
   - What's unclear: Whether LINKEDIN and NEWS should be 0.35 (intermediate) or match one of the two defined tiers
   - Recommendation: Use 0.35 as intermediate default; document it as calibration subject to first re-run validation

2. **Fallback score pass-through**
   - What we know: When `scoredMap.get(i)` is undefined (total scorer failure), items currently pass through with no gate
   - What's unclear: Should fallback-scored items (aiRelevance=0.5 from `fallbackScores()`) also be gated?
   - Recommendation: Yes — fallback returns `aiRelevance: 0.5` which passes both 0.25 and 0.45 thresholds anyway, so behavior is identical. The gate check `if (aiScore)` is still correct.

3. **RAG_DOCUMENT items**
   - What we know: RAG items go through a separate insert loop (~line 1543). Phase 67 scope covers evidence items only.
   - What's unclear: Should RAG passages also be gated?
   - Recommendation: Out of scope for Phase 67. RAG passages are pre-scored by retrieval rank; a relevance gate there is a separate concern (v11+).

---

## Validation Architecture

### Test Framework

| Property           | Value                                        |
| ------------------ | -------------------------------------------- |
| Framework          | Vitest (configured in project)               |
| Config file        | vitest.config.ts or package.json scripts     |
| Quick run command  | `npx vitest run lib/evidence-scorer.test.ts` |
| Full suite command | `npx vitest run`                             |

### Phase Requirements → Test Map

| Req ID    | Behavior                                       | Test Type          | Automated Command                            | File Exists? |
| --------- | ---------------------------------------------- | ------------------ | -------------------------------------------- | ------------ |
| FUNNEL-04 | Items below threshold not stored               | unit               | `npx vitest run lib/evidence-scorer.test.ts` | ❌ Wave 0    |
| FUNNEL-04 | WEBSITE threshold=0.25, REVIEWS threshold=0.45 | unit               | `npx vitest run lib/evidence-scorer.test.ts` | ❌ Wave 0    |
| FUNNEL-04 | aiRelevance present in stored metadata         | integration/manual | Pipeline re-run on STB-kozijnen              | N/A          |
| FUNNEL-04 | Dutch items score comparably                   | unit               | `npx vitest run lib/evidence-scorer.test.ts` | ❌ Wave 0    |
| FUNNEL-04 | 80 items ≤ 90s                                 | manual timing      | `time npx ts-node scripts/tmp-rerun-*.ts`    | N/A          |

### Sampling Rate

- **Per task commit:** `npx vitest run lib/evidence-scorer.test.ts && npx tsc --noEmit`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** All unit tests green + manual pipeline re-run on STB-kozijnen before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/evidence-scorer.test.ts` — covers FUNNEL-04 threshold constants and gate logic
- [ ] Test: `RELEVANCE_THRESHOLDS['WEBSITE'] === 0.25`
- [ ] Test: `RELEVANCE_THRESHOLDS['REVIEWS'] === 0.45`
- [ ] Test: item with aiRelevance=0.10 + sourceType WEBSITE is skipped by gate
- [ ] Test: item with aiRelevance=0.50 + sourceType REVIEWS passes gate
- [ ] Test: item with no aiScore (undefined) passes through (no drop on scorer failure)
- [ ] Test: Dutch prompt examples present in prompt string

---

## Sources

### Primary (HIGH confidence)

- `lib/evidence-scorer.ts` — full scoring logic, batch size, fallback behavior (read directly)
- `lib/research-executor.ts` lines 1246-1369 — evidence insert loop with scoring integration (read directly)
- `lib/quality-config.ts` — existing threshold patterns (MIN_AVERAGE_CONFIDENCE = 0.55) (read directly)
- `prisma/schema.prisma` lines 469-494 — EvidenceItem model, existing fields (read directly)
- `.planning/STATE.md` — Locked decisions: WEBSITE/REGISTRY=0.25, REVIEWS/CAREERS=0.45 (read directly)

### Secondary (MEDIUM confidence)

- `.planning/phases/66-content-deduplication/66-01-PLAN.md` — insert loop shape post-Phase 66 (read directly)
- `.planning/REQUIREMENTS.md` FUNNEL-04 definition (read directly)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new libraries; existing scorer fully read
- Architecture: HIGH — insert loop fully read; change is additive (one guard, one continue)
- Pitfalls: HIGH — identified from reading actual code paths, not speculation
- Dutch calibration: MEDIUM — prompt engineering for Dutch is reasonable but requires validation against real STB-kozijnen data

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable domain; only invalidated if scoring architecture changes)
