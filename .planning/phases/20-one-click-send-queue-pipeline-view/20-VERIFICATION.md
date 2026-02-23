---
phase: 20-one-click-send-queue-pipeline-view
verified: 2026-02-23T03:00:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 20: One-Click Send Queue + Pipeline View Verification Report

**Phase Goal:** Admin can approve and send any outreach channel with a single click from a unified queue that shows only actionable prospects — and every prospect has a visible pipeline stage so the admin knows state at a glance without opening records.
**Verified:** 2026-02-23T03:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                        | Status   | Evidence                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Clicking approveDraft twice does not send the email twice — second call returns CONFLICT     | VERIFIED | `updateMany where {id, status:'draft'}` at outreach.ts:508; `TRPCError CONFLICT` at outreach.ts:514                                                                                                                        |
| 2   | bulkApproveLowRisk with concurrent invocations skips already-claimed drafts                  | VERIFIED | Per-draft `updateMany` at outreach.ts:648; `continue` on `claimed.count === 0` at outreach.ts:653-656                                                                                                                      |
| 3   | If sendOutreachEmail throws, draft reverts to 'draft' for retry                              | VERIFIED | catch block at outreach.ts:580-587 reverts to `status: 'draft'`; quality blocks keep `manual_review`                                                                                                                       |
| 4   | Every prospect in Companies list shows a pipeline stage chip                                 | VERIFIED | `PipelineChip` imported at prospects/page.tsx:23, used at line 171-183 with `computePipelineStage` call                                                                                                                    |
| 5   | Prospect detail header shows pipeline stage chip alongside QualityChip                       | VERIFIED | `PipelineChip` imported at [id]/page.tsx:21-22, used at lines 95-110 in back row                                                                                                                                           |
| 6   | Action queue hides prospects still in Researching stage                                      | VERIFIED | `researchInProgressStatuses` with `none` filter applied to all 4 parallel queries in `getActionQueue` (admin.ts:517-685)                                                                                                   |
| 7   | Engaged prospects appear earlier in queue; draft rows have inline preview and one-click Send | VERIFIED | `latestEngagementAt` helper at admin.ts:33-49; engagement sort at admin.ts:761-770; `preview: log.bodyText?.slice(0, 200)` at admin.ts:714; `approveDraft.useMutation` wired at page.tsx:236, Send button at lines 158-176 |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                          | Expected                                                              | Status   | Details                                                                                                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/routers/outreach.ts`                      | Idempotency guard on approveDraft and bulkApproveLowRisk              | VERIFIED | `updateMany` atomic claim in both mutations; `TRPCError` import at line 1; CONFLICT code at line 514                                                                                      |
| `lib/pipeline-stage.ts`                           | computePipelineStage pure function and PipelineStage type             | VERIFIED | 43 lines; exports both `PipelineStage` type and `computePipelineStage` function; 7-stage priority chain correct                                                                           |
| `components/features/prospects/pipeline-chip.tsx` | PipelineChip React component                                          | VERIFIED | 25 lines; `STAGE_COLORS` record for all 7 stages; renders colored `<span>` chip                                                                                                           |
| `server/routers/admin.ts`                         | getActionQueue with research filter, engagement ranking, preview data | VERIFIED | `researchInProgressStatuses` array; `none` filter on all 4 queries; `latestEngagementAt` helper; `engagementAt` on all items; `preview` on draftItems                                     |
| `app/admin/page.tsx`                              | Dashboard with inline send button for drafts                          | VERIFIED | `approveDraft.useMutation` at line 236; `ActionRow` draft path renders `<div>` + `<button>` (not `<Link>`); `onSendDraft` threaded through `ActionSection`; disabled state during pending |

### Key Link Verification

| From                                | To                                                | Via                                     | Status | Details                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------- | --------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/routers/outreach.ts`        | `prisma.outreachLog.updateMany`                   | atomic status claim draft→sending       | WIRED  | `updateMany({where: {id, status:'draft'}, data: {status:'sending'}})` in both `approveDraft` (line 508) and `bulkApproveLowRisk` (line 648)        |
| `app/admin/prospects/page.tsx`      | `components/features/prospects/pipeline-chip.tsx` | import PipelineChip                     | WIRED  | Imported at line 23, rendered at line 171                                                                                                          |
| `app/admin/prospects/page.tsx`      | `lib/pipeline-stage.ts`                           | import computePipelineStage             | WIRED  | Imported at line 24, called at line 172                                                                                                            |
| `app/admin/prospects/[id]/page.tsx` | `components/features/prospects/pipeline-chip.tsx` | import PipelineChip                     | WIRED  | Imported at line 21, rendered at line 95                                                                                                           |
| `app/admin/page.tsx`                | `api.outreach.approveDraft`                       | useMutation from inline send button     | WIRED  | `api.outreach.approveDraft.useMutation` at line 236; `approveDraft.mutate({ id })` called via `onSendDraft` at line 368                            |
| `server/routers/admin.ts`           | `prisma.outreachLog.findMany`                     | getActionQueue researchRuns none filter | WIRED  | `researchRuns: { none: { status: { in: researchInProgressStatuses } } }` applied to all 4 parallel queries                                         |
| `server/routers/admin.ts`           | `prisma.wizardSession`                            | getActionQueue session engagement data  | WIRED  | `sessions: { orderBy: { updatedAt: 'desc' }, take: 1, select: { createdAt, pdfDownloadedAt, callBookedAt, updatedAt } }` included in all 4 queries |

