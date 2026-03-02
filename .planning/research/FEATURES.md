# Feature Landscape: Hypothesis Generation Quality (v3.0 Sharp Analysis)

**Domain:** AI-powered B2B pain-point hypothesis generation from multi-source evidence
**Researched:** 2026-03-02
**Confidence:** HIGH (verified against live codebase + current LLM research)

---

## What Already Exists (Do Not Rebuild)

These are shipped. Research is scoped to what needs changing or is genuinely new.

| Existing Feature                                                                                                   | Relevant To This Milestone?                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 8-source evidence pipeline (sitemap, Google, KvK, LinkedIn, reviews, jobs, Google Reviews, news)                   | Yes -- feeds the prompt; pipeline unchanged                                        |
| Gemini Flash evidence scoring (relevance/depth/confidence per item)                                                | Yes -- scores available in AIEvidenceInput; prompt must exploit them               |
| Source weights in evidence-scorer (REVIEWS 0.90, LINKEDIN 0.88, CAREERS 0.85, WEBSITE 0.65)                        | Yes -- same tier ordering must inform prompt priority                              |
| `generateHypothesisDraftsAI` with hardwired `gemini-2.0-flash`                                                     | Yes -- this function is the target of all improvements                             |
| Hardcoded metric defaults (hoursSavedWeekLow: 4, Mid: 8, High: 14, handoffSpeedGainPct: 28, errorReductionPct: 20) | Yes -- must be removed or evidence-derived; currently identical for every prospect |
| Fixed 3-hypothesis output regardless of evidence quality                                                           | Yes -- must become variable (1-3)                                                  |
| Fallback template system (`generateFallbackHypothesisDrafts`)                                                      | Carry forward unchanged                                                            |
| Quality gate (traffic-light, soft override, AMBER hard gate on send queue)                                         | Unchanged                                                                          |
| Pain confirmation gate (cross-source, advisory-only)                                                               | Unchanged                                                                          |
| Override audit trail (GateOverrideAudit, reason, history panel)                                                    | Unchanged                                                                          |

---

## Current Prompt Diagnosis (From Codebase Inspection)

The current `generateHypothesisDraftsAI` prompt has four structural deficiencies that produce shallow output:

**Deficiency 1 -- No source-tier instruction.** Evidence is sorted by `aiRelevance` score alone (line 667). REVIEWS and CAREERS items may score lower on relevance because they are indirect signals -- an employee complaining about overwork is not literally about "workflow automation." Without an explicit instruction that REVIEWS/CAREERS/LINKEDIN carry more diagnostic weight than WEBSITE, the LLM treats all sources equally and gravitates toward the clearest, most marketing-polished text: the website.

**Deficiency 2 -- No anti-parroting constraint.** The prompt says "be supported by evidence" but does not forbid deriving hypotheses from the company's own website copy. A company's website describes what they want to be known for, not what actually causes daily friction. LLMs reliably use website descriptions as the primary hypothesis source because the text is coherent and confidence-building.

**Deficiency 3 -- No mandatory quote/citation requirement.** The prompt asks for `evidenceRefs` (URLs) but does not require the LLM to quote specific text from those sources in the hypothesis body. Without a quote requirement, the LLM can hallucinate a plausible pain statement and attach any URL as a post-hoc citation.

**Deficiency 4 -- Hardcoded metrics fabricate precision.** `METRIC_DEFAULTS = { hoursSavedWeekLow: 4, Mid: 8, High: 14 }` are applied identically to a 3-person kozijnen specialist and a 400-person e-commerce company. These numbers appear in the Workflow Loss Map delivered to prospects. Fabricated metric precision is a trust liability.

---

## Table Stakes

Features that must exist for hypothesis quality improvement to be measurable. Missing any = the core problem persists.

