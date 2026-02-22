# Requirements: Qualifai

**Defined:** 2026-02-20
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers.

## v2.0 Requirements

Requirements for milestone v2.0: Streamlined Flow. Each maps to roadmap phases.

### Research Quality (RQUAL)

- [ ] **RQUAL-01**: Admin can see a traffic-light quality indicator (red/amber/green) per prospect on the list view and detail header
- [ ] **RQUAL-02**: Admin can click the quality indicator to see what evidence the system found (count, confidence, source diversity)
- [ ] **RQUAL-03**: Admin can proceed with amber-quality prospects via explicit "proceed with limited research" confirmation
- [ ] **RQUAL-04**: Admin can inspect whether each hypothesis is grounded in real evidence before research is marked as reviewed

### Evidence Pipeline (EVID-v2)

- [ ] **EVID-06**: Research pipeline discovers relevant pages via sitemap.xml crawling instead of guessing URLs
- [ ] **EVID-07**: Research pipeline finds mentions via broader Google search queries (company name + reviews, vacatures, news)
- [ ] **EVID-08**: Research pipeline extracts company info from LinkedIn company pages
- [ ] **EVID-09**: Research pipeline enriches prospects with KvK (Kamer van Koophandel) registry data (industry, employee count, financials)

### Hypothesis Flow (HYPO-v2)

- [ ] **HYPO-05**: Admin reviews research quality (not hypothesis content) — hypothesis approve/reject buttons removed from admin
- [ ] **HYPO-06**: Prospect can see and validate hypotheses on their /voor/ dashboard after first outreach email is sent
- [ ] **HYPO-07**: When prospect confirms/declines a hypothesis on /voor/, admin sees the result in the prospect detail

### Send Queue (SEND)

- [ ] **SEND-01**: Admin can approve and send a draft from the queue with one click, seeing an inline content preview without page navigation
- [ ] **SEND-02**: System prevents double-sends via idempotency guard (atomic status claim before send)

### Pipeline Visibility (PIPE)

- [ ] **PIPE-01**: Each prospect shows a visible pipeline stage chip (Imported → Researching → Reviewed → Ready → Sending → Engaged → Booked) on list view and detail header
- [ ] **PIPE-02**: Action queue dashboard only surfaces prospects in actionable stages (hides research-in-progress noise)
- [ ] **PIPE-03**: Prospects with recent /voor/ engagement (dashboard visit, PDF download, call booked) are ranked higher in the action queue

### Prospect Discovery (DISC)

- [ ] **DISC-01**: Admin can search for prospects by sector and location (e.g., "marketing agencies Amsterdam") and import from results

### Cleanup (CLEAN)

- [ ] **CLEAN-01**: Dead admin pages (/admin/hypotheses, /admin/research, /admin/briefs) are removed

## v1.2 Requirements (Complete)

All v1.2 requirements shipped 2026-02-22.

### Dashboard

- [x] **DASH-01**: Admin sees a unified action queue on the dashboard showing items needing decisions
- [x] **DASH-02**: Each action item links directly to where the admin can take action
- [x] **DASH-03**: Dashboard shows counts per action type with urgency indicators

### Navigation

- [x] **NAV-01**: Admin navigates between 6 items: Dashboard, Companies, Campaigns, Draft Queue, Use Cases, Signals
- [x] **NAV-02**: Nav groups are clear and logically organized

### Prospect Detail

- [x] **DETAIL-01**: Admin sees prospect story as Evidence → Analysis → Outreach Preview → Results flow
- [x] **DETAIL-02**: Evidence section shows what was scraped with sources visible
- [x] **DETAIL-03**: Analysis section shows hypotheses with reasoning
- [x] **DETAIL-04**: Outreach Preview shows exactly what the prospect will receive
- [x] **DETAIL-05**: Results section shows engagement data

### Campaigns

- [x] **CAMP-01**: Admin can create a campaign as a named cohort of prospects
- [x] **CAMP-02**: Admin sees funnel visualization per campaign
- [x] **CAMP-03**: Admin sees per-prospect status within a campaign
- [x] **CAMP-04**: Admin sees conversion metrics

