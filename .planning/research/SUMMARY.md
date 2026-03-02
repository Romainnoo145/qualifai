# Project Research Summary

**Project:** Qualifai — v3.0 Sharp Analysis
**Domain:** AI-powered B2B hypothesis generation quality improvement + tech debt resolution
**Researched:** 2026-03-02
**Confidence:** HIGH

## Executive Summary

Qualifai v3.0 is a targeted precision milestone, not a platform expansion. The research is unanimous: the root cause of shallow hypothesis output is a prompt reasoning failure, not an evidence scarcity problem. The current `generateHypothesisDraftsAI()` function has four structural deficiencies — no source-tier priority, no anti-parroting constraint, no mandatory quote requirement, and hardcoded metric defaults that fabricate identical precision across every prospect. All four are fixable with prompt engineering and minor code changes, requiring zero new dependencies and no schema migrations. The existing Anthropic SDK (`@anthropic-ai/sdk: ^0.73.0`) is already installed and already used for proof matching, making Claude model selection a low-effort, high-value addition that enables systematic quality benchmarking against Gemini Flash.

The architecture is surgically clear: all meaningful v3.0 changes land inside a single function (`generateHypothesisDraftsAI()` in `lib/workflow-engine.ts`) and its call chain. No structural pipeline changes, no new files required. The recommended build order — tech debt cleanup first, then evidence tiering plus prompt rewrite, then model selection, then metric derivation — produces a clean baseline before each progressive change and minimizes debugging surface area at every step.

The primary risk is a silent quality regression: the system continues to generate valid JSON but with shallower, less-evidenced hypotheses after the prompt rewrite. Prevention requires capturing a golden baseline from all 7 real prospects before touching any prompt text, then doing a structured side-by-side comparison after. Secondary risks cluster around downstream consumers of hypothesis data — the workflow loss map PDF, outreach templates, and the `/discover/` dashboard all have implicit assumptions about metric presence and hypothesis count that must be audited before removing hardcoded defaults or enabling variable output count.

## Key Findings

### Recommended Stack

Zero new npm dependencies. The existing stack — Next.js 16, tRPC 11, Prisma 7, `@anthropic-ai/sdk ^0.73.0`, `@google/generative-ai ^0.24.1` — covers all v3.0 requirements without additions. The one proactive action is upgrading all `gemini-2.0-flash` model strings to `gemini-2.5-flash` before the June 1, 2026 retirement date; this is a string change across 4 files (workflow-engine.ts, evidence-scorer.ts, serp.ts, review-adapters.ts) with no API or code changes.

**Core technologies:**

- `@anthropic-ai/sdk ^0.73.0`: Claude hypothesis generation — already installed, already used for proof matching at `workflow-engine.ts:1408`; zero additional setup required
- `@google/generative-ai ^0.24.1`: Gemini Flash evidence scoring (unchanged) + default hypothesis model; stays as-is
- Prisma 7 + PostgreSQL: `WorkflowHypothesis` metric fields already nullable (`Int?`, `Float?`) — no schema migration needed for metric derivation changes

**Model selection:** Use `claude-sonnet-4-5` as the Claude model option. Sonnet is the correct quality/cost balance at approximately $0.02/run — Opus costs roughly 7x more. Gemini Flash remains the default (backward-compatible, zero disruption to existing runs).

**Deferred:** `@google/generative-ai` to `@google/genai` SDK migration (deadline June 24, 2026) deferred to v4.x.

See `.planning/research/STACK.md` for full capability-by-capability analysis.

### Expected Features

**Must have (table stakes — regression fixes):**

- Source-tier priority instruction in prompt — tells LLM that REVIEWS/CAREERS/LINKEDIN evidence is diagnostic; WEBSITE is context only
- Source-type diagnostic labeling — each evidence block labeled with what the source type means (reviews = customer pain, careers = operational gaps, website = marketing self-image)
- Anti-parroting constraint — explicit instruction not to derive hypotheses from the company's own website copy
- Mandatory quote/citation requirement — each `problemStatement` must contain a verbatim quoted snippet from a non-WEBSITE source
- Remove hardcoded `METRIC_DEFAULTS` — eliminates identical fabricated numbers across every prospect (pending downstream audit first)
- Configurable model selection — `model?: 'gemini-flash' | 'claude-sonnet'` per-run parameter on `generateHypothesisDraftsAI()`

