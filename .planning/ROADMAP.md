# Roadmap: Qualifai

## Milestones

- v1.0 MVP — Phases 1-5 (shipped 2026-02-20)
- v1.1 Evidence-Backed Multi-Touch Outreach — Phases 6-10 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) — SHIPPED 2026-02-20</summary>

Phases 1-5 delivered the foundational sales engine: Apollo enrichment + contact discovery, research pipeline (fetch + parse + evidence extraction), Workflow Loss Map + Call Prep PDF generation, outreach sequence drafting with CTA enforcement, reply webhook handling, Cal.com booking, signal tracking, public wizard, admin command center, multi-touch task queue, and Apollo plan-limit guardrails.

</details>

---

### v1.1 Evidence-Backed Multi-Touch Outreach (In Progress)

**Milestone goal:** Upgrade outreach from email-only with thin evidence to engagement-driven multi-touch sequences backed by deep, browser-rendered evidence matched to real services admin-manages in-app.

---

- [x] **Phase 6: Use Cases Foundation** — Replace Obsidian JSON proof catalog with in-app Use Cases management and DB-backed proof matching
- [x] **Phase 7: Evidence Approval Gate** — Wire hypothesis review UI and block outreach until admin approves at least one hypothesis per prospect
- [ ] **Phase 8: Deep Evidence Pipeline** — Add SerpAPI search discovery and managed-browser extraction as new evidence sources feeding the existing pipeline
- [ ] **Phase 9: Engagement Triggers** — Wire wizard, PDF, reply, and email events to immediate touch task creation with deduplication
- [ ] **Phase 10: Cadence Engine** — Build engagement-driven cadence state machine that automatically schedules and advances multi-touch sequences

---

## Phase Details

### Phase 6: Use Cases Foundation

**Goal:** Admin can manage the proof catalog in-app; AI matching reads use cases from the database instead of Obsidian JSON files.

**Depends on:** Phase 5 (v1.0 complete)

**Requirements:** UCASE-01, UCASE-02, UCASE-03, UCASE-04

**Success Criteria** (what must be TRUE when this phase completes):

1. Admin can create, edit, and delete use cases in a dedicated Use Cases tab without touching files or deployments
2. Importing the Obsidian inventory.json and client_offers.json populates the database with all existing proof records
3. Each use case record stores title, description, category, outcomes, case study references, and NL synonym tags
4. Running proof matching on a prospect returns matched use cases from the database with Claude-powered semantic scoring

**Plans:** 3 plans in 2 waves

Plans:

- [x] 06-01-PLAN.md — UseCase model + migration + tRPC CRUD router + Obsidian import (Wave 1)
- [x] 06-02-PLAN.md — Use Cases admin UI + sidebar nav item (Wave 2)
- [x] 06-03-PLAN.md — DB-backed proof matching with Claude semantic scoring (Wave 2)

---

### Phase 7: Evidence Approval Gate

**Goal:** Admin reviews AI-generated hypotheses — each pairing a pain point with matched use cases and supporting evidence — and outreach is blocked until at least one hypothesis is approved.

**Depends on:** Phase 6 (UseCase records must exist for hypothesis matching to reference)

**Requirements:** HYPO-01, HYPO-02, HYPO-03, HYPO-04

**Success Criteria** (what must be TRUE when this phase completes):

1. For each prospect, the system generates a hypothesis that names a pain point, lists matched use cases, and cites supporting evidence
2. Admin sees a review screen showing each hypothesis with its matched use cases and evidence sources
3. Admin can approve or reject a hypothesis; the decision is persisted and visible in the prospect detail
4. Attempting to generate or send outreach for a prospect with no approved hypothesis is blocked with a clear error

**Plans:** 2 plans in 2 waves

Plans:

- [x] 07-01-PLAN.md — Backend: Wire matchProofs into regenerateForRun, enrich hypothesis queries, add outreach gate (Wave 1)
- [x] 07-02-PLAN.md — UI: Standalone hypothesis review page, nav item, enhanced HypothesesTab with evidence display (Wave 2)

---

### Phase 8: Deep Evidence Pipeline

**Goal:** Admin can trigger deep research that discovers review URLs and job listings via SerpAPI and extracts JS-rendered content via managed browser API, with results cached and routed through the existing approval gate.

**Depends on:** Phase 7 (approval gate must be active before new evidence sources are added)

**Requirements:** EVID-01, EVID-02, EVID-03, EVID-04, EVID-05

**Success Criteria** (what must be TRUE when this phase completes):

