---
phase: 29-browser-rendered-evidence-extraction
verified: 2026-03-02T10:00:00Z
status: gaps_found
score: 2/3 ROADMAP success criteria verified
re_verification: false
gaps:
  - truth: 'Pages with source types REVIEWS, CAREERS, or JOB_BOARD route directly through Crawl4AI without attempting stealth first'
    status: failed
    reason: 'shouldUseBrowserDirect() only routes REVIEWS URLs and jsHeavyHint=true URLs to browser-direct. Own-website CAREERS URLs (e.g. example.nl/careers) and non-JS-heavy JOB_BOARD URLs (e.g. intermediair.nl/vacatures) go stealth-first, not browser-direct. The implementation deliberately narrowed EXTR-02 (per RESEARCH.md Pitfall 3) but the ROADMAP success criterion was never updated to reflect this re-interpretation.'
    artifacts:
      - path: 'lib/web-evidence-adapter.ts'
        issue: "shouldUseBrowserDirect() checks inferSourceType(url) === 'REVIEWS' || jsHeavyHint. It does NOT check inferSourceType === 'CAREERS' or inferSourceType === 'JOB_BOARD'."
    missing:
      - 'Either update ROADMAP.md success criterion 2 to reflect the research-validated re-interpretation (REVIEWS + jsHeavyHint=true routes browser-direct; CAREERS/JOB_BOARD go stealth-first unless jsHeavyHint=true), OR extend shouldUseBrowserDirect() to also route CAREERS and JOB_BOARD source types browser-direct as the ROADMAP states.'
      - 'If the research re-interpretation is accepted as correct (Pitfall 3 reasoning is sound), this gap should be closed by updating the ROADMAP criterion and REQUIREMENTS.md EXTR-02 description — not by changing the code.'
---

# Phase 29: Browser-Rendered Evidence Extraction — Verification Report

**Phase Goal:** JS-heavy pages that previously returned empty or near-empty content now yield usable evidence, without slowing the pipeline beyond the acceptable ceiling.
**Verified:** 2026-03-02T10:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #   | Truth                                                                                                                                                         | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Static pages attempt Scrapling stealth fetch first; only pages returning fewer than 500 characters escalate to Crawl4AI browser extraction                    | ✓ VERIFIED | `ingestWebsiteEvidenceDrafts` Tier 2 path: `fetchStealth` → if `stealthHtml.length < 500` → `extractMarkdown`. Tests: "escalation: stealth returns <500 chars" and "no-escalation: stealth returns >=500 chars" both pass.                                                                                                                                    |
| 2   | Pages with source types REVIEWS, CAREERS, or JOB_BOARD route directly through Crawl4AI without attempting stealth first                                       | ✗ FAILED   | `shouldUseBrowserDirect()` only routes `inferSourceType(url) === 'REVIEWS'` and `jsHeavyHint=true`. Own-website CAREERS URLs (e.g., `example.nl/careers`) and non-JS-heavy JOB_BOARD URLs (e.g., `intermediair.nl/vacatures`) go stealth-first. The implementation re-interpreted EXTR-02 per RESEARCH.md Pitfall 3 but did not update the ROADMAP criterion. |
| 3   | A single research run never uses browser extraction on more than 5 URLs — the pipeline enforces this cap regardless of how many JS-heavy pages are discovered | ✓ VERIFIED | `BROWSER_BUDGET_MAX = 5` exported constant at module level. Budget counter shared across both Tier 1 and Tier 2 escalation paths. Test: "budget-cap: 7 JS-heavy URLs → only first 5 call extractMarkdown" passes. `research-executor.ts` deepCrawl path (`ingestCrawl4aiEvidenceDrafts`) is a separate cap (10 URLs) and is intentionally untouched.          |

**Score:** 2/3 ROADMAP success criteria verified

### Must-Haves from Plan Frontmatter (29-01)