| Feature                                             | Why Expected                                                                                                                                                                                                                                                                                                                                                                                                                  | Complexity                                                         | Depends On                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| **Source-tier priority instruction in prompt**      | Without explicitly telling the LLM that REVIEWS, CAREERS, and LINKEDIN evidence is more diagnostically valuable than WEBSITE content, it defaults to website text. This is the root cause of shallow hypotheses. The fix is a single prompt section: "Source tier priority: REVIEWS and CAREERS are primary signals. WEBSITE is context only."                                                                                | Low -- prompt text change                                          | Existing `sourceType` field on AIEvidenceInput       |
| **Source-type diagnostic labeling in prompt**       | The prompt currently uses plain type tags (`[REVIEWS]`, `[LINKEDIN]`). Each type must be explained diagnostically: REVIEWS = what customers report as pain; CAREERS = operational gaps signaled by hiring; LINKEDIN = what leadership publicly acknowledges; WEBSITE = self-reported marketing (use only for context). Without this, the LLM does not know how to interpret source type.                                      | Low -- prompt text change                                          | Existing evidenceLines formatting                    |
| **Anti-parroting constraint**                       | Explicit instruction: "Do NOT derive hypotheses from the company's own website descriptions, service pages, or marketing copy. Those reflect how they want to be perceived, not where they actually struggle." This is a zero-cost prompt addition that directly addresses the identified regression.                                                                                                                         | Low -- prompt text change                                          | None                                                 |
| **Mandatory quote-from-evidence requirement**       | Require: each hypothesis `problemStatement` must include at least one verbatim quoted snippet (in quotes) from a non-WEBSITE source. Without mandatory quoting, LLMs attach URLs as post-hoc citations while writing plausible generalizations. Research confirms citation requirements reduce hallucination.                                                                                                                 | Low -- prompt text change                                          | Existing `snippet` field on evidence items           |
| **Remove hardcoded metric defaults**                | `METRIC_DEFAULTS` produces identical numbers for every prospect. Options: (a) omit metrics from hypothesis output entirely and derive them separately from evidence signals, or (b) instruct the LLM to produce metric estimates with wide ranges clearly labeled as estimates. Option (a) is safer and faster. The Workflow Loss Map still needs numbers -- those can be computed from confirmed pain tags at a later stage. | Low -- remove constant, update schema output                       | `METRIC_DEFAULTS` constant in workflow-engine.ts:619 |
| **Configurable model selection (Claude vs Gemini)** | Active requirement in PROJECT.md. Currently hardwired to `gemini-2.0-flash` at line 723. Model selection must be configurable via env var or campaign setting so Claude Sonnet 4.6 can be tested. Claude is already integrated for proof matching -- the Anthropic SDK is in the codebase.                                                                                                                                    | Medium -- add model resolver, handle Claude API format differences | `@anthropic-ai/sdk` already installed                |

---

## Differentiators

Features that go beyond fixing the identified regression and produce meaningfully better output quality.

| Feature                                                       | Value Proposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Complexity                                                                   | Depends On                                                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Source signal summary injected above evidence block**       | Before the raw evidence lines, inject a structured summary: "High-value signals found: N REVIEWS items, M CAREERS postings. Lower-value: K WEBSITE items. Build hypotheses from the high-value signals first." This primes the LLM before it processes individual evidence. Research on LLM context window position confirms that information appearing early in context receives more weight.                                                                                                        | Low -- preprocessing step                                                    | Evidence already available before prompt construction                                                               |
| **Variable hypothesis count (1-3 based on evidence quality)** | With sparse evidence (thin-web-presence Dutch SMBs), forcing 3 hypotheses causes the LLM to generate a third that is fabricated or redundant. Logic: count confirmed pain tags (GATE-01); generate N = min(confirmedPainTags.size, 3) hypotheses, minimum 1. Sharp 1-hypothesis output is more credible than 3 diluted ones.                                                                                                                                                                          | Low -- wire `hypothesisCount` from confirmed pain tags                       | Existing `hypothesisCount` param in `runSummaryPayload`; confirmed pain tags already computed by `evaluatePainGate` |
| **Two-pass reasoning before output (chain-of-thought)**       | The highest-impact quality lever from LLM research. First pass: analyze evidence by source tier, identify which signals are observational (reviews, hiring) vs contextual (website). Second pass: synthesize hypotheses from observational signals only. Implementation: add a scratchpad block in prompt ("First, analyze signals. Then generate JSON.") or use Claude extended thinking. Research confirms CoT reduces surface-level pattern matching and hallucination in complex reasoning tasks. | Medium -- prompt restructure; extended thinking optional via model selection | Table stakes prompt fixes should be validated first                                                                 |
| **Confidence score tier instruction**                         | Currently the LLM guesses `confidenceScore`. Instruct: "REVIEWS/LINKEDIN evidence = 0.80-0.95; hiring signals alone = 0.70-0.80; website + hiring = 0.70-0.75; website-only = omit or 0.60-0.65." Makes confidence scores reflect actual evidence tier rather than LLM self-calibration.                                                                                                                                                                                                              | Low -- prompt instruction only                                               | Source-tier priority instruction (above)                                                                            |
| **Primary source attribution per hypothesis**                 | Add `primarySourceType` to HypothesisDraft output: the source tier that most strongly drove this hypothesis (e.g., "REVIEWS", "CAREERS", "LINKEDIN"). Surface in admin detail view as a badge next to each hypothesis. Enables reviewer to instantly assess hypothesis trustworthiness without reading the full evidence.                                                                                                                                                                             | Low -- prompt + schema + UI                                                  | Remove hardcoded metrics (frees up output field capacity)                                                           |

