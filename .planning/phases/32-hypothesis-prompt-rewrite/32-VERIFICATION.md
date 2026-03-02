---
phase: 32-hypothesis-prompt-rewrite
verified: 2026-03-02T11:45:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 32: Hypothesis Prompt Rewrite Verification Report

**Phase Goal:** The hypothesis generation prompt prioritizes diagnostic evidence (reviews, hiring, LinkedIn) over marketing copy, prevents parroting of the company's own website, requires at least one verbatim quoted snippet per hypothesis, and varies output count from 1-3 based on confirmed pain signal quality

**Verified:** 2026-03-02T11:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                        | Status   | Evidence                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Prompt prioritizes REVIEWS, CAREERS, LINKEDIN over WEBSITE via explicit tier instruction                     | VERIFIED | `SOURCE TYPE GUIDE` section at line 728 in workflow-engine.ts; REVIEWS marked HIGHEST, WEBSITE marked LOWEST; ANLYS-01 test GREEN                                                |
| 2   | Prompt labels each source type diagnostically with explicit meaning (SOURCE TYPE GUIDE)                      | VERIFIED | Lines 728-734 in workflow-engine.ts; per-type labels: REVIEWS=direct pain, CAREERS=operational gaps, WEBSITE=marketing context; ANLYS-02 test GREEN                              |
| 3   | Prompt includes anti-parroting constraint preventing website-copy derivation                                 | VERIFIED | `ANTI-PARROTING RULE` at line 736 in workflow-engine.ts: "Do NOT derive hypotheses from what the company says about itself"; ANLYS-03 test GREEN                                 |
| 4   | Each hypothesis problemStatement requires a verbatim quoted snippet; post-parse validation warns when absent | VERIFIED | `hasQuote()` at lines 804-813; `console.warn` fires when `"`, `\u201c`, `\u201d` absent; both ANLYS-04 test cases GREEN                                                          |
| 5   | Hypothesis count varies 1-3 based on confirmedPainTags; call site passes gate.confirmedPainTags              | VERIFIED | `targetCount` computed at lines 658-661; `parsed.slice(0, targetCount)` at line 808; research-executor.ts line 921 passes `gate.confirmedPainTags`; ANLYS-06 (3 cases) all GREEN |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact                      | Provides                                                                                                                                      | Status   | Details                                                                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/workflow-engine.ts`      | Rewritten `generateHypothesisDraftsAI` with source tiers, signal summary, anti-parroting, quote mandate, dynamic count, calibrated confidence | VERIFIED | Contains `SOURCE TYPE GUIDE`, `ANTI-PARROTING RULE`, `signalSummary`, `targetCount`, `hasQuote()`; lines 616-864; substantive (248 lines of real implementation)                                        |
| `lib/research-executor.ts`    | Updated call site passing `gate.confirmedPainTags` as 3rd argument                                                                            | VERIFIED | Line 921: `gate.confirmedPainTags` passed as 3rd arg; `gate` from `evaluateQualityGate()` at line 889                                                                                                   |
| `lib/workflow-engine.test.ts` | Gemini mock + 10 test cases covering all 7 ANLYS requirements                                                                                 | VERIFIED | `vi.mock('@google/generative-ai', ...)` at line 25; `lastCapturedPrompt` capture variable; `describe('generateHypothesisDraftsAI')` block at line 490; `generateHypothesisDraftsAI` imported at line 53 |

---

### Key Link Verification

| From                          | To                       | Via                                       | Status | Details                                                                                                                       |
| ----------------------------- | ------------------------ | ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `lib/research-executor.ts`    | `lib/workflow-engine.ts` | `generateHypothesisDraftsAI` 3rd argument | WIRED  | Line 921: `gate.confirmedPainTags` explicitly passed; pattern `generateHypothesisDraftsAI.*gate\.confirmedPainTags` confirmed |
| `lib/workflow-engine.ts`      | `@google/generative-ai`  | Prompt with tier structure                | WIRED  | `ANTI-PARROTING RULE` at line 736; `SOURCE TYPE GUIDE` at line 728; both pattern matches confirmed                            |
| `lib/workflow-engine.test.ts` | `lib/workflow-engine.ts` | `import generateHypothesisDraftsAI`       | WIRED  | Line 53: `generateHypothesisDraftsAI` in import block from `@/lib/workflow-engine`                                            |

---

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                                                     | Status    | Evidence                                                                                                                               |
| ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ANLYS-01    | 32-01, 32-02 | Prompt prioritizes REVIEWS, CAREERS, LINKEDIN over WEBSITE via source-tier instruction                                          | SATISFIED | `SOURCE TYPE GUIDE` marks REVIEWS HIGHEST, WEBSITE LOWEST; test GREEN                                                                  |
| ANLYS-02    | 32-01, 32-02 | Prompt labels each source type diagnostically (reviews=customer pain, careers=operational gaps, website=marketing context)      | SATISFIED | Lines 729-734 in workflow-engine.ts with exact diagnostic labels; test GREEN                                                           |
| ANLYS-03    | 32-01, 32-02 | Prompt includes anti-parroting constraint preventing derivation from marketing copy                                             | SATISFIED | `ANTI-PARROTING RULE` line 736; test GREEN                                                                                             |
| ANLYS-04    | 32-01, 32-02 | Each hypothesis problemStatement includes at least one mandatory quoted snippet (non-WEBSITE source)                            | SATISFIED | `hasQuote()` + `console.warn` at lines 804-813; prompt instructs quoted snippets at line 753; both ANLYS-04 test cases GREEN           |
| ANLYS-05    | 32-01, 32-02 | Source signal summary (counts by tier) injected above evidence block                                                            | SATISFIED | `tierCounts` computed at lines 700-711; `signalSummary` injected at line 738; test GREEN                                               |
| ANLYS-06    | 32-01, 32-02 | Hypothesis count varies 1-3 based on confirmed pain tag evidence quality (not forced 3)                                         | SATISFIED | `targetCount` at lines 658-661; `slice(0, targetCount)` at line 808; call site passes `gate.confirmedPainTags`; 3 test cases all GREEN |
| ANLYS-07    | 32-01, 32-02 | Confidence score instruction maps score tiers to evidence quality (REVIEWS 0.80-0.95, hiring 0.70-0.80, website-only 0.60-0.65) | SATISFIED | Lines 756-759: exact ranges in prompt; "Do NOT score website-derived hypotheses above 0.65" present; test GREEN                        |

**Orphaned requirements:** None. All 7 ANLYS-01 through ANLYS-07 requirements claimed by plans are mapped to Phase 32 in REQUIREMENTS.md and all show as `[x]` (complete).

---

### Test Execution Results

**Command:** `npx vitest run lib/workflow-engine.test.ts`

**Result:** 26 passed, 1 failed (pre-existing, unrelated)

| Test                                                                                          | Status                                                                                            |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ANLYS-01: prompt contains source-tier prioritization instruction                              | PASS                                                                                              |
| ANLYS-02: prompt contains SOURCE TYPE GUIDE with diagnostic label definitions per source type | PASS                                                                                              |
| ANLYS-03: prompt contains anti-parroting constraint against website/marketing copy            | PASS                                                                                              |
| ANLYS-04: warns when hypothesis problemStatement lacks a quoted snippet                       | PASS                                                                                              |
| ANLYS-04: does NOT warn when hypothesis problemStatement contains a quoted snippet            | PASS                                                                                              |
| ANLYS-05: prompt contains signal summary block with correct tier counts                       | PASS                                                                                              |
| ANLYS-06: output length matches confirmedPainTags count (1 tag → 1 hypothesis)                | PASS                                                                                              |
| ANLYS-06: output length matches confirmedPainTags count (3 tags → 3 hypotheses)               | PASS                                                                                              |
| ANLYS-06: empty confirmedPainTags defaults to 1 hypothesis output                             | PASS                                                                                              |
| ANLYS-07: prompt contains confidence calibration table with source-specific tiers             | PASS                                                                                              |
| `uses reviews-first evidence ordering` (generateEvidenceDrafts)                               | FAIL (pre-existing, unrelated to Phase 32 — confirmed in SUMMARY as known out-of-scope deviation) |

---

### Commit Verification

| Commit    | Description                                                             | Files                                               |
| --------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| `cfdce4f` | test(32-01): add failing TDD RED scaffold for ANLYS-01 through ANLYS-07 | lib/workflow-engine.test.ts, lib/workflow-engine.ts |
| `57f2f96` | feat(32-02): rewrite generateHypothesisDraftsAI with source tiers       | lib/workflow-engine.ts                              |
| `c6a79cc` | feat(32-02): update call site to pass gate.confirmedPainTags            | lib/research-executor.ts                            |

All 3 commits verified present in git log.

---

### Anti-Patterns Found

| File                     | Line | Pattern                                                         | Severity | Impact                                                                                                                                                                                    |
| ------------------------ | ---- | --------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/workflow-engine.ts` | 869  | `generateFallbackHypothesisDrafts` still hardcodes 3 hypotheses | Info     | Known inconsistency documented in SUMMARY; fallback path (AI failure) returns 3 regardless of confirmedPainTags; out of scope per Phase 32 plan spec; no impact on primary execution path |

