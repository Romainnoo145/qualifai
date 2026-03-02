# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers.
**Current focus:** Phase 34 — AI Metric Derivation

## Current Position

Phase: 34 of 35 (AI Metric Derivation)
Plan: 2 of 3 in current phase (Plan 02 complete)
Status: Plan 02 complete (AI metric derivation implementation — all 5 MODEL-03/ANLYS-09 tests GREEN; primarySourceType in DB + UI badge)
Last activity: 2026-03-02 — Plan 34-02 complete (3 tasks: clamp helpers + prompt + mapping; DB column + migration; UI badge; 3 commits: e930342, b1c5fd7, f434844; TypeScript clean; 36/37 tests passing)

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

| Milestone                         | Phases | Plans   | Timeline     |
| --------------------------------- | ------ | ------- | ------------ |
| v1.0                              | 5      | —       | Feb 20       |
| v1.1                              | 6      | 16      | Feb 20-21    |
| v1.2                              | 4      | 11      | Feb 21-22    |
| v2.0                              | 6      | 14      | Feb 22-23    |
| v2.1                              | 7      | 16      | Feb 23-Mar 2 |
| v2.2                              | 3      | 9       | Mar 2        |
| **Total**                         | **31** | **66+** | **11 days**  |
| Phase 31 P02                      | 7      | 2 tasks | 3 files      |
| Phase 31 P03                      | 7      | 2 tasks | 3 files      |
| Phase 34-ai-metric-derivation P02 | 25     | 3 tasks | 5 files      |

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
- Phase 31-03: tRPC quality gate E2E test uses appRouter.createCaller with module-level vi.mock; sendOutreachEmail mocked after gate so full gate logic runs
- Phase 32-01: TDD RED scaffold — Gemini mock (vi.mock @google/generative-ai) with module-level lastCapturedPrompt capture; confirmedPainTags: string[] = [] added to generateHypothesisDraftsAI signature; 9 tests fail RED for correct ANLYS reasons
- Phase 32-02: Prompt rewrite — SOURCE TYPE GUIDE + ANTI-PARROTING RULE + signal summary + dynamic count (targetCount from confirmedPainTags.length) + source-calibrated confidence table (REVIEWS 0.80-0.95, CAREERS/LINKEDIN 0.70-0.80, WEBSITE 0.60-0.65) + hasQuote() post-parse validation; all 7 ANLYS tests GREEN; research-executor.ts call site passes gate.confirmedPainTags
- Phase 33-01: TDD RED scaffold — mockAnthropicCreate vi.fn() replacing hardcoded rejection stub; makeClaudeHypothesisResponse factory with <reasoning>+JSON shape; hypothesisModel: 'gemini-flash' | 'claude-sonnet' = 'gemini-flash' parameter added to generateHypothesisDraftsAI (void stub); 5 new tests (MODEL-01 x3, ANLYS-08 x2); 2 RED for correct reasons (Claude path not routed, CoT prompt not added)
- Phase 33-02: Implementation — CLAUDE_MODEL_SONNET = 'claude-sonnet-4-5'; getAnthropicClient() lazy init; extractHypothesisJson() shared helper strips <reasoning> before JSON parse; CoT prompt block added; model branching (claude-sonnet → Anthropic SDK, else → Gemini); hypothesisModel threaded tRPC startRun → executeResearchRun → generateHypothesisDraftsAI; persisted in all 4 inputSnapshot writes; retryRun reads from snapshot; all MODEL-01 + ANLYS-08 GREEN
- Phase 34-01: TDD RED scaffold — mock factories extended with optional metric fields and primarySourceType (default mock hoursSavedWeekMid: 12 vs METRIC_DEFAULTS: 8); MODEL-03 clamping test uses toBe(80) not toBeLessThanOrEqual(80) to avoid coincidental pass with METRIC_DEFAULTS; HypothesisDraft interface extended with primarySourceType: string | null; null stubs in all 7 return sites; 4 of 5 new tests fail RED for correct reasons
- [Phase 34-02]: Tuple cast .sort() as [number, number, number] to avoid number|undefined TypeScript inference from array destructure
- [Phase 34-02]: primarySourceType column placed before status in WorkflowHypothesis schema to avoid merge conflict with AutomationOpportunity identical trailing fields

### Pending Todos

- [x] Capture golden baseline JSON from all 7 real prospects — DONE (31-03, .planning/baselines/baselines.json)
- Run /discover/ validation session with real prospect (Phase 35)
- Crawl4AI v0.8.x feature verification — consent popup, shadow DOM (Phase 35)
- Pain gate calibration SQL against real prospect data (Phase 35)

### Blockers/Concerns

- Phase 34-03 (final integration / baseline validation): validate AI-derived metrics against real prospect baseline; confirm primarySourceType appears in UI for freshly researched prospects.
- Phase 32 (Prompt Rewrite): Variable hypothesis count requires downstream audit of UI and outreach templates before changing count — this is a breaking interface change.

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 34-02-PLAN.md — AI metric derivation implementation (3 tasks, 3 commits: e930342, b1c5fd7, f434844). Plan 34-02 complete.
Resume file: None
