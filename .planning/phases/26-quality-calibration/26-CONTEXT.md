# Phase 26: Quality Calibration - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Calibrate amber/green quality thresholds so they reflect real Dutch marketing agency research patterns,
and fix the list-view traffic light so it computes and displays the real per-prospect quality score
instead of a hardcoded approximation. No new quality signals, no new UI features — calibration and
correctness only.

</domain>

<decisions>
## Implementation Decisions

### Threshold Semantics

- **GREEN** = Multiple strong evidence types found (2–3+ distinct source types contributed evidence)
  — prospect is ready to outreach
- **AMBER** = Evidence found but from fewer source types — blocks send until admin explicitly reviews
  and approves (NOT a soft warn-and-proceed; admin must take action)
- **RED** = Hard block — research quality too low to send outreach at all; prospect stays in pipeline
  but cannot enter send queue
- **Primary quality signal** = source diversity: how many different source types (homepage, Google,
  sitemap, KvK, LinkedIn, etc.) contributed evidence — not hypothesis count or confidence score

### Calibration Process

- Manual inspection: read all 5 real prospects, look at their source diversity and scores, then pick
  threshold values that produce the expected distribution
- Expected distribution: mostly amber with 1–2 green (reflects Dutch SMB reality)
- The plan must include a human sign-off step: calibration script proposes threshold values with a
  review table, and values are committed only after admin approves
- Review table format: one row per prospect with columns — prospect name, source type count,
  current score, proposed tier under new thresholds

### Threshold Storage

- Constants in a config file (not .env, not DB admin settings)
- Claude decides which file based on codebase patterns — preference for co-locating with the
  scoring logic or a dedicated quality config
- Comments required in the config explaining what each threshold means semantically
  (e.g., `// GREEN: 3+ source types — ready to send`)
- Computed dynamically at render time — no per-prospect tier stored in DB; changing the config
  file updates chips on next page load

### List-View Quality Display

- Color chip only — no score number or source count displayed in list view
- "Matching" means: same color tier because both views call the same scoring function with the
  same prospect data (not exact decimal parity, but functionally identical computation)
- Grey chip ("No data") for prospects with no research data yet — visually distinct from the
  three quality tiers
- Fetching strategy: Claude decides based on existing list-view data fetching pattern — optimize
  for simplicity first

### Claude's Discretion

- Which file to put threshold constants in (check existing patterns)
- Exact scoring function structure and where it lives
- How list-view batches or per-fetches quality data
- Exact grey chip styling

</decisions>

<specifics>
## Specific Ideas

- The calibration script should output a table that is easy to read in the terminal — the admin
  needs to see it clearly and make a go/no-go decision on the proposed thresholds
- AMBER behavior change: previous implementation used "soft gate: warn + proceed-anyway" — this
  phase explicitly changes that to "block until reviewed" — the send queue must enforce this

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 26-quality-calibration_
_Context gathered: 2026-02-27_