No blockers. No placeholder/stub implementations. No TODO/FIXME items in modified code sections.

---

### Human Verification Required

No automated verification gaps. All key behaviors tested via unit tests (Gemini mock with prompt capture). The following item is advisory only:

**1. Real Prospect Re-Run (Confidence Calibration)**

**Test:** Re-run hypothesis generation for a website-only prospect (e.g., STB-kozijnen during a sparse evidence window) and verify confidence scores land in 0.60-0.65 range rather than 0.80+.

**Expected:** Hypotheses grounded only in WEBSITE evidence score 0.60-0.65; hypotheses from REVIEWS sources score 0.80-0.95.

**Why human:** Requires a live Gemini API call against real prospect data; cannot mock this in a unit test since it depends on actual LLM reasoning following the calibration prompt instruction.

---

## Summary

Phase 32 goal is fully achieved. The rewritten `generateHypothesisDraftsAI` function in `lib/workflow-engine.ts` (lines 616-864) delivers all 7 ANLYS requirements through a structured 6-section prompt: role context, SOURCE TYPE GUIDE (diagnostic labels per source type), ANTI-PARROTING RULE (website exclusion), signal summary with tier counts, evidence with tier labels in brackets, and output instructions including the confidence calibration table. The post-parse `hasQuote()` validation warns on missing quoted snippets without rejecting output. Dynamic count (`targetCount` = 1-3) driven by `confirmedPainTags.length` is wired end-to-end from `research-executor.ts` line 921 through to `parsed.slice(0, targetCount)`. All 10 ANLYS-specific test assertions pass GREEN.

The one failing test (`uses reviews-first evidence ordering`) is a pre-existing regression in the `generateEvidenceDrafts` function, unrelated to Phase 32 scope and documented in the SUMMARY as a known out-of-scope deviation.

---

_Verified: 2026-03-02T11:45:00Z_
_Verifier: Claude (gsd-verifier)_
