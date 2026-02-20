---
phase: 07-evidence-approval-gate
plan: 01
subsystem: backend-routers
tags: [hypotheses, proof-matching, outreach-gate, campaigns, assets]
dependency_graph:
  requires:
    - 06-03 (matchProofs function in workflow-engine)
    - prisma-schema (ProofMatch.useCase, ProofMatch.evidenceItem relations)
  provides:
    - matchProofs wired into regenerateForRun (hypotheses + opportunities)
    - enriched listByProspect with useCase/evidenceItem data
    - listAll procedure for admin hypothesis list page
    - hypothesis approval gate in queueOutreachDraft (PRECONDITION_FAILED)
    - hypothesis approval gate in runAutopilot (blocked_hypothesis status)
  affects:
    - 07-02 (review UI reads enriched listByProspect data)
    - 07-03 (outreach flows respect the approval gate)
tech_stack:
  added: []
  patterns:
    - matchProofs called after create inside for-loop (same pattern as campaigns.ts)
    - evidenceRefs JSON array resolved via bulk findMany + Map lookup
    - Gate checks BEFORE executeResearchRun to avoid false blocks from fresh DRAFT hypotheses
key_files:
  created: []
  modified:
    - server/routers/hypotheses.ts
    - server/routers/assets.ts
    - server/routers/campaigns.ts
decisions:
  - Hypothesis gate in runAutopilot placed BEFORE executeResearchRun — checking after would always block because executeResearchRun creates fresh DRAFT hypotheses
  - listAll does not resolve evidenceRefs — kept lightweight for list page, evidence detail only in listByProspect
  - matchProofs called sequentially per item (not parallelised) — matches existing campaigns.ts pattern, avoids Claude API rate limit burst
metrics:
  duration: 2 min
  completed_date: 2026-02-20
  tasks_completed: 2
  files_modified: 3
---

# Phase 7 Plan 01: matchProofs Wiring and Hypothesis Approval Gate Summary

Backend foundation for Phase 7: matchProofs wired into hypothesis regeneration, hypothesis queries enriched with use case and evidence data, outreach blocked until at least one hypothesis is approved.

## What Was Built

### Task 1 — hypotheses.ts (commit dde3173)

Three changes to `server/routers/hypotheses.ts`:

**matchProofs wiring in regenerateForRun:** Both the hypotheses loop and the opportunities loop now store the `.create()` return value, defensively delete any existing ProofMatch rows for that record, call `matchProofs(ctx.db, query, 4)`, and create ProofMatch records for each match result. The data shape (`prospectId`, `workflowHypothesisId`/`automationOpportunityId`, `sourceType`, `proofId`, `proofTitle`, `proofSummary`, `proofUrl`, `score`, `isRealShipped`, `isCustomPlan`, `useCaseId`) mirrors the existing campaigns.ts pattern exactly.

**Enriched listByProspect:** `proofMatches: true` replaced with a full include that fetches `useCase` (id, title, summary, category) and `evidenceItem` (id, sourceUrl, snippet, sourceType, workflowTag, title), ordered by score descending, limited to top 6. After the parallel fetch, all evidenceRef IDs from both hypotheses and opportunities are deduplicated and bulk-fetched via a single `evidenceItem.findMany`. Results are returned with a per-item `evidenceItems` array resolved from that Map.

**listAll procedure:** New `adminProcedure` with optional `{ status?, limit? }` input. Queries `workflowHypothesis.findMany` with optional status filter, ordered by `createdAt desc`, includes `prospect` (id, companyName, domain) and `proofMatches` with `useCase` (id, title, category), top 4 by score. No evidenceRefs resolution — intentionally lightweight for the list page.

### Task 2 — assets.ts + campaigns.ts (commit 8ba22cd)

**Gate in assets.ts `queueOutreachDraft`:** Added `TRPCError` import from `@trpc/server`. After the `[map, contact]` parallel fetch, counts `workflowHypothesis` records with `status: 'ACCEPTED'` for the prospect. Throws `PRECONDITION_FAILED` with a human-readable message if count is 0.

**Gate in campaigns.ts `runAutopilot`:** Added `'blocked_hypothesis'` to the status union type. In the per-prospect try block, BEFORE any call to `buildDefaultReviewSeedUrls` or `executeResearchRun`, counts approved hypotheses by `prospectId` (across all runs). If 0, pushes a `blocked_hypothesis` result and continues to next prospect. Also added `blockedHypothesis` counter to the return object summary.

## Verification

- `npx tsc --noEmit`: PASS (no errors)
- `npm run test`: 27/27 tests pass (7 test files)
- `matchProofs` import confirmed in hypotheses.ts
- `listByProspect` includes `useCase` and `evidenceItem` in proofMatches
- `listAll` procedure present with prospect and proofMatch includes
- `queueOutreachDraft` throws PRECONDITION_FAILED on zero approved hypotheses
- `runAutopilot` has `blocked_hypothesis` in status union and gate before executeResearchRun

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All files present:

- server/routers/hypotheses.ts — FOUND
- server/routers/assets.ts — FOUND
- server/routers/campaigns.ts — FOUND
- .planning/phases/07-evidence-approval-gate/07-01-SUMMARY.md — FOUND

All commits present:

- dde3173 — FOUND
- 8ba22cd — FOUND