**Should have (differentiators):**

- Source signal summary injection — structured preamble before evidence block showing tier counts (e.g., "High-value signals: 4 REVIEWS, 2 CAREERS. Low-value: 6 WEBSITE") to prime LLM before raw evidence
- Variable hypothesis count (1-3 based on confirmed pain tags) — eliminates fabricated third hypothesis for thin-evidence prospects; `min(confirmedPainTags.size, 3)`, minimum 1
- Confidence score tier instruction — maps source type to confidence range (REVIEWS/LINKEDIN = 0.80-0.95; website-only = 0.60-0.65)

**Defer to follow-up:**

- Two-pass chain-of-thought reasoning — validate items 1-6 first; may be sufficient without CoT overhead
- Primary source attribution badge in admin UI
- `/discover/` validation session (separate activity, not a code feature — pending since v2.1)
- Fine-tuning, RAG, or automated training loops (insufficient validated data; 7 prospects is far below minimum viable)

**Success signal for MVP:** STB-kozijnen hypotheses cite reviews or hiring signals, not service page copy; Mujjo hypotheses cite customer support reviews (0.85 confidence already confirmed); no two prospects share identical metric numbers; Claude Sonnet selectable via `hypothesisModel` run input.

See `.planning/research/FEATURES.md` for full feature dependency graph and evidence quality citations.

### Architecture Approach

All v3.0 changes are targeted edits inside `generateHypothesisDraftsAI()` and its call chain. The pipeline structure (`research-executor.ts` → `workflow-engine.ts` → AI model → DB) is unchanged. The key architectural pattern is evidence tiering: a new pure `tierEvidence()` helper splits evidence into Tier A (REVIEWS, LINKEDIN, CAREERS, JOB_BOARD, NEWS, REGISTRY) and Tier B (WEBSITE, DOCS, MANUAL_URL) before prompt construction. Tier A items get 1200-char snippets; Tier B gets 400-char snippets. This preserves the 15-item context budget while giving high-signal evidence proportionally more attention.

**Major components and their v3.0 status:**

1. `lib/workflow-engine.ts::generateHypothesisDraftsAI()` — Modified: evidence tiering, full prompt rewrite, model branching, variable count, metric derivation
2. `lib/workflow-engine.ts` (module level) — Modified: new `anthropicClient` lazy init following existing `genaiClient` pattern; new `tierEvidence()` pure helper function
3. `lib/research-executor.ts` — Modified: thread optional `model` param; remove SERP cache re-read bug (second `findUnique` in deepCrawl block)
4. `server/routers/research.ts` — Modified: add optional `hypothesisModel: z.enum(['gemini-flash', 'claude-sonnet'])` to `startRun` and `retryRun`
5. Admin and public pages (8 files) — Modified: TS2589 `as any` cast cleanup using typed helper pattern by category

**No new files required.** The anti-pattern of a separate `lib/claude-hypothesis-generator.ts` is explicitly rejected — all pre-processing is shared; only the API call branches by model. Defining a `generateWithAI(prompt, model): Promise<string>` abstraction handles both providers cleanly without splitting logic.

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, component boundary table, and exact code patterns.

### Critical Pitfalls

Research identified 11 pitfalls (7 critical, 4 moderate) derived from direct codebase analysis. Top 5 by severity:

1. **Silent quality regression after prompt rewrite** — The system continues to produce valid JSON with shallower hypotheses and nobody notices until real prospects receive irrelevant outreach. Prevention: capture golden baseline JSON from all 7 real prospects BEFORE touching any prompt text. After rewriting, run side-by-side and verify `problemStatement` fields contain quoted text, `confidenceScore` distribution is similar, and `evidenceRefs` resolve to real IDs. Add smoke test: `hypotheses.every(h => h.problemStatement.includes('"'))`.

2. **Model swap breaks JSON parsing due to API response format differences** — Gemini returns `response.response.text()`; Anthropic SDK returns `message.content[0].text`. These are incompatible shapes. If Claude is wired as an inline conditional without abstracting the provider interface, Claude calls silently fall back to template output. Prevention: define `generateWithAI(prompt, model): Promise<string>` abstraction first; both providers return raw text; Claude also benefits from XML-structured prompts (`<evidence>`, `<instruction>`) vs Gemini's plain text blocks.

