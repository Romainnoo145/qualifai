# State: Qualifai

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every outreach message is backed by real evidence, matched to a service Klarifai actually delivers.
**Current focus:** v1.1 Phase 8 — Deep Evidence Pipeline

## Current Position

Phase: 8 of 10 (Deep Evidence Pipeline)
Plan: 3 of 3 in current phase
Status: Phase 8 complete — all 3 plans done (SerpAPI discovery, Crawl4AI extraction, pipeline wiring)
Last activity: 2026-02-21 — Phase 8 Plan 3 complete (deepCrawl pipeline wiring, 2 tasks)

Progress: [█████░░░░░] 50% (v1.1)

## Performance Metrics

**Velocity:**

- Total plans completed: 7 (v1.1)
- Average duration: 4.1 min
- Total execution time: 38 min

**By Phase:**

| Phase                     | Plans | Total  | Avg/Plan |
| ------------------------- | ----- | ------ | -------- |
| 6. Use Cases Foundation   | 3/3   | 13 min | 4.3 min  |
| 7. Evidence Approval Gate | 2/2   | 6 min  | 3 min    |
| 8. Deep Evidence Pipeline | 3/3   | ~21min | ~7min    |
| 9. Engagement Triggers    | 0/3   | —      | —        |
| 10. Cadence Engine        | 0/5   | —      | —        |

_Updated after each plan completion_

## Accumulated Context

### Decisions

- UseCase model built first — proof matching, cadence scoring, and admin workflow all depend on it
- UseCase.delete is soft delete (isActive=false) — consistent with Campaign pattern, preserves ProofMatch history
- importFromObsidian uses sourceRef (Obsidian proofId) as idempotency key — re-running never creates duplicates
- Empty externalUrl string converted to null at persistence layer — Zod rejects empty URL strings so handled explicitly
- UseCaseForm extracted as sub-component for both create and inline edit — avoids duplicating 100-line form
- tRPC timestamps arrive as strings not Dates — UseCase type uses string | Date for createdAt/updatedAt
- Lazy Anthropic client initialization via getAnthropicClient() — prevents env access at module load time which breaks test isolation
- matchProofs() accepts PrismaClient as explicit db parameter — keeps function testable with mock, no module-level DB singleton
- Keyword-overlap fallback in matchProofs() — activates automatically when Claude Haiku API call fails
- Evidence approval gate (Phase 7) wired before new evidence sources (Phase 8) — prevents SerpAPI results bypassing review
- Playwright never in Next.js request cycle — use managed browser API (Browserless/ScrapingBee) in Phase 8
- Email opens excluded from cadence escalation — Apple MPP causes 40-60% false positives
- Cadence timestamps in DB columns (OutreachStep.scheduledAt, nextStepReadyAt), not JSON metadata
- SerpAPI caching mandatory from Phase 8 day one — cost compounds fast without it
- Hypothesis gate in runAutopilot placed BEFORE executeResearchRun — checking after would always block (fresh DRAFT hypotheses)
- listAll does not resolve evidenceRefs — lightweight for list page, evidence detail only in listByProspect
- Used alert() for PRECONDITION_FAILED surfacing — sonner not imported in prospect page, alert is sufficient for now
- Skipped disabled state on Queue Outreach button — hypotheses data not in LossMapTab scope, backend gate + onError is the correct guard
- Evidence URL fallback uses ev.title ?? ev.sourceUrl — no URL parsing, truncation handles long URLs via CSS
- discoverSerpUrls accesses process.env.SERP_API_KEY directly (not env.mjs) — keeps module testable without full env setup
- Google Maps uses two-step SerpAPI flow: google_maps fetches data_id, google_maps_reviews uses data_id — mapsDataId returned for cache persistence
- Each SerpAPI engine call wrapped in independent try/catch — failures are logged but non-blocking, returns partial results
- SerpAPI results capped at 5 reviewUrls and 5 jobUrls — controls downstream Crawl4AI scraping cost
- Crawl4AI REST API requires {type: ClassName, params: {...}} wrapping for all config objects — not optional, verified by test
- magic: true + simulate_user: true in Crawl4AI CrawlerRunConfig handles cookie consent banners without explicit DOM interaction
- Crawl4AI fallback drafts use sourceType REVIEWS regardless of URL — minimal content is ambiguous, safer as manual review signal
- 60s AbortController timeout for Crawl4AI — browser rendering is slow, short timeouts produce excessive fallbacks
- Crawl4AI ingest caps at 10 URLs per batch — prevents runaway extraction costs in pipeline
- deepCrawl branch uses allDrafts accumulator before dedup — zero-cost default path, clean merge point for SERP evidence
- SerpAPI cache stored in ResearchRun.inputSnapshot JSON (no new column) — read from existingRunId snapshot, written on cache miss
- Cache validity checked via discoveredAt field in serpCache; isCacheValid false triggers fresh SerpAPI call + cache persist

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 8: Managed browser API selection (Browserless vs ScrapingBee) needs validation before Phase 8 planning — pricing and NL-region reliability unconfirmed as of 2026-02-20
- Phase 10: Cadence rule thresholds ("+2 days on PDF download", "close_lost after 4 touches") need product owner sign-off before implementation

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 08-03-PLAN.md — Phase 8 fully complete. deepCrawl pipeline wiring: SerpAPI discovery + Crawl4AI extraction integrated into executeResearchRun with 24h cache. Ready for Phase 9 (Engagement Triggers).
Resume file: None
