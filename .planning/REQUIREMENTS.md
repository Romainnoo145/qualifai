# Requirements: Qualifai v6.0 Outreach Simplification

**Defined:** 2026-03-08
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service the sender actually delivers. No spray-and-pray.

## v6.0 Requirements

Requirements for outreach simplification. Removes manual multi-touch task management and automates cadence follow-ups.

### Cadence Automation

- [ ] **CADNC-01**: Cadence engine auto-generates personalized follow-up email drafts and places them in the Drafts Queue for approval
- [ ] **CADNC-02**: Non-email follow-ups (call, LinkedIn, WhatsApp) are auto-created by cadence engine as lightweight reminders (no manual task creation UI)
- [ ] **CADNC-03**: Cron sweep promotes due cadence steps directly to draft/reminder state without the touch_open intermediary

### UI Cleanup

- [ ] **UICL-01**: Multi-touch Tasks tab removed from outreach page (4 tabs → 3: Drafts, Replies, Sent History)
- [ ] **UICL-02**: Manual touch task creation form and related UI elements removed
- [ ] **UICL-03**: Non-email reminders displayed as a lightweight section in Drafts Queue (not a separate tab)

### Backend Cleanup

- [ ] **BKCL-01**: queueTouchTask tRPC endpoint removed
- [ ] **BKCL-02**: touch_open/touch_done/touch_skipped status values removed from outreach flow
- [ ] **BKCL-03**: completeTouchTask and skipTouchTask endpoints refactored to handle reminder dismissal

### SERP API Replacement

- [ ] **SERP-01**: Google News enrichment uses free RSS feed (news.google.com/rss/search) instead of SerpAPI
- [ ] **SERP-02**: Google Reviews enrichment uses Scrapling DynamicFetcher + Google Places API free tier instead of SerpAPI
- [ ] **SERP-03**: Deep URL discovery (review/job seed URLs) uses Scrapling Google search scraping instead of SerpAPI
- [ ] **SERP-04**: LinkedIn Jobs enrichment remains on SerpAPI (no free alternative) — isolated as the only SERP dependency

## Previous Milestone Requirements (v5.0 — Complete)

### Extraction

- [x] **EXTR-01**: Scraper output is analyzed into structured intent variables (sector fit, operational pains, ESG/CSRD signals, investment/growth patterns, workforce signals) with source attribution
- [x] **EXTR-02**: Intent variables drive RAG query construction, replacing keyword-stuffed profile fragments with targeted evidence-seeking queries
- [x] **EXTR-03**: Extraction runs as part of the research pipeline and persists intent variables to DB for downstream analysis

### Analysis

- [x] **ANLS-01**: AI master prompt combines intent variables + RAG passages to generate full discover page content (context, triggers, tracks)
- [x] **ANLS-02**: Context section output includes prospect-specific hook, 3 scale KPIs from RAG docs, and executive hook tying their pain to Atlantis solution
- [x] **ANLS-03**: Trigger section output generates 3 cards (market / compliance-ESG / capital de-risking) with specific numbers from RAG
- [x] **ANLS-04**: Partnership section output generates commercial tracks with scope and strategic tags per SPV
- [x] **ANLS-05**: All generated content uses boardroom tone — visionary, data-backed, no AI/RAG/scraping terminology visible
- [x] **ANLS-06**: Analysis output persists to DB and is renderable by discover page without further AI calls

### Discover

- [x] **DISC-01**: Atlantis discover renders three sections: Context (hook) → Triggers (why you, why now) → Partnership (tracks + CTA)
- [x] **DISC-02**: Context section shows hook subtitle, 3 KPI blocks, and executive hook from persisted analysis
- [x] **DISC-03**: Trigger cards render with specific numbers, urgency indicators, and evidence attribution
- [x] **DISC-04**: Partnership section renders commercial tracks with scope, strategic tags, and interest CTA
- [x] **DISC-05**: Visual design matches boardroom tone — clean, confident, data-rich, no generic "bridge" language

### Validation

- [x] **VALD-01**: End-to-end Atlantis flow succeeds with a real prospect (scrape → extract → analyze → discover renders correctly)
- [x] **VALD-02**: Existing Klarifai prospects remain unaffected (regression)

## Future Requirements (Deferred)

### NDA Pipeline

- **NDA-01**: Digital NDA e-sign flow built into discover dashboard (legal text, signature, PDF generation)
- **NDA-02**: Signed NDA stored in DB with timestamp and prospect linkage
- **NDA-03**: Post-NDA content unlock — additional dossier sections become visible after signing
- **NDA-04**: Admin notification on NDA signing with prospect details

## Out of Scope

| Feature                    | Reason                                            |
| -------------------------- | ------------------------------------------------- |
| NDA e-sign flow            | Deferred — analysis quality is the priority       |
| Admin SPV assignment UI    | Deferred from v4.0 — no operational need proven   |
| Auto-send without approval | Trust not calibrated, GDPR risk                   |
| LinkedIn API automation    | ToS risk                                          |
| WhatsApp API integration   | Too complex/expensive                             |
| Full CRM task manager      | Contradicts "autopilot with oversight" philosophy |

## Traceability

| Requirement | Phase | Status  |
| ----------- | ----- | ------- |
| CADNC-01    | 46    | Pending |
| CADNC-02    | 46    | Pending |
| CADNC-03    | 46    | Pending |
| UICL-01     | 47    | Pending |
| UICL-02     | 47    | Pending |
| UICL-03     | 47    | Pending |
| BKCL-01     | 46    | Pending |
| BKCL-02     | 46    | Pending |
| BKCL-03     | 46    | Pending |

**Coverage:**

- v6.0 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---

_Requirements defined: 2026-03-08_
_Last updated: 2026-03-08 after roadmap creation_
