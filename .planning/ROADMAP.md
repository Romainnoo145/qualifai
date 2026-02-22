# Roadmap: Qualifai

## Milestones

- v1.0 MVP — Phases 1-5 (shipped 2026-02-20)
- v1.1 Evidence-Backed Multi-Touch Outreach — Phases 6-11 (shipped 2026-02-21)
- v1.2 Autopilot with Oversight — Phases 12-15 (shipped 2026-02-22)
- v2.0 Streamlined Flow — Phases 17-21 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) — SHIPPED 2026-02-20</summary>

Phases 1-5 delivered the foundational sales engine: Apollo enrichment + contact discovery, research pipeline (fetch + parse + evidence extraction), Workflow Loss Map + Call Prep PDF generation, outreach sequence drafting with CTA enforcement, reply webhook handling, Cal.com booking, signal tracking, public wizard, admin command center, multi-touch task queue, and Apollo plan-limit guardrails.

</details>

<details>
<summary>v1.1 Evidence-Backed Multi-Touch Outreach (Phases 6-11) — SHIPPED 2026-02-21</summary>

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

- [x] 08-01-PLAN.md — SerpAPI URL discovery client with TDD (Google Maps reviews + Google Jobs) (Wave 1)
- [x] 08-02-PLAN.md — Crawl4AI REST API client with TDD (browser extraction + cookie consent + fallback drafts) (Wave 1)
- [x] 08-03-PLAN.md — Wire deep crawl into research pipeline (deepCrawl flag, SerpAPI cache, evidence deduplication) (Wave 2)

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

**Plans:** 2 plans in 1 wave

Plans:

- [x] 09-01-PLAN.md — Resend webhook route (Svix verification, open/click event capture, resendMessageId stored at send time) (Wave 1)
- [x] 09-02-PLAN.md — Engagement trigger utility + wiring with dedup guard (wizard step 3+, PDF download, interested reply -> immediate call task) (Wave 1)

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

**Plans:** 4 plans in 4 waves

Plans:

- [x] 10-01-PLAN.md — Schema migration: add scheduledAt, triggeredBy, nextStepReadyAt columns to OutreachStep (Wave 1)
- [x] 10-02-PLAN.md — Cadence engine TDD: buildCadenceState + evaluateCadence + processDueCadenceSteps with unit tests (Wave 2)
- [x] 10-03-PLAN.md — Wiring: completeTouchTask cadence hook + cron route + getCadenceState tRPC query (Wave 3)
- [x] 10-04-PLAN.md — Cadence history UI: CadenceTab component + prospect detail page tab (Wave 4)

---

### Phase 11: Prospect Dashboard

**Goal:** Upgrade the public wizard from an educational presentation into a prospect dashboard that displays evidence-backed pain points with matched use cases, provides multi-channel contact options (Cal.com + WhatsApp + call + email), enables one-click quote requests, and uses readable URLs (`/voor/bedrijfsnaam`).

**Depends on:** Phase 8 (evidence pipeline data to display), Phase 7 (approved hypotheses to show)

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05

**Success Criteria** (what must be TRUE when this phase completes):

1. Prospect dashboard shows real evidence-backed pain points and matched use cases (from approved hypotheses, not just AI-generated content)
2. Dashboard has Cal.com booking, WhatsApp (wa.me), call (tel:), and email (mailto:) contact buttons to Klarifai
3. Prospect can request a quote with one click — admin receives notification with prospect context and matched use cases
4. Prospect URLs use readable format `/voor/bedrijfsnaam` instead of random nanoid slugs
5. All existing wizard engagement tracking (step times, PDF download, call booked) continues to work

**Plans:** 2 plans in 2 waves

Plans:

- [x] 11-01-PLAN.md — Schema migration (readableSlug, quote tracking) + slug utility + enrichment wiring + quote mutation + notifyAdmin extension + contact env vars (Wave 1)
- [x] 11-02-PLAN.md — /voor/[slug] dashboard route + DashboardClient with evidence content + contact buttons + admin link updates (Wave 2)

</details>

---

<details>
<summary>v1.2 Autopilot with Oversight (Phases 12-15) — SHIPPED 2026-02-22</summary>

### Phase 12: Navigation and Language

**Goal:** Admin navigates a clean 6-item sidebar with no jargon — the structure alone communicates what the app does.

**Depends on:** Phase 11 (v1.1 complete)

**Requirements:** NAV-01, NAV-02, TERM-01

