# State: Qualifai

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Every outreach message is backed by real evidence, matched to a service Klarifai actually delivers.
**Current focus:** v2.1 Production Bootstrap — Phase 26.1: Evidence Pipeline Expansion

## Current Position

Phase: 26.1 of 27 (Evidence Pipeline Expansion)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-02-28 — Phase 26.1-01 completed (LINKEDIN/NEWS schema foundation + SERP domain filter + backfill script)

Progress: [██████░░░░] 62% (v2.1 — 9/13 plans complete)

## Milestones Shipped

- v1.0 MVP — 2026-02-20 (Phases 1-5)
- v1.1 Evidence-Backed Multi-Touch Outreach — 2026-02-21 (Phases 6-11)
- v1.2 Autopilot with Oversight — 2026-02-22 (Phases 12-15)
- v2.0 Streamlined Flow — 2026-02-23 (Phases 17-22)

## Performance Metrics

**Velocity (all milestones):**

| Milestone | Phases | Plans   | Timeline   |
| --------- | ------ | ------- | ---------- |
| v1.0      | 5      | —       | Feb 20     |
| v1.1      | 6      | 16      | Feb 20-21  |
| v1.2      | 4      | 11      | Feb 21-22  |
| v2.0      | 6      | 14      | Feb 22-23  |
| **Total** | **21** | **41+** | **4 days** |

## Accumulated Context

### Roadmap Evolution

- Phase 26.1 inserted after Phase 26: Evidence Pipeline Expansion (URGENT) — deepCrawl always-on, Scrapling for reviews, Google News RSS, LinkedIn source type fix, Trustpilot direct scrape

### Decisions (Recent)

- [Phase 26.1-01]: LinkedIn evidence uses sourceType LINKEDIN (not WEBSITE) — both apollo-derived and crawl4ai sources
- [Phase 26.1-01]: CONTEXT_SOURCE_TYPES includes LINKEDIN and NEWS — external social proof counts as context for quality gate
- [Phase 26.1-01]: Own-domain filtering added to discoverGoogleSearchMentions to prevent duplicate SERP + WEBSITE evidence
- [Phase 26.1-01]: Installed @types/pg devDependency — fixes pre-existing TS7016 in scripts/rerun-hypotheses.ts too
- [Phase 25-03]: generateHypothesisDraftsAI is primary generator; old templates renamed generateFallbackHypothesisDrafts (internal fallback, not exported)
- [Phase 25-03]: Hypothesis re-run bug deferred to Phase 26 — re-run does not clear old hypotheses before inserting new ones (creates template + AI duplicate rows)
- [Phase 25-04]: Use DynamicFetcher (not PlayWrightFetcher) — correct class name in Scrapling 0.4.1
- [Phase 25-04]: Run sync Scrapling fetchers in ThreadPoolExecutor to avoid asyncio event loop conflict
- [Phase 25-04]: Override Scrapling base image ENTRYPOINT with uv run uvicorn to access venv
- [Phase 22]: Admin reviews research quality, not hypothesis content — prospect validates own pain points on /voor/
- [Phase 20]: Idempotency guard must ship in same phase as one-click send UI — never separate
- [v2.1 scope]: SEED-01/02 are new features (build first); DISC-01/02 use existing Phase 21 Apollo search (validate only)
- [2026-02-24]: Added v2.2 milestone (Phases 28-30) for verified pain intelligence: source discovery, browser extraction, and hard pain-confirmation outreach gate

### Pending Todos

- Calibrate amber/green quality thresholds against real prospect data (becomes QUAL-01 in Phase 26)
- Run real prospect validation session on /voor/ before building features that depend on hypothesis confirmation signal
- Plan Phase 28 with concrete Google/sitemap/manual discovery architecture and data model updates

### Tech Debt (Carried Forward)

- SERP cache re-read after overwrite (Phase 8 bug) — cache on re-runs always treated as stale
- List-view traffic light uses hardcoded approximation (sourceTypeCount=1, confidence=0.65) — fixed in Phase 26 (QUAL-02)
- Unused logoUrl prop in DashboardClient interface
- Old construction-industry templates not cleared on research re-run — old + new hypotheses co-exist in DB; delete-before-insert needed in executeResearchRun (Phase 26)
- Hypothesis insertion lacks idempotency guard — duplicate entries on double re-run for deondernemer.nl and motiondesignawards.com (Phase 26)

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-28
Stopped at: Phase 26.1-01 complete (LINKEDIN/NEWS schema foundation, SERP domain filter, backfill script)
Resume with: Phase 26.1-02 (next evidence pipeline expansion plan)
