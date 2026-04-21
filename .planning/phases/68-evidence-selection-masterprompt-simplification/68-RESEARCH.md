# Phase 68: Evidence Selection + Masterprompt Simplification — Research

**Researched:** 2026-04-21
**Domain:** Evidence ranking/selection, prompt engineering, Gemini Flash downstream calls
**Confidence:** HIGH — all findings based on direct codebase inspection

---

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                                                                                                | Research Support                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SELECT-01 | Pre-ranked top-20 evidence selection with source-diversity caps replaces arbitrary `.slice(0, 60)` before masterprompt                                                                     | Evidence ranking + diversity-capping logic documented in detail below; exact insertion points in `lib/research-executor.ts` (lines 1709-1712 and 1885-1888) and `lib/analysis/master-prompt.ts` (lines 75-77, 300-302) identified |
| PROMPT-02 | `visualType`/`visualData` specification removed from masterprompt — simplified JSON output schema (`openingHook`, `executiveSummary`, `sections` with `body`/`citations`/`punchline` only) | All prompt text, TypeScript types, and validator code that reference `visualType`/`visualData` are catalogued below with precise file+line ranges                                                                                 |
| PROMPT-03 | Visual data generated via separate downstream Gemini Flash call per section, receiving section body + cited evidence items                                                                 | Pattern for Flash calls established in `lib/evidence-scorer.ts` (Phase 67); discover page rendering path documented; new function signature designed                                                                              |

</phase_requirements>

---

## Summary

Phase 68 has three tightly coupled sub-problems that touch a clear execution chain: evidence-to-prompt preparation (SELECT-01), prompt schema simplification (PROMPT-02), and visual data generation relocation (PROMPT-03).

**SELECT-01** — The current code sorts all evidence by `confidenceScore` descending and takes the first 60. This is done identically in two places: `lib/research-executor.ts` (Atlantis path line 1709-1712; Klarifai path line 1885-1888) and redundantly re-sorted inside `lib/analysis/master-prompt.ts` (`buildNarrativePrompt` lines 75-77 and `buildKlarifaiNarrativePrompt` lines 300-302). The fix is a single `selectTopEvidence(items, { limit: 20, maxPerSource: 5 })` utility that runs once in `research-executor.ts` before the `EvidenceItem[]` array is handed to the analysis generator. The `master-prompt.ts` internal sort+slice can then be removed.

**PROMPT-02** — `visualType` and `visualData` are present in: (a) the TypeScript types in `lib/analysis/types.ts`; (b) the prompt text in both `buildNarrativePrompt` and `buildKlarifaiNarrativePrompt`; (c) the schema validator `validateNarrativeSection` in `master-analyzer.ts`; (d) the admin analyse page renderer in `app/admin/prospects/[id]/analyse/page.tsx`. Removing them from the prompt schema while keeping them as optional on the TypeScript type (populated downstream by PROMPT-03) preserves backward-compat with existing stored analysis JSON.

**PROMPT-03** — After the masterprompt returns, each section's `body` + `citations` become the input to a new per-section Gemini Flash call that generates `visualType`/`visualData`. The calling pattern exactly mirrors `scoreEvidenceBatch` in `lib/evidence-scorer.ts` (Phase 67) — a single batchable Flash call. The `inputSnapshot` on `ProspectAnalysis` must be enriched with the selected evidence items so Romano can verify diversity caps via the admin UI.

**Primary recommendation:** Build a standalone `selectEvidenceForPrompt()` function in `lib/analysis/evidence-selector.ts`, simplify both prompt builders by removing visual spec, add `generateSectionVisuals()` in `lib/analysis/visual-generator.ts` using Gemini Flash, and wire everything in `research-executor.ts`. The discover page (`analyse-brochure.tsx`) already handles optional `visualData` gracefully via `selectLayout()` — no page changes needed if visual data is populated post-masterprompt.

---

## Current State Inventory

### Evidence Selection — Where `.slice(0, 60)` Lives

