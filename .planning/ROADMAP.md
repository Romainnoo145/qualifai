# Roadmap: Qualifai

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-02-20)
- ✅ **v1.1 Evidence-Backed Multi-Touch Outreach** — Phases 6-11 (shipped 2026-02-21)
- ✅ **v1.2 Autopilot with Oversight** — Phases 12-15 (shipped 2026-02-22)
- ✅ **v2.0 Streamlined Flow** — Phases 17-22 (shipped 2026-02-23)
- ✅ **v2.1 Production Bootstrap** — Phases 23-27.1 (shipped 2026-03-02)
- 🆕 **v2.2 Verified Pain Intelligence** — Phases 28-30 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-02-20</summary>

Phases 1-5 delivered the foundational sales engine: Apollo enrichment + contact discovery, research pipeline (fetch + parse + evidence extraction), Workflow Loss Map + Call Prep PDF generation, outreach sequence drafting with CTA enforcement, reply webhook handling, Cal.com booking, signal tracking, public wizard, admin command center, multi-touch task queue, and Apollo plan-limit guardrails.

</details>

<details>
<summary>✅ v1.1 Evidence-Backed Multi-Touch Outreach (Phases 6-11) — SHIPPED 2026-02-21</summary>

- Phase 6: Use Cases Foundation (3/3 plans) — Use case CRUD, Obsidian import, Claude semantic matching
- Phase 7: Evidence Approval Gate (2/2 plans) — Hypothesis review, outreach gate
- Phase 8: Deep Evidence Pipeline (3/3 plans) — SerpAPI discovery, Crawl4AI extraction, pipeline wiring
- Phase 9: Engagement Triggers (2/2 plans) — Resend webhooks, wizard/PDF/reply → call tasks
- Phase 10: Cadence Engine (4/4 plans) — Multi-touch scheduling, cron processing, cadence UI
- Phase 11: Prospect Dashboard (2/2 plans) — /voor/bedrijfsnaam, multi-channel contact, quote request

</details>

<details>
<summary>✅ v1.2 Autopilot with Oversight (Phases 12-15) — SHIPPED 2026-02-22</summary>

- Phase 12: Navigation and Language (2/2 plans) — 6-item sidebar, terminology cleanup
- Phase 13: Prospect Story Flow (5/5 plans) — 4-section detail page, evidence → analysis → outreach → results
- Phase 14: Campaign Reporting (2/2 plans) — Named cohorts, funnel metrics, conversion rates
- Phase 15: Action Queue Dashboard (2/2 plans) — Unified hub, urgency indicators, direct links

</details>

<details>
<summary>✅ v2.0 Streamlined Flow (Phases 17-22) — SHIPPED 2026-02-23</summary>

- Phase 17: Evidence Pipeline Enrichment (3/3 plans) — Sitemap, Google search, KvK registry, LinkedIn
- Phase 18: Research Quality Gate (3/3 plans) — Traffic-light chip, soft override, hypothesis badges
- Phase 19: Client Hypothesis Validation (2/2 plans) — /voor/ confirm/decline, prospectProcedure middleware
- Phase 20: One-Click Send Queue + Pipeline View (3/3 plans) — Idempotency guards, pipeline chips, inline send
- Phase 21: Prospect Discovery + Cleanup (2/2 plans) — Apollo sector search, batch import, dead pages removed
- Phase 22: Hypothesis Flow Fix (1/1 plan) — DRAFT→PENDING transition, cache invalidation

</details>

<details>
<summary>✅ v2.1 Production Bootstrap (Phases 23-27.1) — SHIPPED 2026-03-02</summary>

