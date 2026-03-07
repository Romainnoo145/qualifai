# Roadmap: Qualifai

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-02-20)
- ✅ **v1.1 Evidence-Backed Multi-Touch Outreach** — Phases 6-11 (shipped 2026-02-21)
- ✅ **v1.2 Autopilot with Oversight** — Phases 12-15 (shipped 2026-02-22)
- ✅ **v2.0 Streamlined Flow** — Phases 17-22 (shipped 2026-02-23)
- ✅ **v2.1 Production Bootstrap** — Phases 23-27.1 (shipped 2026-03-02)
- ✅ **v2.2 Verified Pain Intelligence** — Phases 28-30 (shipped 2026-03-02)
- ✅ **v3.0 Sharp Analysis** — Phases 31-35 (shipped 2026-03-05)
- 🚧 **v4.0 Atlantis Partnership Outreach** — Phases 36-41 (in progress)

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

### ✅ v3.0 Sharp Analysis (Shipped 2026-03-05)

**Milestone Goal:** Hypothesis generation that produces evidence-grounded, prospect-specific analysis — eliminating fabricated metrics, parroted marketing copy, and shallow website-only reasoning.

- [x] **Phase 31: Tech Debt Foundation** — Fix known code defects and upgrade Gemini model string to establish a clean, passing build baseline before hypothesis changes (completed 2026-03-02)
- [x] **Phase 32: Hypothesis Prompt Rewrite** — Rewrite generateHypothesisDraftsAI() with evidence tiering, source-tier priority, anti-parroting constraint, mandatory quote requirement, and variable output count (completed 2026-03-02)
- [x] **Phase 33: Configurable Model Selection** — Add Claude as a selectable hypothesis model with a provider abstraction, plus chain-of-thought reasoning pass (completed 2026-03-02)
- [x] **Phase 34: AI Metric Derivation + Source Attribution** — Replace hardcoded METRIC_DEFAULTS with AI-estimated contextual ranges and surface source attribution in admin UI (completed 2026-03-02)
- [x] **Phase 35: Validation and Calibration** — Verify /discover/ hypothesis flow, Crawl4AI v0.8.x feature set, and pain gate thresholds against real prospect data (completed 2026-03-05)

### 🚧 v4.0 Atlantis Partnership Outreach (In Progress)

**Milestone Goal:** Extend Qualifai to support Atlantis partnership outreach with dual evidence (external prospect signals + cited RAG document passages), while preserving current Klarifai pipeline behavior.

- [x] **Phase 36: Multi-Project Schema + Seed Foundation** — Add Project/SPV models, backfill prospect project ownership, and seed Atlantis structure (completed 2026-03-05)
- [x] **Phase 37: RAG Ingestion Pipeline** — Chunk Atlantis markdown docs, embed, and persist searchable document chunks with metadata (completed 2026-03-05)
- [x] **Phase 38: Retrieval + Dual Evidence Integration** — Retrieve SPV-scoped passages and generate dual-evidence opportunity cards (completed 2026-03-05)
- [x] **Phase 39: Partnership /discover/ Template** — Atlantis discover now renders readiness/trigger narrative + CTA routing (completed 2026-03-07)
- [ ] **Phase 40: Admin Project Operations** — deferred (SPV assignment/filtering removed from active scope)
- [ ] **Phase 41: Validation + First Real Atlantis Prospect** — Run end-to-end Atlantis flow and regression-check existing Klarifai behavior

## Phase Details

### Phase 31: Tech Debt Foundation

**Goal**: The codebase has a clean npm run check pass, the SERP cache bug is gone, the import anomaly in workflow-engine.ts is resolved, and all known TypeScript debt is addressed — establishing a stable baseline before hypothesis generation is touched
**Depends on**: Phase 30 (v2.2 complete)
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05, DEBT-06, MODEL-02
**Success Criteria** (what must be TRUE):

