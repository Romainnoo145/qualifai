# Requirements: Qualifai v8.0 Unified Outreach Pipeline

**Defined:** 2026-03-16
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service the sender actually delivers. No spray-and-pray.

## v8.0 Requirements

### Unified Email Pipeline

- [x] **PIPE-01**: Prospect detail "Generate Email" uses AI engine (generateIntroEmail) instead of template-based WorkflowLossMap
- [ ] **PIPE-02**: All drafts (intro, follow-up, signal-triggered) appear in one unified draft queue on outreach page
- [ ] **PIPE-03**: Draft queue groups drafts by scheduled send date with date section headers ("Vandaag", "Morgen", "Woensdag 18 mrt")
- [ ] **PIPE-04**: Prospect detail shows outreach status and links to related drafts in the queue
- [x] **PIPE-05**: OutreachLog gains prospectId denormalization for direct prospect-to-draft queries

### Signal Detection

- [x] **SGNL-01**: After each research run, evidence items are compared with the previous run to detect changes (new job listings, headcount growth, funding events, technology changes)
- [x] **SGNL-02**: Detected changes create Signal records with appropriate SignalType and link to prospect/contact
- [x] **SGNL-03**: Signal detection includes lookback dedup — same unchanged conditions don't re-trigger signals every 14 days
- [x] **SGNL-04**: Signal detection is wired into research refresh cron (runs automatically after each refresh)
- [x] **SGNL-05**: Existing automation rules (AUTOMATION_RULES) trigger AI-generated drafts from detected signals
- [x] **SGNL-06**: processSignal uses atomic claim (updateMany status guard) to prevent duplicate drafts from concurrent runs

### AI Cadence Follow-ups

- [x] **CDNC-01**: Cadence follow-ups are generated via AI with actual email body text (not empty placeholders)
- [x] **CDNC-02**: Follow-ups use evidence from ProspectAnalysis narrative and recent signals for evidence-enriched content
- [ ] **CDNC-03**: Follow-ups appear in the unified draft queue for review before sending
- [x] **CDNC-04**: Cadence automatically pauses when prospect replies (existing behavior preserved)

### Code Consolidation

- [x] **CNSL-01**: loadProjectSender consolidated into single shared module (currently duplicated in 3 files)
- [x] **CNSL-02**: OutreachContext extended with optional evidence fields (non-breaking, enriches all email generation)
- [x] **CNSL-03**: WorkflowLossMap template engine removed (createWorkflowLossMapDraft, assets.generate, assets.queueOutreachDraft)
- [x] **CNSL-04**: generateMasterAnalysis v1 function removed from master-analyzer.ts
- [x] **CNSL-05**: classifyDraftRisk updated to work with AI-generated drafts (not require workflowLossMapId)

## v8.1 Requirements (Deferred)

### Advanced Signal Detection

- **SGNL-07**: TECHNOLOGY_ADOPTION signal detection from website tech stack changes
- **SGNL-08**: Signal detection also runs on manually-triggered research runs (not just cron)
- **SGNL-09**: Signal-triggered drafts show distinct visual indicator in queue vs manual intro drafts

### Outreach Analytics

- **ANLYT-01**: Open/click/reply rates per prospect visible in admin
- **ANLYT-02**: Conversion funnel per campaign

## Out of Scope

| Feature                        | Reason                                                             |
| ------------------------------ | ------------------------------------------------------------------ |
| JOB_CHANGE / PROMOTION signals | Requires periodic LinkedIn profile monitoring — rate limiting risk |
| INTENT_TOPIC signals           | Requires paid intent data providers (Bombora/G2) — no free source  |
| Auto-send without review       | Trust not yet calibrated at 100+ scale, GDPR risk                  |
| Real-time signal detection     | Overkill — 14-day batch is sufficient for B2B sales cycles         |
| External signal providers      | No cost budget — all detection from existing evidence data         |

## Traceability

| Requirement | Phase | Status   |
| ----------- | ----- | -------- |
| CNSL-01     | 55    | Complete |
| CNSL-02     | 55    | Complete |
| PIPE-01     | 56    | Complete |
| PIPE-05     | 56    | Complete |
| CNSL-03     | 56    | Complete |
| CNSL-04     | 56    | Complete |
| CNSL-05     | 56    | Complete |
| SGNL-01     | 57    | Complete |
| SGNL-02     | 57    | Complete |
| SGNL-03     | 57    | Complete |
| SGNL-06     | 57    | Complete |
| SGNL-04     | 58    | Complete |
| SGNL-05     | 58    | Complete |
| PIPE-02     | 59    | Pending  |
| PIPE-03     | 59    | Pending  |
| PIPE-04     | 59    | Pending  |
| CDNC-01     | 59    | Complete |
| CDNC-02     | 59    | Complete |
| CDNC-03     | 59    | Pending  |
| CDNC-04     | 59    | Complete |

**Coverage:**

- v8.0 requirements: 20 total
- Mapped to phases: 20/20
- Unmapped: 0

---

_Requirements defined: 2026-03-16_
_Traceability updated: 2026-03-16_
