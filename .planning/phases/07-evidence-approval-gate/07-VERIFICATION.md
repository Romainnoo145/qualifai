---
phase: 07-evidence-approval-gate
verified: 2026-02-20T08:42:13Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 7: Evidence Approval Gate — Verification Report

**Phase Goal:** Admin reviews AI-generated hypotheses — each pairing a pain point with matched use cases and supporting evidence — and outreach is blocked until at least one hypothesis is approved.
**Verified:** 2026-02-20T08:42:13Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                       | Status   | Evidence                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Regenerating hypotheses for a research run also creates ProofMatch records linking each hypothesis to matched use cases                     | VERIFIED | `hypotheses.ts` lines 218-243: calls `matchProofs(ctx.db, ...)` after each `workflowHypothesis.create()`, creates ProofMatch rows for each match                                                                                 |
| 2   | Querying hypotheses by prospect returns proofMatches with useCase and evidenceItem data, plus evidenceItems resolved from evidenceRefs JSON | VERIFIED | `hypotheses.ts` lines 22-118: full include with `useCase` + `evidenceItem`, bulk evidenceItem.findMany, Map-resolved evidenceItems returned per hypothesis                                                                       |
| 3   | Querying all hypotheses across prospects returns results with prospect info and proofMatches with useCase data                              | VERIFIED | `hypotheses.ts` lines 121-146: `listAll` procedure returns `workflowHypothesis.findMany` with `prospect` and `proofMatches.useCase` includes                                                                                     |
| 4   | Attempting to queue an outreach draft for a prospect with no ACCEPTED hypothesis throws a PRECONDITION_FAILED TRPCError                     | VERIFIED | `assets.ts` lines 276-286: `workflowHypothesis.count` with `status: 'ACCEPTED'`, throws `TRPCError({ code: 'PRECONDITION_FAILED', ... })` if count is 0                                                                          |
| 5   | Running autopilot on a campaign skips prospects with no ACCEPTED hypothesis and reports blocked_hypothesis status                           | VERIFIED | `campaigns.ts` lines 246-263: gate before `executeResearchRun`, pushes `status: 'blocked_hypothesis'` and calls `continue`                                                                                                       |
| 6   | Admin can navigate to /admin/hypotheses from the sidebar and see a filterable list of all hypotheses                                        | VERIFIED | `app/admin/layout.tsx` line 142: `{ href: '/admin/hypotheses', label: 'Hypotheses', icon: Lightbulb }` in Intelligence group; `app/admin/hypotheses/page.tsx` exists with filter tabs wired to `api.hypotheses.listAll.useQuery` |
| 7   | Each hypothesis card on the review page shows prospect name, matched use cases, and status pill                                             | VERIFIED | `app/admin/hypotheses/page.tsx` lines 119-176: prospect name (linked to detail page), status pill, title, problemStatement, proofMatches with score %, useCase title + category                                                  |
| 8   | On the prospect detail page, each hypothesis card shows matched use cases with scores and supporting evidence snippets                      | VERIFIED | `app/admin/prospects/[id]/page.tsx` lines 950-1011 (hypotheses) and 1055-1110 (opportunities): proofMatches section with score%, useCase title, evidenceItems section with workflowTag, sourceUrl, snippet (line-clamp-2)        |
| 9   | Attempting to queue outreach for a prospect with no approved hypotheses shows a clear error message to the admin                            | VERIFIED | `app/admin/prospects/[id]/page.tsx` lines 122-127: `onError` handler on `queueLossMapDraft` mutation catches `PRECONDITION_FAILED` and calls `alert(error.message)`                                                              |

**Score: 9/9 truths verified**

---

### Required Artifacts

