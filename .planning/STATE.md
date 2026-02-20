# State: Qualifai

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every outreach message is backed by real evidence, matched to a service Klarifai actually delivers.
**Current focus:** v1.1 Phase 6 — Use Cases Foundation

## Current Position

Phase: 6 of 10 (Use Cases Foundation)
Plan: — of 3 in current phase
Status: Ready to plan
Last activity: 2026-02-20 — v1.1 roadmap created (phases 6-10 defined)

Progress: [░░░░░░░░░░] 0% (v1.1)

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.1)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase                     | Plans | Total | Avg/Plan |
| ------------------------- | ----- | ----- | -------- |
| 6. Use Cases Foundation   | 0/3   | —     | —        |
| 7. Evidence Approval Gate | 0/3   | —     | —        |
| 8. Deep Evidence Pipeline | 0/3   | —     | —        |
| 9. Engagement Triggers    | 0/3   | —     | —        |
| 10. Cadence Engine        | 0/5   | —     | —        |

_Updated after each plan completion_

## Accumulated Context

### Decisions

- UseCase model built first — proof matching, cadence scoring, and admin workflow all depend on it
- Evidence approval gate (Phase 7) wired before new evidence sources (Phase 8) — prevents SerpAPI results bypassing review
- Playwright never in Next.js request cycle — use managed browser API (Browserless/ScrapingBee) in Phase 8
- Email opens excluded from cadence escalation — Apple MPP causes 40-60% false positives
- Cadence timestamps in DB columns (OutreachStep.scheduledAt, nextStepReadyAt), not JSON metadata
- SerpAPI caching mandatory from Phase 8 day one — cost compounds fast without it

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 8: Managed browser API selection (Browserless vs ScrapingBee) needs validation before Phase 8 planning — pricing and NL-region reliability unconfirmed as of 2026-02-20
- Phase 10: Cadence rule thresholds ("+2 days on PDF download", "close_lost after 4 touches") need product owner sign-off before implementation

## Session Continuity

Last session: 2026-02-20
Stopped at: Roadmap created — v1.1 phases 6-10 defined, ready to plan Phase 6
Resume file: None
