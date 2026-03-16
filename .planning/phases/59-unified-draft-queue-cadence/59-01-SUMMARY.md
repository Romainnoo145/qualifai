---
phase: 59-unified-draft-queue-cadence
plan: 01
subsystem: outreach
tags: [cadence, signals, outreach, prisma, evidence, ProspectAnalysis]

# Dependency graph
requires:
  - phase: 58-signal-to-draft-pipeline
    provides: Signal model, processSignal function, OutreachLog schema with prospectId column
  - phase: 56-unified-ai-intro-draft
    provides: EvidenceContext type, OutreachContext evidence/signal fields, generateFollowUp function

provides:
  - Cadence follow-up emails enriched with ProspectAnalysis narrative and recent signal context
  - prospectId denormalized on all cadence OutreachLog records (email drafts + reminders)
  - prospectId and kind metadata on signal-triggered OutreachLog records
  - getDraftsForProspect can now surface cadence drafts, cadence reminders, and signal drafts

affects:
  - 59-02-draft-queue-ui (draft queue reads prospectId for per-prospect grouping)
  - any caller of processDueCadenceSteps or processSignal

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Evidence loading in cadence engine — ProspectAnalysis.findFirst with analysis-v2 guard
    - Non-fatal evidence loading — try/catch around ProspectAnalysis and signal queries
    - 30-day signal window for cadence follow-up signal context

key-files:
  created: []
  modified:
    - lib/cadence/engine.ts
    - lib/automation/processor.ts

key-decisions:
  - 'evidence + signal loading is non-fatal in cadence engine — failure never aborts draft creation'
  - 'EvidenceContext sourced from ProspectAnalysis sections (analysis-v2 only) — v1 data skipped'
  - 'Evidence cap: executiveSummary + up to 3 sections = max 4 items fed to follow-up prompt'
  - "kind: 'signal_draft' added to signal OutreachLog metadata for draft queue UI labeling"

patterns-established:
  - 'Cadence evidence loading: findFirst analysis-v2, unshift executiveSummary, slice 3 sections'
  - 'Signal context: findFirst with 30-day detectedAt window, non-fatal try/catch'

requirements-completed: [CDNC-01, CDNC-02, CDNC-04]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 59 Plan 01: Evidence-Enriched Cadence Follow-Ups + prospectId Denormalization Summary

**Cadence follow-up generation enriched with ProspectAnalysis narrative and 30-day signal context; prospectId denormalized on all OutreachLog types for getDraftsForProspect visibility**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-16T07:42:28Z
- **Completed:** 2026-03-16T07:44:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `buildCadenceOutreachContext` now accepts `evidence` and `signal` optional params and passes them to OutreachContext
- `processDueCadenceSteps` loads latest ProspectAnalysis (analysis-v2 guard) and extracts executiveSummary + up to 3 sections as EvidenceContext items
- `processDueCadenceSteps` loads most recent signal (30-day window) as signal context for follow-up prompt
- Both email draft and reminder OutreachLog creates in `processDueCadenceSteps` now include `prospectId`
- Signal-triggered OutreachLog in `processSignal` now includes `prospectId: prospect.id` and `kind: 'signal_draft'` metadata

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich cadence follow-up context with ProspectAnalysis + signals + fix prospectId** - `5331545` (feat)
2. **Task 2: Fix prospectId on signal-triggered OutreachLog in processor.ts** - `d931bfb` (feat)

## Files Created/Modified

- `lib/cadence/engine.ts` - EvidenceContext import, evidence/signal params on buildCadenceOutreachContext, ProspectAnalysis loading, signal loading, prospectId on both OutreachLog creates
- `lib/automation/processor.ts` - prospectId and kind: 'signal_draft' on signal OutreachLog create

## Decisions Made

- Evidence loading is wrapped in non-fatal try/catch — a failed ProspectAnalysis query never blocks draft creation, it just produces a draft with no evidence context
- Only analysis-v2 content is consumed — v1 content has a different structure and is deprecated
- Evidence cap set to executiveSummary + top 3 sections (max 4 items) to keep follow-up prompts focused
- `kind: 'signal_draft'` added alongside existing ruleId/signalId keys (not replacing them) to allow queue UI to label draft type without breaking existing metadata consumers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in `app/admin/outreach/page.tsx` (file was already modified before this plan). Confirmed via `git stash` baseline check — errors pre-exist, not caused by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Evidence-enriched cadence drafts ready for testing via `processDueCadenceSteps` cron sweep
- All OutreachLog types (intro, cadence, signal) now carry prospectId — draft queue UI (59-02) can group by prospect
- No blockers

---

_Phase: 59-unified-draft-queue-cadence_
_Completed: 2026-03-16_