| Artifact                            | Expected                                                                                 | Status   | Details                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/routers/hypotheses.ts`      | regenerateForRun with matchProofs wiring, enriched listByProspect, new listAll procedure | VERIFIED | All three present and substantive. `matchProofs` imported from `@/lib/workflow-engine` (line 6). `listByProspect` includes `useCase` + `evidenceItem` with score-ordered proofMatches (take 6) and bulk-resolved evidenceItems. `listAll` queries all prospects with optional status filter. `setStatus` mutation present. |
| `server/routers/assets.ts`          | Hypothesis approval gate in queueOutreachDraft                                           | VERIFIED | `TRPCError` imported line 2. Gate at lines 276-286 counts ACCEPTED hypotheses by prospectId, throws `PRECONDITION_FAILED` if zero. Gate placed after `[map, contact]` parallel fetch and before `appUrl` line.                                                                                                             |
| `server/routers/campaigns.ts`       | Hypothesis approval gate in runAutopilot per-prospect loop                               | VERIFIED | `blocked_hypothesis` in status union at line 211. Gate at lines 246-263 placed BEFORE `buildDefaultReviewSeedUrls` and `executeResearchRun`. `blockedHypothesis` counter in return object at line 649.                                                                                                                     |
| `app/admin/hypotheses/page.tsx`     | Standalone hypothesis review list page                                                   | VERIFIED | 240-line substantive React component with filter tabs, query wiring, card rendering, approve/reject/reset mutation, loading and empty states.                                                                                                                                                                              |
| `app/admin/layout.tsx`              | Hypotheses nav item in Intelligence group                                                | VERIFIED | `Lightbulb` imported line 19, nav item added at line 142 in Intelligence group.                                                                                                                                                                                                                                            |
| `app/admin/prospects/[id]/page.tsx` | Enhanced HypothesesTab with evidence + use case display                                  | VERIFIED | `proofMatches` sections at lines 950 and 1055, `evidenceItems` sections at lines 977 and 1082, both applied symmetrically to hypotheses and opportunities. `onError` PRECONDITION_FAILED handler at lines 122-127.                                                                                                         |

---

### Key Link Verification

| From                                | To                             | Via                                                  | Status | Details                                                                                                                                                        |
| ----------------------------------- | ------------------------------ | ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/routers/hypotheses.ts`      | `lib/workflow-engine.ts`       | `matchProofs(ctx.db, query, 4)` import               | WIRED  | `import { ..., matchProofs } from '@/lib/workflow-engine'` at line 6; called at lines 222 and 272 with `ctx.db` as first arg                                   |
| `server/routers/assets.ts`          | `WorkflowHypothesis`           | `workflowHypothesis.count` for ACCEPTED status check | WIRED  | `ctx.db.workflowHypothesis.count({ where: { prospectId: map.prospect.id, status: 'ACCEPTED' } })` at line 277                                                  |
| `server/routers/campaigns.ts`       | `WorkflowHypothesis`           | `blocked_hypothesis` in per-prospect loop            | WIRED  | `ctx.db.workflowHypothesis.count({ where: { prospectId: prospect.id, status: 'ACCEPTED' } })` at line 249; gate pushes `blocked_hypothesis` status at line 258 |
| `app/admin/hypotheses/page.tsx`     | `server/routers/hypotheses.ts` | `api.hypotheses.listAll.useQuery`                    | WIRED  | Line 22: `api.hypotheses.listAll.useQuery({ status: statusFilter, limit: 100 })`                                                                               |
| `app/admin/hypotheses/page.tsx`     | `server/routers/hypotheses.ts` | `api.hypotheses.setStatus.useMutation`               | WIRED  | Line 27: `api.hypotheses.setStatus.useMutation(...)` called via onClick on Accept/Reject/Reset buttons                                                         |
| `app/admin/prospects/[id]/page.tsx` | `server/routers/hypotheses.ts` | `evidenceItems` from enriched `listByProspect`       | WIRED  | `item.evidenceItems?.length > 0` rendered at lines 977 and 1082; data sourced from `listByProspect` which resolves evidenceRefs JSON                           |
| `server/routers/_app.ts`            | `server/routers/hypotheses.ts` | `hypothesesRouter` registered                        | WIRED  | `_app.ts` line 7: `import { hypothesesRouter }`, line 23: `hypotheses: hypothesesRouter`                                                                       |

