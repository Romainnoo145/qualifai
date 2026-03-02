# Pitfalls Research

**Domain:** Rewriting AI hypothesis generation and cleaning tech debt in existing 34.7k LOC sales automation pipeline
**Researched:** 2026-03-02
**Confidence:** HIGH — derived from direct codebase analysis (`lib/workflow-engine.ts`, `lib/evidence-scorer.ts`, `lib/research-executor.ts`, `lib/quality-config.ts`, `prisma/schema.prisma`, `app/admin/prospects/[id]/page.tsx`, `app/admin/outreach/page.tsx`) plus web research on LLM migration and production prompt engineering failure modes.

---

## Critical Pitfalls

Mistakes that cause pipeline failures, system-wide blocks, or outreach quality regressions.

---

### Pitfall 1: Prompt Rewrite Produces Silent Quality Regression — No Regression Harness

**What goes wrong:**
The hypothesis generation prompt is rewritten, the system still runs, it still produces 3 hypotheses per prospect, and nobody notices that the new hypotheses are shallower, more generic, or divorced from the evidence. The `/discover/` client dashboard shows hypotheses to real prospects, and the outreach email quotes them. A silent quality regression at the hypothesis layer means real prospects receive emails about pain points that don't apply to them — the worst possible outcome for a sales tool.

**Why it happens:**
There is currently no automated regression harness for hypothesis quality. The existing test suite mocks AI calls (`workflow-engine.test.ts` vi.mocks `@anthropic-ai/sdk` and `@google/generative-ai`). When the prompt changes, the mocks still pass. No human reviews before/after hypothesis content for all 7 real prospects. A "it works" judgment is based on the system not throwing, not on output quality.

The current prompt (`lib/workflow-engine.ts:686-721`) has specific structural properties:

- Takes top 15 evidence items sorted by `aiRelevance`
- Requires quoted evidence snippets in `problemStatement`
- Constrains `workflowTag` to a fixed allowlist of 16 tags
- Constrains `confidenceScore` to 0.60-0.95 with documented tier semantics

Any rewrite must preserve these invariants. A new prompt that drops the "quote evidence" requirement will produce hypotheses that are speculative rather than evidenced — superficially valid JSON, catastrophically wrong content.

**Prevention:**

- Before rewriting the prompt, run the current system against all 7 real prospects and save the hypothesis outputs as a golden baseline file (JSON + human-readable)
- After rewriting, run again and do a side-by-side comparison: at minimum check that `problemStatement` fields still contain quoted text, `confidenceScore` distribution is similar, and `evidenceRefs` resolve to real evidence IDs
- Add a smoke test: parse the output and assert `hypotheses.every(h => h.problemStatement.includes('"'))` — minimal check that evidence quoting is preserved
- Add a word count floor: `problemStatement.length > 150` — guards against the AI returning one-sentence summaries instead of grounded statements

**Detection:**
Hypotheses contain no quoted text. `confidenceScore` values cluster near 0.70 regardless of evidence strength. `evidenceRefs` array is empty or contains invalid IDs. Prospect reports on `/discover/` that hypotheses don't match their business.

**Phase to address:** Hypothesis generation rewrite phase — capture golden output BEFORE touching the prompt. Compare AFTER.

---

### Pitfall 2: Model Swap (Gemini to Claude) Breaks JSON Parsing Due to API Response Format Differences

**What goes wrong:**
The current hypothesis generation uses `gemini-2.0-flash` via `@google/generative-ai`, which returns text directly via `response.response.text()`. The evidence scorer uses the same client. Adding Claude as a configurable option introduces a fundamentally different API surface: Anthropic's SDK returns `message.content[0].text` (not `response.response.text()`), and the client initialization is different.

The current JSON extraction relies on a regex `text.match(/\[[\s\S]*\]/)` that handles Gemini's tendency to wrap output in markdown fences. Claude's JSON output behavior is different — Claude respects "no markdown fences" instructions more reliably than Gemini but may still emit explanatory text before the JSON array in some edge cases.

If the model selector is implemented as a simple flag that changes the API client without also updating the response parsing path, Claude calls will either throw (wrong property access) or silently return null from the regex match, triggering the fallback to template hypotheses. The fallback produces hardcoded generic output — worse than no AI at all.

