---
phase: 26-quality-calibration
verified: 2026-02-28T18:55:00Z
status: passed
score: 7/7 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - 'Local computeTrafficLight copy with wrong amber threshold removed — now imports canonical function from workflow-engine'
  gaps_remaining: []
  note: 'Verifier incorrectly flagged listRuns as not returning summary — Prisma include returns all scalar fields automatically. summary, qualityApproved, qualityReviewedAt are scalar fields on ResearchRun, not relations.'
  regressions: []
gaps: []
human_verification:
  - test: "Open an admin prospect list and note the quality chip color. Click into a specific prospect's detail page. Compare chip color before opening the breakdown popup."
    expected: 'Both chips show identical color. If a prospect has 3+ source types, both should be green.'
    why_human: 'Requires browser and real DB data to compare rendered chip tiers across two pages'
  - test: 'Find a prospect with exactly 2 distinct sourceType evidence items. Check its chip in the list view.'
    expected: 'Chip shows AMBER (limited), because GREEN_MIN_SOURCE_TYPES=3 and 2 source types is amber per quality-config.ts'
    why_human: 'Cannot query live DB source type counts from verification context'
---

# Phase 26: Quality Calibration Verification Report

**Phase Goal:** Calibrate amber/green quality thresholds against real prospect data and fix list-view traffic light to use real source type count.
**Verified:** 2026-02-28T18:45:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (original: 2026-02-28T10:56:52Z)

## Re-Verification Summary

**Previous score:** 5/7
**Current score:** 6/7
**Gaps closed:** 1 of 2
**Gaps remaining:** 1 (detail-view chip still receives undefined summary from listRuns)

### Gap 1 — CLOSED

The local `computeTrafficLight` function in `quality-chip.tsx` (lines 33-41 in the original file) has been fully removed. The file now imports `computeTrafficLight` from `@/lib/workflow-engine` (line 6) and calls it with real extracted values (lines 115-119). The divergent `sourceTypeCount < 2` amber threshold no longer exists anywhere in the chip.

### Gap 2 — PARTIALLY FIXED (still failing)

The `summary` prop is now passed in the detail page (line 155: `summary={(researchRuns.data[0] as any).summary}`). However, the data source (`api.research.listRuns`) does not select `summary`, `qualityApproved`, or `qualityReviewedAt` from the DB. These fields are absent from the `include` block in `server/routers/research.ts` (lines 105-120). At runtime the prop value is `undefined`, so the chip falls back to `realSourceTypeCount = 1` and shows AMBER or RED for every researched prospect on the detail page regardless of actual quality.

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                 | Status     | Evidence                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Threshold constants in lib/quality-config.ts with semantic comments                   | ✓ VERIFIED | 33 lines: MIN_EVIDENCE_COUNT=3, AMBER_MIN_SOURCE_TYPES=2, GREEN_MIN_SOURCE_TYPES=3, MIN_AVERAGE_CONFIDENCE=0.65 with full JSDoc tier semantics                                                                                                         |
| 2   | computeTrafficLight in workflow-engine.ts reads from quality-config.ts                | ✓ VERIFIED | Lines 2-7: imports all 4 constants; lines 531-537: uses MIN_EVIDENCE_COUNT and GREEN_MIN_SOURCE_TYPES; function exported                                                                                                                               |
| 3   | Re-running research deletes old hypotheses before inserting new ones                  | ✓ VERIFIED | research-executor.ts: deleteMany before createMany for hypothesis idempotency (lines 667/689)                                                                                                                                                          |
| 4   | Admin approved thresholds based on real calibration data                              | ✓ VERIFIED | 26-01-SUMMARY.md documents calibration table (5 prospects: 4 GREEN, 1 AMBER, 0 RED); quality-config.ts carries calibration date comment                                                                                                                |
| 5   | List-view quality chip uses real sourceTypeCount from summary.gate                    | ✓ VERIFIED | admin.ts listProspects line 459: summary: true; quality-chip.tsx lines 109-113: extracts gate?.sourceTypeCount and gate?.averageConfidence; calls computeTrafficLight with real values                                                                 |
| 6   | List-view chip shows same tier as detail-view                                         | ✓ VERIFIED | Both views use computeTrafficLight from workflow-engine. List-view gets summary via admin.listProspects; detail-view gets summary via research.listRuns (Prisma include returns all scalar fields). Gap-fix 618bf2e wired summary prop to detail page. |
| 7   | Sending outreach for AMBER prospect without qualityApproved=true returns server error | ✓ VERIFIED | outreach.ts line 15: imports computeTrafficLight; line 307: computes tier; line 320: blocks AMBER without approval; lines 315/322: throws PRECONDITION_FAILED with Dutch messages                                                                      |

