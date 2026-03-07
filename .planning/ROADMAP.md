# Roadmap: Qualifai

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-02-20)
- ✅ **v1.1 Evidence-Backed Multi-Touch Outreach** — Phases 6-11 (shipped 2026-02-21)
- ✅ **v1.2 Autopilot with Oversight** — Phases 12-15 (shipped 2026-02-22)
- ✅ **v2.0 Streamlined Flow** — Phases 17-22 (shipped 2026-02-23)
- ✅ **v2.1 Production Bootstrap** — Phases 23-27.1 (shipped 2026-03-02)
- ✅ **v2.2 Verified Pain Intelligence** — Phases 28-30 (shipped 2026-03-02)
- ✅ **v3.0 Sharp Analysis** — Phases 31-35 (shipped 2026-03-05)
- ✅ **v4.0 Atlantis Partnership Outreach** — Phases 36-39 (shipped 2026-03-07)
- 🚧 **v5.0 Atlantis Intelligence & NDA Pipeline** — Phases 42-45 (in progress)

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

<details>
<summary>✅ v2.2 Verified Pain Intelligence (Phases 28-30) — SHIPPED 2026-03-02</summary>

- Phase 28: Source Discovery with Provenance (3/3 plans) — Pure source URL discovery module with provenance labels, dedup, caps, jsHeavyHint
- Phase 29: Browser-Rendered Evidence Extraction (2/2 plans) — Two-tier extraction routing, stealth-first with Crawl4AI escalation, 5-URL browser budget
- Phase 30: Pain Confirmation Gate + Override Audit (4/4 plans) — Cross-source pain confirmation, GateOverrideAudit model, send queue signals, Bypassed badge

</details>

<details>
<summary>✅ v3.0 Sharp Analysis (Phases 31-35) — SHIPPED 2026-03-05</summary>

- Phase 31: Tech Debt Foundation (3/3 plans) — SERP cache fix, Gemini 2.5 upgrade, TS2589 cleanup
- Phase 32: Hypothesis Prompt Rewrite (2/2 plans) — Source tiers, anti-parroting, quote mandate, dynamic count
- Phase 33: Configurable Model Selection (2/2 plans) — Claude path, CoT reasoning, provider abstraction
- Phase 34: AI Metric Derivation + Attribution (2/2 plans) — AI-estimated ranges, source attribution badges
- Phase 35: Validation and Calibration (2/2 plans) — Crawl4AI v0.8.x, /discover/ validation, pain gate tuning

</details>

<details>
<summary>✅ v4.0 Atlantis Partnership Outreach (Phases 36-39) — SHIPPED 2026-03-07</summary>

- Phase 36: Multi-Project Schema + Seed Foundation (2/2 plans) — Project/SPV models, backfill, seed
- Phase 37: RAG Ingestion Pipeline (2/2 plans) — Markdown chunker, embeddings, idempotent ingestion
- Phase 38: Retrieval + Dual Evidence Integration (2/2 plans) — SPV-scoped retrieval, dual-evidence cards
- Phase 39: Partnership /discover/ Template (2/2 plans) — Readiness/trigger narrative, CTA routing
- Phase 40: Admin Project Operations — Deferred (no operational need proven)
- Phase 41: Validation + First Atlantis Prospect — Deferred (folded into v5.0)

</details>

### 🚧 v5.0 Atlantis Intelligence & NDA Pipeline (In Progress)

**Milestone Goal:** Replace template-based Atlantis discover pipeline with AI-powered content generation. Scraper data gets structured into intent variables, AI combines those with RAG passages into boardroom-ready narrative, and the discover page renders the result as a three-section teaser that drives NDA interest.

- [ ] **Phase 42: Extraction Matrix** - Scraper data structured into intent variables with source attribution
- [ ] **Phase 43: AI Master Analysis** - Intent variables + RAG passages combined into prospect-specific narrative content
- [ ] **Phase 44: Discover Rendering** - Three-section discover page renders persisted analysis without further AI calls
- [ ] **Phase 45: End-to-End Validation** - Real prospect flow verified, existing prospects unaffected

## Phase Details