**Why it happens:**
The `getGenAI()` lazy singleton pattern in `workflow-engine.ts` is tightly coupled to `GoogleGenerativeAI`. Adding a Claude branch requires a parallel `getAnthropicAI()` pattern, different SDK import, different model call syntax, and different text extraction. Developers add a conditional at the call site without abstracting the provider interface, leaving two incompatible code paths that are difficult to test in isolation.

Additionally: Anthropic's API uses XML tag conventions in system prompts (e.g., `<evidence>...</evidence>`) while Gemini performs better with plain text blocks. The hypothesis generation prompt uses plain text formatting — it will work with Claude but will underperform compared to an XML-structured version. A direct swap without prompt re-formatting gives 70% of Claude's potential output quality.

**Prevention:**

- Define a `generateWithAI(prompt: string, model: 'gemini' | 'claude'): Promise<string>` abstraction before touching either call site
- The abstraction handles: client initialization, API call, text extraction — returns raw text only
- Both providers get tested with the same prompt to verify equivalent JSON extraction
- Use XML tags for Claude: wrap evidence block as `<evidence>...</evidence>` and instruction block as `<instruction>...</instruction>` — improves structured output reliability
- Verify Anthropic SDK version (`@anthropic-ai/sdk: ^0.73.0` is installed but not yet used in hypothesis generation): `client.messages.create({ model, max_tokens, messages })` returns `message.content[0].type === 'text' ? message.content[0].text : ''`

**Detection:**
Hypothesis generation with Claude selected falls back to template output on every run. `console.warn('[generateHypothesisDraftsAI] AI generation failed, falling back to templates:')` fires consistently when Claude is selected. `as any` casts added to suppress TypeScript errors on Claude response shape.

**Phase to address:** Model selection phase — write the provider abstraction first, then connect it; do not add Claude as an inline conditional in the existing Gemini call path.

---

### Pitfall 3: Hardcoded Metric Removal Breaks the Workflow Loss Map PDF and Outreach Email Templates

**What goes wrong:**
The current hypothesis schema includes hardcoded metric fields written directly to `WorkflowHypothesis` rows:

- `hoursSavedWeekLow: 4`, `hoursSavedWeekMid: 8`, `hoursSavedWeekHigh: 14`
- `handoffSpeedGainPct: 28`
- `errorReductionPct: 20`
- `revenueLeakageRecoveredLow: 400`, `revenueLeakageRecoveredMid: 900`, `revenueLeakageRecoveredHigh: 2000`

These hardcoded values (from `METRIC_DEFAULTS` in `workflow-engine.ts:619-628`) are used downstream in:

1. Workflow Loss Map PDF generation (`lib/pdf-render.ts`) — renders the hours/revenue table
2. Outreach email draft generation — outreach templates reference hypothesis metrics
3. The `/discover/` prospect dashboard — displays these numbers to real prospects

Removing or changing the metrics without auditing all downstream consumers will produce broken PDFs (missing table cells), broken email drafts (template variables not resolving), or incorrect evidence-derived numbers (if the new prompt produces different metric types).

**Why it happens:**
The task says "remove hardcoded metric defaults or derive from evidence." This sounds like a prompt change, but it is actually a data model change with downstream consumers. `WorkflowHypothesis` schema columns (`hoursSavedWeekLow`, etc.) must also change in the DB schema, and all code that reads these columns must be updated simultaneously.

**Prevention:**

- Before touching `METRIC_DEFAULTS`, audit all callers of `WorkflowHypothesis` fields:
  - `lib/pdf-render.ts` — does it reference these fields?
  - `lib/outreach/` — do email templates reference `hoursSavedWeekLow` etc.?
  - `app/admin/prospects/[id]/page.tsx` — does the UI display them?
  - `app/discover/` — does the prospect dashboard show them?
- If deriving metrics from evidence: the new prompt must output metric fields in the same JSON schema shape — the DB columns don't change, the values change
- If removing metric columns: this requires a Prisma migration + code change across ALL readers before running — cannot be done incrementally in a running system
- Safest approach: keep columns, let AI derive the values, add `null` as acceptable value for when evidence is insufficient

**Detection:**
PDF generation throws on missing fields. Outreach draft fails to render. Prospect dashboard shows "NaN" or "0" in metrics section. TypeScript errors on consumers that expected non-nullable numbers.