| File                            | Lines     | Path                           | Notes                                                          |
| ------------------------------- | --------- | ------------------------------ | -------------------------------------------------------------- |
| `lib/research-executor.ts`      | 1709-1712 | Atlantis pipeline              | `filter(!RAG_DOCUMENT).sort(confidenceScore desc).slice(0,60)` |
| `lib/research-executor.ts`      | 1885-1888 | Klarifai pipeline              | Identical pattern                                              |
| `lib/analysis/master-prompt.ts` | 75-77     | `buildNarrativePrompt`         | Re-sorts + slices the already-sliced array — redundant         |
| `lib/analysis/master-prompt.ts` | 300-302   | `buildKlarifaiNarrativePrompt` | Same redundant sort+slice                                      |

The `research-executor.ts` slices produce the `EvidenceItem[]` passed to `generateNarrativeAnalysis` / `generateKlarifaiNarrativeAnalysis`. The `master-prompt.ts` slices operate on `input.evidence` inside the prompt builder. After SELECT-01, the prompt builder can trust it receives already-ranked top-20, so its internal sort+slice becomes dead code.

### `visualType` / `visualData` Surface Area

| File                                                        | Type of usage                                                                     | What to change                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `lib/analysis/types.ts` lines 11-43                         | `VisualType` union, `VisualData` union, optional fields on `NarrativeSection`     | Keep types as-is — downstream Flash call still populates them; no schema break |
| `lib/analysis/master-prompt.ts` lines 185-218               | Prompt instruction text: `"visualType"` / `"visualData"` spec for both builders   | Delete these instruction blocks from prompt text                               |
| `lib/analysis/master-prompt.ts` lines 230-254               | JSON example in prompt that shows `visualType` / `visualData` keys                | Remove those keys from the example JSON                                        |
| `lib/analysis/master-prompt.ts` lines 365-394               | Same in Klarifai builder                                                          | Same removal                                                                   |
| `lib/analysis/master-prompt.ts` lines 400-423               | Klarifai JSON example with `visualType` / `visualData`                            | Remove from example                                                            |
| `lib/analysis/master-analyzer.ts` lines 241-258             | `validateNarrativeSection` preserves optional visual fields when AI provides them | Keep as-is — acts as pass-through; won't break if fields absent                |
| `app/admin/prospects/[id]/analyse/page.tsx` lines 35-101    | Renders `section.visualData` block                                                | Keep as-is — already guarded by `{section.visualData && (...)}`                |
| `components/features/analyse/analyse-brochure.tsx` line 618 | `selectLayout()` returns `'visual'` when `section.visualData` truthy              | Keep as-is — when Flash call populates `visualData`, layout selection works    |

**Key insight:** `visualType` and `visualData` are optional on `NarrativeSection` (TypeScript `?` fields). The masterprompt validator in `validateNarrativeSection` already uses a pass-through pattern — it preserves them when present, skips when absent. Removing the fields from the prompt spec does not require any type change; the downstream Flash call populates them after the masterprompt returns, and the existing renderer handles them.

### `inputSnapshot` — Current Shape

```typescript
// Current (research-executor.ts lines 1761-1766):
inputSnapshot: toJson({
  evidenceCount: evidenceItems.length,
  passageCount: passageInputs.length,
  crossConnectionCount: crossConnections.length,
  spvCount: spvs.length,
});
```

For SELECT-01, Romano needs to verify diversity caps. The snapshot must be enriched:

```typescript
inputSnapshot: toJson({
  evidenceCount: evidenceItems.length, // top-20 count
  sourceBreakdown: buildSourceBreakdown(evidenceItems), // { WEBSITE: 3, REVIEWS: 5, ... }
  passageCount: passageInputs.length,
  crossConnectionCount: crossConnections.length,
  spvCount: spvs.length,
});
```

`buildSourceBreakdown` is a trivial `Record<string, number>` reduce over `evidenceItems`.

---

## Architecture Patterns

### Pattern 1: Evidence Selector Utility

**What:** A pure function that takes `EvidenceItem[]` and returns a ranked, diversity-capped subset.

**Why standalone:** Both the Atlantis pipeline and the Klarifai pipeline call it with identical logic. Centralizing avoids the current code duplication and makes unit testing trivial.

**Signature:**

```typescript
// lib/analysis/evidence-selector.ts

export type EvidenceSelectorOptions = {
  limit: number; // default 20
  maxPerSource: number; // default 5 (source diversity cap)
};

export function selectEvidenceForPrompt(
  items: EvidenceItem[],
  opts: EvidenceSelectorOptions = { limit: 20, maxPerSource: 5 },
): EvidenceItem[];
```

