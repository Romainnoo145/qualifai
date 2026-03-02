# Phase 32: Hypothesis Prompt Rewrite - Research

**Researched:** 2026-03-02
**Domain:** LLM prompt engineering / Gemini Flash API / TypeScript function rewrite
**Confidence:** HIGH

## Summary

Phase 32 is a contained prompt-engineering and function-signature change within a single file: `lib/workflow-engine.ts`, specifically the `generateHypothesisDraftsAI` function (lines 616-801). All seven requirements (ANLYS-01 through ANLYS-07) are achievable by rewriting the prompt string and adjusting the pre-processing logic before it. No new dependencies, no schema changes, and no new API calls are required.

The core problems with the current prompt are well-documented in the golden baseline: hypotheses cite website marketing copy instead of diagnostic signals (e.g., Brainport and Marcore produce nearly identical "contact form = manual intake risk" hypotheses), confidence scores cluster in a narrow 0.75-0.85 band regardless of evidence quality, and the count is hardcoded to exactly 3. The fix strategy is to restructure the prompt into explicit tiers (REVIEWS/CAREERS/LINKEDIN as diagnostic tier, WEBSITE as marketing context only), inject a source signal summary above the evidence block, mandate verbatim quoted snippets from non-WEBSITE sources, and drive count from `confirmedPainTags.length` passed in from the caller.

The downstream interface impact of variable hypothesis count must be understood: `metricsFromHypotheses` (line 1032) multiplies average hoursSavedWeekMid by `hypotheses.length`, so reducing from 3 to 1 hypothesis will reduce the hours-saved metric proportionally in WorkflowLossMap. This is acceptable — the current inflated values from website-only evidence are misleading.

**Primary recommendation:** Rewrite `generateHypothesisDraftsAI` in-place — change function signature to accept `confirmedPainTags: string[]`, restructure the prompt with source-tier framing, inject signal summary, and constrain output count dynamically.

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                                                      | Research Support                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ANLYS-01 | Hypothesis prompt prioritizes REVIEWS, CAREERS, and LINKEDIN evidence over WEBSITE content via explicit source-tier instruction                  | Prompt rewrite: add explicit tier ordering instruction; label evidence lines by diagnostic tier                                                                                                                     |
| ANLYS-02 | Hypothesis prompt labels each source type diagnostically (reviews = customer pain, careers = operational gaps, website = marketing context only) | Prompt rewrite: add source-type legend block before evidence list                                                                                                                                                   |
| ANLYS-03 | Hypothesis prompt includes anti-parroting constraint preventing derivation from company's own marketing copy                                     | Prompt rewrite: add explicit prohibition — "Do NOT derive hypotheses from the company's own website copy or service descriptions"                                                                                   |
| ANLYS-04 | Each hypothesis problemStatement includes at least one mandatory quoted snippet from a non-WEBSITE evidence source                               | Prompt instruction: "The problemStatement MUST include at least one verbatim quoted snippet (using \"...\") from a REVIEWS, CAREERS, LINKEDIN, or NEWS source"; verified post-parse by checking for quotation marks |
| ANLYS-05 | Source signal summary (counts by tier) injected above evidence block to prime LLM reasoning                                                      | Pre-compute counts before prompt assembly; inject as structured summary block above evidenceLines                                                                                                                   |
| ANLYS-06 | Hypothesis count varies 1-3 based on confirmed pain tag evidence quality (not forced 3)                                                          | Pass `confirmedPainTags: string[]` into `generateHypothesisDraftsAI`; compute target count as `Math.min(3, Math.max(1, confirmedPainTags.length))`; instruction in prompt uses this count                           |
| ANLYS-07 | Confidence score instruction maps score tiers to evidence quality levels (REVIEWS 0.80-0.95, hiring 0.70-0.80, website-only 0.60-0.65)           | Replace current vague confidence table with explicit source-driven calibration table matching requirements                                                                                                          |

</phase_requirements>

## Standard Stack

### Core