**Phase to address:** Hypothesis schema / metrics phase — map all downstream consumers before deciding whether to remove or derive metrics.

---

### Pitfall 4: Variable Hypothesis Count (1-3) Breaks Downstream Code That Expects Exactly 3

**What goes wrong:**
The current pipeline always generates 3 hypotheses via `parsed.map()` over the AI response. Downstream code — the Workflow Loss Map PDF, the outreach generation, the proof matching, and the `/discover/` dashboard — may be designed around the assumption that exactly 3 hypotheses exist per run. Changing to a variable count of 1-3 based on evidence quality will surface these assumptions as runtime errors.

**Why it happens:**
The constraint "3 hypotheses" is implicit in the prompt (`identify 3 distinct workflow pain hypotheses`) and not enforced at the data layer. Downstream consumers may iterate over hypotheses without checking length, or render a 3-column grid that breaks with 1 or 2 items.

**Prevention:**

- Before changing the prompt to allow 1-3 hypotheses, search for hardcoded assumptions:
  - `hypotheses.slice(0, 3)` — trim to 3
  - Template code that renders `hypotheses[0]`, `hypotheses[1]`, `hypotheses[2]` by index
  - CSS grid definitions: `grid-cols-3` in hypothesis display components
  - Outreach drafts that say "I identified three specific bottlenecks" — will be false for single-hypothesis runs
- The prompt change is the easy part; the UI/template audit is where the breakage lives

**Detection:**
PDF renders with empty sections for missing hypotheses. Outreach email references "three pain points" when only one was generated. UI layout breaks with 1 or 2 hypothesis cards.

**Phase to address:** Variable hypothesis count phase — audit all downstream consumers first; treat as a breaking interface change.

---

### Pitfall 5: Evidence Preprocessing Change (Snippet Length, Source Weighting) Invalidates Calibrated Gate Thresholds

**What goes wrong:**
The quality gate thresholds (`MIN_AVERAGE_CONFIDENCE = 0.55`, `MIN_EVIDENCE_COUNT = 3`, `GREEN_MIN_SOURCE_TYPES = 3`) were calibrated against 7 real prospects with the current evidence scoring formula: `sourceWeight * 0.30 + aiRelevance * 0.45 + aiDepth * 0.25`. The source weights in `evidence-scorer.ts` are: REVIEWS=0.90, LINKEDIN=0.88, NEWS/CAREERS=0.85, REGISTRY=0.80, WEBSITE=0.65.

If snippet length limits change (currently `snippet.slice(0, 600)` for hypothesis, `snippet.slice(0, 300)` for evidence scorer), or if source weights change, the AI scoring output changes, which changes `finalConfidence` values, which changes whether prospects hit AMBER or GREEN. The 7 calibrated prospects could all shift to AMBER (too strict) or all shift to GREEN (too lenient) without any deliberate decision.

**Why it happens:**
Preprocessing changes feel minor ("just adjust the snippet length") but are multiplied across every evidence item. A 300→500 char snippet gives the scoring AI more context, which reliably increases `aiDepth` scores, which shifts `finalConfidence` up by ~0.05 across the board, which can push AMBER prospects to GREEN — effectively re-calibrating the gate without realizing it.

**Prevention:**

- Treat snippet length and source weights as calibrated constants, not free parameters — document them as such in `evidence-scorer.ts`
- Before changing either, run the scoring on the 7 existing real prospects' evidence items and record the before/after `finalConfidence` distribution
- Only proceed if the distribution shift is deliberate and acceptable
- If source weights change (e.g., prioritizing non-website evidence), re-run the quality gate calibration SQL against real prospect data and adjust `MIN_AVERAGE_CONFIDENCE` accordingly

**Detection:**
All 7 existing prospects suddenly shift gate color after a preprocessing change. AMBER prospects become GREEN without any new evidence being collected. Admin no longer sees AMBER warnings that were previously useful.

**Phase to address:** Evidence preprocessing phase — run calibration check before and after any snippet/weight change.

---

### Pitfall 6: Prisma TS2589 Cast Cleanup Introduces Runtime Errors via Over-Confident Typing

