---
phase: 55-evidence-enriched-ai-context
plan: 01
subsystem: outreach
tags: [consolidation, ai-context, evidence, refactor]
dependency_graph:
  requires: []
  provides:
    [
      shared-loadProjectSender,
      EvidenceContext,
      HypothesisContext,
      OutreachContext-evidence,
    ]
  affects:
    [
      lib/automation/processor.ts,
      server/routers/outreach.ts,
      lib/cadence/engine.ts,
      lib/ai/outreach-prompts.ts,
    ]
tech_stack:
  added: []
  patterns:
    [
      shared-module-extraction,
      optional-context-fields,
      conditional-prompt-injection,
    ]
key_files:
  created:
    - lib/outreach/sender.ts
  modified:
    - lib/ai/outreach-prompts.ts
    - lib/automation/processor.ts
    - server/routers/outreach.ts
    - lib/cadence/engine.ts
decisions:
  - 'Used type-only import in sender.ts (OutreachSender) to avoid circular imports'
  - 'Kept OutreachSender import in engine.ts — still used in buildCadenceOutreachContext function signature'
  - 'Non-breaking: optional evidence/hypotheses fields default to undefined, existing callers unaffected'
metrics:
  duration_seconds: 196
  completed_date: 2026-03-16
  tasks_completed: 2
  files_changed: 5
---

# Phase 55 Plan 01: Shared loadProjectSender + Evidence-Enriched OutreachContext Summary

**One-liner:** Consolidated three duplicate loadProjectSender implementations into a single shared module and extended OutreachContext with optional evidence/hypothesis fields that inject structured research data into AI email prompts.

## Tasks Completed

| Task | Name                                                   | Commit  | Files                                                              |
| ---- | ------------------------------------------------------ | ------- | ------------------------------------------------------------------ |
| 1    | Extract loadProjectSender into shared module           | d6dc0c6 | lib/outreach/sender.ts (new), processor.ts, outreach.ts, engine.ts |
| 2    | Extend OutreachContext with evidence/hypothesis fields | b1965c4 | lib/ai/outreach-prompts.ts                                         |

## What Was Built

### Task 1 — Shared loadProjectSender

Created `lib/outreach/sender.ts` as the single source of truth for loading project outreach sender settings from the database. The implementation uses the most complete version (from `server/routers/outreach.ts`) which includes `languageOverride` support.

Three consumers were rewired:

- `lib/automation/processor.ts` — removed local function, now imports from shared module
- `server/routers/outreach.ts` — removed local function, now imports from shared module
- `lib/cadence/engine.ts` — replaced inline 18-line sender block with single `loadProjectSender(db, projectId)` call

### Task 2 — Evidence-Enriched OutreachContext

Added two new exported interfaces to `lib/ai/outreach-prompts.ts`:

- `EvidenceContext` — sourceType, snippet, title for individual evidence items
- `HypothesisContext` — title and problemStatement for validated pain points

Extended `OutreachContext` with two optional fields:

- `evidence?: EvidenceContext[]` — top research items (capped at 8 in prompt)
- `hypotheses?: HypothesisContext[]` — confirmed hypothesis data

Both `buildIntroEmailPrompt` and `buildFollowUpPrompt` now conditionally inject evidence and hypothesis blocks when provided. Snippets are capped at 200 chars. When no evidence is passed, prompt output is identical to before.

## Verification Results

- `grep -rn "async function loadProjectSender" lib/ server/` returns exactly 1 result (lib/outreach/sender.ts)
- `grep -c "senderProject" lib/cadence/engine.ts` returns 0
- `grep -n "export interface EvidenceContext|export interface HypothesisContext" lib/ai/outreach-prompts.ts` shows both at lines 11 and 17
- `grep -c "BEWIJS UIT PROSPECT" lib/ai/outreach-prompts.ts` returns 2
- TypeScript compiles without errors in application code

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- lib/outreach/sender.ts: FOUND
- lib/ai/outreach-prompts.ts: FOUND (modified)
- lib/automation/processor.ts: FOUND (modified)
- server/routers/outreach.ts: FOUND (modified)
- lib/cadence/engine.ts: FOUND (modified)
- Commit d6dc0c6: FOUND
- Commit b1965c4: FOUND
