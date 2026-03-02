# Phase 35: Validation and Calibration - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify existing features against real prospect data and tune thresholds. No new features — this phase confirms what v3.0 built actually works in production conditions.

</domain>

<decisions>
## Implementation Decisions

### Discover validation

- Two contrasting prospects: one high-confidence + one borderline
- Test both confirm and decline actions on /discover/[slug]
- Live browser session (real user flow, not API simulation)
- Verify with both: scripted DB assertions + visual admin UI check

### Crawl4AI verification

- Verify both consent popup removal and shadow DOM flattening
- Test pages: mix of existing prospect pages (regression) + known-difficult NL sites (capability proof)

### Pain gate calibration

- Distribution analysis first, then user judgment to finalize thresholds
- Document in both: calibration report markdown + inline comments in quality-config.ts
- SQL analysis across all prospects, then re-run one prospect as sanity check

### Claude's Discretion

- Crawl4AI fallback strategy: assess severity, minor gaps = document, blocking gaps = fix inline
- Crawl4AI artifact format: one-time report vs rerunnable script — pick best value/effort
- Whether source weights need revisiting based on actual data
- Issue resolution: bugs found during validation — fix inline if small, defer if substantial

</decisions>

<specifics>
## Specific Ideas

No specific requirements — the roadmap success criteria are already actionable.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 35-validation-and-calibration_
_Context gathered: 2026-03-02_
