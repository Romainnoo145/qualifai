# Roadmap: Qualifai

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-02-20)
- ✅ **v1.1 Evidence-Backed Multi-Touch Outreach** — Phases 6-11 (shipped 2026-02-21)
- ✅ **v1.2 Autopilot with Oversight** — Phases 12-15 (shipped 2026-02-22)
- ✅ **v2.0 Streamlined Flow** — Phases 17-22 (shipped 2026-02-23)
- 🚧 **v2.1 Production Bootstrap** — Phases 23-27 (in progress)
- 🆕 **v2.2 Verified Pain Intelligence (Browser + Google)** — Phases 28-30 (planned)

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

### 🚧 v2.1 Production Bootstrap (In Progress)

**Milestone Goal:** Populate the system with real Klarifai data, validate the full outreach cycle against real companies, and calibrate quality thresholds — proving the system works end-to-end before scaling.

#### Phase 23: Use Case Extractors

**Goal:** Admin can populate the use case catalog from existing Klarifai knowledge assets — Obsidian vault markdown and project codebases — without manual entry.
**Depends on:** Phase 22 (existing UseCase model and CRUD infrastructure)
**Requirements:** SEED-01, SEED-02
**Success Criteria** (what must be TRUE):

1. Admin can point the vault reader at an Obsidian folder and it produces UseCase records with dedup (no duplicates on re-run)
2. Admin can point the codebase analyzer at a project directory and it extracts capability descriptions, creating UseCase records
3. Both extractors surface clear results — how many records created, how many skipped as duplicates
4. Extracted use cases appear immediately in the Use Cases admin list and are usable for proof matching
   **Plans:** 2 plans

Plans:

- [x] 23-01-PLAN.md — Vault reader: scan Obsidian markdown via AI, create UseCase records with dedup, UI button
- [x] 23-02-PLAN.md — Codebase analyzer: AI-powered capability extraction from project source files, UseCase record creation, UI with path input

---

#### Phase 24: Data Population and Discovery

**Goal:** The system is populated with real Klarifai service data and at least 5 real prospect companies are imported and ready for research.
**Depends on:** Phase 23 (vault reader and codebase analyzer must exist before populating)
**Requirements:** SEED-03, DISC-01, DISC-02
**Success Criteria** (what must be TRUE):

1. Klarifai service catalog reflects all real offerings — populated from vault and codebases via Phase 23 extractors
2. At least 5 known target companies are imported and visible in the prospects list
3. Admin can discover new prospects via Apollo sector/location search and import them in batch
4. All imported prospects have correct company data and are ready to kick off research
   **Plans:** TBD

Plans:

- [x] 24-01: Run vault reader and codebase analyzer on Klarifai assets — populate service catalog
- [x] 24-02: Import known target companies and run Apollo discovery for new prospects

---

#### Phase 25: Pipeline Hardening

**Goal:** The research pipeline runs successfully on real company websites and surfaces clear errors when external APIs fail, rather than silently producing empty results.
**Depends on:** Phase 24 (real prospects must exist to run research against)
**Requirements:** PIPE-01, PIPE-02, PIPE-03
**Success Criteria** (what must be TRUE):

1. Research pipeline completes successfully on at least 3 real marketing agency websites
2. When Crawl4AI times out, SerpAPI hits rate limits, or KvK returns an error, the admin sees a user-visible error message — not a silent empty result
3. Evidence extraction produces at least one relevant workflow pain point hypothesis per real prospect
4. Research quality gate correctly classifies each result as red, amber, or green
   **Plans:** 4/2 plans complete

Plans:

- [x] 25-01: Run research pipeline on real prospects — document which sources succeed and which fail
- [x] 25-02: Implement user-visible error handling for API failures (Crawl4AI, SerpAPI, KvK)
- [x] 25-03: Validate hypothesis quality on real marketing agency data
- [x] 25-04: Integrate Scrapling as stealth fetcher — replace raw fetch(), increase snippet limits to 700 chars

---

#### Phase 26: Quality Calibration