| Library                 | Version | Purpose                | Why Standard                                              |
| ----------------------- | ------- | ---------------------- | --------------------------------------------------------- |
| `@google/generative-ai` | ^0.24.1 | Gemini Flash API calls | Already in use; `GEMINI_MODEL_FLASH = 'gemini-2.5-flash'` |

### Supporting

| Library | Version | Purpose            | When to Use                            |
| ------- | ------- | ------------------ | -------------------------------------- |
| None    | —       | No new deps needed | All changes are prompt text + TS logic |

### Alternatives Considered

| Instead of   | Could Use     | Tradeoff                                                               |
| ------------ | ------------- | ---------------------------------------------------------------------- |
| Gemini Flash | Claude Sonnet | Phase 33 adds model selection (ANLYS-08/MODEL-01); defer to that phase |

**Installation:** None required.

## Architecture Patterns

### Recommended Project Structure

No new files needed. All changes to:

```
lib/
└── workflow-engine.ts    # generateHypothesisDraftsAI — signature + prompt + pre/post logic
lib/
└── research-executor.ts  # call site — pass confirmedPainTags from gate result
```

### Pattern 1: Evidence Tier Pre-Processing

**What:** Before building `evidenceLines`, classify evidence items by source tier and compute per-tier counts. These counts are injected as a summary block above the evidence list to prime the LLM's reasoning.

**When to use:** Always — this is the ANLYS-05 mechanism.

**Example:**

```typescript
// Pre-compute signal summary for ANLYS-05
const tierCounts = {
  diagnostic: filteredEvidence.filter((e) =>
    ['REVIEWS', 'CAREERS', 'LINKEDIN', 'NEWS'].includes(e.sourceType),
  ).length,
  registry: filteredEvidence.filter((e) => e.sourceType === 'REGISTRY').length,
  website: filteredEvidence.filter((e) => e.sourceType === 'WEBSITE').length,
};

const signalSummary = `Signal summary (${filteredEvidence.length} items):
- Diagnostic tier (REVIEWS, CAREERS, LINKEDIN, NEWS): ${tierCounts.diagnostic} items — USE THESE FIRST
- Registry (KvK/REGISTRY): ${tierCounts.registry} items — factual reference
- Marketing context (WEBSITE): ${tierCounts.website} items — background only, DO NOT derive hypotheses from these`;
```

### Pattern 2: Dynamic Hypothesis Count from confirmedPainTags

**What:** Accept `confirmedPainTags: string[]` as a new parameter to `generateHypothesisDraftsAI`. Compute target count before building the prompt.

**When to use:** Always for ANLYS-06. The call site in research-executor.ts already computes `gate.confirmedPainTags` just before calling `generateHypothesisDraftsAI` (lines 889-904).

**Current call site in research-executor.ts (lines 889-904):**

```typescript
const gate = evaluateQualityGate(...);  // already computes confirmedPainTags

// Clear existing hypotheses...

const hypotheses = await generateHypothesisDraftsAI(
  evidenceRecords.map(...),
  { companyName, industry, specialties, description },
  // ADD: gate.confirmedPainTags  ← new 3rd argument
);
```

**Updated function signature:**

```typescript
export async function generateHypothesisDraftsAI(
  evidence: AIEvidenceInput[],
  prospectContext: AIProspectContext,
  confirmedPainTags: string[] = [], // ANLYS-06 — defaults to [] for backward compat
): Promise<HypothesisDraft[]>;
```

**Count logic:**

```typescript
const targetCount =
  confirmedPainTags.length === 0
    ? 1 // No confirmed tags: WEBSITE-only scenario → single low-confidence hypothesis
    : Math.min(3, Math.max(1, confirmedPainTags.length));
```

**Prompt instruction update:**

```
Generate exactly ${targetCount} workflow pain hypothesis/hypotheses (not more, not fewer).
```

### Pattern 3: Source-Tier Prompt Structure

**What:** Replace the current single-block prompt with a structured prompt containing:

1. Role/context block
2. Source-type legend (diagnostic meaning per type)
3. Anti-parroting constraint
4. Signal summary (counts by tier)
5. Evidence list (with source type labels)
6. Output requirements (count, quote mandate, confidence table, JSON schema)