1. npm run check passes with zero errors after all fixes applied
2. SERP cache re-read bug is absent from research-executor.ts (pre-read snapshot taken before deepCrawl overwrites)
3. Gemini model string is gemini-2.5-flash across all four files (workflow-engine.ts, evidence-scorer.ts, serp.ts, review-adapters.ts)
4. The unused logoUrl prop is gone from DashboardClient interface and all call sites compile cleanly
5. TS2589 as any casts are categorized and fixed by pattern (deep inference → Prisma.XGetPayload, tRPC mutations → correct v11 pattern, Json fields → typed helper)
   **Plans**: 3 plans

Plans:

- [x] 31-01-PLAN.md — Quick fixes: SERP cache double-read, unused logoUrl prop, import ordering, Gemini model constant extraction + 2.5-flash upgrade
- [x] 31-02-PLAN.md — TS2589 type safety: detail-view as any replacement with Prisma.ResearchRunGetPayload, quality-chip and outreach typed Json guards
- [x] 31-03-PLAN.md — E2E test refactor to tRPC quality gate + golden baseline capture for all 7 prospects

### Phase 32: Hypothesis Prompt Rewrite

**Goal**: The hypothesis generation prompt prioritizes diagnostic evidence (reviews, hiring, LinkedIn) over marketing copy, prevents parroting of the company's own website, requires at least one verbatim quoted snippet per hypothesis, and varies output count from 1-3 based on confirmed pain signal quality
**Depends on**: Phase 31
**Requirements**: ANLYS-01, ANLYS-02, ANLYS-03, ANLYS-04, ANLYS-05, ANLYS-06, ANLYS-07
**Success Criteria** (what must be TRUE):

1. Generated hypotheses for STB-kozijnen cite reviews or hiring signals in problemStatement, not service page copy
2. Generated hypotheses for Mujjo cite customer support reviews (expected confidence 0.85+) and no two prospects share identical metric values
3. Each hypothesis problemStatement contains at least one verbatim quoted snippet from a non-WEBSITE evidence source (detectable by presence of quotation marks)
4. A prospect with only one confirmed pain tag produces one hypothesis, not three
5. A prompt run on a WEBSITE-only evidence set produces a confidence score in the 0.60-0.65 range, not 0.80+
   **Plans**: 2 plans

Plans:

- [x] 32-01-PLAN.md — TDD test scaffold: Gemini mock + ANLYS-01 through ANLYS-07 failing test assertions
- [x] 32-02-PLAN.md — Prompt rewrite: source tiers, signal summary, anti-parroting, quote mandate, dynamic count, calibrated confidence + call site update

### Phase 33: Configurable Model Selection

**Goal**: Admin can select Claude Sonnet as the hypothesis generation model for any research run via an optional parameter, and a two-pass chain-of-thought reasoning step separates evidence analysis from hypothesis synthesis
**Depends on**: Phase 32
**Requirements**: MODEL-01, ANLYS-08
**Success Criteria** (what must be TRUE):

1. Passing hypothesisModel: 'claude-sonnet' to research.startRun or research.retryRun produces hypotheses via the Anthropic API (verifiable by distinct reasoning style and xml-structured prompt trace)
2. Passing hypothesisModel: 'gemini-flash' (or omitting the field) produces hypotheses via Gemini, unchanged from Phase 32 output — backward-compatible default
3. Both models parse to the same hypothesis JSON shape with no runtime errors
4. Chain-of-thought pass is observable: reasoning section present in raw model output before synthesis step
   **Plans**: 2 plans

Plans:

- [x] 33-01-PLAN.md — TDD RED scaffold: upgrade Anthropic mock + MODEL-01 and ANLYS-08 failing test cases
- [x] 33-02-PLAN.md — Implementation: CLAUDE_MODEL_SONNET constant, CoT prompt, extractHypothesisJson helper, Claude path, parameter threading through tRPC/executor

### Phase 34: AI Metric Derivation + Source Attribution

