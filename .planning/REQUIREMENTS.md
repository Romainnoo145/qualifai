# Requirements: Qualifai v5.0 Atlantis Intelligence & NDA Pipeline

**Defined:** 2026-03-07
**Core Value:** The Atlantis discover page must intrigue prospects into seeing Europe's Gate as the project that could transform their industry — through AI-generated, prospect-specific narrative backed by real evidence and hard numbers from the Atlantis dossier.

## v5.0 Requirements

Requirements for the Atlantis intelligence overhaul. Replaces template-based opportunity cards and rule-based triggers with AI-powered content generation.

### Extraction

- [x] **EXTR-01**: Scraper output is analyzed into structured intent variables (sector fit, operational pains, ESG/CSRD signals, investment/growth patterns, workforce signals) with source attribution
- [ ] **EXTR-02**: Intent variables drive RAG query construction, replacing keyword-stuffed profile fragments with targeted evidence-seeking queries
- [x] **EXTR-03**: Extraction runs as part of the research pipeline and persists intent variables to DB for downstream analysis

### Analysis

- [ ] **ANLS-01**: AI master prompt combines intent variables + RAG passages to generate full discover page content (context, triggers, tracks)
- [ ] **ANLS-02**: Context section output includes prospect-specific hook, 3 scale KPIs from RAG docs, and executive hook tying their pain to Atlantis solution
- [ ] **ANLS-03**: Trigger section output generates 3 cards (market / compliance-ESG / capital de-risking) with specific numbers from RAG
- [ ] **ANLS-04**: Partnership section output generates commercial tracks with scope and strategic tags per SPV
- [ ] **ANLS-05**: All generated content uses boardroom tone — visionary, data-backed, no AI/RAG/scraping terminology visible
- [ ] **ANLS-06**: Analysis output persists to DB and is renderable by discover page without further AI calls

### Discover

- [ ] **DISC-01**: Atlantis discover renders three sections: Context (hook) → Triggers (why you, why now) → Partnership (tracks + CTA)
- [ ] **DISC-02**: Context section shows hook subtitle, 3 KPI blocks, and executive hook from persisted analysis
- [ ] **DISC-03**: Trigger cards render with specific numbers, urgency indicators, and evidence attribution
- [ ] **DISC-04**: Partnership section renders commercial tracks with scope, strategic tags, and interest CTA
- [ ] **DISC-05**: Visual design matches boardroom tone — clean, confident, data-rich, no generic "bridge" language

### Validation

- [ ] **VALD-01**: End-to-end Atlantis flow succeeds with a real prospect (scrape → extract → analyze → discover renders correctly)
- [ ] **VALD-02**: Existing Klarifai prospects remain unaffected (regression)

## v6.0 Requirements (Deferred)

### NDA Pipeline

- **NDA-01**: Digital NDA e-sign flow built into discover dashboard (legal text, signature, PDF generation)
- **NDA-02**: Signed NDA stored in DB with timestamp and prospect linkage
- **NDA-03**: Post-NDA content unlock — additional dossier sections become visible after signing
- **NDA-04**: Admin notification on NDA signing with prospect details

## Out of Scope

| Feature                            | Reason                                              |
| ---------------------------------- | --------------------------------------------------- |
| NDA e-sign flow                    | Deferred to v6.0 — analysis quality is the priority |
| Admin SPV assignment UI            | Deferred from v4.0 — no operational need proven     |
| Partnership-to-campaign conversion | Deferred from v4.0 — needs NDA flow first           |
| Precision financial projections    | Goal is intrigue/scale, not verified business cases |
| Multi-language discover            | Dutch only for now                                  |

## Traceability

| Requirement | Phase    | Status   |
| ----------- | -------- | -------- |
| EXTR-01     | Phase 42 | Complete |
| EXTR-02     | Phase 42 | Pending  |
| EXTR-03     | Phase 42 | Complete |
| ANLS-01     | Phase 43 | Pending  |
| ANLS-02     | Phase 43 | Pending  |
| ANLS-03     | Phase 43 | Pending  |
| ANLS-04     | Phase 43 | Pending  |
| ANLS-05     | Phase 43 | Pending  |
| ANLS-06     | Phase 43 | Pending  |
| DISC-01     | Phase 44 | Pending  |
| DISC-02     | Phase 44 | Pending  |
| DISC-03     | Phase 44 | Pending  |
| DISC-04     | Phase 44 | Pending  |
| DISC-05     | Phase 44 | Pending  |
| VALD-01     | Phase 45 | Pending  |
| VALD-02     | Phase 45 | Pending  |

**Coverage:**

- v5.0 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---

_Requirements defined: 2026-03-07_
_Last updated: 2026-03-07 after roadmap creation_