**Current prompt problem:** The evidence lines already have `[SOURCEYPE]` labels but the prompt gives no instruction about what those labels mean or how to weight them. The LLM treats WEBSITE evidence equally to REVIEWS evidence.

**Example prompt structure:**

```
You are analyzing external diagnostic signals to identify workflow pain hypotheses for a Dutch company. Klarifai is an AI/automation consultancy that could solve these pains.

SOURCE TYPE GUIDE — how to interpret each label:
- [REVIEWS]: Customer or employee voices — HIGHEST DIAGNOSTIC VALUE. Direct pain signal.
- [CAREERS] / [JOB_BOARD]: Hiring signals — operational gaps, bottleneck areas, scaling strain.
- [LINKEDIN]: Company signals — organizational changes, strategic pressure, public statements.
- [NEWS]: External press — market pressure, recent events, competitive context.
- [REGISTRY]: KvK data — factual reference (size, legal form, registered activities).
- [WEBSITE]: Company's own marketing copy — LOWEST DIAGNOSTIC VALUE. Background context only.

ANTI-PARROTING RULE: Do NOT derive hypotheses from what the company says about itself on its website. Website copy is marketing — it describes aspirations, not operational reality. Pain hypotheses must come from external signals (reviews, hiring, LinkedIn, news).

${signalSummary}

Evidence (sorted by relevance — diagnostic sources weighted higher):
${evidenceLines}

Generate exactly ${targetCount} distinct workflow pain hypothesis/hypotheses for ${companyName} (${industryLabel}).

Each hypothesis MUST:
1. Be grounded in diagnostic signals (REVIEWS, CAREERS, LINKEDIN, NEWS) — not website copy
2. Include at least one verbatim quoted snippet (using "...") in the problemStatement from a non-WEBSITE source
3. Have a workflowTag from this list ONLY: ${validTagsList}
4. Have a confidenceScore calibrated to evidence source quality:
   - 0.80-0.95: Hypothesis grounded in REVIEWS (customer/employee pain — direct signal)
   - 0.70-0.80: Hypothesis grounded in CAREERS/LINKEDIN (operational gap — indirect signal)
   - 0.60-0.65: Hypothesis inferred from WEBSITE only (marketing context — lowest confidence)
   - Do NOT score website-derived hypotheses above 0.65
5. Include 2-3 evidenceRefs (sourceUrls of the non-WEBSITE items that support the hypothesis)

Only output JSON. No markdown fences. No explanation.
[schema]
```

### Pattern 4: Post-Parse Validation

**What:** After parsing AI JSON response, validate that each `problemStatement` contains a quoted snippet (detectable by presence of `"` or `"` character sequences). Log a warning if not — don't reject, but flag for monitoring.

**Why:** The requirement is detectable programmatically for the success criterion check.

**Example:**

```typescript
const hasQuote = (stmt: string) =>
  stmt.includes('"') || stmt.includes('\u201c') || stmt.includes('\u201d');

return parsed.map((item): HypothesisDraft => {
  if (!hasQuote(item.problemStatement)) {
    console.warn(
      `[generateHypothesisDraftsAI] Hypothesis "${item.title}" missing quoted snippet in problemStatement`,
    );
  }
  // ... rest of mapping
});
```

### Anti-Patterns to Avoid

