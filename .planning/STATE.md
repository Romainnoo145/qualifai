---
gsd_state_version: 1.0
milestone: v9.0
milestone_name: Klant Lifecycle Convergence
status: 'Roadmap ready — next action is `/gsd:plan-phase 60`'
stopped_at: Completed 60-02-PLAN.md (Quote schema foundation)
last_updated: '2026-04-13T11:25:41.951Z'
last_activity: 2026-04-13 — Roadmap created for v9.0
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 5
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers. No spray-and-pray.
**Current focus:** v9.0 Klant Lifecycle Convergence — Phase 60 (Quote Schema Foundation, ready to plan)

## Current Position

Phase: 60 — Quote Schema Foundation
Plan: — (not yet planned)
Status: Roadmap ready — next action is `/gsd:plan-phase 60`
Last activity: 2026-04-13 — Roadmap created for v9.0

**Progress bar:** ░░░░░░░░░░ 0% (0/4 phases)

## Milestones Shipped

- v1.0 MVP — 2026-02-20 (Phases 1-5)
- v1.1 Evidence-Backed Multi-Touch Outreach — 2026-02-21 (Phases 6-11)
- v1.2 Autopilot with Oversight — 2026-02-22 (Phases 12-15)
- v2.0 Streamlined Flow — 2026-02-23 (Phases 17-22)
- v2.1 Production Bootstrap — 2026-03-02 (Phases 23-27.1)
- v2.2 Verified Pain Intelligence — 2026-03-02 (Phases 28-30)
- v3.0 Sharp Analysis — 2026-03-05 (Phases 31-35)
- v4.0 Atlantis Partnership Outreach — 2026-03-07 (Phases 36-39)
- v5.0 Atlantis Intelligence — 2026-03-08 (Phases 42-45)
- v6.0 Outreach Simplification — 2026-03-08 (Phases 46-47)
- v7.0 Atlantis Discover Pipeline Rebuild — 2026-03-15 (Phases 49-54)
- v8.0 Unified Outreach Pipeline — 2026-03-16 (Phases 55-59)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Strategy decisions for v9.0 live in `klarifai-core/docs/strategy/decisions.md`:

- **Q5**: PDF rendering via separate Railway worker service, not in-process
- **Q8**: Existing klarifai-core YAMLs migrated via idempotent import script (`scripts/import-klarifai-yaml.ts`, dry-run default, `--apply` flag)
- **Q9**: Snapshot at `QUOTE_SENT` (not live render) — what client sees is frozen from the moment of sending
- **Q12**: Snapshot versioning = `snapshotAt: DateTime` + `templateVersion: String`, no counter. Applied to Quote model; existing models (ResearchRun, WorkflowLossMap, ProspectAnalysis) are separate tech-debt cleanup.
- **Q13**: Quote and Prospect have separate status enums with auto-sync via state-machine helper. One new ProspectStatus value: `QUOTE_SENT` (between ENGAGED and CONVERTED). Quote.ACCEPTED → Prospect.CONVERTED (transactional). Quote.REJECTED → Prospect remains ENGAGED.

Codebase concerns informing Phase 60 scope (see `.planning/codebase/CONCERNS.md` and `.planning/tech-debt.md`):

- ProspectStatus has scattered hardcoded string checks — Phase 60 must extract typed constants into `lib/constants/prospect-statuses.ts`
- `updateProspect` mutation accepts any state transition without validation — Phase 60 adds state-machine guard with typed error on invalid moves
- `Quote.snapshotData` must have a Zod schema at `lib/schemas/quote-snapshot.ts`, validated on every write, with type-safe accessor helper

Out of Phase 60 scope (deferred to tech-debt backlog):

- tRPC v11 `as any` inference casts in existing components (Phase 61 touches those files)
- Cadence engine config hardcoded thresholds (unrelated to Quote)
- `ResearchRun.inputSnapshot` Zod schema (separate cleanup, not Phase 60 blocker)
- Inconsistent snapshot versioning on WorkflowLossMap/ProspectAnalysis (separate cleanup)
- [Phase 60]: Plan 02: Manually-authored migration to bypass pre-existing dev DB drift, verified clean on shadow DB pre-loaded from dev schema dump
- [Phase 60]: Plan 02: Quote.replacesId self-FK added in Phase 60 (Q9) to avoid second migration in Phase 61

### Pending Todos

None.

### Blockers/Concerns

None — all Phase 60 blockers (Q5/Q8/Q9/Q12/Q13) resolved in `klarifai-core/docs/strategy/decisions.md`.

Pre-Phase 62 decisions still to make (from decisions.md "Next decisions"):

- **Q6**: Design tokens harmoniseren — resolve before Phase 62 start
- **Q7**: Auth model voor `/voorstel` pagina — resolve before Phase 62 start

Pre-Phase 63 decisions:

- **Q3**: Contracts zelf bouwen vs SignWell — locked to MVP self-built per REQUIREMENTS.md Out of Scope (SignWell deferred)

## Session Continuity

Last session: 2026-04-13T11:25:33.678Z
Stopped at: Completed 60-02-PLAN.md (Quote schema foundation)
Resume command: `/gsd:plan-phase 60`