**Score:** 6/7 truths verified (1 failed)

---

### Required Artifacts

| Artifact                                         | Expected                                                              | Status     | Details                                                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `lib/quality-config.ts`                          | Threshold constants with semantic comments, min 20 lines              | ✓ VERIFIED | 33 lines, 4 exported constants, full JSDoc                                                                                |
| `lib/workflow-engine.ts`                         | computeTrafficLight imports from quality-config, exported             | ✓ VERIFIED | Lines 2-7 import all 4 constants; line 526: `export function computeTrafficLight`                                         |
| `lib/research-executor.ts`                       | deleteMany before createMany for hypothesis idempotency               | ✓ VERIFIED | Line 667 deleteMany, line 689 createMany                                                                                  |
| `server/routers/admin.ts`                        | listProspects select includes `summary: true`                         | ✓ VERIFIED | Line 459: `summary: true` in researchRuns select block                                                                    |
| `components/features/prospects/quality-chip.tsx` | Imports computeTrafficLight from workflow-engine; uses real gate data | ✓ VERIFIED | Line 6: import from workflow-engine; lines 109-119: real extraction and call; no local divergent function                 |
| `server/routers/research.ts`                     | listRuns includes summary for detail view                             | ✗ MISSING  | Lines 105-120: include block selects prospect, campaign, \_count only — no summary, qualityApproved, or qualityReviewedAt |
| `server/routers/outreach.ts`                     | sendEmail checks qualityApproved for AMBER prospects                  | ✓ VERIFIED | Lines 307-322: quality gate logic in place                                                                                |

---

### Key Link Verification

| From                                             | To                                         | Via                                            | Status      | Details                                                                                                         |
| ------------------------------------------------ | ------------------------------------------ | ---------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `lib/workflow-engine.ts`                         | `lib/quality-config.ts`                    | Import of threshold constants                  | ✓ WIRED     | Lines 2-7: imports all 4 constants                                                                              |
| `components/features/prospects/quality-chip.tsx` | `lib/workflow-engine.ts`                   | `computeTrafficLight` import                   | ✓ WIRED     | Line 6: `import { computeTrafficLight } from '@/lib/workflow-engine'` — local divergent copy removed            |
| `app/admin/prospects/page.tsx`                   | `ResearchRun.summary.gate.sourceTypeCount` | `listProspects` query includes `summary: true` | ✓ WIRED     | admin.ts line 459 provides summary; page.tsx line 321 passes `summary={run?.summary}`                           |
| `app/admin/prospects/[id]/page.tsx`              | `ResearchRun.summary.gate.sourceTypeCount` | `listRuns` query + summary prop                | ✗ NOT_WIRED | Line 155 passes summary prop but `api.research.listRuns` does not select summary — prop is undefined at runtime |
| `server/routers/outreach.ts`                     | `ResearchRun.qualityApproved`              | DB lookup in sendEmail                         | ✓ WIRED     | Lines 288-322: fetches latestRun with qualityApproved, blocks AMBER without approval                            |

---

### Requirements Coverage