- **Hardcoded count = 3 in prompt:** The phrase "identify 3 distinct workflow pain hypotheses" forces 3 regardless of evidence. Use the dynamic `targetCount` variable.
- **Evidence line format without tier annotation:** Current format `[WEBSITE] url: snippet` provides no guidance on how to use each tier. Add explicit tier weighting instructions before the evidence block.
- **Symmetric confidence band (0.60-0.95 for all):** The current table makes all sources equally credible. New table must explicitly cap website-derived hypotheses at 0.65.
- **Passing confirmedPainTags as undefined:** The function should default to `[]` for backward compatibility (unit tests that mock Gemini won't break). The 3rd argument is optional.

## Don't Hand-Roll

| Problem           | Don't Build                    | Use Instead                                         | Why                                                                     |
| ----------------- | ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Quote detection   | Regex parser for quoted text   | Simple `.includes('"')` check                       | Sufficient for success criterion; LLM uses standard ASCII double-quotes |
| Count enforcement | JSON schema validation library | Prompt instruction + `parsed.slice(0, targetCount)` | LLM occasionally returns N+1; defensive slice is enough                 |

**Key insight:** This phase is entirely prompt text + parameter plumbing. Zero new infrastructure.

## Common Pitfalls

### Pitfall 1: LLM Ignores Count Instruction

**What goes wrong:** Even with "generate exactly N", the LLM may return N+1 or N-1 items.

**Why it happens:** Gemini Flash sometimes over-generates to be "helpful." The anti-parroting constraint combined with limited diagnostic evidence may cause under-generation.

**How to avoid:** After `JSON.parse`, add a defensive `parsed.slice(0, targetCount)` before mapping. If parsed array is shorter than targetCount, proceed — don't retry.

**Warning signs:** parsed.length !== targetCount in logs.

### Pitfall 2: Website-Only Prospects Score 0.80+

**What goes wrong:** Even after adding the confidence calibration table, the LLM may assign 0.80 to website-derived hypotheses (current behavior — see Brainport and Marcore baselines both at 0.85 for website-only evidence).

**Why it happens:** LLMs tend to score confidently unless explicitly instructed not to. The current confidence table has a 0.60-0.70 tier but the LLM ignores it because there's no explicit cap for website-derived items.

**How to avoid:** The prompt must state "Do NOT score website-derived hypotheses above 0.65" as an explicit hard constraint, not just a range in a table. Additionally, the success criterion for ANLYS-07 requires the 0.60-0.65 range — verify with a manual test on a WEBSITE-only evidence set.

**Warning signs:** Success criterion 5 check (WEBSITE-only set → 0.60-0.65) fails in unit test.

### Pitfall 3: confirmedPainTags.length = 0 for Thin Prospects

**What goes wrong:** Marcore and STB-kozijnen (from baseline) both have `distinctPainTags >= 1` confirmed but with only 1 confirmed tag. The current code would produce `targetCount = 1`. This is intentional per ANLYS-06, but downstream `metricsFromHypotheses` multiplies by `hypotheses.length`, meaning hoursSavedWeek drops from ~24h (3 × 8h) to ~8h (1 × 8h).

**Why it happens:** `metricsFromHypotheses` at line 1032: `average(...) * hypotheses.length`. This is a downstream side effect of reducing count.

**How to avoid:** This is expected behavior — the old inflated metric from 3 website-only hypotheses was misleading. Document in plan that this is acceptable. No code change needed.

**Warning signs:** If the outreach email template requires exactly 3 hypotheses, check `createWorkflowLossMapDraft` — currently uses `hypotheses.slice(0, 3)` so it safely handles 1-3.

### Pitfall 4: Unit Test Isolation

**What goes wrong:** The test for `generateHypothesisDraftsAI` must mock `@google/generative-ai` to avoid real API calls. The test file `workflow-engine.test.ts` already mocks `@anthropic-ai/sdk` but NOT `@google/generative-ai`.

**Why it happens:** Current unit tests don't call `generateHypothesisDraftsAI` directly (it's tested E2E via research-executor). The new unit tests for count variation (ANLYS-06 success criterion 4) must mock the Gemini client.

**How to avoid:** Add vitest mock before the import:

```typescript
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () =>
              JSON.stringify([
                /* mock hypothesis */
              ]),
          },
        }),
      };
    }
  },
}));
```

**Warning signs:** Unit test hits real Gemini API and fails with auth error.

### Pitfall 5: Breaking the Fallback Path

