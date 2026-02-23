---
phase: 22-hypothesis-flow-fix
verified: 2026-02-23T03:29:30Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 22: Hypothesis Flow Fix — Verification Report

**Phase Goal:** Close the critical integration gap where `approveQuality` doesn't transition hypotheses from DRAFT to PENDING — making /voor/ hypothesis validation work for new prospects and completing the E2E discovery-to-send flow.
**Verified:** 2026-02-23T03:29:30Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                           | Status   | Evidence                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | When admin approves research quality, all DRAFT hypotheses for that research run transition to PENDING          | VERIFIED | `approveQuality` mutation in `server/routers/research.ts` lines 207-211: `if (input.approved) { await ctx.db.workflowHypothesis.updateMany({ where: { researchRunId: input.runId, status: 'DRAFT' }, data: { status: 'PENDING' } })`                                                                   |
| 2   | When admin rejects research quality, any PENDING hypotheses for that research run revert to DRAFT               | VERIFIED | `approveQuality` mutation lines 212-216: `else { await ctx.db.workflowHypothesis.updateMany({ where: { researchRunId: input.runId, status: 'PENDING' }, data: { status: 'DRAFT' } })`                                                                                                                  |
| 3   | After quality approval, the /voor/ dashboard shows hypotheses in the validation section                         | VERIFIED | `app/voor/[slug]/page.tsx` line 47: `workflowHypotheses: { where: { status: { in: ['ACCEPTED', 'PENDING'] } }` — PENDING hypotheses are fetched; `DashboardClient` renders them in Step 1 unconditionally (validation buttons gated on SENT+ status, which is existing design)                         |
| 4   | After quality approval, the admin Analysis section immediately reflects the PENDING status without page refresh | VERIFIED | `components/features/prospects/quality-chip.tsx` line 66: `void utils.hypotheses.listByProspect.invalidate()` in `approveQuality.onSuccess` triggers React Query refetch of `AnalysisSection`'s query                                                                                                  |
| 5   | When a prospect validates a hypothesis on /voor/, admin sees the result in Analysis on next page load           | VERIFIED | `hypotheses.validateByProspect` mutation (`server/routers/hypotheses.ts` lines 305-337) writes ACCEPTED/DECLINED to DB; `AnalysisSection` calls `api.hypotheses.listByProspect.useQuery` which reads from DB on page load — status labels and pills at lines 38-52 display ACCEPTED/DECLINED correctly |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                         | Expected                                                        | Status   | Details                                                                                                                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/routers/research.ts`                     | DRAFT→PENDING transition in approveQuality mutation             | VERIFIED | Lines 198-219: `updateMany` with `status: 'DRAFT'` guard on approval, `status: 'PENDING'` guard on rejection. Return type unchanged (`return run` where `run` is the `researchRun.update` result). |
| `components/features/prospects/quality-chip.tsx` | Cache invalidation for hypothesis status after quality approval | VERIFIED | Line 66: `void utils.hypotheses.listByProspect.invalidate()` present in `approveQuality.onSuccess` alongside three other invalidations.                                                            |

### Key Link Verification

| From                                             | To                                | Via                                       | Status | Details                                                                                                                  |
| ------------------------------------------------ | --------------------------------- | ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `server/routers/research.ts`                     | `prisma.workflowHypothesis`       | `updateMany` in `approveQuality` mutation | WIRED  | Lines 208-210 and 213-215: conditional `updateMany` with `researchRunId` + status guard, exact pattern specified in PLAN |
| `components/features/prospects/quality-chip.tsx` | `utils.hypotheses.listByProspect` | cache invalidation in `onSuccess`         | WIRED  | Line 66: `void utils.hypotheses.listByProspect.invalidate()` present in `approveQuality.onSuccess`                       |

### Requirements Coverage

All three success criteria from ROADMAP.md verified:

| Requirement                                              | Status    | Notes                                                                                    |
| -------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `approveQuality` transitions DRAFT hypotheses to PENDING | SATISFIED | Exact `updateMany` implemented with DRAFT guard                                          |
| /voor/ dashboard shows hypotheses after quality approval | SATISFIED | Page query filters `status: { in: ['ACCEPTED', 'PENDING'] }` — PENDING hypotheses appear |
| Prospect validation visible to admin on next page load   | SATISFIED | `validateByProspect` writes to DB; `AnalysisSection` fetches fresh on load               |

### Anti-Patterns Found

None. No TODOs, FIXMEs, stubs, or placeholder returns in the modified files. The `return null` at `quality-chip.tsx:96` is a legitimate early-return guard for the no-runId case.

### Human Verification Required

**1. E2E hypothesis flow — new prospect**

Test: Run research on a new prospect. After research completes, open the QualityChip dropdown and click "Onderzoek goedkeuren". Check that the Analysis section immediately shows hypothesis status as PENDING. Then open the /voor/ dashboard (prospect must be READY+ status). Confirm hypotheses appear in Step 1 "Pijnpunten".

Expected: Hypotheses transition from DRAFT to PENDING on approval, appear on /voor/, validation buttons appear on SENT+ prospects.

Why human: Database state + React Query invalidation + page navigation can't be verified by static grep.

**2. Reject-after-approve flow**

Test: After approving quality, open QualityChip again and approve again (or check if a reject path is accessible). Verify PENDING hypotheses revert to DRAFT and disappear from /voor/.

Expected: The `else` branch in `approveQuality` reverts PENDING→DRAFT, /voor/ no longer shows them.

Why human: Only the code path exists statically; runtime behavior requires database interaction.

**3. Prospect validation visible to admin**

Test: As a prospect on /voor/ (SENT+ status), click "Ja, herkenbaar" on a hypothesis. Reload the admin prospect detail page and check the Analysis section shows the hypothesis with "Confirmed by prospect" pill (emerald color).

Expected: Status updates to ACCEPTED, admin sees it on next page load.

Why human: Requires authenticated prospect session + admin session + database write verification.

### Notable Design Constraint (Not a Gap)

The /voor/ validation buttons (confirm/decline) are gated on `showValidation` which requires prospect status in `['SENT', 'VIEWED', 'ENGAGED', 'CONVERTED']`. A prospect with status `READY` will see the hypotheses listed on Step 1 but without validation buttons. This is existing design (Phase 19 decision), not introduced by Phase 22. The PLAN truth states "shows hypotheses in the validation section" — the section header and cards render for READY+ but the interactive buttons require SENT+.

### Gaps Summary

No gaps. All five observable truths verified. Both artifacts exist, are substantive, and are correctly wired. TypeScript compiles clean (`npx tsc --noEmit` exits 0). Commits 26bbeb1 and 820a72d confirmed in git history.

---

_Verified: 2026-02-23T03:29:30Z_
_Verifier: Claude (gsd-verifier)_