---

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature                                                 | Why Avoid                                                                                                                                                                                                                                          | What to Do Instead                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Fine-tuning a custom model on validated hypotheses**       | Requires 100+ validated prospect examples minimum for useful signal; 7 in DB is insufficient. Enormous cost for marginal gain over good prompt engineering.                                                                                        | Prompt engineering closes 80% of the quality gap at 1% of the cost                           |
| **RAG/vector retrieval over evidence corpus**                | Evidence is already gathered and scored; the full top-15 set fits in one prompt. A vector store adds infrastructure complexity, latency, and retrieval errors with zero quality benefit at this scale.                                             | Pass top-15 scored items directly in prompt as today                                         |
| **Automated training loop from /discover/ validation data**  | The /discover/ validation session has not been run (pending todo in PROJECT.md). Building a feedback pipeline before validated data exists creates a ghost feature.                                                                                | Run real validation session first; build feedback loop only once signal quality is confirmed |
| **Per-industry prompt templates**                            | The fallback system already has construction/install and generic templates. More templates create a maintenance moat and contradict the AI-driven specificity goal. Industry context is passed as a variable; the LLM reasons from it dynamically. | AI reasoning from evidence + industry label (already implemented)                            |
| **Adding more evidence sources to improve hypothesis depth** | The problem is prompt reasoning failure, not evidence scarcity. 8+ sources already exist. Adding sources without fixing the prompt produces more website-style noise.                                                                              | Fix the prompt first; source expansion is a separate future milestone                        |
| **Streaming hypothesis output**                              | Hypothesis generation is background async; no UX requirement for streaming. Adds implementation complexity for zero user benefit.                                                                                                                  | Batch generate as today                                                                      |
| **LLM self-evaluation scoring its own hypotheses**           | An LLM grading its own output introduces self-referential bias and adds a second model call with unpredictable signal quality. The quality signal is admin review and prospect confirmation on /discover/.                                         | Admin review gate (already built)                                                            |

---

## Feature Dependencies

```
[1] Source-tier priority instruction          (prompt)
    -> [2] Diagnostic source type labeling    (prompt)
        -> [3] Anti-parroting constraint      (prompt)
            -> [4] Quote requirement          (prompt)

[5] Remove hardcoded metric defaults          (code)

[6] Configurable model selection              (code)
    -> [7] Two-pass CoT reasoning             (prompt -- especially valuable with Claude extended thinking)

[8] Source signal summary injection           (preprocessing)
    -> [9] Variable hypothesis count          (logic -- reads confirmed pain tags)

[10] Confidence score tier instruction        (prompt -- builds on [1])
[11] Primary source attribution per hyp.     (prompt + schema + UI -- builds on [5])
```

**Critical path:**

1. Items 1-5 (prompt fixes + metric removal) -- closes the identified regression
2. Item 6 (model selection) -- unblocks benchmarking Claude vs Gemini
3. Items 8-9 (signal summary + variable count) -- improves sparse evidence handling
4. Items 7, 10, 11 -- quality enhancements, phase 2

---

## MVP Recommendation

**Must ship (regression fix):**

1. Source-tier priority instruction
2. Source-type diagnostic labeling
3. Anti-parroting constraint
4. Quote/citation requirement
5. Remove hardcoded metric defaults
6. Configurable model selection (Claude Sonnet 4.6 as option)

**Ship if time allows:** 7. Source signal summary injection 8. Variable hypothesis count (1-3 from confirmed pain tags) 9. Confidence score tier instruction

**Defer to follow-up:** 10. Two-pass CoT reasoning (validate items 1-6 first -- may be sufficient) 11. Primary source attribution badge in admin UI 12. /discover/ validation session (separate activity, not a code feature)

**Success signal for MVP:**