**What goes wrong:** `generateFallbackHypothesisDrafts` always returns exactly 3 hypotheses (it's template-based). After this phase, the fallback still returns 3 even for 1-confirmed-tag prospects.

**Why it happens:** The fallback function has its own hardcoded template arrays.

**How to avoid:** The fallback is for AI failure scenarios (network errors, JSON parse errors). Updating it is out of scope for this phase. Document the known inconsistency — fallback still returns 3, AI path returns 1-3.

## Code Examples

Verified patterns from existing codebase:

### Current Evidence Filtering (lines 657-668)

```typescript
// Source: lib/workflow-engine.ts:657-668
const filteredEvidence = evidence
  .filter(
    (item) => item.confidenceScore >= 0.3 && item.snippet.trim().length > 0,
  )
  .sort((a, b) => {
    const aRelevance = parseAiRelevance(a) ?? a.confidenceScore;
    const bRelevance = parseAiRelevance(b) ?? b.confidenceScore;
    return bRelevance - aRelevance;
  })
  .slice(0, 15);
```

Note: The sort already biases toward high-aiRelevance items. Since REVIEWS/CAREERS items typically have aiRelevance 0.80-0.95 vs WEBSITE items at 0.30-0.50 (from evidence-scorer), the top-15 slice will already skew diagnostic. The prompt tier instruction reinforces this at the reasoning level.

### Current evidence line format (lines 670-677)

```typescript
// Source: lib/workflow-engine.ts:670-677
const evidenceLines = filteredEvidence
  .map((item) => {
    const relevance = parseAiRelevance(item);
    const relevanceTag =
      relevance !== null ? ` (relevance: ${relevance.toFixed(2)})` : '';
    return `[${item.sourceType}]${relevanceTag} ${item.sourceUrl}: ${item.snippet.slice(0, 600)}`;
  })
  .join('\n');
```

Enhancement: Add tier label in parentheses after sourceType for clarity:

```typescript
const TIER_LABEL: Record<string, string> = {
  REVIEWS: 'diagnostic',
  CAREERS: 'diagnostic',
  JOB_BOARD: 'diagnostic',
  LINKEDIN: 'diagnostic',
  NEWS: 'diagnostic',
  REGISTRY: 'registry',
  WEBSITE: 'marketing-context',
  MANUAL_URL: 'marketing-context',
};

return `[${item.sourceType}/${TIER_LABEL[item.sourceType] ?? 'context'}]${relevanceTag} ${item.sourceUrl}: ${item.snippet.slice(0, 600)}`;
```

### Downstream consumer — WorkflowLossMap (line 1066-1068)

```typescript
// Source: lib/workflow-engine.ts:1066-1068
const hypothesisLines = hypotheses
  .slice(0, 3) // already uses slice(0,3) — handles 1-3 safely
  .map((h, idx) => `${idx + 1}. ${h.title} — ${h.problemStatement}`)
  .join('\n');
```

Safe: `createWorkflowLossMapDraft` uses `hypotheses.slice(0, 3)` so it tolerates 1 or 2 hypotheses.

### Call site in research-executor.ts (lines 889-921)

```typescript
// Source: lib/research-executor.ts:889-921
const gate = evaluateQualityGate(...);  // gate.confirmedPainTags available here

const hypotheses = await generateHypothesisDraftsAI(
  evidenceRecords.map((item) => ({...})),
  { companyName, industry, specialties, description },
  gate.confirmedPainTags,  // ← add this 3rd argument
);
```

## State of the Art

| Old Approach                   | Current Approach                          | When Changed | Impact                                                               |
| ------------------------------ | ----------------------------------------- | ------------ | -------------------------------------------------------------------- |
| Template-based hypotheses      | AI-generated via Gemini Flash             | Phase 22     | Dynamic content, but uncalibrated prompt                             |
| All evidence weighted equally  | AI relevance scoring (evidence-scorer.ts) | Phase 30     | Better evidence ordering, but prompt doesn't reflect tier importance |
| Fixed 3 hypotheses             | Variable 1-3 (this phase)                 | Phase 32     | Count honest to evidence quality                                     |
| Symmetric confidence 0.60-0.95 | Source-calibrated tiers                   | Phase 32     | Website-only capped at 0.65                                          |

**Current problem baseline (golden baseline — 7 prospects, 2026-03-01):**

- All 7 prospects produced exactly 3 hypotheses regardless of evidence quality
- Confidence distribution: 0.65, 0.75, 0.85 (exact same pattern for 4 of 7 prospects)
- Marcore hypothesis 1: "contact form = manual intake risk" (0.85) — website-derived, should be 0.60-0.65
- Brainport hypothesis 1: same "contact form" pattern (0.85) — identical reasoning to Marcore
- STB-kozijnen hypothesis 1: correctly cites hiring + review signals — already working
- Mujjo hypothesis 1: correctly cites customer review quote — already working
- De Ondernemer hypothesis 1: correctly cites Dutch customer review quote — already working

**Key observation:** When REVIEWS evidence exists, the current prompt already tends to quote it. The problem is when REVIEWS is absent — the LLM falls back to website copy and scores it 0.85. The fix is the anti-parroting constraint + confidence cap.

## Open Questions

1. **confirmedPainTags.length = 0 edge case**
   - What we know: No current prospects have 0 confirmed pain tags (minimum is 1 in baseline)
   - What's unclear: Should `targetCount = 0` be possible? The gate requires `distinctPainTags >= 1` to pass, so a passing gate will always have >= 1 tag.
   - Recommendation: Default `targetCount = 1` when `confirmedPainTags.length === 0`. This handles edge cases where hypotheses are regenerated on a failing-gate prospect.

2. **STB-kozijnen has 3 confirmedPainTags — will it still get 3 hypotheses?**
   - What we know: STB-kozijnen baseline has `distinctPainTags: 3` (lines 877-878 in baselines.json). With new logic, `targetCount = Math.min(3, Math.max(1, 3)) = 3`. So yes, STB-kozijnen gets 3.
   - What's unclear: The success criterion says "cite reviews or hiring signals in problemStatement, not service page copy." Current STB hypothesis 1 already does this correctly.
   - Recommendation: No concern — the 3 hypotheses for STB will be the same count, but better-sourced with the new prompt.

3. **Mujjo has 3 distinctPainTags — should it still get 3?**
   - What we know: Mujjo baseline `distinctPainTags: 3`, success criterion requires "customer support reviews (expected confidence 0.85+)". With target count = 3, all 3 must cite non-website sources.
   - What's unclear: Whether all 3 confirmed pain tags in Mujjo have REVIEWS/CAREERS coverage.
   - Recommendation: No code change; the prompt constraint handles it.

4. **Should `targetCount` use `confirmedPainTags.length` or `unconfirmedPainTags` too?**
   - What we know: ANLYS-06 says "confirmed pain tag evidence quality" — unconfirmed tags are advisory-only.
   - Recommendation: Use `confirmedPainTags.length` only. Unconfirmed tags are single-source; generating a hypothesis from them would conflict with the anti-parroting intent.

## Validation Architecture

### Test Framework

| Property           | Value                                        |
| ------------------ | -------------------------------------------- |
| Framework          | Vitest ^4.0.18                               |
| Config file        | `vitest.config.ts` (project root)            |
| Quick run command  | `npx vitest run lib/workflow-engine.test.ts` |
| Full suite command | `npx vitest run`                             |
| Estimated runtime  | ~5-10 seconds                                |

### Phase Requirements → Test Map

| Req ID   | Behavior                                                                                 | Test Type                               | Automated Command                                          | File Exists?  |
| -------- | ---------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------- | ------------- |
| ANLYS-01 | Prompt string contains source-tier instruction prioritizing REVIEWS/CAREERS/LINKEDIN     | unit (prompt text assertion)            | `npx vitest run lib/workflow-engine.test.ts -t "ANLYS-01"` | ❌ Wave 0 gap |
| ANLYS-02 | Prompt string contains per-source diagnostic label definitions                           | unit (prompt text assertion)            | `npx vitest run lib/workflow-engine.test.ts -t "ANLYS-02"` | ❌ Wave 0 gap |
| ANLYS-03 | Prompt string contains anti-parroting constraint                                         | unit (prompt text assertion)            | `npx vitest run lib/workflow-engine.test.ts -t "ANLYS-03"` | ❌ Wave 0 gap |
| ANLYS-04 | problemStatement with quoted snippet passes, without fails warning                       | unit (post-parse logic)                 | `npx vitest run lib/workflow-engine.test.ts -t "ANLYS-04"` | ❌ Wave 0 gap |
| ANLYS-05 | Signal summary block present in prompt with correct tier counts                          | unit (prompt text assertion)            | `npx vitest run lib/workflow-engine.test.ts -t "ANLYS-05"` | ❌ Wave 0 gap |
| ANLYS-06 | 1 confirmed tag → 1 hypothesis; 3 confirmed tags → 3 hypotheses                          | unit (mock Gemini, check output length) | `npx vitest run lib/workflow-engine.test.ts -t "ANLYS-06"` | ❌ Wave 0 gap |
| ANLYS-07 | Prompt confidence table maps REVIEWS→0.80-0.95, hiring→0.70-0.80, website-only→0.60-0.65 | unit (prompt text assertion)            | `npx vitest run lib/workflow-engine.test.ts -t "ANLYS-07"` | ❌ Wave 0 gap |

**Note:** ANLYS-01, ANLYS-02, ANLYS-03, ANLYS-05, ANLYS-07 are prompt text assertions — they test the prompt string content before sending to AI. These are low-cost, deterministic tests that don't require mocking Gemini.

**ANLYS-06 requires Gemini mock** (see Pitfall 4 above for mock pattern). The mock returns a controlled JSON response, and the test verifies that `targetCount` is passed correctly into the prompt and that the output length matches.

**ANLYS-04 success criterion** (each hypothesis has a quoted snippet) is a **live AI output property** — it cannot be fully verified in unit tests without real AI calls. The unit test verifies that the warning log fires when a quote is absent. The live success criterion is verified manually by re-running research for STB-kozijnen and Mujjo after the prompt rewrite.

### Nyquist Sampling Rate

- **Minimum sample interval:** After each prompt change → run: `npx vitest run lib/workflow-engine.test.ts`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)

