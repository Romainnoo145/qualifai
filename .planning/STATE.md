# State: Qualifai

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Every outreach message is backed by real evidence, matched to a service Klarifai actually delivers.
**Current focus:** v1.2 — Autopilot with Oversight (Phase 13: Prospect Story Flow)

## Current Position

Phase: 13 of 16 (Prospect Story Flow)
Plan: 2 of 5
Status: In progress
Last activity: 2026-02-22 — Plan 13-02 complete (AnalysisSection with reasoning chain)

Progress: [███░░░░░░░] 38% (v1.2)

## Performance Metrics

**Velocity (v1.1):**

- Total plans completed: 16 (v1.1, including quick tasks)
- Average duration: ~3.5 min
- Total execution time: ~56 min

**By Phase (v1.1):**

| Phase                     | Plans | Total   | Avg/Plan |
| ------------------------- | ----- | ------- | -------- |
| 6. Use Cases Foundation   | 3/3   | 13 min  | 4.3 min  |
| 7. Evidence Approval Gate | 2/2   | 6 min   | 3 min    |
| 8. Deep Evidence Pipeline | 3/3   | ~21 min | ~7 min   |
| 9. Engagement Triggers    | 2/2   | ~5 min  | ~2.5 min |
| 10. Cadence Engine        | 4/4   | 7 min   | 1.75 min |
| 11. Prospect Dashboard    | 2/2   | ~6 min  | 3 min    |
| 12. Navigation & Language | 2/2   | 6 min   | 3 min    |

_Updated after each plan completion_

## Accumulated Context

### Decisions

- [Phase 12, Plan 01]: navItems is flat NavItem[] array — no group wrappers, no section labels; removed pages stay accessible via direct URL
- [Phase 12, Plan 01]: Signals label is "Signals" (not "Signals feed") for sidebar consistency
- [Phase 12, Plan 02]: Only user-visible string literals changed in TERM-01 — variable/prop names (latestLossMap, generateLossMap, CallPrepTab, etc.) left intact to avoid regressions
- [Phase 12, Plan 02]: "Workflow Reports" used for briefs page heading to match tab rename in prospect detail
- [Phase 13, Plan 01]: Mutations (startResearch, matchProof, etc.) removed from page.tsx — section components in plans 02-04 will own their own mutations locally
- [Phase 13, Plan 01]: EvidenceSection receives signals as prop from parent getProspect query (already loaded) instead of a separate query
- [Phase 13, Plan 02]: tRPC deep inference TS2589 avoided by casting listByProspect result as any at call site, re-mapped via typed toFinding() helper
- [Phase 13, Plan 02]: setHypothesisStatus mutation defined in page.tsx (not AnalysisSection) — needs prospectId for cache invalidation, already in page scope

Recent decisions affecting v1.2 work:

- [v1.2 scope]: UI/UX only — no new backend pipeline features, no new DB columns for campaigns (reuse existing Campaign/CampaignProspect models)
- [v1.2 scope]: TERM cleanup spread across phases (not isolated) — TERM-01 in Phase 12, TERM-02 in Phase 13
- [Phase 11]: glass-card CSS class overrides Tailwind bg colors — avoid combining with dark backgrounds
- [Phase 11]: /voor/ and /discover/ routes serve different components — keep both for backward compat
- [Phase 10]: Email opens excluded from cadence escalation — Apple MPP causes 40-60% false positives
- [Phase 7]: Hypotheses must be manually approved (DRAFT → ACCEPTED) — auto-accept removed

### Pending Todos

None yet.

### Roadmap Evolution

- Phase 16 added: Draft Queue Redesign — one-click-per-action outreach queue (user feedback: current Draft Queue is too complex for "autopilot with oversight" vision)

### Blockers/Concerns

None identified for v1.2 phases.

### Quick Tasks Completed

| #   | Description                                                                                  | Date       | Commit  | Directory                                                                                         |
| --- | -------------------------------------------------------------------------------------------- | ---------- | ------- | ------------------------------------------------------------------------------------------------- |
| 1   | Merge search into prospects page, restructure detail page, fix CTA cards on /voor/ dashboard | 2026-02-21 | 42fd9ee | [1-commit-search-merge-detail-page-restruct](./quick/1-commit-search-merge-detail-page-restruct/) |

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 13-02-PLAN.md (AnalysisSection with reasoning chain + Accept/Reject/Reset)
Resume file: None