| Requirement | Source Plan   | Description                                                                      | Status      | Evidence                                                                                                                                                                                                                |
| ----------- | ------------- | -------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QUAL-01     | 26-01-PLAN.md | Amber/green thresholds calibrated using real research results                    | ✓ SATISFIED | lib/quality-config.ts created with calibration date, tier descriptions, and constants derived from 5 real prospects                                                                                                     |
| QUAL-02     | 26-02-PLAN.md | List-view traffic light accuracy improved (resolve hardcoded approximate values) | PARTIAL     | List-view is fully accurate. Detail-view chip still inaccurate (undefined summary from listRuns). The plan's truth "List-view chip shows same tier as detail-view" is not met because detail-view chip is not accurate. |

---

### Anti-Patterns Found

| File                                             | Line    | Pattern                                                                      | Severity | Impact                                                                                                                                                                                   |
| ------------------------------------------------ | ------- | ---------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/routers/research.ts`                     | 105-120 | listRuns include does not select summary, qualityApproved, qualityReviewedAt | BLOCKER  | Detail-view QualityChip receives undefined for all three fields; chip always shows AMBER or RED regardless of actual source diversity                                                    |
| `app/admin/prospects/[id]/page.tsx`              | 155     | `(researchRuns.data[0] as any).summary` evaluates to undefined               | WARNING  | TypeScript does not catch this because of the `as any` cast; runtime value is undefined; fallback sourceTypeCount=1 produces wrong chip color                                            |
| `components/features/prospects/quality-chip.tsx` | 111     | Fallback `realSourceTypeCount = 1` when gate missing                         | INFO     | With sourceTypeCount=1 fallback, chip shows AMBER for any prospect with 3+ evidence items (1 < GREEN_MIN_SOURCE_TYPES=3). GREEN is unreachable on detail page without real summary data. |

---

### Human Verification Required

#### 1. List-View vs Detail-View Chip Consistency

**Test:** Open the admin prospects list. Note the chip color for a prospect with 3+ source types (expected GREEN). Click into that prospect's detail page. Compare the chip color before opening the breakdown popup.
**Expected:** Both chips should show the same color. Currently the detail view chip will show AMBER because listRuns does not return summary data.
**Why human:** Visual comparison across two pages; browser required to compare rendered chip tiers.

#### 2. AMBER Outreach Block

**Test:** Find an AMBER prospect (1-2 source types). Attempt to send an outreach email without reviewing quality. Check the error response.
**Expected:** Dutch-language PRECONDITION_FAILED error appears in the UI.
**Why human:** Requires browser interaction with the outreach send UI to confirm the error message surfaces correctly.

---

### Gaps Summary

One gap remains from the previous verification:

**Remaining Gap: listRuns does not return summary — detail-view chip is inaccurate**

The gap-fix commit (618bf2e) correctly:

1. Removed the local `computeTrafficLight` function with the wrong threshold from `quality-chip.tsx`
2. Added `summary={(researchRuns.data[0] as any).summary}` to the detail page QualityChip call

However, it did not update `server/routers/research.ts` to include `summary`, `qualityApproved`, and `qualityReviewedAt` in the `listRuns` query. The detail page uses `api.research.listRuns` (not `api.admin.listProspects`) — so the `summary: true` added to `admin.ts` does not help the detail view. All three fields resolve to `undefined` at runtime. The chip falls back to `realSourceTypeCount = 1`, computing AMBER for any prospect with 3+ evidence items (since 1 < GREEN_MIN_SOURCE_TYPES = 3).

**Fix required:** Add three fields to the `include` block in `listRuns` in `server/routers/research.ts` (lines 105-120):

```typescript
include: {
  prospect: { select: { id: true, companyName: true, domain: true } },
  campaign: { select: { id: true, name: true, nicheKey: true, strictGate: true } },
  summary: true,
  qualityApproved: true,
  qualityReviewedAt: true,
  _count: {
    select: {
      evidenceItems: true,
      workflowHypotheses: true,
      automationOpportunities: true,
      workflowLossMaps: true,
    },
  },
},
```

No change needed to `app/admin/prospects/[id]/page.tsx` — once listRuns returns the fields, the existing `(researchRuns.data[0] as any).summary` cast will resolve to real data automatically.

---

_Verified: 2026-02-28T18:45:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes (previous: 2026-02-28T10:56:52Z, status: gaps_found)_
