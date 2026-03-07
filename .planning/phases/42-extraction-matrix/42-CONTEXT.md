# Phase 42: Extraction Matrix - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform raw scraper/evidence output into structured intent variables (sector fit, operational pains, ESG/CSRD signals, investment/growth patterns, workforce signals) with source attribution. Use those variables to construct targeted per-category RAG queries replacing the current keyword-stuffed approach. Persist intent variables to DB and surface them in admin prospect detail.

</domain>

<decisions>
## Implementation Decisions

### Intent Variable Shape

- Structured objects per category, not free-text summaries — each category is an array of typed items (e.g. `pains: [{signal: string, confidence: number, sourceUrl: string, snippet: string, sourceType: string}]`)
- Each item gets a 0-1 confidence score from the extraction AI — consistent with existing evidence scoring pattern
- Soft minimum gate: warn if fewer than 3 of the 5 core categories have items, but proceed to analysis anyway (Atlantis prospects may have thin web presence in specific areas)
- 5 core categories are fixed (sector fit, operational pains, ESG/CSRD, investment/growth, workforce) PLUS the AI can add optional extra categories if it finds relevant signals (e.g. 'digital maturity', 'supply chain risk')

### Source Attribution

- Each extracted item stores: source URL + text snippet that backs the claim + source type (WEBSITE, NEWS, LINKEDIN, etc.)
- Extraction pulls only from quality-gated evidence items (aiRelevance >= 0.50) — consistent with existing pipeline
- A single evidence item can contribute to multiple categories (multi-map) — real-world articles often cover multiple signals

### RAG Query Strategy

- Generate one targeted semantic query per populated intent category — e.g. ESG category with "green hydrogen" signal produces a query like "green hydrogen production capacity Europe's Gate"
- Auto-scope queries to relevant SPVs based on intent variables — steel sector fit searches Green Steel SPV, strong ESG signals include Renewable Energy SPV
- Retrieve top 5 passages per query (~25 total across categories)
- Deduplicate across categories: if same chunk appears in multiple results, keep once with highest similarity score, tag with all matching categories

### Admin Inspection UX

- New "Intent Signals" section in prospect detail page, positioned between research and hypotheses in the story flow
- Category cards layout: each category is a card showing its extracted items with confidence scores and source links
- Read-only — admin inspects but doesn't edit. Rerun research to get new extraction (autopilot with oversight pattern)
- Sparse extraction warning: yellow badge/chip visible on prospects with fewer than 3 populated categories, so weak extractions are spotted at a glance without drilling in

</decisions>

<specifics>
## Specific Ideas

- Intent variable structure should be a stable contract for Phase 43 (AI Master Analysis) to consume — typed interfaces, not loose JSON
- The per-category RAG query approach replaces the current keyword-stuffed profile fragments in the retriever
- SPV auto-scoping should use the intent variables to determine which SPVs are most relevant, not a hardcoded mapping
- Category cards in admin should feel consistent with existing prospect detail sections (glass-card pattern, compact layout)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 42-extraction-matrix_
_Context gathered: 2026-03-07_