1. Triggering deep research on a prospect returns discovered URLs from Google Reviews, Glassdoor, and job listings via SerpAPI
2. Content from discovered URLs is extracted as text via managed browser API (not plain fetch), including pages that require JavaScript rendering
3. Playwright and the managed browser client never run inside a Next.js API route or tRPC handler — extraction is delegated to a worker or external API
4. Re-running deep research on the same prospect within a session returns cached SerpAPI results without additional API calls
5. Pages guarded by cookie consent banners (Cookiebot) are handled so content is still extracted

**Plans:** 3 plans in 2 waves

Plans:

- [ ] 08-01-PLAN.md — SerpAPI URL discovery client with TDD (Google Maps reviews + Google Jobs) (Wave 1)
- [ ] 08-02-PLAN.md — Crawl4AI REST API client with TDD (browser extraction + cookie consent + fallback drafts) (Wave 1)
- [ ] 08-03-PLAN.md — Wire deep crawl into research pipeline (deepCrawl flag, SerpAPI cache, evidence deduplication) (Wave 2)

---

### Phase 9: Engagement Triggers

**Goal:** Wizard engagement, PDF downloads, and positive email replies automatically create immediate follow-up tasks; email open/click events are captured but do not drive cadence escalation.

**Depends on:** Phase 7 (approved hypotheses must exist before task creation makes sense; engagement signals act on prospect state)

**Requirements:** ENGAG-01, ENGAG-02, ENGAG-03, ENGAG-04, ENGAG-05

**Success Criteria** (what must be TRUE when this phase completes):

1. When a prospect reaches wizard step 3 or beyond, a call task is created immediately without admin action
2. When a prospect downloads the PDF, a call task is created immediately without admin action
3. When a reply is triaged as "interested," a call task is created immediately without admin action
4. Email open and click events are captured and stored via Resend webhook with HMAC signature verification
5. Email opens alone never trigger cadence escalation — only wizard engagement and PDF download do

**Plans:** TBD

Plans:

- [ ] 09-01: Resend webhook route (HMAC verification, open/click event capture, resendMessageId stored at send time)
- [ ] 09-02: Engagement trigger wiring (wizard step 3+, PDF download, interested reply → immediate call task)
- [ ] 09-03: Deduplication guard (prevent duplicate tasks when same engagement fires multiple times)

---

### Phase 10: Cadence Engine

**Goal:** After each touch is completed, the cadence engine evaluates engagement state and automatically schedules the next touch — advancing multi-channel sequences without manual intervention.

**Depends on:** Phase 9 (engagement event infrastructure must exist before cadence can consume it; Phase 6 for use case scoring)

**Requirements:** CADNC-01, CADNC-02, CADNC-03, CADNC-04, CADNC-05

**Success Criteria** (what must be TRUE when this phase completes):

1. Completing a touch task automatically creates or schedules the next touch in the cadence sequence (email, call, LinkedIn, WhatsApp) without manual intervention
2. Prospects with high engagement (wizard depth, PDF download) receive an accelerated follow-up schedule compared to unengaged prospects
3. The next scheduled cadence step for any prospect is queryable by timestamp using database columns — not buried in JSON metadata
4. A cron job runs on schedule and processes all prospects with due cadence steps, creating tasks as needed
5. Admin can see the cadence history and current cadence state for any prospect in the outreach detail view

**Plans:** TBD

Plans:

- [ ] 10-01: Schema migration (OutreachStep.scheduledAt, triggeredBy, nextStepReadyAt columns)
- [ ] 10-02: Cadence engine (buildCadenceState + evaluateCadence + configuration rules)
- [ ] 10-03: completeTouchTask wiring (calls evaluateCadence after each task completion)
- [ ] 10-04: Cadence cron job (Railway cron processes due steps on schedule)
- [ ] 10-05: Cadence history UI (admin can see cadence state and history per prospect)

---

## Progress

**Execution order:** 6 → 7 → 8 → 9 → 10

| Phase                     | Milestone | Plans Complete | Status      | Completed  |
| ------------------------- | --------- | -------------- | ----------- | ---------- |
| 1-5. MVP                  | v1.0      | —              | Complete    | 2026-02-20 |
| 6. Use Cases Foundation   | v1.1      | 3/3            | Complete    | 2026-02-20 |
| 7. Evidence Approval Gate | v1.1      | 2/2            | Complete    | 2026-02-20 |
| 8. Deep Evidence Pipeline | v1.1      | 0/3            | Not started | —          |
| 9. Engagement Triggers    | v1.1      | 0/3            | Not started | —          |
| 10. Cadence Engine        | v1.1      | 0/5            | Not started | —          |