| Truth                                                                                               | Status     | Evidence                                                                                                                                         |
| --------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| URLs with jsHeavyHint=true or sourceType REVIEWS route directly to Crawl4AI without stealth attempt | ✓ VERIFIED | `shouldUseBrowserDirect(url, jsHeavyHint)` — checks `inferSourceType(url) === 'REVIEWS' \|\| jsHeavyHint`. Test passes.                          |
| Static pages returning fewer than 500 chars from stealth escalate to Crawl4AI                       | ✓ VERIFIED | Tier 2 path: `const isStealthSufficient = stealthHtml.length >= 500` guard. Test passes.                                                         |
| No more than 5 URLs per batch use browser-rendered extraction                                       | ✓ VERIFIED | `BROWSER_BUDGET_MAX = 5`, budget decremented in both tier paths. Test passes.                                                                    |
| Budget-exhausted URLs receive a fallback draft instead of crashing                                  | ✓ VERIFIED | `budgetExhaustedDraft()` called when `browserBudget <= 0`. Test: "budget-cap: 7 JS-heavy URLs" passes.                                           |
| Crawl4AI-escalated drafts get correct workflowTag from detectWorkflowTag, not default               | ✓ VERIFIED | `buildCrawl4aiDraft()` calls `detectWorkflowTag(sourceType, markdown)`. Test: "crawl4ai-draft: REVIEWS url draft uses detectWorkflowTag" passes. |

| Must-Have from Plan Frontmatter (29-02)                                                      | Status     | Evidence                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Research executor passes jsHeavyHints map from sourceSet to ingestWebsiteEvidenceDrafts      | ✓ VERIFIED | Lines 264-272 of `lib/research-executor.ts`: `const jsHeavyHints = new Map(initialSourceSet.urls.map((u) => [u.url, u.jsHeavyHint]));` then `ingestWebsiteEvidenceDrafts(researchUrls, { jsHeavyHints })`. |
| jsHeavyHint values from Phase 28 sourceSet.urls flow through to extraction routing decisions | ✓ VERIFIED | `ingestWebsiteEvidenceDrafts` resolves hint via `options?.jsHeavyHints?.get(sourceUrl) ?? detectJsHeavy(sourceUrl)`.                                                                                       |
| Existing callers without sourceSet still work (backwards-compatible)                         | ✓ VERIFIED | `options` parameter is optional. Test: "backwards-compat: calling without options param works" passes.                                                                                                     |

### Required Artifacts

| Artifact                           | Expected                                                        | Status     | Details                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/web-evidence-adapter.ts`      | Two-tier extraction routing with budget cap                     | ✓ VERIFIED | 596 lines. Contains `BROWSER_BUDGET_MAX = 5` (exported, line 18). `ingestWebsiteEvidenceDrafts` with optional `options` param. `shouldUseBrowserDirect`, `buildCrawl4aiDraft`, `budgetExhaustedDraft`, `processCrawl4aiResult` helpers all present and substantive.                                                         |
| `lib/web-evidence-adapter.test.ts` | Tests covering direct-route, escalation, and budget enforcement | ✓ VERIFIED | 379 lines (expanded from 36 original). 17 tests: all pass (100%). Covers direct-route (REVIEWS, jsHeavyHint), escalation (<500 chars, ok=false), no-escalation (>=500 chars), budget-cap, budget-shared, workflowTag detection, backwards-compat, 404-detection, short markdown, raw-fetch-removed, detectJsHeavy-fallback. |
| `lib/research-executor.ts`         | jsHeavyHints map construction and passing                       | ✓ VERIFIED | Lines 264-272: `jsHeavyHints` Map constructed from `initialSourceSet.urls`, passed via `{ jsHeavyHints }` options to `ingestWebsiteEvidenceDrafts`. `ingestCrawl4aiEvidenceDrafts` call at line 424 is untouched.                                                                                                           |

### Key Link Verification

| From                          | To                                   | Via                                                           | Status  | Details                                                                                                                                                       |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/web-evidence-adapter.ts` | `lib/enrichment/crawl4ai.ts`         | `import { extractMarkdown } from ...crawl4ai`                 | ✓ WIRED | Line 4: `import { extractMarkdown } from '@/lib/enrichment/crawl4ai';`. Used at lines 538 and 564.                                                            |
| `lib/web-evidence-adapter.ts` | `lib/enrichment/source-discovery.ts` | `import { detectJsHeavy } from ...source-discovery`           | ✓ WIRED | Line 5: `import { detectJsHeavy } from '@/lib/enrichment/source-discovery';`. Used at line 526 as fallback when no hints map.                                 |
| `lib/research-executor.ts`    | `lib/web-evidence-adapter.ts`        | `ingestWebsiteEvidenceDrafts(..., { jsHeavyHints })`          | ✓ WIRED | Lines 267-272: call includes `{ jsHeavyHints }` options object. Pattern `ingestWebsiteEvidenceDrafts.*jsHeavyHints` confirmed.                                |
| `lib/research-executor.ts`    | `lib/enrichment/source-discovery.ts` | `initialSourceSet.urls.map(...)` providing jsHeavyHint values | ✓ WIRED | Line 265: `initialSourceSet.urls.map((u) => [u.url, u.jsHeavyHint])`. `initialSourceSet` is built via `buildSourceSet()` (line 197) from source-discovery.ts. |