### Phase 42: Extraction Matrix

**Goal**: Scraper output is reliably structured into intent variables that downstream analysis can consume, and those variables drive targeted RAG retrieval instead of keyword-stuffed queries
**Depends on**: Phase 39 (v4.0 Atlantis pipeline in place)
**Requirements**: EXTR-01, EXTR-02, EXTR-03
**Success Criteria** (what must be TRUE):

1. Running research on an Atlantis prospect produces structured intent variables (sector fit, operational pains, ESG/CSRD signals, investment/growth patterns, workforce signals) with source attribution per variable
2. RAG retrieval queries are constructed from intent variables instead of keyword-stuffed profile fragments, returning more relevant passages
3. Intent variables are persisted to the database and available for inspection in admin prospect detail
   **Plans**: 2 plans

Plans:

- [ ] 42-01-PLAN.md — Intent variable types, schema, extraction module, and research pipeline integration
- [ ] 42-02-PLAN.md — Intent-driven RAG query builder and admin Intent Signals UI

### Phase 43: AI Master Analysis

**Goal**: AI generates complete discover page content (context, triggers, tracks) from intent variables and RAG passages in boardroom tone
**Depends on**: Phase 42
**Requirements**: ANLS-01, ANLS-02, ANLS-03, ANLS-04, ANLS-05, ANLS-06
**Success Criteria** (what must be TRUE):

1. Running analysis on a prospect with intent variables produces a context section with prospect-specific hook, 3 scale KPIs sourced from RAG documents, and an executive hook connecting their pain to Atlantis
2. Running analysis produces a trigger section with 3 cards (market / compliance-ESG / capital de-risking) containing specific numbers from RAG documents, not generic filler
3. Running analysis produces a partnership section with commercial tracks per SPV including scope and strategic tags
4. All generated content reads as boardroom-ready — visionary and data-backed with zero AI/RAG/scraping terminology visible in output
5. Analysis output is persisted to DB and can be loaded without making any AI calls
   **Plans**: TBD

Plans:

- [ ] 43-01: TBD
- [ ] 43-02: TBD

### Phase 44: Discover Rendering

**Goal**: Atlantis discover page renders three-section narrative from persisted analysis data with clean, confident visual design
**Depends on**: Phase 43
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05
**Success Criteria** (what must be TRUE):

1. Atlantis discover page at /discover/[slug] shows three distinct sections in order: Context (hook + KPIs) then Triggers (why you, why now) then Partnership (tracks + CTA)
2. Context section displays hook subtitle, 3 KPI blocks with numbers from RAG, and executive hook — all from persisted data
3. Trigger cards show specific numbers, urgency indicators, and evidence attribution — not placeholder text
4. Partnership section shows commercial tracks with scope, strategic tags, and interest CTA per SPV
5. Visual design is clean, confident, and data-rich — no generic "bridge" imagery or language, matches boardroom tone of the analysis
   **Plans**: TBD

Plans:

- [ ] 44-01: TBD
- [ ] 44-02: TBD

### Phase 45: End-to-End Validation

**Goal**: Full Atlantis intelligence pipeline verified with real prospect data, existing Klarifai prospects confirmed unaffected
**Depends on**: Phase 44
**Requirements**: VALD-01, VALD-02
**Success Criteria** (what must be TRUE):

1. A real Atlantis prospect completes the full flow (scrape → extract intent variables → AI analysis → discover page renders correctly) with no manual intervention
2. An existing Klarifai prospect's research pipeline, discover page, and outreach flow still work correctly (regression)
   **Plans**: TBD

Plans:

- [ ] 45-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 42 → 43 → 44 → 45

