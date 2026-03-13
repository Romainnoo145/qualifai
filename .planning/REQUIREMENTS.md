# Requirements: Qualifai v7.0 Atlantis Discover Pipeline Rebuild

**Defined:** 2026-03-13
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service the sender actually delivers. No spray-and-pray.

## v7.0 Requirements

Rebuild the pipeline from evidence to discover page. Evidence scrapers are good — everything after (intent extraction, RAG retrieval, master prompt, discover rendering) needs rebuilding to produce boardroom-quality narrative output.

### Pipeline (PIPE) — Evidence → Master Prompt

- [x] **PIPE-01**: Master prompt receives raw evidence items directly (not lossy intent variable summaries) — all 83+ evidence items for a prospect are available to the LLM
- [x] **PIPE-02**: Master prompt receives relevant RAG passages with source attribution — passages are selected by semantic relevance, not keyword-stuffed queries
- [x] **PIPE-03**: Master prompt generates flowing narrative content in boardroom Dutch — prospect-specific hooks, real numbers from evidence, natural citations ("U publiceerde uw EPD in oktober 2024")
- [x] **PIPE-04**: Generated narrative persists to DB as structured sections renderable without further AI calls
- [x] **PIPE-05**: Cross-prospect connections are surfaced when available (e.g., "Nedri werkt samen met Heijmans" when both are prospects)

### RAG Retrieval (RAG) — Query Quality

- [x] **RAG-01**: RAG queries are constructed from prospect evidence context (industry, pains, signals) — not from keyword-stuffed profile fragments
- [x] **RAG-02**: Retrieved passages include source document attribution (which Atlantis volume, which SPV context)
- [x] **RAG-03**: Passage ranking prioritizes prospect-relevance over generic similarity — steel manufacturer gets groenstaal passages, not generic waterstof

### Discover Rendering (DISC) — Page Design

- [x] **DISC-01**: Discover page renders as a flowing boardroom document — not a rigid 3-section wizard with cards
- [x] **DISC-02**: Opening section has a prospect-specific hook that demonstrates understanding of their business ("Uw grootste kostenpost wordt uw grootste concurrentievoordeel")
- [x] **DISC-03**: Body content weaves evidence naturally — specific numbers, dates, project names from both scraper evidence and RAG docs
- [ ] **DISC-04**: CTA drives NDA signing (not generic "intake gesprek") — positioned as gateway to confidential dossier
- [x] **DISC-05**: Visual design matches boardroom tone — clean, confident, data-rich, no template feel

### Validation (VALD)

- [ ] **VALD-01**: Nedri Spanstaal discover page quality matches or exceeds the hand-written gold standard example
- [ ] **VALD-02**: Pipeline produces comparable quality for other prospects with sufficient evidence
- [ ] **VALD-03**: Existing Klarifai (non-Atlantis) prospects remain unaffected

## Previous Milestone Requirements

<details>
<summary>v6.0 Outreach Simplification (Complete)</summary>

- [x] CADNC-01: Cadence engine auto-generates personalized follow-up email drafts
- [x] CADNC-02: Non-email follow-ups auto-created as lightweight reminders
- [x] CADNC-03: Cron sweep promotes due cadence steps directly to draft/reminder state
- [x] UICL-01: Multi-touch Tasks tab removed (4 → 3 tabs)
- [x] UICL-02: Manual touch task creation form removed
- [x] UICL-03: Non-email reminders displayed inline in Drafts Queue
- [x] BKCL-01: queueTouchTask endpoint removed
- [x] BKCL-02: touch_open/touch_done/touch_skipped status values removed
- [x] BKCL-03: completeTouchTask/skipTouchTask refactored for reminders
- SERP-01 through SERP-04: Deferred

</details>

<details>
<summary>v5.0 Atlantis Intelligence (Complete)</summary>

- [x] EXTR-01 through EXTR-03: Intent extraction pipeline
- [x] ANLS-01 through ANLS-06: AI master analysis generation
- [x] DISC-01 through DISC-05: Discover rendering
- [x] VALD-01, VALD-02: E2E validation

</details>

## Future Requirements (Deferred)

### NDA Pipeline

- **NDA-01**: Digital NDA e-sign flow built into discover dashboard
- **NDA-02**: Signed NDA stored in DB with timestamp and prospect linkage
- **NDA-03**: Post-NDA content unlock — additional dossier sections visible after signing
- **NDA-04**: Admin notification on NDA signing with prospect details

### SERP API Replacement (Carried from v6.0)

- **SERP-01**: Google News via free RSS feed
- **SERP-02**: Google Reviews via Scrapling/Places API
- **SERP-03**: Deep URL discovery via Scrapling Google search
- **SERP-04**: Isolate LinkedIn Jobs as only SERP dependency

## Out of Scope

| Feature                    | Reason                                                  |
| -------------------------- | ------------------------------------------------------- |
| Evidence scraper changes   | Scrapers work well (83 items for Nedri) — don't touch   |
| NDA e-sign flow            | Deferred — pipeline quality is the priority             |
| Admin SPV assignment UI    | Deferred from v4.0 — no operational need proven         |
| Auto-send without approval | Trust not calibrated, GDPR risk                         |
| LinkedIn API automation    | ToS risk                                                |
| SERP API replacement       | Deferred from v6.0 — not blocking pipeline quality work |

## Traceability

| Requirement | Phase | Status   |
| ----------- | ----- | -------- |
| PIPE-01     | 50    | Complete |
| PIPE-02     | 50    | Complete |
| PIPE-03     | 50    | Complete |
| PIPE-04     | 50    | Complete |
| PIPE-05     | 50    | Complete |
| RAG-01      | 49    | Complete |
| RAG-02      | 49    | Complete |
| RAG-03      | 49    | Complete |
| DISC-01     | 51    | Complete |
| DISC-02     | 51    | Complete |
| DISC-03     | 51    | Complete |
| DISC-04     | 51    | Pending  |
| DISC-05     | 51    | Complete |
| VALD-01     | 52    | Pending  |
| VALD-02     | 52    | Pending  |
| VALD-03     | 52    | Pending  |

**Coverage:**

- v7.0 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---

_Requirements defined: 2026-03-13_