### Terminology

- [x] **TERM-01**: All UI labels use plain language
- [x] **TERM-02**: Internal technical terms replaced throughout

## v1.1 Requirements (Complete)

All v1.1 requirements shipped 2026-02-21.

### Use Cases

- [x] **UCASE-01**: Admin can create, edit, and delete use cases
- [x] **UCASE-02**: Admin can import use cases from Obsidian vault
- [x] **UCASE-03**: Each use case has: title, description, category, outcomes, case study references
- [x] **UCASE-04**: AI-powered matching links prospect pain points to relevant use cases

### Evidence Pipeline

- [x] **EVID-01**: SerpAPI discovers review URLs, job listing URLs, and support docs
- [x] **EVID-02**: Playwright extracts content from discovered URLs
- [x] **EVID-03**: Playwright runs via managed browser API
- [x] **EVID-04**: SerpAPI results are cached per prospect
- [x] **EVID-05**: Cookie consent banners are handled during extraction

### Hypothesis & Approval

- [x] **HYPO-01**: AI generates hypothesis per prospect
- [x] **HYPO-02**: Admin reviews hypothesis with matched use cases
- [x] **HYPO-03**: Admin can approve or reject a hypothesis
- [x] **HYPO-04**: Outreach is blocked until at least one hypothesis is approved

### Multi-Touch Cadence

- [x] **CADNC-01**: Cadence engine auto-creates touch tasks across 4 channels
- [x] **CADNC-02**: Cadence schedule is engagement-driven
- [x] **CADNC-03**: Completing a touch triggers next step evaluation
- [x] **CADNC-04**: Scheduling uses DB columns for cron-queryable timestamps
- [x] **CADNC-05**: Cron job processes due cadence steps

### Engagement Tracking

- [x] **ENGAG-01**: Wizard view triggers immediate call task
- [x] **ENGAG-02**: PDF download triggers immediate call task
- [x] **ENGAG-03**: Interested reply triggers immediate call task
- [x] **ENGAG-04**: Resend webhook captures open/click events
- [x] **ENGAG-05**: Email opens NOT used for cadence escalation

## Future Requirements

Deferred to future milestones.

### Automation

- **AUTO-01**: Bulk prospect import from Apollo search results (batch add)
- **AUTO-02**: Campaign-level batch processing

### Advanced Cadence

- **CADNC-06**: A/B testing of cadence sequences
- **CADNC-07**: AI-generated cadence timing optimization
- **CADNC-08**: Auto-close after N unsuccessful touches

### Analytics

- **ANLYT-01**: Channel effectiveness reporting
- **ANLYT-02**: Evidence quality scoring trends

### Integrations

- **INTGR-01**: LinkedIn API automation
- **INTGR-02**: WhatsApp Business API
- **INTGR-03**: CRM sync (HubSpot/Pipedrive)

## Out of Scope

| Feature                               | Reason                                                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| "Need more research" re-run button    | Current pipeline is too narrow — re-running gets same results. Fix the pipeline first (EVID-06 through EVID-09), then consider re-run flows. |
| Kanban board pipeline view            | Only warranted at 100+ active prospects. List with stage chips is sufficient at current volumes.                                             |
| Auto-send without approval            | Trust not yet calibrated. GDPR/anti-spam risk for NL/BE market. Keep human approval gate.                                                    |
| Bulk approve above threshold          | Add after single-approve flow is working smoothly (v2.1).                                                                                    |
| Confidence-gated auto-advance         | Requires quality scoring to be stable for 2+ weeks first (v2.1).                                                                             |
| Global research threshold             | Different industries have different evidence availability. Dutch bakery ≠ SaaS company.                                                      |
| Research completeness as hard blocker | Makes system unusable for thin-presence Dutch SMBs. Soft gate only.                                                                          |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement               | Phase | Status |
| ------------------------- | ----- | ------ |
| (populated by roadmapper) |       |        |

**Coverage:**

- v2.0 requirements: 18 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 18

---

_Requirements defined: 2026-02-20_
_Last updated: 2026-02-22 after v2.0 milestone definition_