| Phase                                  | Milestone | Plans Complete | Status      | Completed  |
| -------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1-5. MVP                               | v1.0      | —              | Complete    | 2026-02-20 |
| 6. Use Cases Foundation                | v1.1      | 3/3            | Complete    | 2026-02-20 |
| 7. Evidence Approval Gate              | v1.1      | 2/2            | Complete    | 2026-02-20 |
| 8. Deep Evidence Pipeline              | v1.1      | 3/3            | Complete    | 2026-02-21 |
| 9. Engagement Triggers                 | v1.1      | 2/2            | Complete    | 2026-02-21 |
| 10. Cadence Engine                     | v1.1      | 4/4            | Complete    | 2026-02-21 |
| 11. Prospect Dashboard                 | v1.1      | 2/2            | Complete    | 2026-02-21 |
| 12. Navigation and Language            | v1.2      | 2/2            | Complete    | 2026-02-21 |
| 13. Prospect Story Flow                | v1.2      | 5/5            | Complete    | 2026-02-22 |
| 14. Campaign Reporting                 | v1.2      | 2/2            | Complete    | 2026-02-22 |
| 15. Action Queue Dashboard             | v1.2      | 2/2            | Complete    | 2026-02-22 |
| 17. Evidence Pipeline Enrichment       | v2.0      | 3/3            | Complete    | 2026-02-22 |
| 18. Research Quality Gate              | v2.0      | 3/3            | Complete    | 2026-02-22 |
| 19. Client Hypothesis Validation       | v2.0      | 2/2            | Complete    | 2026-02-23 |
| 20. One-Click Send Queue + Pipeline    | v2.0      | 3/3            | Complete    | 2026-02-23 |
| 21. Prospect Discovery + Cleanup       | v2.0      | 2/2            | Complete    | 2026-02-23 |
| 22. Hypothesis Flow Fix                | v2.0      | 1/1            | Complete    | 2026-02-23 |
| 23. Use Case Extractors                | v2.1      | 2/2            | Complete    | 2026-02-24 |
| 24. Data Population and Discovery      | v2.1      | 2/2            | Complete    | 2026-02-25 |
| 25. Pipeline Hardening                 | v2.1      | 4/4            | Complete    | 2026-02-27 |
| 26. Quality Calibration                | v2.1      | 2/2            | Complete    | 2026-02-28 |
| 26.1. Evidence Pipeline Expansion      | v2.1      | 3/3            | Complete    | 2026-02-28 |
| 27. End-to-End Cycle                   | v2.1      | 2/2            | Complete    | 2026-02-28 |
| 27.1. Cal.com Booking Validation       | v2.1      | 1/1            | Complete    | 2026-03-01 |
| 28. Source Discovery with Provenance   | v2.2      | 3/3            | Complete    | 2026-03-02 |
| 29. Browser-Rendered Extraction        | v2.2      | 2/2            | Complete    | 2026-03-02 |
| 30. Pain Confirmation Gate + Audit     | v2.2      | 4/4            | Complete    | 2026-03-02 |
| 31. Tech Debt Foundation               | v3.0      | 3/3            | Complete    | 2026-03-02 |
| 32. Hypothesis Prompt Rewrite          | v3.0      | 2/2            | Complete    | 2026-03-02 |
| 33. Configurable Model Selection       | v3.0      | 2/2            | Complete    | 2026-03-02 |
| 34. AI Metric Derivation + Attribution | v3.0      | 2/2            | Complete    | 2026-03-02 |
| 35. Validation and Calibration         | v3.0      | 2/2            | Complete    | 2026-03-05 |
| 36. Multi-Project Schema + Seed        | v4.0      | 2/2            | Complete    | 2026-03-05 |
| 37. RAG Ingestion Pipeline             | v4.0      | 2/2            | Complete    | 2026-03-05 |
| 38. Retrieval + Dual Evidence          | v4.0      | 2/2            | Complete    | 2026-03-05 |
| 39. Partnership Discover Template      | v4.0      | 2/2            | Complete    | 2026-03-07 |
| 40. Admin Project Operations           | v4.0      | 0/2            | Deferred    | -          |
| 41. Validation + First Atlantis        | v4.0      | 0/2            | Deferred    | -          |
| 42. Extraction Matrix                  | v5.0      | 0/2            | Not started | -          |
| 43. AI Master Analysis                 | v5.0      | 0/?            | Not started | -          |
| 44. Discover Rendering                 | v5.0      | 0/?            | Not started | -          |
| 45. End-to-End Validation              | v5.0      | 0/?            | Not started | -          |