---

### Requirements Coverage

| Success Criterion                                                                                                | Status    | Evidence                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System generates a hypothesis naming a pain point, listing matched use cases, and citing supporting evidence     | SATISFIED | `regenerateForRun` creates ProofMatch records via `matchProofs`; `listByProspect` returns `proofMatches.useCase` and `evidenceItems` resolved from evidenceRefs           |
| Admin sees a review screen showing each hypothesis with its matched use cases and evidence sources               | SATISFIED | `/admin/hypotheses` page shows proofMatches with useCase titles/scores; prospect detail HypothesesTab shows proofMatches + evidenceItems with snippets and source links   |
| Admin can approve or reject a hypothesis; decision is persisted and visible                                      | SATISFIED | `setStatus` mutation updates `workflowHypothesis.status` in DB; status pill displayed on both review page and prospect detail; invalidation triggers refetch              |
| Attempting to generate or send outreach for a prospect with no approved hypothesis is blocked with a clear error | SATISFIED | `assets.ts` throws `PRECONDITION_FAILED` for manual queueing; `campaigns.ts` returns `blocked_hypothesis` for autopilot; UI surfaces the error via `alert(error.message)` |

---

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments in modified files. No stub return values. No empty handler implementations. All mutations make real DB calls and return actual data.

---

### Human Verification Required

#### 1. Hypothesis card evidence display (live data)

**Test:** Navigate to a prospect that has had research run, click the Hypotheses tab, expand a hypothesis card.
**Expected:** Matched use cases appear with score percentages; supporting evidence section shows snippets with source links and workflowTag pills.
**Why human:** Requires real ProofMatch and EvidenceItem records in the DB — cannot verify data flow with grep alone.

#### 2. PRECONDITION_FAILED alert on Queue Outreach

**Test:** Navigate to a prospect with zero ACCEPTED hypotheses; click the "Queue Outreach Draft" button.
**Expected:** A browser alert appears with the message "Outreach blocked: approve at least one hypothesis before generating sequences."
**Why human:** Requires a running app and a prospect in the correct DB state.

#### 3. Filter tab count badge on /admin/hypotheses

**Test:** Navigate to /admin/hypotheses; observe the count badge next to the active filter tab.
**Expected:** Badge shows the number of hypotheses matching the current filter; switching tabs updates the list and count.
**Why human:** Count badge only shows count for the active tab (`tab.value === statusFilter ? list.length : ''`); behavior with multiple statuses needs visual confirmation.

#### 4. Autopilot blocked_hypothesis reporting

**Test:** Run autopilot on a campaign containing a mix of prospects — some with ACCEPTED hypotheses, some without.
**Expected:** Prospects without approved hypotheses appear in results with `blocked_hypothesis` status; `blockedHypothesis` counter is non-zero in the summary.
**Why human:** Requires a real campaign with real prospect data and approved/unapproved hypotheses to validate branching in `runAutopilot`.

---

### Gaps Summary

No gaps. All 9 observable truths verified. All 6 required artifacts exist and are substantive. All 7 key links are wired. The phase goal — admin reviews AI-generated hypotheses pairing pain points with matched use cases and supporting evidence, outreach blocked until at least one is approved — is fully achieved in the codebase.

**Key architectural decisions that verified correctly:**

- The hypothesis gate in `campaigns.ts` is placed BEFORE `executeResearchRun`, preventing false blocks from fresh DRAFT hypotheses created by a new research run.
- The `matchProofs` wiring covers both the hypotheses loop AND the opportunities loop in `regenerateForRun`.
- `listAll` is kept lightweight (no evidenceRefs resolution) while `listByProspect` is fully enriched.
- The `hypothesesRouter` is registered in `_app.ts` confirming all tRPC endpoints are reachable.

---

_Verified: 2026-02-20T08:42:13Z_
_Verifier: Claude (gsd-verifier)_