**Success Criteria** (what must be TRUE when this phase completes):

1. Sidebar shows exactly 6 items in this order: Dashboard, Companies, Campaigns, Draft Queue, Use Cases, Signals — no more, no less
2. The terms "Loss Map", "Call Prep", "Nodes", and "Sprint Intelligence" do not appear anywhere in the sidebar, page headings, or button labels
3. Nav groups feel logically organized — admin can predict where to find any feature without trial and error

**Plans:** 2 plans in 1 wave

Plans:

- [x] 12-01-PLAN.md — Sidebar restructure: flatten to 6 items (Dashboard, Companies, Campaigns, Draft Queue, Use Cases, Signals), remove group headers and obsolete nav entries (Wave 1)
- [x] 12-02-PLAN.md — Terminology sweep: replace jargon (Loss Map, Call Prep, Nodes, Sprint Intelligence, and settings-page spy language) with plain labels across 7 files (Wave 2)

---

### Phase 13: Prospect Story Flow

**Goal:** Opening a prospect shows one coherent story from raw evidence to sent outreach — admin can follow the chain of reasoning without switching tabs.

**Depends on:** Phase 12 (nav must be settled before restructuring a major page)

**Requirements:** DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, DETAIL-05, TERM-02

**Success Criteria** (what must be TRUE when this phase completes):

1. Prospect detail has four sections in order — Evidence, Analysis, Outreach Preview, Results — replacing the current 7-tab layout
2. Evidence section lists scraped sources with their URLs visible, so admin can verify where data came from
3. Analysis section shows each hypothesis with the reasoning chain: which evidence led to which conclusion and which services were matched
4. Outreach Preview shows exactly what the prospect will receive — email content, dashboard content — before anything is sent
5. Results section shows engagement data: email opens, replies, bookings, and conversions tied to this prospect
6. All section headings, labels, and field names use plain language — no internal technical terms remain in the prospect detail

**Plans:** 5 plans in 3 waves

Plans:

- [x] 13-01-PLAN.md — Page restructure (tabs to vertical sections) + Evidence section with source URL display (Wave 1)
- [x] 13-02-PLAN.md — Analysis section: hypothesis reasoning chain with matched services (Wave 2)
- [x] 13-03-PLAN.md — Outreach Preview section: email content, dashboard link, call brief (Wave 2)
- [x] 13-04-PLAN.md — Results section: engagement metrics, cadence timeline, dashboard activity (Wave 3)
- [x] 13-05-PLAN.md — TERM-02: full terminology sweep replacing remaining internal terms (Wave 3)

---

### Phase 14: Campaign Reporting

**Goal:** Admin can create named prospect cohorts and see exactly where each prospect stands in the funnel — at a glance and per-prospect.

**Depends on:** Phase 12 (nav must include Campaigns item before campaign UI is built out)

**Requirements:** CAMP-01, CAMP-02, CAMP-03, CAMP-04

**Success Criteria** (what must be TRUE when this phase completes):

1. Admin can create a campaign with a name and segment description, then add prospects to it
2. Campaign view shows a funnel: imported → researched → approved → emailed → replied → booked — with counts at each stage
3. Campaign view lists every prospect with their current funnel stage visible at a glance
4. Campaign view shows conversion metrics: response rate and booking rate calculated from funnel counts

**Plans:** 2 plans in 2 waves

Plans:

- [x] 14-01-PLAN.md — Campaign funnel data query + list page redesign with creation form and clickable cards (Wave 1)
- [x] 14-02-PLAN.md — Campaign detail page with funnel visualization, per-prospect status table, and conversion metrics (Wave 2)

---

### Phase 15: Action Queue Dashboard

**Goal:** Admin opens the dashboard and immediately knows what needs attention — every pending decision is listed with a direct link to act on it.