**What goes wrong:**
The current codebase has 45 `as any` casts across 15 files. Most of these are in UI components that consume tRPC query results (`app/admin/prospects/[id]/page.tsx` has 8, `app/admin/outreach/page.tsx` has 16). TS2589 occurs because Prisma's deep nested `include` types cause TypeScript's type instantiation to exceed depth limits — the compiler gives up and requires an explicit cast.

The correct fix for TS2589 is to use `Prisma.XGetPayload<typeof query>` helper types or to extract intermediate types using `ReturnType<>`. The incorrect fix is to replace `as any` with `as SomeInterface` where the interface is hand-written and may not exactly match the Prisma-generated shape. This creates a false sense of type safety: the code compiles, but at runtime, fields that Prisma returns under different names (e.g., `_count` vs `count`, relation names) cause `undefined` access.

In `app/admin/prospects/[id]/page.tsx`, the cast `(researchRuns.data?.[0] as any).qualityApproved` is accessing a field that must exist on `ResearchRun`. If the cleanup replaces this with a typed interface that spells the field differently, the TypeScript check passes but the runtime behavior is wrong.

**Why it happens:**
TS2589 casts exist because they were the pragmatic solution at the time. Cleaning them requires understanding WHY each specific cast was needed — some are for TS2589 (depth limit), some are for tRPC return type inference mismatches, some are for Prisma `Json` field access patterns. Treating them all the same way leads to wrong fixes.

The 16 `as any` casts in `outreach/page.tsx` are predominantly for tRPC mutation access patterns: `(api.outreach.processSignals as any).useMutation({...})`. This is a tRPC v11 pattern issue, not a TS2589 issue — the fix requires either upgrading how tRPC mutations are accessed or using the correct tRPC v11 inference helpers, not just removing the cast.

**Prevention:**

- Categorize each `as any` cast before touching it:
  - Category A: TS2589 deep Prisma inference — fix with `Prisma.XGetPayload` helper types
  - Category B: tRPC mutation pattern (`api.x.y as any`).useMutation) — fix with tRPC v11 correct mutation access
  - Category C: Prisma `Json` field access — fix with a typed helper function (e.g., `parseMetadata(item.metadata)`)
  - Category D: Intentional escape hatch (correctly typed elsewhere) — leave with comment explaining why
- Fix one category at a time, run `npm run check` after each category
- Never remove a cast without understanding what it was hiding — add a comment explaining the fix approach

**Detection:**
TypeScript compiles after cast removal but runtime throws `Cannot read property 'qualityApproved' of undefined`. tRPC mutation calls break silently after removing the `as any` wrapper. Prisma `Json` fields return `null` instead of expected object because the new type implies non-null.

**Phase to address:** Tech debt cleanup phase — categorize all 45 instances first, then fix by category with validation between each batch.

---

### Pitfall 7: Import-After-Export Pattern in workflow-engine.ts Causes ESM Circular Reference in Build

**What goes wrong:**
`workflow-engine.ts` has an import statement on lines 540-544 that appears AFTER an export statement on line 539:

```typescript
// Line 539
export { computeTrafficLight, type TrafficLight } from '@/lib/quality-config';
// Lines 540-544 — import AFTER export
import {
  MIN_AVERAGE_CONFIDENCE,
  PAIN_CONFIRMATION_MIN_SOURCES,
} from '@/lib/quality-config';
import type { TrafficLight } from '@/lib/quality-config';
```

ESM hoists all `import` declarations to the top of the module regardless of where they appear in the source — so this works at runtime. However, it creates a linting/readability issue and can trip up build tools that perform static analysis in source order. More importantly, if `workflow-engine.ts` is further modified during the v3.0 milestone (which it will be — hypothesis generation is in this file), additional imports added near these out-of-order statements can accidentally compound the ordering issue or introduce genuine circular reference problems if new imports reference modules that import from `workflow-engine.ts`.

The `workflow-engine.ts` file is already 1400+ lines. Adding more hypothesis generation logic (model selection, evidence preprocessing changes) will push it over 1500 lines — approaching the project's 300-line file limit guideline. The import anomaly is a signal that the file needs modularization, not just cleanup.

**Prevention:**

