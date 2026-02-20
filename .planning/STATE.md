# State: Qualifai

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every outreach message is backed by real evidence, matched to a service Klarifai actually delivers.
**Current focus:** v1.1 Phase 9 — Engagement Triggers

## Current Position

Phase: 9 of 11 (Engagement Triggers)
Plan: 2 of 3 in current phase
Status: Plan 09-02 complete — ENGAG-01, ENGAG-02, ENGAG-03 satisfied. Dedup guard consolidated into utility (09-03 may be implicit complete).
Last activity: 2026-02-20 — Phase 9 Plan 02 complete (engagement trigger utility, wizard/reply wiring)

Progress: [███████░░░] 70% (v1.1)

## Performance Metrics

**Velocity:**

- Total plans completed: 8 (v1.1)
- Average duration: 4.1 min
- Total execution time: 38 min

**By Phase:**

| Phase                     | Plans | Total  | Avg/Plan |
| ------------------------- | ----- | ------ | -------- |
| 6. Use Cases Foundation   | 3/3   | 13 min | 4.3 min  |
| 7. Evidence Approval Gate | 2/2   | 6 min  | 3 min    |
| 8. Deep Evidence Pipeline | 3/3   | ~21min | ~7min    |
| 9. Engagement Triggers    | 2/3   | ~5min  | ~2.5min  |
| 10. Cadence Engine        | 0/5   | —      | —        |
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

### Roadmap Evolution

- Phase 11 added: Prospect Dashboard — upgrade wizard to evidence-backed dashboard with multi-channel contact, one-click quotes, readable URLs

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 8: Managed browser API selection (Browserless vs ScrapingBee) needs validation before Phase 8 planning — pricing and NL-region reliability unconfirmed as of 2026-02-20
- Phase 10: Cadence rule thresholds ("+2 days on PDF download", "close_lost after 4 touches") need product owner sign-off before implementation

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 09-01-PLAN.md — Resend webhook route with Svix verification, email.opened/clicked capture, resendMessageId stored at send time. ENGAG-04/05 satisfied. (Executed after 09-02 due to parallel agent ordering.)
Resume file: None
