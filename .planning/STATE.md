# State: Qualifai

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers.
**Current focus:** v2.2 Verified Pain Intelligence — Phases 28-30 (source discovery, browser extraction, pain confirmation gate + audit)

## Current Position

Phase: 30 — Pain Confirmation Gate + Override Audit
Plan: 04 (complete) — Bypassed badge in prospect list + Override History panel on prospect detail
Status: Phase 30 COMPLETE (All plans: 30-01, 30-02, 30-03, 30-04 done)
Last activity: 2026-03-02 — Completed 30-04 Bypassed badge + Override History UI

Progress: [==========] ~100% (v2.2: 3/3 phases complete, 9 plans done)

## Milestones Shipped

- v1.0 MVP — 2026-02-20 (Phases 1-5)
- v1.1 Evidence-Backed Multi-Touch Outreach — 2026-02-21 (Phases 6-11)
- v1.2 Autopilot with Oversight — 2026-02-22 (Phases 12-15)
- v2.0 Streamlined Flow — 2026-02-23 (Phases 17-22)
- v2.1 Production Bootstrap — 2026-03-02 (Phases 23-27.1)

## Performance Metrics

**Velocity (all milestones):**

| Milestone    | Phases | Plans   | Timeline     |
| ------------ | ------ | ------- | ------------ |
| v1.0         | 5      | —       | Feb 20       |
| v1.1         | 6      | 16      | Feb 20-21    |
| v1.2         | 4      | 11      | Feb 21-22    |
| v2.0         | 6      | 14      | Feb 22-23    |
| v2.1         | 7      | 16      | Feb 23-Mar 2 |
| **Total**    | **28** | **57+** | **11 days**  |
| Phase 28 P02 | 5      | 2 tasks | 2 files      |

## Accumulated Context

### Architectural Decisions (v2.2)

- SourceSetSection is debug-only UI — hidden by default, toggled via `localStorage.setItem('qualifai-debug', 'true')` in browser console; backend provenance tracking unchanged
- Debug-only UI pattern: guard render with `{debugMode && ...}` where `useDebugMode` uses `useSyncExternalStore` on localStorage key `qualifai-debug`

- Pain gate is advisory-only — AMBER quality gate remains the single hard block; pain confirmation is a second signal, not a second block
- computePainTagConfirmation uses isPlaceholder() exclusion (notFound/fallback), NOT aiRelevance — low-relevance items count for cross-source coverage; aiRelevance filtering is confidence-average-only
- PAIN_CONFIRMATION_MIN_SOURCES = 2 in quality-config.ts (client-safe module); pain tag arrays in QualityGateResult but never added to reasons (advisory-only contract)
- Two-tier extraction implemented (Phase 29-01): stealth-first for static pages, Crawl4AI for <500 chars or jsHeavyHint=true; 5-URL budget cap; raw fetch() removed; BROWSER_BUDGET_MAX=5 exported constant; processCrawl4aiResult shared handler; REVIEWS routing uses inferSourceType() not storage-mapped type; 404 detection before 80-char minimum
- jsHeavyHints wiring complete (Phase 29-02): research-executor builds Map from initialSourceSet.urls and passes to ingestWebsiteEvidenceDrafts — avoids detectJsHeavy() re-computation; deepCrawl ingestCrawl4aiEvidenceDrafts call untouched (separate budget path)
- SerpAPI cache guarded at prospect level via serpDiscoveredAt timestamp — skip if <24h old, never trigger at import time
- GateOverrideAudit is a proper relational model (not JSON in inputSnapshot) — enables querying, joining to prospect/user tables; SHIPPED in Phase 30-02
- GateOverrideAudit onDelete: Restrict on researchRunId FK — audit trail is permanent; ResearchRun cannot be deleted once it has audits
- GateOverrideAudit idempotency: qualityApproved === null pre-check ensures only first approval creates audit row (no unique constraint needed)
- Pain tags extracted from summary.gate.confirmedPainTags/unconfirmedPainTags — no new schema column on ResearchRun (STATE.md deferred decision honored)
- 12-char reason guard in approveQuality extended to cover unconfirmedPainTags.length > 0 in addition to !gatePassed
- Pain gate thresholds must be calibrated against 7 real prospects before writing constants — run calibration SQL first
- Schema migration (GateOverrideAudit model) COMPLETE — applied to qualifai-db in Phase 30-02
- painGatePassed/painGateDetails NOT added as ResearchRun schema columns — use summary.gate.confirmedPainTags/unconfirmedPainTags (deferred decision honored)
- Phases 28 and 29 can ship to production before Phase 30 schema migration runs
- source-discovery.ts is a pure module (zero side effects, no Prisma) — CAPS.serp=15 (5 review + 5 job + 5 search), defaultResearchUrls has 19 paths verbatim from research-executor.ts
- Dual-phase sourceSet: initial (sitemap+default) at run create, full (sitemap+serp+default) after deepCrawl SERP — avoids restructuring existing pipeline
- researchUrls derived from sourceSet.urls filtered to non-serp provenance — SERP URLs feed Crawl4AI, not website ingestion (matches existing behavior)
- rediscoverSources mutation: toJson defined inline in router (research-executor does not export it); spreads existing snapshot fields to preserve manualUrls/campaignId/deepCrawl
- Bypassed badge: amber pill rendered inline with PipelineChip/QualityChip in prospect list; uses gateOverrideAudits \_count from listProspects — no extra query
- Override History panel: placed in evidence tab on prospect detail, conditional on data.length > 0; gateType color semantics: amber=pain (advisory), rose=quality/quality+pain (hard block)
- TS2589 workaround pattern for listOverrideAudits: cast result as any[] with inline type annotation — matches existing any-cast pattern for researchRun.summary

### Pending Todos

- Run real prospect validation session on /discover/ before building features that depend on hypothesis confirmation signal
- Verify Crawl4AI service is on v0.8.x before Phase 29 ships (remove_consent_popups and flatten_shadow_dom are v0.8.x features)
- Run pain gate calibration SQL against 7 real prospects before writing PAIN*GATE*\* constants in quality-config.ts

### Tech Debt (Carried Forward)

- SERP cache re-read after overwrite (Phase 8 bug) — now mitigated by sourceSet.serpDiscoveredAt as primary guard; legacy serpCache remains as fallback
- Unused logoUrl prop in DashboardClient interface
- E2E send test bypasses tRPC quality gate (calls Resend directly)
- Detail-view uses `(researchRuns.data[0] as any).summary` cast

### Blockers/Concerns

- (none)

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 30-04-PLAN.md (Bypassed badge + Override History UI)
Resume with: v2.2 milestone complete — all phases 28-30 done. Ready for milestone archive or new milestone definition.
