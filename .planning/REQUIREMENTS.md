# Requirements: Qualifai

**Defined:** 2026-02-20
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers.

## v1.1 Requirements

Requirements for milestone v1.1: Evidence-Backed Multi-Touch Outreach. Each maps to roadmap phases.

### Use Cases

- [ ] **UCASE-01**: Admin can create, edit, and delete use cases (service offerings) in a dedicated "Use Cases" tab
- [ ] **UCASE-02**: Admin can import use cases from Obsidian vault JSON files (inventory + client offers)
- [ ] **UCASE-03**: Each use case has: title, description, category, outcomes, case study references
- [ ] **UCASE-04**: AI-powered matching links prospect pain points to relevant use cases using Claude

### Evidence Pipeline

- [ ] **EVID-01**: SerpAPI discovers review URLs, job listing URLs, and support docs for a prospect's domain
- [ ] **EVID-02**: Playwright extracts content from discovered URLs (browser-rendered, handles JS)
- [ ] **EVID-03**: Playwright runs via managed browser API or worker service (not in Next.js request cycle)
- [ ] **EVID-04**: SerpAPI results are cached per prospect to control costs
- [ ] **EVID-05**: Cookie consent banners (Cookiebot) are handled during Playwright extraction

### Hypothesis & Approval

- [ ] **HYPO-01**: AI generates hypothesis (pain point + matched services + supporting evidence) per prospect
- [ ] **HYPO-02**: Admin reviews hypothesis with matched use cases and source evidence in a review UI
- [ ] **HYPO-03**: Admin can approve or reject a hypothesis before outreach is generated
- [ ] **HYPO-04**: Outreach is blocked until at least one hypothesis is approved for the prospect

### Multi-Touch Cadence

- [ ] **CADNC-01**: Cadence engine automatically creates touch tasks across email, call, LinkedIn, WhatsApp
- [ ] **CADNC-02**: Cadence schedule is engagement-driven (not fixed timing)
- [ ] **CADNC-03**: Completing a touch task triggers evaluation of next step in cadence
- [ ] **CADNC-04**: Cadence scheduling uses DB columns (not JSON metadata) for cron-queryable timestamps
- [ ] **CADNC-05**: Cron job processes due cadence steps on a schedule

### Engagement Tracking

- [ ] **ENGAG-01**: Wizard view (step >= 3) triggers immediate call task creation
- [ ] **ENGAG-02**: PDF download triggers immediate call task creation
- [ ] **ENGAG-03**: Email reply (interested) triggers immediate call task creation
- [ ] **ENGAG-04**: Resend webhook captures email open/click events
- [ ] **ENGAG-05**: Email opens are NOT used for cadence escalation (Apple MPP false positives)

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Advanced Cadence

- **CADNC-06**: A/B testing of cadence sequences
- **CADNC-07**: AI-generated cadence timing optimization based on historical data
- **CADNC-08**: Auto-close contacts after N unsuccessful touches

### Analytics

- **ANLYT-01**: Conversion funnel dashboard (research → hypothesis → outreach → reply → booking)
- **ANLYT-02**: Channel effectiveness reporting (email vs call vs LinkedIn vs WhatsApp)
- **ANLYT-03**: Evidence quality scoring trends over time

### Integrations

- **INTGR-01**: LinkedIn API automation (pending ToS evaluation)
- **INTGR-02**: WhatsApp Business API integration
- **INTGR-03**: CRM sync (HubSpot/Pipedrive export)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                              | Reason                                               |
| ------------------------------------ | ---------------------------------------------------- |
| LinkedIn API automation              | ToS risk, manual tasks only for now                  |
| WhatsApp API integration             | Too complex/expensive, manual tasks only             |
| Bulk email sending without evidence  | Contradicts core value                               |
| Auto-approval of hypotheses          | Manual quality gate is the product differentiator    |
| Email open-driven cadence escalation | Apple MPP makes opens ~50% false positives           |
| Real-time Playwright in API routes   | Kills Railway container; must use worker/managed API |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status  |
| ----------- | ----- | ------- |
| UCASE-01    | 6     | Pending |
| UCASE-02    | 6     | Pending |
| UCASE-03    | 6     | Pending |
| UCASE-04    | 6     | Pending |
| EVID-01     | 8     | Pending |
| EVID-02     | 8     | Pending |
| EVID-03     | 8     | Pending |
| EVID-04     | 8     | Pending |
| EVID-05     | 8     | Pending |
| HYPO-01     | 7     | Pending |
| HYPO-02     | 7     | Pending |
| HYPO-03     | 7     | Pending |
| HYPO-04     | 7     | Pending |
| CADNC-01    | 10    | Pending |
| CADNC-02    | 10    | Pending |
| CADNC-03    | 10    | Pending |
| CADNC-04    | 10    | Pending |
| CADNC-05    | 10    | Pending |
| ENGAG-01    | 9     | Pending |
| ENGAG-02    | 9     | Pending |
| ENGAG-03    | 9     | Pending |
| ENGAG-04    | 9     | Pending |
| ENGAG-05    | 9     | Pending |

**Coverage:**

- v1.1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---

_Requirements defined: 2026-02-20_
_Last updated: 2026-02-20 after roadmap creation (phases 6-10 assigned)_