- Phase 23: Use Case Extractors (2/2 plans) — Obsidian vault reader, AI codebase analyzer
- Phase 24: Data Population and Discovery (2/2 plans) — Klarifai service catalog, 10+ prospect import
- Phase 25: Pipeline Hardening (4/4 plans) — Real pipeline validation, error handling, AI hypotheses, Scrapling stealth fetcher
- Phase 26: Quality Calibration (2/2 plans) — Threshold calibration from real data, list-view traffic light fix
- Phase 26.1: Evidence Pipeline Expansion (3/3 plans) — LINKEDIN/NEWS source types, Google Reviews, Google News, LinkedIn posts
- Phase 27: End-to-End Cycle (2/2 plans) — 2 emails sent + delivered, 2 replies triaged
- Phase 27.1: Cal.com Booking Validation (1/1 plan) — HMAC webhook simulation, 6 DB state checks

</details>

### v2.2 Verified Pain Intelligence (Planned)

**Milestone Goal:** Confirm pain points from real external evidence using browser-rendered extraction before outreach is allowed. Better source discovery, better extraction, stricter gating with a full audit trail.

- [x] **Phase 28: Source Discovery with Provenance** — Automatic per-prospect source URL discovery with deduplication, per-source caps, and provenance labels
- [ ] **Phase 29: Browser-Rendered Evidence Extraction** — Two-tier extraction routing (stealth-first, browser escalation) with browser cap and per-type routing
- [ ] **Phase 30: Pain Confirmation Gate + Override Audit** — Cross-source pain gate (advisory), admin UI integration, and immutable override audit trail

## Phase Details

### Phase 28: Source Discovery with Provenance

**Goal**: Admin can verify exactly which source URLs were discovered for a prospect, where they came from, and that no URL explosion or API credit burn occurred.

**Depends on**: Phase 27.1 (stable end-to-end baseline)

**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05

**Success Criteria** (what must be TRUE):

1. After running research, the pipeline persists a provenance-tagged source URL list (sitemap / serp / manual / default) to `inputSnapshot.sourceSet` — inspectable by reading the research run record
2. Each discovered URL has a `jsHeavyHint` flag indicating whether browser rendering will be needed downstream
3. Re-running research on a prospect within 24 hours does not trigger new SerpAPI calls — the cached `serpDiscoveredAt` timestamp is respected
4. No single source type produces more than its configured cap of URLs — a prospect with a large sitemap does not flood the pipeline with 200+ URLs
5. Duplicate URLs discovered via different methods (sitemap + SERP returning the same page) are collapsed to a single entry before any extraction runs

**Plans:** 3/3 plans executed

Plans:

- [x] 28-01-PLAN.md — Source discovery module with TDD (types, buildSourceSet, caps, dedup, jsHeavyHint)
- [x] 28-02-PLAN.md — Research executor integration + rediscoverSources tRPC mutation
- [x] 28-03-PLAN.md — SourceSetSection UI component + prospect detail wiring (debug-only)

---

### Phase 29: Browser-Rendered Evidence Extraction

**Goal**: JS-heavy pages that previously returned empty or near-empty content now yield usable evidence, without slowing the pipeline beyond the acceptable ceiling.

**Depends on**: Phase 28 (jsHeavyHint flags and provenance-tagged sourceSet must be available)

**Requirements**: EXTR-01, EXTR-02, EXTR-03

**Success Criteria** (what must be TRUE):

1. Static pages attempt Scrapling stealth fetch first; only pages returning fewer than 500 characters escalate to Crawl4AI browser extraction
2. Pages with source types REVIEWS, CAREERS, or JOB_BOARD route directly through Crawl4AI without attempting stealth first
3. A single research run never uses browser extraction on more than 5 URLs — the pipeline enforces this cap regardless of how many JS-heavy pages are discovered

**Plans**: TBD

---

### Phase 30: Pain Confirmation Gate + Override Audit

**Goal**: Admin sees a cross-source pain confirmation status before approving outreach, and every decision to proceed despite unconfirmed pain is permanently recorded with a written reason.

**Depends on**: Phase 29 (full evidence set including browser-extracted items must be available before gate evaluates)