- Fix the import ordering anomaly at the start of the v3.0 milestone, not at the end — it should be the first commit of the tech debt phase
- The correct fix: move the `import` block to the top of the file alongside all other imports
- Consider extracting hypothesis generation into `lib/ai/generate-hypotheses.ts` to bring `workflow-engine.ts` under 1200 lines — the AI functions (`generateHypothesisDraftsAI`, `scoreWithClaude`, `generateFallbackHypothesisDrafts`) are self-contained and can be split

**Detection:**
Build warnings about import ordering. Circular reference errors in Next.js edge runtime. ESLint import order rule violations that accumulate after further edits.

**Phase to address:** Tech debt cleanup phase — import ordering fix first, file splitting as a follow-on if hypothesis generation is extracted.

---

## Moderate Pitfalls

---

### Pitfall 8: Model Selection Config Uses Environment Variable That Breaks Per-Request Flexibility

**What goes wrong:**
The most tempting implementation of "configurable model selection" is an environment variable: `AI_HYPOTHESIS_MODEL=claude` or `AI_HYPOTHESIS_MODEL=gemini`. This works for global switching but prevents per-run or per-prospect model selection (e.g., "use Claude for this specific re-run to compare"). If the admin UI later needs to expose model selection per run, the env-var approach requires a full implementation swap.

**Prevention:**

- Store the model preference in the `Campaign` record or the `ResearchRun.inputSnapshot` — not in env vars
- The `executeResearchRun` input already accepts `campaignId` which maps to a campaign with `tone`, `language`, `nicheKey` — add `aiModel?: 'gemini' | 'claude'` to the same campaign config
- Default: `gemini` (current behavior, zero disruption)
- The env var `GOOGLE_AI_API_KEY` and `ANTHROPIC_API_KEY` (already in use for proof matching) are provider credentials, not model selection

**Detection:**
Model selection only works globally; cannot test Claude on one prospect without affecting all concurrent runs. A/B comparison between models is impossible at the run level.

**Phase to address:** Model selection phase — add to Campaign schema or ResearchRun input, not to env vars.

---

### Pitfall 9: /discover/ Validation Session Data Invalidated by Prompt Rewrite Before Session Runs

**What goes wrong:**
The project has a pending todo: "Run real prospect validation session on /discover/ before building features that depend on this signal." The v3.0 milestone rewrites the hypothesis generation prompt. If the rewrite happens before the validation session, the hypotheses that real prospects see will be generated by the NEW prompt — not the current one that has been running in production. The validation session result then measures the new prompt's quality, not the old one. This is valuable, but if the new prompt produces worse hypotheses (silent regression from Pitfall 1), the validation session produces feedback about AI quality, not about UX or hypothesis relevance — a wasted session.

**Prevention:**

- Run the /discover/ validation session BEFORE rewriting the prompt, if even one session is possible
- If the session must happen after the rewrite, add a note to the session debrief: "hypotheses were generated by the new prompt — feedback may reflect prompt quality, not product design"
- The session's primary value is UX feedback on the validation UI (confirm/decline flow), which is prompt-independent — this part is safe to run at any time

**Detection:**
Session feedback focuses on "the pain points don't apply to us" rather than "I can't figure out how to confirm/decline" — this indicates prompt regression, not UX issue.

**Phase to address:** Validation session phase — schedule BEFORE hypothesis prompt rewrite; if impossible, run after but note the dependency.

---

### Pitfall 10: Pain Gate Calibration SQL Not Run Before or After Hypothesis Changes

**What goes wrong:**
The pending todo "Pain gate calibration SQL against real prospect data" has been deferred since v2.1. The v3.0 hypothesis rewrite changes what hypotheses are generated, which may change what evidence gets linked via `evidenceRefs`. If the pain gate calibration SQL (which analyzes cross-source evidence distribution) is run AFTER the hypothesis rewrite, it measures a different distribution than the production system produced before v3.0. The calibration results will not be comparable across versions.

**Prevention:**

- Run the calibration SQL against current production data BEFORE the hypothesis rewrite ships:
  ```sql
  SELECT p."companyName", ei."sourceType", COUNT(*) as evidence_count,
         AVG(ei."confidenceScore") as avg_confidence
  FROM "EvidenceItem" ei
  JOIN "Prospect" p ON ei."prospectId" = p.id
  WHERE ei."confidenceScore" >= 0.50
  GROUP BY p."companyName", ei."sourceType"
  ORDER BY p."companyName", ei."sourceType";
  ```