3. **Metric removal breaks workflow loss map PDF and outreach email templates** — `METRIC_DEFAULTS` feeds three downstream consumers: `lib/pdf-render.ts`, outreach email draft templates, and the `/discover/` prospect dashboard. Removing defaults without auditing all consumers produces broken PDFs, unresolved template variables, or "NaN" values visible to real prospects. Prevention: grep all metric field consumers (`hoursSavedWeekLow`, `handoffSpeedGainPct`, `errorReductionPct`, `revenueLeakageRecoveredLow`) before touching the constant. Schema fields are already nullable — keep `METRIC_DEFAULTS` as last-resort fallback, not deleted entirely.

4. **Variable hypothesis count breaks downstream code expecting exactly 3** — UI components may render 3-column grids; outreach drafts may hardcode "three specific bottlenecks"; templates may access `hypotheses[0]`, `hypotheses[1]`, `hypotheses[2]` by index. Prevention: audit all these patterns before changing the prompt count. This is a breaking interface change, not a prompt-only change.

5. **TS2589 cast cleanup introduces runtime errors via wrong fix pattern** — The 45 `as any` casts across 15 files fall into three distinct categories: TS2589 depth limit (fix with `Prisma.XGetPayload`), tRPC v11 mutation pattern (fix with correct v11 access pattern), and Prisma `Json` field access (fix with typed helper). Treating all categories the same produces false type safety that compiles but fails at runtime. Prevention: categorize first, fix by category, run `npm run check` after each batch.

See `.planning/research/PITFALLS.md` for all 11 pitfalls with detection signals, recovery strategies, and the "looks done but isn't" checklist.

## Implications for Roadmap

Research is unambiguous on build order. The dependency chain flows from clean baseline → verified prompt → model comparison → metric derivation.

### Phase 1: Tech Debt Foundation

**Rationale:** `workflow-engine.ts` is 1400+ lines and already has an import ordering anomaly and a known SERP cache re-read bug. Adding hypothesis generation changes on top of this without cleaning first compounds debugging complexity. Tech debt fixes also establish a passing `npm run check` — the health baseline required to validate all subsequent changes. The import ordering fix (5 minutes) should be the first commit so further edits don't compound the anomaly.

**Delivers:** Clean `npm run check` pass; import ordering fixed in `workflow-engine.ts`; SERP cache re-read bug removed from `research-executor.ts`; TS2589 casts addressed by category across 8 files; unused `logoUrl` prop removed; `gemini-2.0-flash` upgraded to `gemini-2.5-flash` across 4 files.

**Addresses:** TD-1 (import ordering), TD-2 (logoUrl prop), TD-3/TD-4 (as any casts categorized and fixed), TD-5 (E2E send test), TD-6 (SERP cache re-read), Gemini model string upgrade.

**Avoids:** Pitfall 7 (import anomaly compounds with new hypothesis code), Pitfall 11 (SERP bug expands if more executor logic is added before fix), Pitfall 6 (cast cleanup runtime errors prevented by categorical approach).

**Research flag:** Standard patterns — no deeper research needed. All fixes fully specified in ARCHITECTURE.md with exact file locations and correct fix patterns for each category.

---

### Phase 2: Hypothesis Prompt Rewrite + Evidence Tiering

**Rationale:** Highest-value, lowest-risk change in the milestone. Pure prompt engineering and an in-function tiering helper — no new dependencies, no schema changes, no API integrations. Must come before model selection so the prompt is validated on Gemini (known baseline) before adding Claude routing complexity. Captures the regression fix that closes the core quality gap without any moving parts beyond the prompt text itself.

**Delivers:** `tierEvidence()` pure helper inside `workflow-engine.ts`; evidence tiering with Tier A (8 items, 1200-char snippets) and Tier B (7 items, 400-char snippets); rewritten prompt with source-tier priority, diagnostic labeling, anti-parroting constraint, mandatory quote requirement, source signal summary injection, confidence score tier instruction; variable output count (1-3 based on confirmed pain tags); post-parse quality filter (`confidenceScore >= 0.60`).

**Addresses:** Features: source-tier priority, diagnostic labeling, anti-parroting constraint, quote requirement, variable hypothesis count, confidence score tier instruction, source signal summary injection.

**Avoids:** Pitfall 1 (silent regression) by capturing golden baseline before prompt change and doing structured side-by-side comparison after; Pitfall 4 (variable count) by auditing downstream UI and templates before changing count; Pitfall 5 (gate threshold drift) by treating snippet length as a calibrated constant.