**Algorithm:**

1. Sort items by `confidenceScore` descending.
2. Greedily pick items: track per-`sourceType` count; skip if adding this item would exceed `maxPerSource`.
3. Stop when `limit` items are selected or list exhausted.

This is O(n) after sort — simple enough to not need a library.

**Example:**

```typescript
// lib/analysis/evidence-selector.ts
export function selectEvidenceForPrompt(
  items: EvidenceItem[],
  opts: EvidenceSelectorOptions = { limit: 20, maxPerSource: 5 },
): EvidenceItem[] {
  const sorted = [...items].sort(
    (a, b) => b.confidenceScore - a.confidenceScore,
  );
  const sourceCounts: Record<string, number> = {};
  const selected: EvidenceItem[] = [];
  for (const item of sorted) {
    if (selected.length >= opts.limit) break;
    const count = sourceCounts[item.sourceType] ?? 0;
    if (count >= opts.maxPerSource) continue;
    sourceCounts[item.sourceType] = count + 1;
    selected.push(item);
  }
  return selected;
}
```

**Usage in `research-executor.ts`** (replaces both `.slice(0, 60)` blocks):

```typescript
const evidenceItems: EvidenceItem[] = evidenceRecords
  .filter((item) => item.sourceType !== 'RAG_DOCUMENT')
  .map((item) => ({
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl,
    title: item.title,
    snippet: item.snippet,
    confidenceScore: item.confidenceScore,
    workflowTag: item.workflowTag,
  }));

const selectedEvidence = selectEvidenceForPrompt(evidenceItems);
// Pass selectedEvidence to generateNarrativeAnalysis / generateKlarifaiNarrativeAnalysis
```

### Pattern 2: Simplified Masterprompt

**What:** Remove the `visualType` / `visualData` specification from both prompt builders in `master-prompt.ts`. The JSON example in the prompt becomes:

```json
{
  "version": "analysis-v2",
  "openingHook": "2-3 zinnen...",
  "executiveSummary": "1 alinea...",
  "sections": [
    {
      "id": "slug-identifier",
      "title": "Sectietitel",
      "body": "Narratief...",
      "citations": ["Bron: ..."],
      "punchline": "Eén pakkende zin"
    }
  ]
}
```

**What NOT to change:**

- The TypeScript `NarrativeSection` type — `visualType?` and `visualData?` remain as optional fields
- `validateNarrativeSection` — already passes through optional fields; will simply not see them
- Any renderer — they are already guarded

### Pattern 3: Per-Section Visual Generator (PROMPT-03)

**What:** A new function `generateSectionVisuals()` that calls Gemini Flash once per section (or as a batch) to produce `visualType` / `visualData`.

**Model:** `GEMINI_MODEL_FLASH` (same as `evidence-scorer.ts`). Free tier, fast.

**Input per section:**

- Section `body` (prose already written by masterprompt)
- Section `citations` (source references)
- The raw `EvidenceItem[]` items whose `sourceType` appears in citations (for grounding)

**Output per section:**

```typescript
export type SectionVisualOutput = {
  sectionId: string;
  visualType?: VisualType;
  visualData?: VisualData;
};
```

**Strategy:** Single batched Flash call with all sections in one prompt (not N separate calls). The prompt lists all sections and asks for a JSON array of `SectionVisualOutput`. This avoids N round-trips and keeps latency acceptable.

**Placement in research-executor.ts** — after `generateNarrativeAnalysis` returns, before `ProspectAnalysis.create`:

```typescript
const analysisResult = await generateNarrativeAnalysis(narrativeInput);

// PROMPT-03: Enrich sections with visual data via Flash
const enrichedSections = await generateSectionVisuals(
  analysisResult.sections,
  selectedEvidence,  // the top-20 items, for grounding
);

// Merge visual data back into sections
const finalAnalysis = {
  ...analysisResult,
  sections: analysisResult.sections.map((s, i) => ({
    ...s,
    ...enrichedSections[i],
  })),
};

await db.prospectAnalysis.create({
  data: {
    ...
    content: toJson(finalAnalysis),
    ...
  },
});
```

**File location:** `lib/analysis/visual-generator.ts` — new file, same directory as `master-analyzer.ts`.