### Requirements Coverage

| Requirement                                                                    | Status    | Notes                                                                                                                                 |
| ------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| SEND-01: One row per pending action with inline preview + single action button | SATISFIED | Draft rows show subject as title, `bodyText.slice(0,200)` as preview, Send button calls `approveDraft.mutate({id})`                   |
| SEND-02: Single click sends; double click does not double-send                 | SATISFIED | Atomic `updateMany` claim returns count=0 on second click, throws CONFLICT; UI also disables button during `isPending`                |
| PIPE-01: Every prospect shows pipeline stage chip (7 stages)                   | SATISFIED | `PipelineChip` on Companies list and prospect detail header; 7 stages: Imported/Researching/Reviewed/Ready/Sending/Engaged/Booked     |
| PIPE-02: Queue hides Researching-stage prospects                               | SATISFIED | `researchInProgressStatuses` filter with Prisma `none` relation applied to all 4 `getActionQueue` queries                             |
| PIPE-03: Engaged prospects appear earlier in queue                             | SATISFIED | `latestEngagementAt` computes max(updatedAt, pdfDownloadedAt, callBookedAt); sort places engaged before unengaged within urgency tier |

### Anti-Patterns Found

None — no TODO/FIXME/placeholder comments in any modified file. No stub implementations. No orphaned artifacts.

### Commit Verification

All 5 feature commits confirmed in git history:

| Commit    | Description                                                                              |
| --------- | ---------------------------------------------------------------------------------------- |
| `a0d3b2e` | feat(20-01): add idempotency guards to approveDraft and bulkApproveLowRisk               |
| `50bc938` | feat(20-02): add computePipelineStage, PipelineChip, and booked-session include          |
| `59f5c3a` | feat(20-02): wire PipelineChip into Companies list and prospect detail header            |
| `85d7cb0` | feat(20-03): enhance getActionQueue — research filter, engagement ranking, draft preview |
| `6e52066` | feat(20-03): add inline send button to dashboard draft rows                              |

### Human Verification Required

#### 1. Double-send prevention under real concurrency

**Test:** Open the admin dashboard in two browser tabs simultaneously. Click Send on the same draft row in both tabs within 1 second of each other.
**Expected:** Only one email is sent. The second tab either sees the row already gone or shows a toast error indicating "already being sent."
**Why human:** The DB-level idempotency guard is verified in code, but the UI's response to a CONFLICT error (invalidates cache, row disappears) requires a browser session to confirm the error is handled gracefully and no stuck UI state remains.

#### 2. Pipeline chip stage accuracy in browser

**Test:** Open the Companies list `/admin/prospects`. For a prospect with an active research run, verify the chip shows "Researching" not "Imported." For a prospect with `qualityApproved=true` and no sent outreach, verify it shows "Reviewed."
**Expected:** Each chip accurately reflects the prospect's actual state.
**Why human:** Stage derivation depends on runtime data (researchRun.status, qualityApproved, sessions) that requires real DB records to validate the full priority chain.

#### 3. Queue filters correctly in browser

**Test:** While a research run is in progress for a prospect that has a pending draft, open the Dashboard. Verify the draft from that prospect does NOT appear in the "Drafts to Approve" section.
**Expected:** Draft from researching prospect is absent from queue; it reappears after research completes.
**Why human:** The `none` filter behavior requires a live research run in the DB to validate.

### Gaps Summary

No gaps found. All 7 observable truths are verified. All 5 required artifacts exist, are substantive, and are wired. All 5 requirements are satisfied. All 5 commits exist in git history.

---

_Verified: 2026-02-23T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