**Depends on:** Phase 13 (prospect detail must exist in final form before it's linked from the queue), Phase 14 (campaign data feeds dashboard context)

**Requirements:** DASH-01, DASH-02, DASH-03

**Success Criteria** (what must be TRUE when this phase completes):

1. Dashboard shows a unified list of items needing admin decisions: hypotheses to review, drafts to approve, calls due, replies to handle
2. Each item in the queue links directly to the page where the admin takes action — no extra navigation steps
3. Dashboard shows a count per action type with urgency indicators (e.g., overdue calls, unread replies)

**Plans:** 2 plans in 2 waves

Plans:

- [x] 15-01-PLAN.md — Action queue data layer: getActionQueue tRPC query aggregating pending decisions across hypothesis, outreach, task, and reply tables (Wave 1)
- [x] 15-02-PLAN.md — Action queue UI: dashboard page rewrite with grouped action items, count badges, urgency indicators, and direct links (Wave 2)

</details>

---

### v2.0 Streamlined Flow (In Progress)

**Milestone goal:** Transform the admin from a collection of disconnected pages into a single oversight console where the admin enters prospects, reviews research quality, approves outreach with one click per channel, and tracks status — while prospects validate hypotheses themselves on their dashboard.

- [ ] **Phase 17: Evidence Pipeline Enrichment** — Expand evidence sources to sitemap crawling, Google search mentions, LinkedIn company pages, and KvK registry data
- [ ] **Phase 18: Research Quality Gate** — Admin reviews research sufficiency (not hypothesis content) via traffic-light indicator; hypothesis approve/reject buttons removed from admin UI
- [ ] **Phase 19: Client Hypothesis Validation** — Prospects confirm or decline hypotheses on their /voor/ dashboard; admin sees results in prospect detail
- [ ] **Phase 20: One-Click Send Queue + Pipeline View** — Unified per-channel send queue with inline preview; pipeline stage chip on every prospect row; queue filters to actionable stages only with urgency ranking
- [ ] **Phase 21: Prospect Discovery + Cleanup** — Apollo sector search for batch prospect import; dead admin pages removed

---

## Phase Details

### Phase 17: Evidence Pipeline Enrichment

**Goal:** Research pipeline collects substantially more evidence per prospect so that the quality gate introduced in Phase 18 has meaningful data to assess — not just homepage content.

**Depends on:** Phase 15 (v1.2 complete)

**Requirements:** EVID-06, EVID-07, EVID-08, EVID-09

**Success Criteria** (what must be TRUE when this phase completes):

1. Running research on a prospect with a sitemap.xml discovers and crawls internal pages listed there instead of guessing paths (no more constructed URL 404s)
2. Research includes Google search results for the company name combined with terms like "reviews", "vacatures", and "nieuws" — surfacing external mentions that homepage crawling would miss
3. Research includes company profile data from LinkedIn (description, employee count, industry, recent posts) where the page is publicly accessible
4. Research includes company data from KvK registry (legal form, SBI sector code, registered address, employee range, financial filings) for Dutch companies
5. After re-running research on a previously thin prospect, the evidence count is meaningfully higher and the source list includes at least two distinct source types

**Plans:** 3 plans in 2 waves

Plans:

- [x] 17-01-PLAN.md — Sitemap URL discovery module (EVID-06) + Google search mention discovery (EVID-07) (Wave 1)
- [x] 17-02-PLAN.md — REGISTRY schema enum + KVK env vars + KvK registry module (EVID-09) + crawl4ai fallback fix (Wave 1)
- [x] 17-03-PLAN.md — Wire all new sources into research executor + LinkedIn evidence (EVID-08) (Wave 2)

---

### Phase 18: Research Quality Gate

**Goal:** Admin reviews whether research is sufficient before approving for outreach — using a traffic-light quality indicator — and hypothesis approve/reject is removed from the admin because prospects will validate hypotheses themselves on /voor/.

**Depends on:** Phase 17 (evidence pipeline must be enriched so quality gate has meaningful data; thin evidence pool makes quality indicator permanently red)

**Requirements:** RQUAL-01, RQUAL-02, RQUAL-03, RQUAL-04, HYPO-05

**Success Criteria** (what must be TRUE when this phase completes):

1. Every prospect row in the admin list shows a traffic-light chip (red/amber/green) derived from evidence count, confidence scores, and source diversity — without opening the prospect
2. Admin can click the quality chip to see a breakdown: how many evidence items were found, their average confidence, how many source types contributed, and how many hypotheses were generated
3. Admin can mark research as reviewed (green-lighting it for outreach) or request another research run — the decision is stored and visible on subsequent visits
4. Admin can proceed with an amber-quality prospect by confirming "proceed with limited research" — the system records this override and does not block outreach
5. The hypothesis approve/reject buttons are gone from the admin Analysis section; instead hypotheses show their current status (Pending prospect validation, Confirmed, Declined) as read-only badges

**Plans:** 3 plans in 2 waves

Plans:

- [ ] 18-01-PLAN.md — Schema migration (quality fields on ResearchRun, PENDING/DECLINED enum) + tRPC approveQuality + extend listProspects + computeTrafficLight helper (Wave 1)
- [ ] 18-02-PLAN.md — QualityChip component + wire into prospect list and detail header (Wave 2)
- [ ] 18-03-PLAN.md — Remove hypothesis accept/reject buttons from admin, add read-only badges, fix /voor/ filter (Wave 2)

---

### Phase 19: Client Hypothesis Validation

**Goal:** Prospects can tell Qualifai which pain-point hypotheses apply to their team directly on their /voor/ dashboard — shifting hypothesis validation from admin guesswork to prospect confirmation.

**Depends on:** Phase 18 (HYPO-05 must ship first — admin no longer approves hypothesis content, so PENDING status and the new status enum values must exist before the /voor/ UI can use them)

**Requirements:** HYPO-06, HYPO-07

**Success Criteria** (what must be TRUE when this phase completes):

1. After the first outreach email is sent to a prospect, their /voor/ dashboard shows a section where they can confirm or decline each hypothesis with a single click per hypothesis
2. A prospect who confirms a hypothesis sees it marked as confirmed on their dashboard; one who declines sees it acknowledged without re-showing
3. When a prospect validates (confirms or declines) a hypothesis, the result appears in the admin prospect detail Analysis section within the next page load — without the admin having to do anything
4. The hypothesis validation card presents the pain-point hypothesis statement, not the email message text — the prospect is evaluating whether the pain point applies, not approving the outreach

**Plans:** TBD (run /gsd:plan-phase 19 to break down)

---

### Phase 20: One-Click Send Queue + Pipeline View

**Goal:** Admin can approve and send any outreach channel with a single click from a unified queue that shows only actionable prospects — and every prospect has a visible pipeline stage so the admin knows state at a glance without opening records.

**Depends on:** Phase 18 (queue must filter by quality-approved prospects; quality gate must exist before send queue surfaces only post-gate items)

**Requirements:** SEND-01, SEND-02, PIPE-01, PIPE-02, PIPE-03

**Success Criteria** (what must be TRUE when this phase completes):

1. Admin opens the send queue and sees one row per pending outreach action (email draft, LinkedIn task, WhatsApp task, call task) — each row shows the prospect name, channel icon, and an inline content preview without page navigation required
2. Clicking the single action button on a queue row sends or marks the action complete; the row disappears from the queue; clicking the same button twice (or in two tabs) does not send the message twice
3. Every prospect in the Companies list and in the prospect detail header shows a pipeline stage chip with one of: Imported, Researching, Reviewed, Ready, Sending, Engaged, Booked
4. The action queue dashboard hides prospects that are still in the Researching stage — only actionable-stage prospects appear, eliminating research-in-progress noise
5. Prospects with recent /voor/ dashboard activity (page visit, PDF download, call booked) appear earlier in the action queue than unengaged prospects at the same stage

**Plans:** TBD (run /gsd:plan-phase 20 to break down)

---

### Phase 21: Prospect Discovery + Cleanup

**Goal:** Admin can find and import new prospects by searching Apollo by sector and location instead of adding them one by one — and dead admin pages that no longer serve any workflow are removed.

**Depends on:** Phase 18 (quality gate must be in place so newly imported prospects flow through the correct review process)

**Requirements:** DISC-01, CLEAN-01

**Success Criteria** (what must be TRUE when this phase completes):

1. Admin can type a sector and location (e.g., "marketingbureaus Amsterdam") into a search form and see a list of Apollo company results with company name, domain, employee count, and industry visible before importing
2. Admin can select one or more results from the search and import them as prospects in a single action — duplicates (already-imported companies) are skipped with a visible count
3. The pages /admin/hypotheses, /admin/research, and /admin/briefs return 404 or redirect — no direct URL can reach dead admin pages that are no longer part of any workflow

**Plans:** TBD (run /gsd:plan-phase 21 to break down)

---

## Progress

**Execution order (v2.0):** 17 → 18 → 19 → 20 → 21

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
| 18. Research Quality Gate           | v2.0      | 0/?            | Not started | -          |
| 19. Client Hypothesis Validation    | v2.0      | 0/?            | Not started | -          |
| 20. One-Click Send Queue + Pipeline | v2.0      | 0/?            | Not started | -          |
| 21. Prospect Discovery + Cleanup    | v2.0      | 0/?            | Not started | -          |