### Requirements Coverage

| Requirement | Source Plans | Description                                                                                                 | Status      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ------------ | ----------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EXTR-01     | 29-01, 29-02 | Static pages route through Scrapling stealth fetcher first; pages returning <500 chars escalate to Crawl4AI | ✓ SATISFIED | Tier 2 stealth-first path with 500-char threshold implemented and tested. ROADMAP success criterion 1 passes.                                                                                                                                                                                                                                                                                                                               |
| EXTR-02     | 29-01, 29-02 | REVIEWS, CAREERS, and JOB_BOARD source types route directly through Crawl4AI browser extraction             | ✗ BLOCKED   | Only REVIEWS and jsHeavyHint=true route browser-direct. Own-website CAREERS (e.g., example.nl/careers) and non-JS-heavy JOB_BOARD (e.g., intermediair.nl/vacatures) go stealth-first. ROADMAP success criterion 2 is not satisfied as written. The RESEARCH.md Pitfall 3 explicitly re-interpreted this requirement (own-website CAREERS are typically static HTML, not JS-rendered), but the ROADMAP and REQUIREMENTS.md were not updated. |
| EXTR-03     | 29-01, 29-02 | Maximum 5 URLs per prospect use browser-rendered extraction to control pipeline duration                    | ✓ SATISFIED | `BROWSER_BUDGET_MAX = 5` enforced across both tier paths. Budget-exhausted URLs get `budgetExhaustedDraft`. ROADMAP success criterion 3 passes.                                                                                                                                                                                                                                                                                             |

**Orphaned requirements:** None. EXTR-01, EXTR-02, EXTR-03 are all claimed by plans 29-01 and 29-02. No REQUIREMENTS.md entries for Phase 29 go unclaimed.

### Anti-Patterns Found

| File                          | Line | Pattern | Severity | Impact |
| ----------------------------- | ---- | ------- | -------- | ------ |
| None found in phase 29 files. | —    | —       | —        | —      |

The "placeholder" string occurrences in `lib/research-executor.ts` (lines 510, 558, 798) are inside diagnostic message strings reporting no-result conditions, not stub implementations.

### Human Verification Required

None — all phase 29 behaviors are verifiable programmatically. Tests run cleanly (17/17 pass). The EXTR-02 gap is a specification vs. implementation discrepancy, verifiable by code inspection.

### Gaps Summary

**One gap blocking full goal achievement.**

The ROADMAP.md success criterion 2 for Phase 29 states: "Pages with source types REVIEWS, CAREERS, or JOB_BOARD route directly through Crawl4AI without attempting stealth first."

The implementation routes only REVIEWS URLs and jsHeavyHint=true URLs browser-direct. CAREERS and JOB_BOARD URL types on own-website domains (e.g., `example.nl/careers`, `intermediair.nl/vacatures`) go stealth-first, NOT browser-direct.

This is a deliberate re-interpretation documented in RESEARCH.md Pitfall 3: "Own-website CAREERS pages are typically static HTML, not JS-rendered. Direct Crawl4AI routing wastes budget." The research notes conclude: "EXTR-02 is more precisely: URLs with jsHeavyHint=true from Phase 28 AND REVIEWS source type route directly through Crawl4AI. Own-website CAREERS pages are not JS-heavy in the common case and should go stealth-first."

This re-interpretation is technically sound and the implementation is correct for the use case. However, the ROADMAP.md success criterion and REQUIREMENTS.md EXTR-02 description were never updated to reflect this decision. This creates a specification drift: the ROADMAP says one thing, the code does another.

**Resolution options (for gap planner):**

1. **Recommended — update spec to match implementation:** Update ROADMAP.md success criterion 2 and REQUIREMENTS.md EXTR-02 description to reflect the research-validated re-interpretation. No code changes needed — the implementation is correct.

2. **Alternatively — update implementation to match spec:** Extend `shouldUseBrowserDirect()` to also return true for `inferSourceType(url) === 'CAREERS' || inferSourceType(url) === 'JOB_BOARD'`. This would make own-website CAREERS pages browser-direct, which the research found to be incorrect (wastes budget on static HTML pages).

The spec-update path is the correct resolution — the research finding is sound and the implementation is more accurate than the original requirement as written.

---

_Verified: 2026-03-02T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
