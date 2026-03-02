# Phase 28: Source Discovery with Provenance - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Automatic per-prospect source URL discovery with deduplication, per-source caps, provenance labels, and admin visibility into what was found. Discovery is fully automatic — no manual URL curation. The admin verifies results, not inputs.

</domain>

<decisions>
## Implementation Decisions

### Source list visibility

- Collapsible section inside the existing research run detail view — no new pages or tabs
- Collapsed by default, showing a summary line: "23 source URLs (12 sitemap, 5 serp, 4 default) — Discovered 2h ago"
- When expanded, URLs grouped by provenance type under headers: Sitemap (12), SERP (5), Default (4)
- Each URL shows provenance label + URL only — no metadata, timestamps, or flags per URL
- Discovery timestamp shown in the collapsed summary line (relative time like "2h ago" or absolute date)

### Manual URL control

- No manual URL add/remove — discovery is fully automatic
- Admin sees results but does not curate the source set
- No per-prospect URL blacklist or exclusion mechanism
- Admin overrides happen at the gate level (quality gate, pain gate), not source level

### Cap & dedup feedback

- When a source type is capped, summary shows "X of Y" format (e.g., "Sitemap (20 of 147)")
- Collapsed summary includes dedup count: "23 source URLs (3 duplicates removed)"
- Duplicate URLs keep the first provenance type that discovered them — no multi-source badge
- No special indicator for thin source coverage — the quality gate handles that signal

### Re-discovery behavior

- "Re-discover sources" button as a separate action in the source list section
- Independent from "Run Research" — admin can refresh sources without re-running the full pipeline
- 24h SerpAPI cache is the default; the button explicitly bypasses it (admin understands credit cost)
- Re-discovery never deletes existing evidence — old evidence stays, new discovery only affects the next extraction round
- Discovery timestamp updates when re-discovery completes

### Claude's Discretion

- jsHeavyHint detection heuristics
- URL deduplication algorithm and priority when collapsing
- Which URLs survive when caps are reached (prioritization strategy)
- Exact summary line formatting and relative time display
- Button placement and styling within the research run detail section

</decisions>

<specifics>
## Specific Ideas

- Summary line pattern: "23 source URLs (12 sitemap, 5 serp, 4 default) · 3 duplicates removed · Discovered 2h ago"
- Grouping under headers mirrors the existing evidence list pattern (grouped by sourceType)
- "Re-discover sources" should feel lightweight — not a big action, just a refresh

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 28-source-discovery-with-provenance_
_Context gathered: 2026-03-02_