**Goal**: The Workflow Loss Map and outreach templates show AI-estimated metric ranges that are specific to each prospect's industry and evidence, and the admin detail view shows which source type most drove each hypothesis
**Depends on**: Phase 33
**Requirements**: MODEL-03, ANLYS-09
**Success Criteria** (what must be TRUE):

1. Two different prospects in different industries produce different hoursSaved and errorReduction metric values (not the same hardcoded defaults)
2. Metric values are labeled as estimated ranges (e.g., "8-12 hours/week") not false precision integers
3. The Workflow Loss Map PDF renders without NaN or undefined values for any metric field
4. Each hypothesis card in the admin detail view shows a source attribution badge (e.g., "REVIEWS", "CAREERS") identifying the primary evidence driver
   **Plans**: 2 plans

Plans:

- [x] 34-01-PLAN.md — TDD RED scaffold: extend mock factories with metric fields + primarySourceType, add MODEL-03 and ANLYS-09 failing tests
- [x] 34-02-PLAN.md — GREEN implementation: prompt metric instruction, clamp helpers, type extensions, DB migration, executor write, FindingCard source attribution badge

### Phase 35: Validation and Calibration

**Goal**: Real prospect data confirms the /discover/ hypothesis validation flow works end-to-end, Crawl4AI v0.8.x features are verified against real pages, and PAIN_GATE threshold constants are tuned to actual evidence distribution
**Depends on**: Phase 34
**Requirements**: VALID-01, VALID-02, VALID-03
**Success Criteria** (what must be TRUE):

1. /discover/ validation session run with at least one real prospect — confirm/decline interaction recorded in DB and visible in admin override history
2. Crawl4AI v0.8.x consent popup removal and shadow DOM flattening verified working against at least two real pages that previously required manual intervention
3. Pain gate calibration SQL run against all 7+ real prospects and threshold constants updated in quality-config.ts with documented before/after distribution
   **Plans**: 2 plans

Plans:

- [x] 35-01-PLAN.md — Crawl4AI v0.8.x params + pain gate calibration report
- [x] 35-02-PLAN.md — /discover/ validation session with DB assertions

### Phase 36: Multi-Project Schema + Seed Foundation

**Goal**: Introduce project-aware data boundaries so Atlantis and Klarifai can run in one app without data leakage or query ambiguity.
**Depends on**: Phase 35 (v3.0 complete)
**Requirements**: MPROJ-01, MPROJ-02, MPROJ-03, MPROJ-04, MPROJ-05
**Success Criteria** (what must be TRUE):

1. Prisma schema includes `Project`, `SPV`, and `Prospect.projectId/spvId` relations with indexes and migration runs cleanly
2. Seed creates `klarifai` and `europes-gate` projects plus eight Atlantis SPVs
3. Existing prospects are backfilled to Klarifai project and app runs without null-project query errors
4. Project-scoped querying is possible in routers without breaking existing endpoints
   **Plans**: 2 plans

Plans:

- [x] 36-01-PLAN.md — Prisma schema + migration + backfill for project/SPV ownership
- [x] 36-02-PLAN.md — Seed scripts for projects/SPVs + baseline project-scoped router helpers

### Phase 37: RAG Ingestion Pipeline

**Goal**: Ingest Atlantis corpus into structured, searchable chunks with embeddings and metadata suitable for deterministic citation.
**Depends on**: Phase 36
**Requirements**: RAG-01, RAG-02, RAG-03, RAG-04, RAG-05, RAG-06
**Success Criteria** (what must be TRUE):

1. pgvector extension is active and chunk embeddings are stored for Atlantis documents
2. Markdown chunker preserves section semantics and keeps tables atomic
3. Ingestion CLI can be rerun safely without duplicate chunk explosions
4. Ingestion output logs chunk count and embedding cost estimate
   **Plans**: 2 plans

Plans:

