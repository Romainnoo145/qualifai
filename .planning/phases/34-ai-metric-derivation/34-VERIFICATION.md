---
phase: 34-ai-metric-derivation
verified: 2026-03-02T23:10:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 34: AI Metric Derivation Verification Report

**Phase Goal:** The Workflow Loss Map and outreach templates show AI-estimated metric ranges that are specific to each prospect's industry and evidence, and the admin detail view shows which source type most drove each hypothesis
**Verified:** 2026-03-02T23:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                       | Status   | Evidence                                                                                                               |
| --- | ------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | AI-derived metric values flow from AI response through clamp helpers to HypothesisDraft     | VERIFIED | `lib/workflow-engine.ts` lines 980-1039: IIFE extracts and clamps all 8 metric fields with METRIC_DEFAULTS as fallback |
| 2   | METRIC_DEFAULTS used only as last-resort fallback when AI value is missing or out of range  | VERIFIED | `METRIC_DEFAULTS` retained at line 663; every clampInt/clampFloat call passes it as `def` parameter                    |
| 3   | primarySourceType persisted to WorkflowHypothesis DB column                                 | VERIFIED | `prisma/schema.prisma` line 407: `primarySourceType String?`; live DB column confirmed (text, 1 row from psql query)   |
| 4   | Source attribution badge visible in admin FindingCard for hypotheses with primarySourceType | VERIFIED | `analysis-section.tsx` lines 93-97: conditional blue badge renders when `finding.primarySourceType` is truthy          |
| 5   | MODEL-03 tests pass GREEN (AI values not overwritten by METRIC_DEFAULTS)                    | VERIFIED | 3 MODEL-03 tests pass: Gemini hoursSavedWeekMid=12, Claude revenueLeakageRecoveredMid=1200, clamping to bound 80       |
| 6   | ANLYS-09 tests pass GREEN (primarySourceType resolved from AI output)                       | VERIFIED | 2 ANLYS-09 tests pass: Gemini resolves 'REVIEWS', invalid value falls back to null                                     |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact                                                                            | Expected                                                                     | Status   | Details                                                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `lib/workflow-engine.ts`                                                            | AIHypothesisItem, clampInt/clampFloat, VALID_SOURCE_TYPES, per-field mapping | VERIFIED | All present: lines 618-636 (interface), 675-705 (helpers+set), 973-1039 (mapping)             |
| `prisma/schema.prisma`                                                              | primarySourceType String? on WorkflowHypothesis                              | VERIFIED | Line 407 present; live DB column confirmed via psql                                           |
| `lib/research-executor.ts`                                                          | primarySourceType in workflowHypothesis.create data                          | VERIFIED | Line 948: `primarySourceType: hypothesis.primarySourceType, // ANLYS-09`                      |
| `components/features/prospects/analysis-section.tsx`                                | Finding type + toFinding extraction + FindingCard badge                      | VERIFIED | Line 13 (type), lines 246-247 (toFinding), lines 93-97 (badge)                                |
| `prisma/migrations/20260302200000_add_hypothesis_primary_source_type/migration.sql` | ALTER TABLE migration                                                        | VERIFIED | File exists; contains `ALTER TABLE "WorkflowHypothesis" ADD COLUMN "primarySourceType" TEXT;` |
| `lib/workflow-engine.test.ts`                                                       | Mock factories with non-default metric values; 5 MODEL-03/ANLYS-09 tests     | VERIFIED | Factories at lines 530-607: hoursSavedWeekMid defaults to 12, primarySourceType to 'REVIEWS'  |

### Key Link Verification

| From                                                 | To                         | Via                                                   | Status | Details                                                                                        |
| ---------------------------------------------------- | -------------------------- | ----------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `lib/workflow-engine.ts`                             | `lib/research-executor.ts` | HypothesisDraft.primarySourceType field               | WIRED  | executor line 948 reads `hypothesis.primarySourceType` from HypothesisDraft                    |
| `lib/research-executor.ts`                           | `prisma/schema.prisma`     | workflowHypothesis.create data field                  | WIRED  | executor line 948 writes to DB; schema line 407 accepts String?; DB column confirmed live      |
| `components/features/prospects/analysis-section.tsx` | `lib/workflow-engine.ts`   | Finding type consuming DB-persisted primarySourceType | WIRED  | toFinding() at lines 246-247 extracts primarySourceType; FindingCard renders it at lines 93-97 |

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                                                 | Status    | Evidence                                                                                              |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| MODEL-03    | 34-01, 34-02 | AI-estimated metric ranges replace hardcoded METRIC_DEFAULTS — contextual to each prospect's industry and evidence          | SATISFIED | clampInt/clampFloat helpers extract AI values; METRIC_DEFAULTS as last-resort fallback; 3 tests GREEN |
| ANLYS-09    | 34-01, 34-02 | Primary source attribution badge (sourceType that most drove each hypothesis) displayed per hypothesis in admin detail view | SATISFIED | VALID_SOURCE_TYPES whitelist validation; DB column; blue badge in FindingCard; 2 tests GREEN          |

No orphaned requirements: REQUIREMENTS.md traceability table maps MODEL-03 and ANLYS-09 exclusively to Phase 34.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| None | —    | —       | —        | —      |

No anti-patterns found across the 5 modified files. The `return null` instances in workflow-engine.ts are legitimate early returns (e.g. buildCalBookingUrl URL parse failure), not stub implementations.

### Pre-existing Failing Test (Out of Scope)

One test fails in the suite: `"uses reviews-first evidence ordering for construction/install profiles"` — this test was already failing before Phase 34 (confirmed in 34-02-SUMMARY.md: "Pre-existing test failure ... confirmed out of scope — was already failing before Plan 34-02 (verified with git stash)"). The failure is `expected 'WEBSITE' to be 'REVIEWS'` and is unrelated to MODEL-03 or ANLYS-09. All 36 passing tests include all 5 new MODEL-03/ANLYS-09 tests.

### Human Verification Required

#### 1. Badge visibility on live prospect with AI-populated primarySourceType

**Test:** Open admin detail view for a prospect that has been through a research run after Phase 34 deployment. Navigate to the Analysis/Findings section. Find a hypothesis card.
**Expected:** A blue badge appears next to the "Challenge" pill showing the source type (e.g., "REVIEWS", "LINKEDIN", "CAREERS"). Hypotheses from older runs (before Phase 34) will show no badge — this is correct.
**Why human:** The blue badge conditional render is wired correctly in code, but can only be validated visually against a DB record that has a non-null primarySourceType. Pre-Phase-34 research runs produce null (no badge), so a new research run is needed to see the badge in production.

#### 2. Metric range variation across two prospects in different industries

**Test:** Run research on two prospects with clearly different profiles (e.g., a construction company and a software firm). Compare the hoursSavedWeekMid and revenueLeakageRecoveredMid values in their Workflow Loss Map.
**Expected:** The metric values differ between prospects — reflecting the AI's industry-specific estimation rather than identical METRIC_DEFAULTS values (8 hours/week, 900 EUR/month).
**Why human:** Tests mock the AI response. Real-world validation requires actual Gemini/Claude output with the new prompt instruction 6 to confirm that the LLM actually produces varied, industry-calibrated metrics rather than constant values.

### Gaps Summary

No gaps found. All 6 observable truths verified, all 5 artifacts substantive and wired, all 3 key links confirmed, both requirements satisfied with test evidence. The phase goal is fully achieved at the implementation level.

---

_Verified: 2026-03-02T23:10:00Z_
_Verifier: Claude (gsd-verifier)_
