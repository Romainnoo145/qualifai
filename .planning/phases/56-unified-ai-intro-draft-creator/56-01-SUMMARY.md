---
phase: 56-unified-ai-intro-draft-creator
plan: '01'
subsystem: outreach
tags: [outreach, ai-draft, prisma, trpc, evidence]
dependency_graph:
  requires: [55-01]
  provides:
    [lib/outreach/generate-intro.ts, outreach.generateIntroDraft mutation]
  affects: [server/routers/outreach.ts, prisma/schema.prisma]
tech_stack:
  added: []
  patterns: [atomic-db-create, hypothesis-gate, evidence-enrichment]
key_files:
  created:
    - lib/outreach/generate-intro.ts
    - prisma/migrations/20260316120000_outreach_log_prospect_id/migration.sql
  modified:
    - prisma/schema.prisma
    - server/routers/outreach.ts
decisions:
  - isAiGenerated flag in classifyDraftRisk allows AI drafts (kind=intro_draft/cadence_draft/signal_draft) to reach riskLevel=low with evidenceBacked=true alone, no CTA strings or workflowLossMapId required
  - Hypothesis gate falls back to prospect-level hypotheses when none exist on the specific run (Phase 7 invariant preserved)
  - void step pattern used to silence unused variable warning without removing the DB create
metrics:
  duration_minutes: 20
  completed_date: '2026-03-16'
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 56 Plan 01: Unified AI Intro Draft Creator Summary

Atomic AI intro draft creator with OutreachLog.prospectId denormalization, evidence-enriched context, hypothesis gate, and AI-native risk classification.

## Tasks Completed

| Task | Name                                                                | Commit  | Files                                                               |
| ---- | ------------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| 1    | Add OutreachLog.prospectId + create generate-intro.ts               | 607f72d | prisma/schema.prisma, lib/outreach/generate-intro.ts, migration.sql |
| 2    | Add outreach.generateIntroDraft mutation + update classifyDraftRisk | bd4b438 | server/routers/outreach.ts                                          |

## What Was Built

**lib/outreach/generate-intro.ts** — New module exporting `generateIntroDraft(opts: GenerateIntroOptions)`. The function:

1. Loads prospect and contact from DB
2. Enforces hypothesis approval gate (ACCEPTED or PENDING, falls back to prospect-level)
3. Loads top 5 evidence items by confidence score
4. Loads project sender settings via `loadProjectSender`
5. Builds evidence-enriched `OutreachContext` with hypotheses and evidence snippets
6. Calls `generateIntroEmail` for AI-generated subject/body
7. Atomically creates `OutreachSequence` (templateKey=AI_Intro_Draft) + `OutreachStep` + `OutreachLog` with `prospectId` set
8. Links step to log, updates contact outreach status to QUEUED

**prisma/schema.prisma** — Added `prospectId String?` + FK + index to `OutreachLog`. Added `outreachLogs OutreachLog[]` relation on `Prospect`.

**server/routers/outreach.ts** — Two changes:

- New `generateIntroDraft` mutation: resolves `prospectId` from `runId`, delegates to generate-intro.ts, returns `{ sequenceId, draftId }`
- Updated `classifyDraftRisk`: added `isAiGenerated` flag for drafts with `kind` in `[intro_draft, cadence_draft, signal_draft]`. AI drafts reach `riskLevel=low` with `evidenceBacked=true` alone — no CTA strings or `workflowLossMapId` required

## Decisions Made

1. **AI-native risk path in classifyDraftRisk** — Rather than requiring the old CTA strings (`CTA_STEP_1`/`CTA_STEP_2`) and `workflowLossMapId` for AI drafts, a `kind` metadata flag determines the path. Existing template-based drafts are unaffected.

2. **Hypothesis gate fallback** — If no hypotheses exist on the specific research run, falls back to prospect-level hypotheses. This prevents false blocks when hypotheses were approved against an older run.

3. **`void step` pattern** — The `OutreachStep` create is needed for the sequence but its return value isn't used directly (the step is linked via `outreachLogId` update). `void step` silences the warning cleanly without removing the create.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `lib/outreach/generate-intro.ts` — FOUND
- `prisma/migrations/20260316120000_outreach_log_prospect_id/migration.sql` — FOUND
- Commit 607f72d — FOUND
- Commit bd4b438 — FOUND
- `generateIntroDraft` export at line 22 — FOUND
- `generateIntroDraft:` mutation at line 335 — FOUND
- `isAiGenerated` at lines 108, 113, 121, 142 — FOUND
- `OutreachLog.prospectId String?` at line 273 — FOUND
- TypeScript: no errors in new/modified files — PASSED