**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, AUDT-01, AUDT-02, AUDT-03, AUDT-04

**Success Criteria** (what must be TRUE):

1. After research completes, the system computes which workflowTags are confirmed (evidence from 2+ distinct sourceTypes) and which are only suspected (single sourceType or none)
2. The send queue displays confirmed and unconfirmed pain tags alongside the existing quality gate traffic light — admin sees both signals before clicking send
3. Proceeding with outreach that has unconfirmed pain tags requires the admin to type a reason — the form does not submit without it
4. Every gate bypass is recorded in the `GateOverrideAudit` table with actor, timestamp, reason, gate type, and point-in-time gate snapshot — the record cannot be deleted
5. Prospects where any gate was overridden display a "Bypassed" badge in the admin prospect list, and the full override history is visible on the research run detail view

**Plans**: TBD

---

## Progress

| Phase                                | Milestone | Plans Complete | Status      | Completed  |
| ------------------------------------ | --------- | -------------- | ----------- | ---------- |
| 1-5. MVP                             | v1.0      | —              | Complete    | 2026-02-20 |
| 6. Use Cases Foundation              | v1.1      | 3/3            | Complete    | 2026-02-20 |
| 7. Evidence Approval Gate            | v1.1      | 2/2            | Complete    | 2026-02-20 |
| 8. Deep Evidence Pipeline            | v1.1      | 3/3            | Complete    | 2026-02-21 |
| 9. Engagement Triggers               | v1.1      | 2/2            | Complete    | 2026-02-21 |
| 10. Cadence Engine                   | v1.1      | 4/4            | Complete    | 2026-02-21 |
| 11. Prospect Dashboard               | v1.1      | 2/2            | Complete    | 2026-02-21 |
| 12. Navigation and Language          | v1.2      | 2/2            | Complete    | 2026-02-21 |
| 13. Prospect Story Flow              | v1.2      | 5/5            | Complete    | 2026-02-22 |
| 14. Campaign Reporting               | v1.2      | 2/2            | Complete    | 2026-02-22 |
| 15. Action Queue Dashboard           | v1.2      | 2/2            | Complete    | 2026-02-22 |
| 17. Evidence Pipeline Enrichment     | v2.0      | 3/3            | Complete    | 2026-02-22 |
| 18. Research Quality Gate            | v2.0      | 3/3            | Complete    | 2026-02-22 |
| 19. Client Hypothesis Validation     | v2.0      | 2/2            | Complete    | 2026-02-23 |
| 20. One-Click Send Queue + Pipeline  | v2.0      | 3/3            | Complete    | 2026-02-23 |
| 21. Prospect Discovery + Cleanup     | v2.0      | 2/2            | Complete    | 2026-02-23 |
| 22. Hypothesis Flow Fix              | v2.0      | 1/1            | Complete    | 2026-02-23 |
| 23. Use Case Extractors              | v2.1      | 2/2            | Complete    | 2026-02-24 |
| 24. Data Population and Discovery    | v2.1      | 2/2            | Complete    | 2026-02-25 |
| 25. Pipeline Hardening               | v2.1      | 4/4            | Complete    | 2026-02-27 |
| 26. Quality Calibration              | v2.1      | 2/2            | Complete    | 2026-02-28 |
| 26.1. Evidence Pipeline Expansion    | v2.1      | 3/3            | Complete    | 2026-02-28 |
| 27. End-to-End Cycle                 | v2.1      | 2/2            | Complete    | 2026-02-28 |
| 27.1. Cal.com Booking Validation     | v2.1      | 1/1            | Complete    | 2026-03-01 |
| 28. Source Discovery with Provenance | v2.2      | 3/3            | Complete    | 2026-03-02 |
| 29. Browser-Rendered Extraction      | v2.2      | 0/TBD          | Not started | -          |
| 30. Pain Confirmation Gate + Audit   | v2.2      | 0/TBD          | Not started | -          |