- [x] 37-01-PLAN.md — Markdown-aware chunker + document metadata extraction + table-preservation tests
- [x] 37-02-PLAN.md — Embedding integration + chunk persistence + idempotent ingestion CLI

### Phase 38: Retrieval + Dual Evidence Integration

**Goal**: Connect external research and Atlantis RAG evidence into one opportunity-generation path with strong source controls.
**Depends on**: Phase 37
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07
**Success Criteria** (what must be TRUE):

1. RAG retrieval only runs for Atlantis prospects and does not alter Klarifai path outputs
2. Retrieved passages are SPV-filtered, similarity-thresholded, and stored as `RAG_DOCUMENT` evidence items
3. Opportunity generator emits 2-4 dual-evidence cards with explicit citation metadata
4. RAG errors downgrade gracefully to warning path without failing full research run
   **Plans**: 2 plans

Plans:

- [x] 38-01-PLAN.md — Retriever implementation (SPV filters, similarity threshold, citation payload)
- [x] 38-02-PLAN.md — Research executor branching + dual-evidence opportunity generation + graceful degradation

### Phase 39: Partnership /discover/ Template

**Goal**: Deliver Atlantis-specific discover UX while reusing shared shell/session primitives to avoid route divergence.
**Depends on**: Phase 38
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05
**Success Criteria** (what must be TRUE):

1. `/discover/[slug]` branches by project type and renders correct template
2. Atlantis template shows readiness + partnership trigger cards with evidence citations
3. CTA profile routing switches by readiness tier (high/medium/low)
4. Shared dashboard/session shell is reused to avoid route divergence
   **Plans**: 2 plans

Plans:

- [x] 39-01-PLAN.md — Discover route branching + partnership trigger assessment surfaced in analysis
- [x] 39-02-PLAN.md — Partnership narrative cards + readiness CTA routing in discover

### Phase 40: Admin Project Operations

**Goal**: Harden account-scoped admin operations with SPV-aware prospect management and conversion visibility.
**Depends on**: Phase 36
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Success Criteria** (what must be TRUE):

1. Account token determines project scope server-side for all admin workflows (no client-side switching)
2. Prospect create/edit/list flows support SPV assignment and filtering inside the scoped project
3. Use-case operations remain project-scoped and Atlantis catalog guardrails stay intact
4. Partnership-to-campaign conversion events are visible per SPV/readiness tier
   **Plans**: 2 plans

Plans:

- [ ] 40-01-PLAN.md — SPV assignment plumbing (deferred/reverted)
- [ ] 40-02-PLAN.md — Partnership conversion instrumentation + SPV funnel visibility (deferred)

### Phase 41: Validation + First Real Atlantis Prospect

**Goal**: Validate Atlantis flow end-to-end with real data while proving non-regression for the existing Klarifai path.
**Depends on**: Phases 36-40
**Requirements**: VALID-01, VALID-02, VALID-03, VALID-04, VALID-05
**Success Criteria** (what must be TRUE):

1. E2E Atlantis run succeeds from prospect creation through discover experience
2. Existing Klarifai regression set remains green after Atlantis integration
3. First real Atlantis target prospect output is manually reviewed and citation quality passes
4. Atlantis calibration report captures confidence distribution and gate recommendations
5. Project scoping prevents Atlantis citations from appearing on non-Atlantis prospects
   **Plans**: 2 plans

Plans:

- [ ] 41-01-PLAN.md — Atlantis E2E validation harness + regression matrix for existing prospects
- [ ] 41-02-PLAN.md — First real prospect walkthrough + calibration/report artifact

## Progress