**Goal:** The amber/green quality thresholds reflect what real Dutch marketing agency research actually looks like, and the list-view traffic light matches the detail-view score.
**Depends on:** Phase 25 (real research results needed for calibration)
**Requirements:** QUAL-01, QUAL-02
**Success Criteria** (what must be TRUE):

1. Amber/green thresholds are set based on observed real research scores — not estimated defaults
2. List-view traffic light chip matches the detail-view quality score for the same prospect (no more hardcoded approximation)
3. At least one real prospect clears green threshold and at least one lands at amber — thresholds are meaningfully distinguishing
   **Plans:** 2/2 plans complete

**Plans:** 2 plans

Plans:

- [x] 26-01-PLAN.md — Calibrate thresholds: create quality-config.ts constants, update computeTrafficLight, fix hypothesis re-run idempotency, human approval checkpoint
- [ ] 26-02-PLAN.md — Fix list-view traffic light: extend listProspects with summary, use real sourceTypeCount in QualityChip, enforce AMBER hard gate in sendEmail

---

### Phase 26.1: Evidence Pipeline Expansion (INSERTED)

**Goal:** Add new evidence sources and fix data quality gaps so Phase 26 threshold calibration has real multi-source data to work with. Target: 4-5 distinct source types per prospect.
**Depends on:** Phase 26
**Requirements:** EXP-01, EXP-02, EXP-03, EXP-04, EXP-05
**Plans:** 3/3 plans complete

Plans:

- [x] 26.1-01-PLAN.md — Schema extension (LINKEDIN + NEWS enum values), SERP ungating, domain filter on Google mentions, LinkedIn source type backfill script
- [x] 26.1-02-PLAN.md — Google Reviews via Scrapling + Google News RSS + wire both into pipeline with empty-result recording
- [x] 26.1-03-PLAN.md — LinkedIn company posts via Scrapling + wire into pipeline replacing Crawl4AI LinkedIn

#### Phase 27: End-to-End Cycle

**Goal:** At least one real outreach email is sent, received, and replied to — with the reply correctly triaged and a Cal.com booking triggering an automatic meeting brief.
**Depends on:** Phase 26 (calibrated quality gate needed before sending real outreach)
**Requirements:** E2E-01, E2E-02, E2E-03
**Success Criteria** (what must be TRUE):

1. Admin sends a real outreach email to a real prospect via the send queue — email is delivered and not caught by spam
2. A real reply from the prospect is received via webhook and correctly triaged (interested / not interested / auto-reply)
3. A Cal.com booking from a real prospect triggers automatic meeting brief generation — brief appears in the prospect's Results section
   **Plans:** TBD

Plans:

- [ ] 27-01: Send real outreach email via send queue — verify delivery and record outcome
- [ ] 27-02: Verify reply webhook receives and triages real responses
- [ ] 27-03: Verify Cal.com booking triggers meeting brief generation end-to-end

---

### 🆕 v2.2 Verified Pain Intelligence (Planned)

**Milestone Goal:** Confirm pain points from real external evidence (Google reviews, jobs, support/docs, website) using browser-rendered extraction before outreach is allowed.

#### Phase 28: Source Discovery Upgrade

**Goal:** Automatically discover high-signal evidence sources per prospect instead of relying on fixed URL guesses.
**Depends on:** Phase 27 (stable end-to-end baseline)
**Requirements:** VPI-01, VPI-02
**Success Criteria** (what must be TRUE):

1. Per prospect, system discovers and stores candidate source URLs for reviews, jobs, docs/help, and core website pages
2. Discovery deduplicates URLs and keeps source provenance (google/sitemap/manual)
3. Admin can inspect discovered sources before running extraction
   **Plans:** TBD

Plans:

- [ ] 28-01: Add source discovery layer (Google + sitemap + manual merge) with dedup and provenance
- [ ] 28-02: Add admin source list visibility and selection controls

---

#### Phase 29: Browser Evidence Extraction

**Goal:** Extract evidence from JS-rendered pages reliably using browser automation rather than fetch-only HTML.
**Depends on:** Phase 28 (source catalog must exist first)
**Requirements:** VPI-03, VPI-04
**Success Criteria** (what must be TRUE):

