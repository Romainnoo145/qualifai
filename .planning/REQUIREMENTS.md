# Requirements: Qualifai v3.0 Sharp Analysis

**Defined:** 2026-03-02
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers.

## v3.0 Requirements

Requirements for v3.0 release. Each maps to roadmap phases.

### Analysis Quality

- [x] **ANLYS-01**: Hypothesis prompt prioritizes REVIEWS, CAREERS, and LINKEDIN evidence over WEBSITE content via explicit source-tier instruction
- [x] **ANLYS-02**: Hypothesis prompt labels each source type diagnostically (what the signal means: reviews = customer pain, careers = operational gaps, website = marketing context only)
- [x] **ANLYS-03**: Hypothesis prompt includes anti-parroting constraint preventing derivation from company's own marketing copy
- [x] **ANLYS-04**: Each hypothesis problemStatement includes at least one mandatory quoted snippet from a non-WEBSITE evidence source
- [x] **ANLYS-05**: Source signal summary (counts by tier) injected above evidence block to prime LLM reasoning
- [x] **ANLYS-06**: Hypothesis count varies 1-3 based on confirmed pain tag evidence quality (not forced 3)
- [x] **ANLYS-07**: Confidence score instruction maps score tiers to evidence quality levels (REVIEWS 0.80-0.95, hiring 0.70-0.80, website-only 0.60-0.65)
- [x] **ANLYS-08**: Two-pass chain-of-thought reasoning separates evidence analysis from hypothesis synthesis
- [ ] **ANLYS-09**: Primary source attribution badge (sourceType that most drove each hypothesis) displayed per hypothesis in admin detail view

### Model & Metrics

- [x] **MODEL-01**: Hypothesis generation supports configurable model selection (Gemini Flash vs Claude) via env var
- [x] **MODEL-02**: Gemini model string upgraded from `gemini-2.0-flash` to `gemini-2.5-flash` across all files
- [ ] **MODEL-03**: AI-estimated metric ranges (hours saved, handoff speed, error reduction, revenue leakage) replace hardcoded METRIC_DEFAULTS — contextual to each prospect's industry and evidence

### Validation & Calibration

- [ ] **VALID-01**: /discover/ validation session run with real prospects to verify hypothesis confirmation flow works end-to-end
- [ ] **VALID-02**: Crawl4AI v0.8.x features verified (consent popup removal, shadow DOM flattening) against real pages
- [ ] **VALID-03**: Pain gate calibration SQL run against real prospect data to tune PAIN_GATE threshold constants

### Tech Debt

- [x] **DEBT-01**: SERP cache re-read after overwrite bug fixed in research-executor.ts (pre-read snapshot before overwrite in deepCrawl block)
- [x] **DEBT-02**: Unused logoUrl prop removed from DashboardClient interface and all call sites
- [x] **DEBT-03**: E2E send test refactored to use tRPC quality gate instead of calling Resend directly
- [x] **DEBT-04**: Detail-view Prisma `as any` cast replaced with narrow typed cast
- [x] **DEBT-05**: Import ordering anomaly fixed in workflow-engine.ts (move import block to top)
- [x] **DEBT-06**: TS2589 deep Prisma `as any` casts cleaned up — categorized into 3 types (deep inference, tRPC mutation, Json field access), each fixed with appropriate pattern

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Feedback Loop

- **FEED-01**: Automated training loop from /discover/ prospect validation data into hypothesis quality scoring
- **FEED-02**: Per-industry prompt templates based on accumulated validation data

### Evidence Expansion

- **EVID-01**: Additional evidence source types beyond current 8+
- **EVID-02**: RAG/vector retrieval over evidence corpus for larger prospect sets

## Out of Scope

| Feature                       | Reason                                                    |
| ----------------------------- | --------------------------------------------------------- |
| Fine-tuning a custom model    | Only 7 validated prospects — need 100+ for useful signal  |
| RAG/vector retrieval          | Evidence fits in one prompt at current scale              |
| Per-industry prompt templates | AI reasons dynamically from evidence + industry label     |
| Streaming hypothesis output   | Background async generation — no UX need                  |
| LLM self-evaluation scoring   | Self-referential bias; admin review is the quality signal |
| Adding more evidence sources  | Problem is prompt reasoning, not evidence scarcity        |
| `@google/genai` SDK migration | Deadline June 24, 2026 — defer to v4.x                    |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status   |
| ----------- | ----- | -------- |
| ANLYS-01    | 32    | Complete |
| ANLYS-02    | 32    | Complete |
| ANLYS-03    | 32    | Complete |
| ANLYS-04    | 32    | Complete |
| ANLYS-05    | 32    | Complete |
| ANLYS-06    | 32    | Complete |
| ANLYS-07    | 32    | Complete |
| ANLYS-08    | 33    | Complete |
| ANLYS-09    | 34    | Pending  |
| MODEL-01    | 33    | Complete |
| MODEL-02    | 31    | Complete |
| MODEL-03    | 34    | Pending  |
| VALID-01    | 35    | Pending  |
| VALID-02    | 35    | Pending  |
| VALID-03    | 35    | Pending  |
| DEBT-01     | 31    | Complete |
| DEBT-02     | 31    | Complete |
| DEBT-03     | 31    | Complete |
| DEBT-04     | 31    | Complete |
| DEBT-05     | 31    | Complete |
| DEBT-06     | 31    | Complete |

**Coverage:**

- v3.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---

_Requirements defined: 2026-03-02_
_Last updated: 2026-03-02 after roadmap creation — all 21 requirements mapped_
