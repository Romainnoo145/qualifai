---
phase: 56-unified-ai-intro-draft-creator
plan: 02
subsystem: outreach
tags: [cleanup, dead-code, ai-pipeline, unification]
dependency_graph:
  requires: [56-01]
  provides: [unified-ai-draft-ui, clean-outreach-pipeline]
  affects:
    [outreach-preview-section, assets-router, campaigns-router, workflow-engine]
tech_stack:
  added: []
  patterns: [single-mutation-pattern, generateIntroDraft-as-sole-email-path]
key_files:
  created: []
  modified:
    - components/features/prospects/outreach-preview-section.tsx
    - app/admin/contacts/[id]/page.tsx
    - server/routers/outreach.ts
    - server/routers/assets.ts
    - server/routers/campaigns.ts
    - lib/workflow-engine.ts
    - lib/analysis/master-analyzer.ts
    - lib/workflow-engine.test.ts
decisions:
  - generateIntroDraft is now the single path for all intro email generation
  - Contact detail page no longer triggers outreach — links to prospect page instead
  - runAutopilot in campaigns.ts uses generateIntroDraft per-prospect with try/catch isolation
  - ProofMatch building loop retained in runAutopilot (still feeds other consumers)
  - analysis-v1 validator functions retained (validateMasterAnalysis exported, used externally)
  - analysis-v1 types retained in types.ts (still imported by master-prompt.ts overloads)
metrics:
  duration_minutes: 21
  completed_date: 2026-03-16
  tasks_completed: 2
  files_modified: 8
  lines_deleted: ~970
---

# Phase 56 Plan 02: UI Rewrite + Template Engine Deletion Summary

**One-liner:** Replaced WorkflowLossMap template email flow with single AI pipeline via generateIntroDraft, deleting ~970 lines of dead code.

## What Was Built

Complete unification of the email generation path. After this plan, there is exactly one way to generate intro emails: `api.outreach.generateIntroDraft` → `lib/outreach/generate-intro.ts`. All template-based paths are gone.

## Tasks Completed

### Task 1: Rewrite outreach-preview-section.tsx + update contacts page

- Replaced the "Email Content" card (WorkflowLossMap template) with a single "Generate Draft" button using `api.outreach.generateIntroDraft`
- Added `getDraftsForProspect` query to outreach router for fetching existing drafts
- Shows existing draft preview (subject + body preview) with link to outreach queue
- Removed `api.assets.generate`, `api.assets.queueOutreachDraft`, `api.assets.getLatest` from UI
- Contacts detail page: removed "Initialize Outreach" button (needed `workflowLossMapId`), replaced with "View Prospect" link
- Commit: `f56f07e`

### Task 2: Delete template engine dead code + generateMasterAnalysis v1

- Deleted `assets.generate` mutation (152 lines, template-based loss map creation)
- Deleted `assets.queueOutreachDraft` mutation (149 lines, template-based sequence seeding)
- Deleted `createWorkflowLossMapDraft` from workflow-engine.ts (~103 lines)
- Deleted `createOutreachSequenceSteps` from workflow-engine.ts (~75 lines)
- Deleted `WorkflowLossMapDraft` interface, `formatEuro`, `metricsFromHypotheses` helpers
- Deleted `generateMasterAnalysis` (analysis-v1, ~72 lines) from master-analyzer.ts
- Replaced campaigns.ts `runAutopilot` 200-line template block with 40-line `generateIntroDraft` call
- Cleaned all unused imports: `buildCalBookingUrl`, `createOutreachSequenceSteps`, `createWorkflowLossMapDraft`, `validateTwoStepCta`, `CTA_STEP_1`, `CTA_STEP_2`, `persistWorkflowLossMapPdf`, `buildDiscoverUrl`, `env`, `toJson`, `metadataObject`
- Removed `createWorkflowLossMapDraft` test case and its fixtures from workflow-engine.test.ts
- Commit: `0a2db0f`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrupted createCallPrepDraft declaration after initial edit attempt**