1. JS-rendered pages produce evidence records with snippet, source URL, timestamp, and source type
2. Extraction handles anti-bot or failed loads with explicit status (not silent empty results)
3. Review and vacature sources consistently yield usable evidence for scoring
   **Plans:** TBD

Plans:

- [ ] 29-01: Introduce browser-rendered extractor pipeline (Playwright/Crawl4AI-compatible adapter)
- [ ] 29-02: Persist normalized extraction diagnostics and user-visible failure reasons

---

#### Phase 30: Pain Confirmation Gate

**Goal:** Block outreach drafts unless minimum cross-source pain confirmation is met.
**Depends on:** Phase 29 (browser evidence must be available first)
**Requirements:** VPI-05, VPI-06
**Success Criteria** (what must be TRUE):

1. Outreach queue enforces a hard gate based on confirmed pain evidence thresholds
2. Gate explains exactly what is missing (e.g. no review proof, weak vacature signal)
3. Manual override is tracked with explicit reason and audit metadata
   **Plans:** TBD

Plans:

- [ ] 30-01: Implement pain-confirmation scoring and minimum evidence thresholds
- [ ] 30-02: Enforce gate in draft creation/approval flows with explicit override audit trail

---

## Progress

| Phase                               | Milestone | Plans Complete | Status      | Completed  |
| ----------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1-5. MVP                            | v1.0      | —              | Complete    | 2026-02-20 |
| 6. Use Cases Foundation             | v1.1      | 3/3            | Complete    | 2026-02-20 |
| 7. Evidence Approval Gate           | v1.1      | 2/2            | Complete    | 2026-02-20 |
| 8. Deep Evidence Pipeline           | v1.1      | 3/3            | Complete    | 2026-02-21 |
| 9. Engagement Triggers              | v1.1      | 2/2            | Complete    | 2026-02-21 |
| 10. Cadence Engine                  | v1.1      | 4/4            | Complete    | 2026-02-21 |
| 11. Prospect Dashboard              | v1.1      | 2/2            | Complete    | 2026-02-21 |
| 12. Navigation and Language         | v1.2      | 2/2            | Complete    | 2026-02-21 |
| 13. Prospect Story Flow             | v1.2      | 5/5            | Complete    | 2026-02-22 |
| 14. Campaign Reporting              | v1.2      | 2/2            | Complete    | 2026-02-22 |
| 15. Action Queue Dashboard          | v1.2      | 2/2            | Complete    | 2026-02-22 |
| 17. Evidence Pipeline Enrichment    | v2.0      | 3/3            | Complete    | 2026-02-22 |
| 18. Research Quality Gate           | v2.0      | 3/3            | Complete    | 2026-02-22 |
| 19. Client Hypothesis Validation    | v2.0      | 2/2            | Complete    | 2026-02-23 |
| 20. One-Click Send Queue + Pipeline | v2.0      | 3/3            | Complete    | 2026-02-23 |
| 21. Prospect Discovery + Cleanup    | v2.0      | 2/2            | Complete    | 2026-02-23 |
| 22. Hypothesis Flow Fix             | v2.0      | 1/1            | Complete    | 2026-02-23 |
| 23. Use Case Extractors             | v2.1      | 2/2            | Complete    | 2026-02-24 |
| 24. Data Population and Discovery   | v2.1      | 2/2            | Complete    | 2026-02-25 |
| 25. Pipeline Hardening              | v2.1      | Complete       | 2026-02-27  | 2026-02-27 |
| 26. Quality Calibration             | 2/2       | Complete       | 2026-02-28  | -          |
| 27. End-to-End Cycle                | v2.1      | 0/3            | Not started | -          |
| 28. Source Discovery Upgrade        | v2.2      | 0/2            | Not started | -          |
| 29. Browser Evidence Extraction     | v2.2      | 0/2            | Not started | -          |
| 30. Pain Confirmation Gate          | v2.2      | 0/2            | Not started | -          |
