# State: Qualifai

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Every outreach message is backed by real evidence, matched to a service Klarifai actually delivers.
**Current focus:** v2.1 Production Bootstrap — Phase 27: End-to-End Cycle

## Current Position

Phase: 27 of 27 (End-to-End Cycle)
Plan: 2 of 2 in current phase
Status: In Progress (Phase 27-01 complete; Phase 27-02 reply-triage pending)
Last activity: 2026-02-28 — Phase 27-01 complete: 2 emails delivered to info@klarifai.nl inbox (not spam), confirmed by human

Progress: [█████████░] 96% (v2.1 — 15/16 plans complete)

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

- [Phase 27-01]: Verified Resend sending domain is mail.klarifai.nl (not klarifai.nl) — from address must be romano@mail.klarifai.nl for sends to be accepted
- [Phase 27-01]: Both E2E test emails delivered to info@klarifai.nl inbox (not spam) — Resend msgIds: Mujjo 976a7bb7, De Ondernemer 0b84e093
- [Phase 27-01]: DKIM for resend.\_domainkey.klarifai.nl not yet configured — required before production sends at volume
- [Phase 27-01]: DMARC policy=none (monitoring only) — should enforce p=quarantine after DKIM is confirmed working
- [Phase 27-01]: Test contacts created inline for Mujjo and De Ondernemer with primaryEmail=info@klarifai.nl
- [Phase 26-02]: Contact.prospectId is non-nullable String — direct field access in sendEmail mutation is type-safe without optional chaining
- [Phase 26-02]: computeTrafficLight imported statically into outreach router — no circular dependency (already imports from workflow-engine)
- [Phase 26-02]: Always render QualityChip in list-view (null runId → grey chip) — eliminates invisible gap for unresearched prospects
- [Phase 26-01]: MIN_AVERAGE_CONFIDENCE=0.65 retained as meaningful secondary signal — Brainport Eindhoven had 5 source types but avgConf 0.64, correctly classified AMBER
- [Phase 26-01]: Thresholds approved as-is: GREEN_MIN_SOURCE_TYPES=3, AMBER_MIN_SOURCE_TYPES=2, MIN_EVIDENCE_COUNT=3, MIN_AVERAGE_CONFIDENCE=0.65
- [Phase 26-01]: AMBER is a HARD gate (not soft warn-and-proceed) — send queue requires qualityApproved===true for AMBER prospects
- [Phase 26-01]: Active source types for quality scoring: WEBSITE, CAREERS, LINKEDIN, NEWS, REVIEWS (KVK/REGISTRY inactive — no API key)
- [Phase 26.1-02]: Google Reviews uses Google Search page (not Maps embed) — simpler to scrape, same snippet data available
- [Phase 26.1-02]: Google News uses native fetch RSS (not Scrapling) — public XML feed, no bot detection needed
- [Phase 26.1-02]: Empty-result recording mandatory for REVIEWS and NEWS — confidenceScore 0.1, notFound:true metadata distinguishes "tried/not-found" from "not-tried"
- [Phase 26.1-03]: Replaced Crawl4AI LinkedIn extraction with Scrapling StealthyFetcher (fetchLinkedInPosts) — better stealth posture
- [Phase 26.1-03]: Empty-result placeholder recorded with notFound=true when LinkedIn posts are blocked — distinguishes blocked from not-tried
- [Phase 26.1-03]: Evidence cap raised from 36 to 48 — LinkedIn posts adds up to 8 new items per pipeline run
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

- Run real prospect validation session on /voor/ before building features that depend on hypothesis confirmation signal
- Plan Phase 28 with concrete Google/sitemap/manual discovery architecture and data model updates

### Tech Debt (Carried Forward)

- SERP cache re-read after overwrite (Phase 8 bug) — cache on re-runs always treated as stale
- Unused logoUrl prop in DashboardClient interface
- Unused logoUrl prop in DashboardClient interface

### Blockers/Concerns

- Resend DKIM (`resend._domainkey.mail.klarifai.nl`) not configured in Cloudflare DNS — configure before ramping production send volume

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 27-01-PLAN.md (E2E send + delivery confirmed); Phase 27-02 reply-triage is next
Resume with: Execute Phase 27-02 — POST 2 realistic replies to the inbound webhook and verify interested/not-interested triage paths