**Failure mode:** If Flash call fails or returns malformed JSON, log a warning and proceed without visual data. Sections render fine without `visualData` — the brochure falls through to `split`, `pillars`, or `quote` layout. This must be a soft failure (same pattern as the master-analyzer catch block in `research-executor.ts` lines 1784-1808).

---

## Don't Hand-Roll

| Problem                              | Don't Build         | Use Instead                                                                        |
| ------------------------------------ | ------------------- | ---------------------------------------------------------------------------------- |
| JSON extraction from Flash response  | Custom regex        | `extractJSON()` — already in `master-analyzer.ts` lines 332-362; copy or export it |
| Gemini retry/fallback for Flash call | New retry loop      | `callGeminiWithRetry()` — already exported from `master-analyzer.ts`               |
| Diversity-cap algorithm              | Heap/priority queue | Greedy O(n) pass after sort — sufficient at 20-400 items                           |

---

## Common Pitfalls

### Pitfall 1: Double-sorting in master-prompt.ts

**What goes wrong:** SELECT-01 replaces the slice in `research-executor.ts` but leaves the sort+slice inside `master-prompt.ts` untouched. The prompt then re-sorts the already-selected 20 items (no-op) but the `.slice(0, 60)` caps at 60 — harmless, but confusing.
**How to avoid:** Delete the sort+slice lines from both `buildNarrativePrompt` and `buildKlarifaiNarrativePrompt` after SELECT-01. They become dead code.
**Warning signs:** `master-prompt.ts` still references `.slice(0, 60)` after the task is "done."

### Pitfall 2: Breaking backward-compat on stored analysis JSON

**What goes wrong:** Existing `ProspectAnalysis` records in the DB have `visualType`/`visualData` in their JSON content. If `validateNarrativeAnalysis` or the discover page renderer starts _requiring_ those fields, old records break.
**How to avoid:** Keep `visualType` and `visualData` as optional TypeScript fields. Never add them as required fields in validators. The existing code already treats them as optional.

### Pitfall 3: Visual Flash call blocking analysis persistence

**What goes wrong:** `generateSectionVisuals()` throws an unhandled error, preventing `ProspectAnalysis.create` from running — the whole run logs as failed.
**How to avoid:** Wrap `generateSectionVisuals()` in try/catch. On failure, proceed with `analysisResult.sections` as-is (no visual data). Log a warning diagnostic.

### Pitfall 4: Per-section Flash calls (N round-trips instead of 1)

**What goes wrong:** Calling Flash once per section (3-5 calls) adds 3-10 seconds of latency versus one batched call.
**How to avoid:** Send all sections in a single Flash prompt requesting a JSON array indexed by section `id`. Parse and distribute the results.

### Pitfall 5: Evidence grounding gap in visual Flash call

**What goes wrong:** Flash hallucinates `visualData` values because it doesn't see the underlying evidence items, only the section body.
**How to avoid:** Pass the `selectedEvidence` items relevant to each section's citations into the Flash prompt. Filter: include evidence items whose `sourceType` appears in `section.citations`.

### Pitfall 6: `inputSnapshot` not updated for SELECT-01

**What goes wrong:** Romano can't verify diversity caps because `inputSnapshot` only stores `evidenceCount`, not the `sourceBreakdown`.
**How to avoid:** Update both `inputSnapshot` writes in `research-executor.ts` (line 1761 and line 2005 equivalent for Klarifai) to include `sourceBreakdown`.

---

## Code Examples

### Current slice pattern (to be replaced)

```typescript
// lib/research-executor.ts line 1709-1712 — REPLACE THIS
const evidenceItems: EvidenceItem[] = evidenceRecords
  .filter((item) => item.sourceType !== 'RAG_DOCUMENT')
  .sort((a, b) => b.confidenceScore - a.confidenceScore)
  .slice(0, 60)
  .map((item) => ({ ... }));
```

### Target pattern (SELECT-01)

```typescript
// lib/research-executor.ts — AFTER SELECT-01
const allEvidence: EvidenceItem[] = evidenceRecords
  .filter((item) => item.sourceType !== 'RAG_DOCUMENT')
  .map((item) => ({
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl,
    title: item.title,
    snippet: item.snippet,
    confidenceScore: item.confidenceScore,
    workflowTag: item.workflowTag,
  }));

const evidenceItems = selectEvidenceForPrompt(allEvidence);
// evidenceItems: top 20, max 5 per sourceType, sorted by confidenceScore desc
```