- This gives a before-state baseline for the pain gate
- Run again after the rewrite ships and compare — any major shift in distribution indicates the new hypothesis generation is pulling from different evidence

**Phase to address:** Pain gate calibration phase — run SQL BEFORE hypothesis changes, then again AFTER. Both datapoints are needed.

---

### Pitfall 11: SERP Cache Re-Read After Overwrite Bug Not Fixed Before Adding More Research Logic

**What goes wrong:**
The known tech debt item: "SERP cache re-read after overwrite (Phase 8) — mitigated by sourceSet.serpDiscoveredAt as primary guard." In `executeResearchRun`, the `priorSnapshot` is read BEFORE the run is created/updated (line 133-141). However, in the `deepCrawl` block, there is a SECOND read of `existingSnapshot` (lines 316-325) after the `inputSnapshot` has already been overwritten by the initial `run.create/update`. This secondary read is the bug — it reads the just-overwritten snapshot, finds no `serpCache`, and potentially triggers a fresh SerpAPI call even when the primary guard (`useSerpFromSourceSet`) correctly detected a valid cache.

This bug is currently mitigated but not fixed. If v3.0 adds more logic that reads from `inputSnapshot` (e.g., reading previously generated hypotheses to avoid re-generating identical output), the same pattern will be applied to the new reads — at which point there will be THREE reads from a stale/overwritten snapshot.

**Prevention:**