| Phase                                  | Milestone | Plans Complete | Status     | Completed  |
| -------------------------------------- | --------- | -------------- | ---------- | ---------- |
| 1-5. MVP                               | v1.0      | —              | Complete   | 2026-02-20 |
| 6. Use Cases Foundation                | v1.1      | 3/3            | Complete   | 2026-02-20 |
| 7. Evidence Approval Gate              | v1.1      | 2/2            | Complete   | 2026-02-20 |
| 8. Deep Evidence Pipeline              | v1.1      | 3/3            | Complete   | 2026-02-21 |
| 9. Engagement Triggers                 | v1.1      | 2/2            | Complete   | 2026-02-21 |
| 10. Cadence Engine                     | v1.1      | 4/4            | Complete   | 2026-02-21 |
| 11. Prospect Dashboard                 | v1.1      | 2/2            | Complete   | 2026-02-21 |
| 12. Navigation and Language            | v1.2      | 2/2            | Complete   | 2026-02-21 |
| 13. Prospect Story Flow                | v1.2      | 5/5            | Complete   | 2026-02-22 |
| 14. Campaign Reporting                 | v1.2      | 2/2            | Complete   | 2026-02-22 |
| 15. Action Queue Dashboard             | v1.2      | 2/2            | Complete   | 2026-02-22 |
| 17. Evidence Pipeline Enrichment       | v2.0      | 3/3            | Complete   | 2026-02-22 |
| 18. Research Quality Gate              | v2.0      | 3/3            | Complete   | 2026-02-22 |
| 19. Client Hypothesis Validation       | v2.0      | 2/2            | Complete   | 2026-02-23 |
| 20. One-Click Send Queue + Pipeline    | v2.0      | 3/3            | Complete   | 2026-02-23 |
| 21. Prospect Discovery + Cleanup       | v2.0      | 2/2            | Complete   | 2026-02-23 |
| 22. Hypothesis Flow Fix                | v2.0      | 1/1            | Complete   | 2026-02-23 |
| 23. Use Case Extractors                | v2.1      | 2/2            | Complete   | 2026-02-24 |
| 24. Data Population and Discovery      | v2.1      | 2/2            | Complete   | 2026-02-25 |
| 25. Pipeline Hardening                 | v2.1      | 4/4            | Complete   | 2026-02-27 |
| 26. Quality Calibration                | v2.1      | 2/2            | Complete   | 2026-02-28 |
| 26.1. Evidence Pipeline Expansion      | v2.1      | 3/3            | Complete   | 2026-02-28 |
| 27. End-to-End Cycle                   | v2.1      | 2/2            | Complete   | 2026-02-28 |
| 27.1. Cal.com Booking Validation       | v2.1      | 1/1            | Complete   | 2026-03-01 |
| 28. Source Discovery with Provenance   | v2.2      | 3/3            | Complete   | 2026-03-02 |
| 29. Browser-Rendered Extraction        | v2.2      | 2/2            | Complete   | 2026-03-02 |
| 30. Pain Confirmation Gate + Audit     | v2.2      | 4/4            | Complete   | 2026-03-02 |
| 31. Tech Debt Foundation               | 3/3       | Complete       | 2026-03-02 | -          |
| 32. Hypothesis Prompt Rewrite          | 2/2       | Complete       | 2026-03-02 | -          |
| 33. Configurable Model Selection       | 2/2       | Complete       | 2026-03-02 | -          |
| 34. AI Metric Derivation + Attribution | 2/2       | Complete       | 2026-03-02 | -          |
| 35. Validation and Calibration         | 2/2       | Complete       | 2026-03-05 | -          |
| 36. Multi-Project Schema + Seed        | v4.0      | 2/2            | Complete   | 2026-03-05 |
| 37. RAG Ingestion Pipeline             | v4.0      | 2/2            | Complete   | 2026-03-05 |
| 38. Retrieval + Dual Evidence          | v4.0      | 2/2            | Complete   | 2026-03-05 |
| 39. Partnership Discover Template      | v4.0      | 2/2            | Complete   | 2026-03-07 |
| 40. Admin Project Operations           | v4.0      | 0/2            | Deferred   | -          |
| 41. Validation + First Atlantis Target | v4.0      | 0/2            | Planned    | -          |