### Enriched inputSnapshot

```typescript
// lib/research-executor.ts — AFTER SELECT-01
function buildSourceBreakdown(items: EvidenceItem[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.sourceType] = (acc[item.sourceType] ?? 0) + 1;
    return acc;
  }, {});
}

// In ProspectAnalysis.create:
inputSnapshot: toJson({
  evidenceCount: evidenceItems.length,
  sourceBreakdown: buildSourceBreakdown(evidenceItems),
  passageCount: passageInputs.length,
  crossConnectionCount: crossConnections.length,
  spvCount: spvs.length,
}),
```

### Visual generator skeleton (PROMPT-03)

```typescript
// lib/analysis/visual-generator.ts (new file)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL_FLASH } from '@/lib/ai/constants';
import type {
  NarrativeSection,
  EvidenceItem,
  VisualType,
  VisualData,
} from './types';

export type SectionVisualResult = {
  sectionId: string;
  visualType?: VisualType;
  visualData?: VisualData;
};

export async function generateSectionVisuals(
  sections: NarrativeSection[],
  evidence: EvidenceItem[],
): Promise<SectionVisualResult[]> {
  // Build single batch prompt, call Flash once, parse JSON array
  // On any failure: return sections.map(s => ({ sectionId: s.id })) — no visuals
}
```

### Simplified section spec in prompt (PROMPT-02)

```
Elke sectie moet bevatten:
- "id": slug identifier
- "title": korte titel in het Nederlands
- "body": narratief (2-3 alinea's boardroom Dutch)
- "citations": bronverwijzingen
- "punchline": één pakkende zin die de kernboodschap samenvat (max 15 woorden)
```

(The `visualType` / `visualData` bullet points are deleted.)

---

## File Change Map

| File                                               | Change Type | What                                                                                                              |
| -------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `lib/analysis/evidence-selector.ts`                | New         | `selectEvidenceForPrompt()` + `buildSourceBreakdown()`                                                            |
| `lib/analysis/evidence-selector.test.ts`           | New         | Unit tests for selector and diversity cap                                                                         |
| `lib/analysis/visual-generator.ts`                 | New         | `generateSectionVisuals()` using Gemini Flash                                                                     |
| `lib/analysis/types.ts`                            | No change   | Optional `visualType`/`visualData` on `NarrativeSection` stay as-is                                               |
| `lib/analysis/master-prompt.ts`                    | Edit        | Remove visual spec from both prompt builders; remove internal sort+slice                                          |
| `lib/analysis/master-analyzer.ts`                  | No change   | `validateNarrativeSection` pass-through already handles absent optional fields                                    |
| `lib/research-executor.ts`                         | Edit        | Replace both `.slice(0, 60)` with `selectEvidenceForPrompt()`; add visual enrichment step; update `inputSnapshot` |
| `app/admin/prospects/[id]/analyse/page.tsx`        | No change   | Renders `visualData` optionally already                                                                           |
| `components/features/analyse/analyse-brochure.tsx` | No change   | `selectLayout()` handles optional `visualData` already                                                            |

---

## Validation Architecture

> `workflow.nyquist_validation` not set to false in `.planning/config.json` — validation section included.

### Test Framework

