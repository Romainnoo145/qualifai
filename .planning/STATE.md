# State: Qualifai

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every outreach message is backed by real evidence, matched to a service Klarifai actually delivers.
**Current focus:** v1.1 Phase 11 — Prospect Dashboard

## Current Position

Phase: 10 of 11 (Cadence Engine) — COMPLETE
Plan: 4 of 4 in current phase
Status: Phase 10 verified (5/5 must-haves). Ready for Phase 11
Last activity: 2026-02-21 — Phase 10 verified and complete (schema migration, cadence engine TDD, wiring, CadenceTab UI)

Progress: [█████████░] 90% (v1.1)

## Performance Metrics

**Velocity:**

- Total plans completed: 12 (v1.1)
- Average duration: 3.5 min
- Total execution time: 46 min

**By Phase:**

| Phase                     | Plans | Total  | Avg/Plan |
| ------------------------- | ----- | ------ | -------- |
| 6. Use Cases Foundation   | 3/3   | 13 min | 4.3 min  |
| 7. Evidence Approval Gate | 2/2   | 6 min  | 3 min    |
| 8. Deep Evidence Pipeline | 3/3   | ~21min | ~7min    |
| 9. Engagement Triggers    | 2/2   | ~5min  | ~2.5min  |
| 10. Cadence Engine        | 4/4   | 7 min  | 1.75 min |
| 11. Prospect Dashboard    | 0/?   | —      | —        |

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
- Resend webhook verification uses resend.webhooks.verify() (Svix), not node:crypto HMAC — multi-header signing requires Svix library
- resendMessageId stored in OutreachLog.metadata JSON (not separate column) — webhook correlation via Prisma path query
- openedAt only set when currently null — preserves first open timestamp, ignores subsequent opens from same email
- RESEND_WEBHOOK_SECRET defined as optional in env.mjs — returns 500 if missing at runtime, matching calcom pattern
- Dedup guard built directly into createEngagementCallTask — dedup IS the first step of task creation, 09-03 plan consolidated here
- Contact resolution for engagement triggers: OutreachSequence.contactId first (active outreach), then earliest non-opted-out Contact
- TriggerSource type (wizard_step3, pdf_download, interested_reply) constrains all call sites at compile time
- Engagement dedup key: (prospectId via contact relation, triggerSource via metadata JSON path) — matches calcom/route.ts bookingUid dedup pattern
- [Phase 10-cadence-engine]: triggeredBy stored as String? not Prisma enum — accommodates TriggerSource values without parallel enum migration
- [Phase 10-cadence-engine]: nextStepReadyAt indexed via @@index([nextStepReadyAt]) — enables efficient cron sweep query WHERE nextStepReadyAt <= NOW()
- [Phase 10-02]: buildCadenceState is a pure function (no DB) — enables deterministic unit testing without mocks, same pattern as matchProofs
- [Phase 10-02]: EngagementSignals interface has no openedAt field — email opens excluded at type level, locked decision enforced at compile time
- [Phase 10-02]: evaluateCadence counts SENT and QUEUED steps as completed — DRAFTED steps are pending, not completed, so don't contribute to exhaustion
- [Phase 10-02]: nextScheduledAt returns null when no prior touches — prevents cron sweep from immediately firing on brand-new sequences
- [Phase 10-03]: resolveSequenceId checks metadata.outreachSequenceId first — cadence-created tasks carry this, skips unnecessary DB query
- [Phase 10-03]: getCadenceState includes full sequence+steps+contact include — Phase 10-04 UI needs full structure
- [Phase 10-03]: getCadenceState engagementLevel computed at query time from wizardSession — no persisted field needed
- [Phase 10-04]: tRPC deeply-inferred getCadenceState return type causes TS2589 — cast sequences to any[] at component boundary, typed inner callbacks maintain correctness
- [Phase 10-04]: Cadence tab placed last in prospect detail tab array — cadence monitoring is final step of prospect workflow after outreach sequences sent

### Roadmap Evolution

- Phase 11 added: Prospect Dashboard — upgrade wizard to evidence-backed dashboard with multi-channel contact, one-click quotes, readable URLs

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 8: Managed browser API selection (Browserless vs ScrapingBee) needs validation before Phase 8 planning — pricing and NL-region reliability unconfirmed as of 2026-02-20
- Phase 10: Cadence rule thresholds ("+2 days on PDF download", "close_lost after 4 touches") need product owner sign-off before implementation

## Session Continuity

Last session: 2026-02-21
Stopped at: Phase 10 verified and complete (5/5 must-haves). Cadence engine ships: schema migration (scheduledAt/triggeredBy/nextStepReadyAt), buildCadenceState/evaluateCadence/processDueCadenceSteps with 14 unit tests, completeTouchTask hook, cron sweep route, getCadenceState tRPC query, CadenceTab UI in prospect detail. Ready for Phase 11 (Prospect Dashboard).
Resume file: None
