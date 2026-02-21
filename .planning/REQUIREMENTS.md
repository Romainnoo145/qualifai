# Requirements: Qualifai

**Defined:** 2026-02-20
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers.

## v1.2 Requirements

Requirements for milestone v1.2: Autopilot with Oversight. Each maps to roadmap phases.

### Dashboard

- [ ] **DASH-01**: Admin sees a unified action queue on the dashboard showing items needing decisions (hypotheses to review, drafts to approve, calls to make, replies to handle)
- [ ] **DASH-02**: Each action item links directly to where the admin can take action
- [ ] **DASH-03**: Dashboard shows counts per action type with urgency indicators

### Navigation

- [ ] **NAV-01**: Admin navigates between 6 items: Dashboard, Companies, Campaigns, Draft Queue, Use Cases, Signals
- [ ] **NAV-02**: Nav groups are clear and logically organized

### Prospect Detail

- [ ] **DETAIL-01**: Admin sees prospect story as Evidence → Analysis → Outreach Preview → Results flow
- [ ] **DETAIL-02**: Evidence section shows what was scraped with sources visible
- [ ] **DETAIL-03**: Analysis section shows hypotheses with reasoning (why this conclusion from that evidence)
- [ ] **DETAIL-04**: Outreach Preview shows exactly what the prospect will receive (emails, dashboard content)
- [ ] **DETAIL-05**: Results section shows engagement (opens, replies, bookings, conversions)

### Campaigns

- [ ] **CAMP-01**: Admin can create a campaign as a named cohort of prospects (by industry/segment)
- [ ] **CAMP-02**: Admin sees funnel visualization per campaign (imported → researched → approved → emailed → replied → booked)
- [ ] **CAMP-03**: Admin sees per-prospect status within a campaign
- [ ] **CAMP-04**: Admin sees conversion metrics (response rate, booking rate)

### Terminology

- [ ] **TERM-01**: All UI labels use plain language (no Loss Map, Call Prep, Nodes, Sprint Intelligence)
- [ ] **TERM-02**: Internal technical terms replaced with user-facing equivalents throughout the app

## v1.1 Requirements (Complete)

All v1.1 requirements shipped 2026-02-21.

### Use Cases

- [x] **UCASE-01**: Admin can create, edit, and delete use cases (service offerings) in a dedicated "Use Cases" tab
- [x] **UCASE-02**: Admin can import use cases from Obsidian vault JSON files (inventory + client offers)
- [x] **UCASE-03**: Each use case has: title, description, category, outcomes, case study references
- [x] **UCASE-04**: AI-powered matching links prospect pain points to relevant use cases using Claude

### Evidence Pipeline

- [x] **EVID-01**: SerpAPI discovers review URLs, job listing URLs, and support docs for a prospect's domain
- [x] **EVID-02**: Playwright extracts content from discovered URLs (browser-rendered, handles JS)
- [x] **EVID-03**: Playwright runs via managed browser API or worker service (not in Next.js request cycle)
- [x] **EVID-04**: SerpAPI results are cached per prospect to control costs
- [x] **EVID-05**: Cookie consent banners (Cookiebot) are handled during Playwright extraction

### Hypothesis & Approval

- [x] **HYPO-01**: AI generates hypothesis (pain point + matched services + supporting evidence) per prospect
- [x] **HYPO-02**: Admin reviews hypothesis with matched use cases and source evidence in a review UI
- [x] **HYPO-03**: Admin can approve or reject a hypothesis before outreach is generated
- [x] **HYPO-04**: Outreach is blocked until at least one hypothesis is approved for the prospect

### Multi-Touch Cadence

- [x] **CADNC-01**: Cadence engine automatically creates touch tasks across email, call, LinkedIn, WhatsApp
- [x] **CADNC-02**: Cadence schedule is engagement-driven (not fixed timing)
- [x] **CADNC-03**: Completing a touch task triggers evaluation of next step in cadence
- [x] **CADNC-04**: Cadence scheduling uses DB columns (not JSON metadata) for cron-queryable timestamps
- [x] **CADNC-05**: Cron job processes due cadence steps on a schedule

### Engagement Tracking

- [x] **ENGAG-01**: Wizard view (step >= 3) triggers immediate call task creation
- [x] **ENGAG-02**: PDF download triggers immediate call task creation
- [x] **ENGAG-03**: Email reply (interested) triggers immediate call task creation
- [x] **ENGAG-04**: Resend webhook captures email open/click events
- [x] **ENGAG-05**: Email opens are NOT used for cadence escalation (Apple MPP false positives)

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Automation

- **AUTO-01**: Bulk prospect import from Apollo search results (batch add)
- **AUTO-02**: Campaign-level batch processing (process all unprocessed prospects)

### Advanced Cadence

- **CADNC-06**: A/B testing of cadence sequences
- **CADNC-07**: AI-generated cadence timing optimization based on historical data
- **CADNC-08**: Auto-close contacts after N unsuccessful touches

### Analytics

- **ANLYT-01**: Channel effectiveness reporting (email vs call vs LinkedIn vs WhatsApp)
- **ANLYT-02**: Evidence quality scoring trends over time

### Integrations

- **INTGR-01**: LinkedIn API automation (pending ToS evaluation)
- **INTGR-02**: WhatsApp Business API integration
- **INTGR-03**: CRM sync (HubSpot/Pipedrive export)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                               | Reason                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------ |
| New backend pipeline features         | v1.2 is UI/UX only — pipeline works, just needs better visibility        |
| Database schema changes for campaigns | Reuse existing Campaign/CampaignProspect models, add queries not columns |
| New integrations                      | No new APIs — focus on surfacing existing data better                    |
| Public-facing changes (/voor/)        | Admin-side only — prospect dashboard stays as-is                         |
| LinkedIn API automation               | ToS risk, manual tasks only for now                                      |
| WhatsApp API integration              | Too complex/expensive, manual tasks only                                 |
| Auto-approval of hypotheses           | Manual quality gate is the product differentiator                        |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase    | Status  |
| ----------- | -------- | ------- |
| NAV-01      | Phase 12 | Pending |
| NAV-02      | Phase 12 | Pending |
| TERM-01     | Phase 12 | Pending |
| DETAIL-01   | Phase 13 | Pending |
| DETAIL-02   | Phase 13 | Pending |
| DETAIL-03   | Phase 13 | Pending |
| DETAIL-04   | Phase 13 | Pending |
| DETAIL-05   | Phase 13 | Pending |
| TERM-02     | Phase 13 | Pending |
| CAMP-01     | Phase 14 | Pending |
| CAMP-02     | Phase 14 | Pending |
| CAMP-03     | Phase 14 | Pending |
| CAMP-04     | Phase 14 | Pending |
| DASH-01     | Phase 15 | Pending |
| DASH-02     | Phase 15 | Pending |
| DASH-03     | Phase 15 | Pending |

**Coverage:**

- v1.2 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---

_Requirements defined: 2026-02-20_
_Last updated: 2026-02-21 after v1.2 roadmap creation_