| Property           | Value                                                      |
| ------------------ | ---------------------------------------------------------- |
| Framework          | Vitest (via `lib/analysis/master-analyzer.test.ts` exists) |
| Config file        | Check `vitest.config.ts` or `package.json` test scripts    |
| Quick run command  | `npx vitest run lib/analysis/evidence-selector.test.ts`    |
| Full suite command | `npx vitest run lib/analysis/`                             |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                  | Test Type | Automated Command                                       | File Exists? |
| --------- | ------------------------------------------------------------------------- | --------- | ------------------------------------------------------- | ------------ |
| SELECT-01 | `selectEvidenceForPrompt` returns max 20 items, max 5 per sourceType      | unit      | `npx vitest run lib/analysis/evidence-selector.test.ts` | Wave 0       |
| SELECT-01 | Sorted by confidenceScore descending                                      | unit      | same                                                    | Wave 0       |
| SELECT-01 | `inputSnapshot.sourceBreakdown` reflects actual selected items            | unit      | `npx vitest run lib/research-executor.test.ts`          | exists       |
| PROMPT-02 | Masterprompt string does not contain "visualType" or "visualData"         | unit      | `npx vitest run lib/analysis/master-prompt.test.ts`     | Wave 0       |
| PROMPT-02 | `validateNarrativeSection` accepts sections without visualType/visualData | unit      | `npx vitest run lib/analysis/master-analyzer.test.ts`   | exists       |
| PROMPT-03 | `generateSectionVisuals` returns one result per input section             | unit      | `npx vitest run lib/analysis/visual-generator.test.ts`  | Wave 0       |
| PROMPT-03 | On Flash failure, returns empty visuals array (soft fail)                 | unit      | same                                                    | Wave 0       |

### Sampling Rate

- **Per task commit:** `npx vitest run lib/analysis/evidence-selector.test.ts`
- **Per wave merge:** `npx vitest run lib/analysis/ && npx tsc --noEmit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/analysis/evidence-selector.test.ts` — covers SELECT-01 diversity cap, sort order, edge cases (empty input, all same sourceType)
- [ ] `lib/analysis/master-prompt.test.ts` — covers PROMPT-02 (prompt string does not contain visual spec)
- [ ] `lib/analysis/visual-generator.test.ts` — covers PROMPT-03 (happy path + soft-fail)

---

## Open Questions

1. **Should `generateSectionVisuals` run for both Atlantis AND Klarifai pipelines?**
   - What we know: Both use `NarrativeSection[]` with identical structure. The brochure renderer is shared.
   - What's unclear: Whether Atlantis pipeline is still actively used (no active Atlantis prospects mentioned in recent memory).
   - Recommendation: Implement for both — the function is generic on `NarrativeSection[]` so there is no branching cost.

2. **Should evidence grounding in the visual Flash call be per-section or across all sections?**
   - What we know: Sections cite evidence by sourceType label (e.g., "Bron: REVIEWS — ..."), not by item ID.
   - What's unclear: Whether filtering evidence by sourceType-from-citations is precise enough.
   - Recommendation: Pass all `selectedEvidence` items to the visual Flash call (the top-20 is already compact). Filtering by sourceType per section adds complexity without clear benefit at 20-item scale.

3. **Token budget: how large is the batched visual Flash prompt?**
   - What we know: 3-5 sections, each with body (est. 400 chars) + citations (est. 100 chars). Plus 20 evidence snippets at 300 chars each = ~6000 chars total input. Well within Flash's context window.
   - Recommendation: No truncation needed.

---

## Sources

### Primary (HIGH confidence)

- Direct inspection of `lib/analysis/master-prompt.ts` — prompt text, sort/slice locations
- Direct inspection of `lib/research-executor.ts` — both pipeline paths, inputSnapshot shape
- Direct inspection of `lib/analysis/master-analyzer.ts` — retry layer, `callGeminiWithRetry`, `validateNarrativeSection`
- Direct inspection of `lib/analysis/types.ts` — TypeScript types, optional fields
- Direct inspection of `components/features/analyse/analyse-brochure.tsx` — `selectLayout()`, visual rendering
- Direct inspection of `app/admin/prospects/[id]/analyse/page.tsx` — `{section.visualData && (...)}` guard
- Direct inspection of `prisma/schema.prisma` — `EvidenceItem` model, `metadata` JSON field (stores aiRelevance)

### Secondary (MEDIUM confidence)

- `.planning/phases/67-relevance-gate-at-ingestion/67-01-PLAN.md` — confirmed `aiRelevance` stored in `metadata` JSON, not a dedicated column
- `.planning/REQUIREMENTS.md` — requirement text for SELECT-01, PROMPT-02, PROMPT-03
- `.planning/STATE.md` — locked decisions from prior phases

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already in use; no new dependencies needed
- Architecture: HIGH — based on direct codebase inspection; all insertion points identified with line numbers
- Pitfalls: HIGH — derived from actual code structure (double-sort, optional types, soft-fail requirement)

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable codebase; risk is only from parallel phase work changing `research-executor.ts`)