**Research flag:** Standard patterns — prompt structure, evidence tiering code, and response validation logic are all fully specified in ARCHITECTURE.md. No additional research needed.

---

### Phase 3: Configurable Model Selection (Claude vs Gemini)

**Rationale:** Depends on Phase 2 having a verified, clean prompt on real prospects. Model comparison is meaningless if the prompt itself is broken. Once Phase 2 is verified, adding Claude as a selectable option enables per-run quality benchmarking. The Anthropic SDK is already in the file — this is a wiring task, not an integration task.

**Delivers:** `generateWithAI(prompt, model): Promise<string>` provider abstraction handling both Gemini (`response.response.text()`) and Claude (`message.content[0].text`) response shapes; `getAnthropic()` lazy init alongside existing `getGenAI()`; `model?: HypothesisModel` optional parameter on `generateHypothesisDraftsAI()` defaulting to `'gemini-flash'`; `hypothesisModel` optional input on `research.startRun` and `research.retryRun`; parameter threaded through `executeResearchRun()`.

**Addresses:** Feature: configurable model selection. Stack: `@anthropic-ai/sdk` Anthropic client following existing `scoreWithClaude()` pattern at line 1408.

**Avoids:** Pitfall 2 (JSON parsing breaks on model swap) by building provider abstraction first before connecting to the model param; Pitfall 8 (env-var model config prevents per-run flexibility) by using per-run parameter, not global env var.

**Research flag:** Standard patterns — Anthropic SDK call pattern already demonstrated in same file. XML tag formatting recommendation for Claude documented in PITFALLS.md. No additional research needed.

---

### Phase 4: Metric Derivation (Remove Hardcoded Defaults)

**Rationale:** Last in sequence because it has the most downstream dependencies and one unresolved research gap (`generateWorkflowLossMapContent()` not read in this research pass). Requires auditing all consumers of metric fields before implementation. The schema is already nullable, so no migration risk, but the application-level consumer audit is a prerequisite.

**Delivers:** AI-estimated metric ranges per prospect (hours saved, error reduction) in hypothesis output instead of hardcoded identical defaults; `METRIC_DEFAULTS` retained as last-resort fallback (not deleted); prompts updated with metric estimation instructions and wide-range labeling.

**Addresses:** Feature: remove hardcoded metric defaults. Architecture: prompt schema update; consumer audit complete.

**Avoids:** Pitfall 3 (metric removal breaks PDF and outreach) by auditing all downstream consumers before any implementation; the nullable schema columns are already in place so no migration risk once consumers are confirmed safe.

**Research flag:** Needs deeper research during planning — `generateWorkflowLossMapContent()` was not read in this research pass and is the critical dependency. Phase planning must include reading that function and mapping all `hoursSavedWeekLow`, `handoffSpeedGainPct`, `errorReductionPct`, `revenueLeakageRecoveredLow` call sites before committing to an approach. Also grep outreach templates and `/discover/` components for metric field reads.

---

### Phase Ordering Rationale

- Tech debt first establishes a clean build baseline and prevents the import anomaly and SERP cache bug from compounding with new code
- Prompt rewrite before model selection validates correctness on the known Gemini baseline before adding branching complexity
- Model selection before metric derivation — benchmarking model quality requires a stable, fully-tested prompt
- Metric derivation last — highest downstream dependency surface; all other phases must be stable before touching this
- Each phase is independently shippable and testable with real prospect data

### Research Flags

Phases needing deeper research during planning:

- **Phase 4 (Metric Derivation):** `generateWorkflowLossMapContent()` not read in this research pass. Must read and audit before implementing. Budget time to grep all metric field consumers across the full codebase before the phase plan is written.

Phases with standard patterns (skip `/gsd:research-phase`):