- Fix the SERP cache re-read bug as the FIRST technical change in the research executor:
  - Remove the second `db.researchRun.findUnique` in the `deepCrawl` block (lines 316-325)
  - Use `priorSnapshot` (already pre-read on line 133) as the single source of truth for all snapshot reads
  - Keep `isCacheValid = useSerpFromSourceSet` as the primary guard (it's correct)
- Document the fix in a comment: "Pre-read snapshot is the ONLY valid source of prior-run data — do not re-read after run create/update"

**Phase to address:** Tech debt cleanup phase — fix SERP re-read as first change in research-executor.ts before any other logic is added.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems when v3.0 changes interact with them.

| Shortcut                                                      | Immediate Benefit                 | Long-term Cost                                                                     | When Acceptable                                                 |
| ------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `(researchRuns.data?.[0] as any).qualityApproved`             | Bypasses TS2589 depth limit       | Breaks silently if field name changes in Prisma schema                             | Temporary; must be replaced with `Prisma.ResearchRunGetPayload` |
| `(api.outreach.processSignals as any).useMutation`            | Bypasses tRPC v11 inference limit | Masks breaking API changes in tRPC router                                          | Must be replaced with correct tRPC v11 mutation pattern         |
| `METRIC_DEFAULTS` hardcoded in `generateHypothesisDraftsAI`   | Zero per-prospect computation     | Metrics in PDF and outreach emails are always identical regardless of prospect     | Must derive from evidence or flag as placeholder                |
| Model-specific response parsing inline in hypothesis function | Simple first implementation       | Breaks when second model added; Gemini and Claude have different text() extraction | Must be abstracted before Claude is added                       |
| Import statement after export in `workflow-engine.ts`         | ESM hoisting makes it work        | Compounds with further edits; linting violations accumulate                        | Fix immediately — one-line move                                 |

---

## Integration Gotchas

Common mistakes when v3.0 changes interact with existing systems.

| Integration                                          | Common Mistake                                                                              | Correct Approach                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Hypothesis rewrite + PDF generation                  | Changing metric field names in hypothesis output without updating `pdf-render.ts`           | Audit all `WorkflowHypothesis` field readers before changing the prompt schema                                                            |
| Claude model + Gemini evidence scorer                | Using `GoogleGenerativeAI` client for Claude calls                                          | Two separate client instances: `getGenAI()` for Gemini evidence scoring (keep), `getAnthropicAI()` for Claude hypothesis generation (new) |
| Variable hypothesis count + outreach drafts          | Outreach template says "three specific bottlenecks" even when 1 hypothesis generated        | Audit outreach templates for hardcoded count references before variable count ships                                                       |
| TS2589 cast cleanup + tRPC mutations                 | Removing `as any` from `api.x.y.useMutation()` calls breaks at runtime                      | tRPC v11 mutations need the correct `api.x.y.useMutation()` without wrapper — test each individually                                      |
| Evidence preprocessing + quality gate                | Changing snippet length shifts `aiDepth` scores which shifts `finalConfidence` distribution | Run calibration query on 7 prospects before and after; adjust `MIN_AVERAGE_CONFIDENCE` if distribution shifts                             |
| Hypothesis rewrite + `/discover/` validation session | Validation session measures new prompt quality, not product UX                              | Session reveals prompt quality regression — treat as bonus signal, not session failure                                                    |

---

## Performance Traps

Patterns that work at 7 prospects but degrade at 50+.

| Trap                                               | Symptoms                                                                                      | Prevention                                                                                                                             | When It Breaks                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Sequential hypothesis generation for batch re-runs | Re-running all 7 prospects takes 7× the per-prospect time                                     | No change needed now; add note for when batch re-runs are implemented                                                                  | At 20+ prospects in a batch re-run                 |
| Claude API rate limits during evidence scoring     | If Claude is used for BOTH hypothesis generation AND evidence scoring, rate limits hit harder | Keep Gemini Flash for evidence scoring (low cost, high volume); use Claude only for hypothesis generation (low volume, higher quality) | At 10+ concurrent research runs                    |
| Gemini Flash evidence scoring 15-item batches      | Already optimized; if snippet length increases, token count per batch increases               | Keep batch size at 15; monitor Gemini API response times after snippet length changes                                                  | If snippet length increases to 600+ chars per item |

---

## "Looks Done But Isn't" Checklist

- [ ] **Hypothesis prompt rewrite:** Golden baseline captured from all 7 real prospects before the prompt change — verify by checking for a `hypotheses-baseline-YYYY-MM-DD.json` file in `/scripts/` or similar
- [ ] **Model selection:** Provider abstraction wraps both Gemini and Claude — verify by checking that `generateWithAI(prompt, 'claude')` and `generateWithAI(prompt, 'gemini')` both return raw text strings without requiring the caller to know API client details
- [ ] **Metric removal/derivation:** All downstream consumers of `hoursSavedWeekLow` and related fields audited — verify by grepping `hoursSavedWeek\|handoffSpeedGainPct\|errorReductionPct\|revenueLeakage` across all files and confirming no unupdated consumer exists
- [ ] **Variable hypothesis count:** All downstream consumers of hypothesis array length audited — verify by grepping `hypotheses\[0\]\|hypotheses\[1\]\|hypotheses\[2\]\|grid-cols-3` in templates and UI components
- [ ] **TS2589 cast cleanup:** Each category of `as any` cast addressed with the correct fix pattern — verify by running `npm run check` after each batch and ensuring zero new TypeScript errors
- [ ] **Import ordering fix:** All imports in `workflow-engine.ts` appear before any exports — verify by checking that lines 1-30 contain only imports and no `export { ... } from` statements
- [ ] **SERP cache re-read fix:** Only one `db.researchRun.findUnique` call per `executeResearchRun` invocation — verify by grepping `findUnique` in `research-executor.ts`
- [ ] **Pain gate calibration:** SQL run against real data BEFORE and AFTER hypothesis changes — verify that both result sets are saved for comparison

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall                                       | Recovery Cost | Recovery Steps                                                                                                                                                                                               |
| --------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hypothesis quality regression (silent)        | MEDIUM        | Roll back `generateHypothesisDraftsAI` prompt to prior version; re-run `deleteMany` + hypothesis re-generation for affected prospects; do not send outreach for prospects that received regressed hypotheses |
| Claude model swap breaks JSON parsing         | LOW           | Add explicit text extraction branch for Claude: `message.content[0].type === 'text' ? message.content[0].text : ''`; fall back to Gemini if Claude extraction fails; add test for both paths                 |
| Metric removal breaks PDF generation          | HIGH          | Restore `METRIC_DEFAULTS` immediately; audit all PDF consumers before attempting removal again; this is a multi-phase change that cannot be done in one commit                                               |
| TS2589 cast cleanup introduces runtime errors | MEDIUM        | Revert the specific cast cleanup that caused the error; add a test that exercises the affected code path before attempting cleanup again; use `Prisma.XGetPayload` instead of manual interface               |
| Variable hypothesis count breaks UI layout    | LOW           | Add `min(hypotheses, 3)` guard in all render paths immediately; audit templates; re-attempt variable count with proper UI handling                                                                           |
| Evidence preprocessing shifts gate thresholds | MEDIUM        | Revert preprocessing change; recalibrate `MIN_AVERAGE_CONFIDENCE` against the 7 real prospects with the NEW preprocessing values before shipping                                                             |

---

## Pitfall-to-Phase Mapping

| Pitfall                                 | Prevention Phase                       | Verification                                                                                                                   |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Silent hypothesis quality regression    | Hypothesis rewrite phase               | Verify: golden baseline captured before; side-by-side comparison shows `problemStatement` fields contain quotes                |
| Model swap breaks JSON parsing          | Model selection phase                  | Verify: both Gemini and Claude branches tested with same prompt; provider abstraction returns identical string type            |
| Metric removal breaks PDF/outreach      | Hypothesis schema phase                | Verify: grep for all metric field consumers returns empty (or all consumers updated) before merging                            |
| Variable count breaks UI/templates      | Variable count phase                   | Verify: hypothesis array length of 1 renders correctly in all UI components; outreach draft does not hardcode "three"          |
| Evidence preprocessing invalidates gate | Evidence preprocessing phase           | Verify: calibration query run before and after; threshold adjusted if distribution shifts                                      |
| TS2589 cast cleanup runtime errors      | Tech debt cleanup phase                | Verify: `npm run check` passes; smoke test hits each cleaned call site in development                                          |
| Import anomaly compounds                | Tech debt cleanup phase (first commit) | Verify: all imports in `workflow-engine.ts` appear before line 50; no `export { ... } from` in import section                  |
| SERP cache re-read bug                  | Tech debt cleanup phase                | Verify: `grep -n 'findUnique' lib/research-executor.ts` returns exactly one hit                                                |
| Pain gate calibration skipped           | Calibration phase                      | Verify: two SQL result sets saved — one pre-rewrite, one post-rewrite                                                          |
| /discover/ session timing               | Validation phase                       | Verify: session notes indicate whether it ran on old or new prompt; hypothesis generation commit date compared to session date |

---

## Sources

- Codebase analysis (direct): `lib/workflow-engine.ts` (generateHypothesisDraftsAI at lines 615-801, METRIC_DEFAULTS at 619-628, import anomaly at 539-544, scoreWithClaude at 1408-1464), `lib/evidence-scorer.ts` (SOURCE_WEIGHTS, batch scoring, snippet slice at 300 chars), `lib/research-executor.ts` (SERP cache re-read bug at lines 316-325, pre-read at 133-141), `lib/quality-config.ts` (calibrated thresholds, MIN_AVERAGE_CONFIDENCE=0.55), `app/admin/prospects/[id]/page.tsx` (8 `as any` casts), `app/admin/outreach/page.tsx` (16 `as any` casts, tRPC mutation pattern), `package.json` (`@anthropic-ai/sdk: ^0.73.0` installed but not used in hypothesis generation)
- Web research: LLM provider API incompatibilities — Anthropic XML tag preference vs Gemini plain text, different response object structures (`response.response.text()` vs `message.content[0].text`), temperature handling differences (VentureBeat "Swapping LLMs isn't plug-and-play"); TS2589 deep type instantiation — TypeScript GitHub issue #34933 confirming large-codebase-specific manifestation, correct fix patterns via `Prisma.XGetPayload`; Prompt versioning and regression testing — getmaxim.ai recommendation for golden test sets and side-by-side comparison before shipping prompt changes
- Project memory: "TS2589 deep inference: cast Prisma results as any, re-type via helper functions"; "SERP cache re-read after overwrite (Phase 8) — mitigated by sourceSet.serpDiscoveredAt as primary guard"; "Run real prospect validation session on /discover/ before building features that depend on this signal"; "Pending: Crawl4AI v0.8.x verification, pain gate calibration SQL against real prospects"

---

_Pitfalls research for: Qualifai v3.0 Sharp Analysis — hypothesis generation rewrite, model selection, evidence preprocessing, Prisma cast cleanup, import ordering fix, validation session, pain gate calibration_
_Researched: 2026-03-02_