- Hypotheses for STB-kozijnen cite reviews or hiring signals, not service page copy
- Hypotheses for Mujjo cite customer support reviews or hiring signals (customer support 0.85 confidence already confirmed)
- No hypothesis has identical metric numbers to another prospect
- Claude Sonnet 4.6 can be selected via `HYPOTHESIS_MODEL=claude-sonnet-4-6` env var

---

## Evidence Quality for This Research

| Claim                                                       | Source                                                                        | Confidence |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------- |
| Current prompt hardwired to `gemini-2.0-flash`              | Codebase inspection (workflow-engine.ts:723)                                  | HIGH       |
| Hardcoded METRIC_DEFAULTS applied to all prospects          | Codebase inspection (workflow-engine.ts:619-624)                              | HIGH       |
| Evidence sorted by relevance only, not source tier          | Codebase inspection (workflow-engine.ts:667)                                  | HIGH       |
| Anti-parroting constraint absent from current prompt        | Codebase inspection (workflow-engine.ts:686-721)                              | HIGH       |
| No mandatory quote requirement in current prompt            | Codebase inspection (workflow-engine.ts:701)                                  | HIGH       |
| Anthropic SDK already installed (proof matching)            | Codebase inspection (workflow-engine.ts:1446)                                 | HIGH       |
| CoT reduces surface-level pattern matching                  | arXiv:2201.11903 + 2025 survey (arXiv:2504.05496)                             | HIGH       |
| Mandatory citation requirement reduces hallucination        | Multiple 2025 papers: techcommunity.microsoft.com, machinelearningmastery.com | HIGH       |
| Explicit source weighting in prompt improves prioritization | arXiv:2502.13396v1 (weighting in LLM-as-judge, 2025)                          | MEDIUM     |
| Early context position receives more LLM weight             | LLM context window research (ICLR 2025)                                       | MEDIUM     |
| Variable output count based on evidence quality             | AutoQual EMNLP-industry.87.pdf (2025)                                         | MEDIUM     |
| Claude extended thinking improves complex reasoning         | Anthropic official docs (extended thinking)                                   | MEDIUM     |
| Claude Sonnet 4.6: 38% accuracy improvement vs 4.5          | artificialanalysis.ai benchmarks 2026                                         | MEDIUM     |
| Few-shot: 2 examples sufficient, plateau after              | DataCamp, PromptHub, IBM (multiple consistent sources)                        | MEDIUM     |

---

## Sources

- [Chain-of-Thought Prompting Elicits Reasoning in Large Language Models](https://arxiv.org/abs/2201.11903)
- [A Survey on Hypothesis Generation for Scientific Discovery in LLMs](https://arxiv.org/html/2504.05496v1)
- [AgenticHypothesis: Hypothesis Generation Using LLM Systems](https://openreview.net/forum?id=UeeyfR4CUg)
- [Prompting a Weighting Mechanism into LLM-as-a-Judge](https://arxiv.org/html/2502.13396v1)
- [Evidence-Based Prompting Strategies for LLM-as-a-Judge](https://arize.com/blog/evidence-based-prompting-strategies-for-llm-as-a-judge-explanations-and-chain-of-thought/)
- [DETAIL Matters: Measuring the Impact of Prompt Specificity on Reasoning](https://arxiv.org/html/2512.02246v1)
- [AutoQual: An LLM Agent for Automated Discovery (EMNLP 2025)](https://aclanthology.org/2025.emnlp-industry.87.pdf)
- [Claude Sonnet 4.6 vs Gemini 3 Flash Comparison 2026](https://www.nxcode.io/resources/news/claude-sonnet-4-6-vs-gemini-3-flash-ai-model-comparison-2026)
- [Claude Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Best Practices for Mitigating Hallucinations in LLMs](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/best-practices-for-mitigating-hallucinations-in-large-language-models-llms/4403129)
- [7 Prompt Engineering Tricks to Mitigate Hallucinations](https://machinelearningmastery.com/7-prompt-engineering-tricks-to-mitigate-hallucinations-in-llms/)
- [A Survey of Chain-of-X Paradigms for LLMs (COLING 2025)](https://aclanthology.org/2025.coling-main.719.pdf)
- [AI for Technical Sales: Uncovering Pain Points 10x Faster](https://techbullion.com/ai-for-technical-sales-how-engineering-heavy-b2b-teams-uncover-hidden-customer-pain-points-10x-faster-in-2025/)