- **Phase 1 (Tech Debt):** All fixes fully specified in ARCHITECTURE.md with exact line numbers and correct fix patterns per category.
- **Phase 2 (Prompt Rewrite):** Prompt structure, tiering code, and response validation logic all specified in ARCHITECTURE.md and FEATURES.md.
- **Phase 3 (Model Selection):** Anthropic SDK pattern already demonstrated in same file at `scoreWithClaude()`. No new integrations.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                                                      |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stack        | HIGH       | All from direct `package.json` and `env.mjs` inspection; zero new dependencies confirmed; model string change confirmed across 4 files with exact locations                                |
| Features     | HIGH       | Prompt deficiencies confirmed from direct codebase inspection of `workflow-engine.ts:686-721`; research citations for prompt engineering patterns from arXiv/ACL 2025 peer-reviewed papers |
| Architecture | HIGH       | All findings from direct codebase inspection; exact file locations, line numbers, and code patterns provided for every change                                                              |
| Pitfalls     | HIGH       | Derived from both codebase analysis and web research on LLM migration failure modes; all pitfalls have concrete detection signals and recovery steps                                       |

**Overall confidence:** HIGH

### Gaps to Address

- `generateWorkflowLossMapContent()` not read in this research pass — before Phase 4 planning, read this function and determine whether metric fields are read from DB records or recomputed. This determines whether metric derivation is safe as a prompt-only change or requires updating consumers simultaneously.

- `/discover/` validation session timing — the pending validation session (running before this milestone if at all possible) provides ground truth on whether hypothesis quality issues are detectable by real prospects. If the session runs post-Phase 2, its feedback value shifts from product UX validation to prompt quality validation. Document which prompt version was active during the session.

- Pain gate calibration SQL — should be run against current production data BEFORE Phase 2 ships to establish a before-state baseline for evidence confidence distribution. Run again after Phase 2 to confirm gate threshold stability. This is a 10-minute SQL operation, not a code feature.

- E2E send test refactor (TD-5) — test infrastructure complexity not fully assessed in this research pass. May require a dedicated sub-plan if the current test setup doesn't support tRPC test client injection. Budget 60+ minutes and validate the new test passes before removing the old one.

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `lib/workflow-engine.ts` — `generateHypothesisDraftsAI()` full function (lines 615-801), `METRIC_DEFAULTS` (619-628), import anomaly (539-544), `scoreWithClaude()` Anthropic pattern (1408-1464)
- `lib/research-executor.ts` — full orchestration, SERP re-read bug location (lines 316-325), `generateHypothesisDraftsAI()` call site
- `lib/evidence-scorer.ts` — SOURCE_WEIGHTS, Gemini Flash integration pattern, snippet slice at 300 chars
- `lib/quality-config.ts` — calibrated thresholds (`MIN_AVERAGE_CONFIDENCE=0.55`)
- `server/routers/research.ts` — `startRun`, `retryRun`, `listRuns` query shape
- `prisma/schema.prisma` — `WorkflowHypothesis` nullable metric fields confirmed
- `package.json` — `@anthropic-ai/sdk: ^0.73.0` and `@google/generative-ai: ^0.24.1` confirmed
- `env.mjs` — `ANTHROPIC_API_KEY` and `GOOGLE_AI_API_KEY` both declared optional
- `app/admin/prospects/[id]/page.tsx` — `as any` cast locations (8 instances)
- `app/admin/outreach/page.tsx` — `as any` cast locations (16 instances, tRPC mutation pattern)
- `components/public/prospect-dashboard-client.tsx` — `logoUrl` prop location

### Secondary (HIGH confidence — peer-reviewed research, 2025)

- arXiv:2201.11903 — Chain-of-Thought Prompting Elicits Reasoning in Large Language Models
- arXiv:2504.05496 — Survey on Hypothesis Generation for Scientific Discovery in LLMs
- arXiv:2502.13396v1 — Prompting a Weighting Mechanism into LLM-as-a-Judge
- ACL Anthology 2025.emnlp-industry.87 — AutoQual: LLM Agent for Automated Discovery (variable output count research)
- COLING 2025.coling-main.719 — Survey of Chain-of-X Paradigms for LLMs
- Microsoft TechCommunity 2025 — Best Practices for Mitigating LLM Hallucinations (citation requirements)
- TypeScript GitHub issue #34933 — TS2589 deep type instantiation root cause and correct fix patterns

### Tertiary (MEDIUM confidence — external sources)

- getmaxim.ai — Golden test set methodology for prompt regression testing; recommendation to compare before/after for all affected records
- VentureBeat — "Swapping LLMs isn't plug-and-play" (API incompatibility research; Anthropic XML tag preference vs Gemini plain text)
- artificialanalysis.ai benchmarks 2026 — Claude Sonnet 4.6 accuracy benchmarks

---

_Research completed: 2026-03-02_
_Ready for roadmap: yes_
