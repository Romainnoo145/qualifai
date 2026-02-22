# State: Qualifai

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Every outreach message is backed by real evidence, matched to a service Klarifai actually delivers.
**Current focus:** v1.2 — Autopilot with Oversight (Phase 15: Action Queue Dashboard)

## Current Position

Phase: 15 of 16 (Action Queue Dashboard)
Plan: 1 of 2
Status: In progress
Last activity: 2026-02-22 — Plan 15-01 complete (action queue data layer)

Progress: [████████░░] 80% (v1.2)

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
| 13. Prospect Story Flow   | 5/5   | ~17 min | ~3.4 min |
| 14. Campaign Reporting    | 2/2   | ~4 min  | ~2 min   |

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
- [Phase 13]: OutreachPreviewSection owns all mutations locally (generate, queueDraft, regenerateCallBrief) — page only passes latestRunId + prospect as props
- [Phase 13]: CallPlanGrid helper component avoids TS2589 deep type inference from Prisma JsonValue
- [Phase 13, Plan 04]: ResultsSection fetches cadence state locally via tRPC; session data passed via prospect prop (already loaded by getProspect)
- [Phase 13, Plan 04]: page.tsx at 399 lines (target was 300) — all content is purposeful; no dead code found
- [Phase 13, Plan 05]: TERM-02 scope follows TERM-01 pattern — only user-visible string literals changed, variable/prop/type names left intact
- [Phase 13, Plan 05]: Label maps (WORKFLOW_TAG_LABELS, OUTREACH_STATUS_LABELS, OUTREACH_TYPE_LABELS) co-located at file top with ?? fallback for unknown enum values
- [Phase 14, Plan 01]: nicheKey defaults to 'generic_b2b' when segment description field left blank — avoids hardcoded option list
- [Phase 14, Plan 01]: getWithFunnelData uses two separate groupBy queries (researchRuns + workflowHypotheses) to avoid TS2589 — same pattern as Phase 13
- [Phase 14, Plan 01]: Campaigns list page removes autopilot and prospect assignment UI — both belong on campaign detail page (Plan 02)
- [Phase 14, Plan 02]: api.admin.listProspects cast as any + re-typed in AddProspectPanel to avoid TS2589 — consistent with Phase 13 pattern
- [Phase 14, Plan 02]: Campaign detail page uses STAGE_ORDER array for prospect sort instead of numeric priority map — simpler and avoids duplication with backend stagePriority
- [Phase 15, Plan 01]: parseDueAt helper duplicated in admin.ts (not imported from outreach.ts) to avoid circular dependency
- [Phase 15, Plan 01]: getActionQueue uses Promise.all for four parallel Prisma queries — single tRPC call for dashboard, no waterfall
- [Phase 15, Plan 01]: Items sorted overdue-first then oldest createdAt — matches autopilot with oversight where overdue tasks need immediate attention

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
Stopped at: Completed 15-01-PLAN.md (getActionQueue tRPC query)
Resume file: None
