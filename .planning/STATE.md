# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers.
**Current focus:** Phase 31 — Tech Debt Foundation

## Current Position

Phase: 31 of 35 (Tech Debt Foundation)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-03-02 — Plan 31-02 complete (TS2589 as any casts replaced with ResearchRunRow type, typed Json guards in outreach and quality-chip)

Progress: [████████████████████░░░░░░░░░░] 66% (30 phases complete across 7 milestones)

## Milestones Shipped

- v1.0 MVP — 2026-02-20 (Phases 1-5)
- v1.1 Evidence-Backed Multi-Touch Outreach — 2026-02-21 (Phases 6-11)
- v1.2 Autopilot with Oversight — 2026-02-22 (Phases 12-15)
- v2.0 Streamlined Flow — 2026-02-23 (Phases 17-22)
- v2.1 Production Bootstrap — 2026-03-02 (Phases 23-27.1)
- v2.2 Verified Pain Intelligence — 2026-03-02 (Phases 28-30)

## Performance Metrics

**Velocity (all milestones):**

| Milestone    | Phases | Plans   | Timeline     |
| ------------ | ------ | ------- | ------------ |
| v1.0         | 5      | —       | Feb 20       |
| v1.1         | 6      | 16      | Feb 20-21    |
| v1.2         | 4      | 11      | Feb 21-22    |
| v2.0         | 6      | 14      | Feb 22-23    |
| v2.1         | 7      | 16      | Feb 23-Mar 2 |
| v2.2         | 3      | 9       | Mar 2        |
| **Total**    | **31** | **66+** | **11 days**  |
| Phase 31 P02 | 7      | 2 tasks | 3 files      |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v3.0:

- v2.2: Advisory-only pain gate (Dutch SMBs fail cross-source; gate provides visibility not block)
- v3.0 research: Gemini Flash remains default; Claude Sonnet as opt-in per-run (not global env var)
- v3.0 research: METRIC_DEFAULTS retained as last-resort fallback (not deleted) pending consumer audit
- v3.0 research: No new npm dependencies — existing @anthropic-ai/sdk ^0.73.0 covers Claude integration
- v3.0 research: generateWorkflowLossMapContent() must be audited before Phase 34 planning begins
- Phase 31-01: SERP cache guard uses only useSerpFromSourceSet (no backward-compat serpCache fallback needed)
- Phase 31-01: GEMINI_MODEL_FLASH = 'gemini-2.5-flash' — model upgraded as part of constant extraction; name not version-specific to allow Phase 33 changes
- [Phase 31]: Prisma.ResearchRunGetPayload replaces TS2589 as any casts in detail view; tRPC v11 inference gaps kept as any with TODO comment

### Pending Todos

- Capture golden baseline JSON from all 7 real prospects BEFORE Phase 32 touches any prompt text
- Run /discover/ validation session with real prospect (Phase 35)
- Crawl4AI v0.8.x feature verification — consent popup, shadow DOM (Phase 35)
- Pain gate calibration SQL against real prospect data (Phase 35)

### Blockers/Concerns

- Phase 34 (Metric Derivation): generateWorkflowLossMapContent() not read in research pass — must audit all metric field consumers before planning. Flag for plan-phase research step.
- Phase 32 (Prompt Rewrite): Variable hypothesis count requires downstream audit of UI and outreach templates before changing count — this is a breaking interface change.

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 31-02-PLAN.md — TS2589 as any replaced with ResearchRunRow type, typed Json guards in outreach and quality-chip (2 tasks, 2 commits)
Resume file: None