- **Found during:** Task 2, Step 4
- **Issue:** First edit attempt replaced only the function signature of createWorkflowLossMapDraft, leaving the old function body merged into the createCallPrepDraft declaration
- **Fix:** Second edit deleted the entire remaining body block (createWorkflowLossMapDraft body + createOutreachSequenceSteps) and the duplicate createCallPrepDraft signature
- **Files modified:** lib/workflow-engine.ts
- **Commit:** 0a2db0f

**2. [Rule 2 - Cleanup] Unused helper functions after createWorkflowLossMapDraft deletion**

- **Found during:** Task 2
- **Issue:** formatEuro, metricsFromHypotheses, and WorkflowLossMapDraft interface became dead code after deleting createWorkflowLossMapDraft
- **Fix:** Deleted all three from workflow-engine.ts
- **Files modified:** lib/workflow-engine.ts
- **Commit:** 0a2db0f

**3. [Rule 1 - Bug] extractGateFromSummary dead function left in assets.ts**

- **Found during:** Task 2, Step 2
- **Issue:** extractGateFromSummary and ResearchGateSummary type were only used by the deleted generate mutation
- **Fix:** Removed both from assets.ts
- **Files modified:** server/routers/assets.ts
- **Commit:** 0a2db0f

**4. [Rule 2 - Cleanup] Unused lossMapId field in campaigns.ts results array**

- **Found during:** Task 2, Step 3
- **Issue:** lossMapId was a result field only populated by the deleted template path
- **Fix:** Removed from results type and results.push calls
- **Files modified:** server/routers/campaigns.ts
- **Commit:** 0a2db0f

**5. [Rule 2 - Cleanup] MasterAnalysisInput no longer needed in master-analyzer.ts imports**

- **Found during:** Task 2, Step 5
- **Issue:** MasterAnalysisInput was only used as parameter type for generateMasterAnalysis
- **Fix:** Removed from import statement
- **Files modified:** lib/analysis/master-analyzer.ts
- **Commit:** 0a2db0f

## Architecture Decisions

- **Single email path:** `api.outreach.generateIntroDraft` is the sole mutation for intro email generation. Template engine is gone.
- **ProofMatch loop retained in runAutopilot:** The loop that builds ProofMatch records was kept because it feeds other consumers (proof display in prospect detail). `generateIntroDraft` queries evidence directly, not via ProofMatch.
- **analysis-v1 validators retained:** `validateMasterAnalysis` and related private validators kept in master-analyzer.ts because they are exported and the types are still referenced in master-prompt.ts legacy overloads.
- **Per-prospect try/catch in runAutopilot:** generateIntroDraft wrapped in inner try/catch so one failed draft doesn't abort the entire batch.

## Self-Check

### Files verified to exist:

- components/features/prospects/outreach-preview-section.tsx — FOUND
- server/routers/outreach.ts (getDraftsForProspect added) — FOUND
- server/routers/assets.ts (generate+queueOutreachDraft deleted) — FOUND
- server/routers/campaigns.ts (runAutopilot uses generateIntroDraft) — FOUND
- lib/workflow-engine.ts (createWorkflowLossMapDraft+createOutreachSequenceSteps deleted) — FOUND
- lib/analysis/master-analyzer.ts (generateMasterAnalysis deleted) — FOUND

### Commits verified:

- f56f07e (Task 1: UI rewrite) — FOUND
- 0a2db0f (Task 2: dead code deletion) — FOUND

### Dead code checks:

- createWorkflowLossMapDraft in lib/server: PASS (0 results)
- generateMasterAnalysis exported function: PASS (0 results)
- queueOutreachDraft in server/components/app: PASS (0 results)
- generateIntroDraft in UI: PASS (confirmed at line 83)
- generateIntroDraft in campaigns.ts: PASS (confirmed at lines 9, 704)

## Self-Check: PASSED