- [ ] `lib/workflow-engine.test.ts` — add `generateHypothesisDraftsAI` test block with Gemini mock and ANLYS-01 through ANLYS-07 assertions. File exists; add new `describe` block.
- [ ] Gemini mock in `lib/workflow-engine.test.ts` — `vi.mock('@google/generative-ai', ...)` with configurable JSON response. Currently the file mocks `@anthropic-ai/sdk` but not Gemini.

_(No new test files needed — extend the existing `lib/workflow-engine.test.ts`.)_

## Sources

### Primary (HIGH confidence)

- Codebase read: `lib/workflow-engine.ts` lines 616-801 — `generateHypothesisDraftsAI` full implementation
- Codebase read: `lib/research-executor.ts` lines 889-921 — call site with `gate.confirmedPainTags` available
- Codebase read: `lib/workflow-engine.ts` lines 1023-1053 — `metricsFromHypotheses` downstream consumer
- Codebase read: `lib/evidence-scorer.ts` lines 18-29 — source weight constants (REVIEWS=0.90, WEBSITE=0.65)
- Codebase read: `.planning/baselines/baselines.json` — golden baseline for 7 prospects showing current output defects
- Codebase read: `lib/quality-config.ts` — `PAIN_CONFIRMATION_MIN_SOURCES = 2`
- Codebase read: `.planning/REQUIREMENTS.md` — ANLYS-01 through ANLYS-07 full descriptions
- Codebase read: `.planning/STATE.md` — blocker note: "Variable hypothesis count requires downstream audit of UI and outreach templates before changing count — this is a breaking interface change"

### Secondary (MEDIUM confidence)

- Codebase read: `lib/workflow-engine.ts` lines 1066-1068 — `createWorkflowLossMapDraft` uses `hypotheses.slice(0, 3)` — confirms safe for 1-3 count
- Codebase read: `lib/workflow-engine.test.ts` — existing test patterns; confirms Gemini mock gap
- Codebase read: `vitest.config.ts` — test framework configuration

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies; existing `@google/generative-ai` confirmed in package.json
- Architecture: HIGH — single-function rewrite with clear call site and downstream audit complete
- Pitfalls: HIGH — all pitfalls derived from direct codebase reading and baseline evidence

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable — no external API changes expected; internal codebase is the reference)
