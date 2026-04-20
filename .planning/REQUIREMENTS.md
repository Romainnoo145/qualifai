# Requirements: Qualifai v10.0 — Evidence Pipeline Overhaul

**Defined:** 2026-04-21
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers. No spray-and-pray.

## v10.0 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Evidence Funnel

- [ ] **FUNNEL-01**: Crawl4AI path checks HTTP status and skips 4xx/5xx pages before storing evidence
- [ ] **FUNNEL-02**: Fallback/notFound drafts are suppressed — no URL-only EvidenceItems stored
- [ ] **FUNNEL-03**: Content deduplication via SHA-256 hash on normalized snippet, scoped per sourceType per prospect
- [ ] **FUNNEL-04**: AI relevance scoring at ingestion via Gemini Flash with source-type-specific thresholds drops irrelevant items before DB storage

### Masterprompt

- [ ] **PROMPT-01**: Legacy v1 prompt (buildLegacyPrompt, ~260 lines) and associated v1 types/validators deleted
- [ ] **PROMPT-02**: visualType/visualData specification removed from masterprompt — simplified JSON output schema (openingHook, executiveSummary, sections with body/citations/punchline only)
- [ ] **PROMPT-03**: Visual data generated via separate downstream Gemini Flash call per section, receiving section body + cited evidence items

### Evidence Selection

- [ ] **SELECT-01**: Pre-ranked top-20 evidence selection with source-diversity caps replaces arbitrary .slice(0, 60) before masterprompt

### Validation

- [ ] **VALID-01**: Baseline analysis JSON captured for all existing prospects before pipeline changes
- [ ] **VALID-02**: Full pipeline re-run for 3-5 prospects with before/after comparison on evidence count, narrative quality, and discover page rendering

## Future Requirements

Deferred beyond v10.0.

### Evidence Quality (v11+)

- **FUNNEL-05**: Semantic near-dedup via embedding similarity (Jaccard on shingles)
- **FUNNEL-06**: Evidence pre-summarization for token-efficient prompt context
- **FUNNEL-07**: Real-time quality UI overlays showing per-item scores in admin

### Pipeline Automation (v11+)

- **AUTO-01**: Backfill scoring/dedup for existing 7 prospects' evidence items
- **AUTO-02**: Cookie/boilerplate heuristic filter with NL-specific patterns

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                     | Reason                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| Semantic embedding dedup    | Overkill at 20-400 items/prospect scale; SHA-256 catches 95%+       |
| New scraper sources         | Existing 8 sources are sufficient; problem is post-scraping quality |
| MinHash/LSH infrastructure  | Built for trillion-doc corpora; unnecessary at this scale           |
| Real-time quality dashboard | Not needed until pipeline is clean                                  |
| Evidence schema restructure | Current EvidenceItem model works; only adding contentHash field     |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status  |
| ----------- | ----- | ------- |
| FUNNEL-01   | —     | Pending |
| FUNNEL-02   | —     | Pending |
| FUNNEL-03   | —     | Pending |
| FUNNEL-04   | —     | Pending |
| PROMPT-01   | —     | Pending |
| PROMPT-02   | —     | Pending |
| PROMPT-03   | —     | Pending |
| SELECT-01   | —     | Pending |
| VALID-01    | —     | Pending |
| VALID-02    | —     | Pending |

**Coverage:**

- v10.0 requirements: 10 total
- Mapped to phases: 0
- Unmapped: 10 ⚠️

---

_Requirements defined: 2026-04-21_
_Last updated: 2026-04-21 after initial definition_
