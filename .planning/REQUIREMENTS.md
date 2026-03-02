# Requirements: Qualifai

**Defined:** 2026-03-02
**Core Value:** Every outreach message is backed by real evidence of a prospect's workflow pain points, matched to a service Klarifai actually delivers.

## v2.2 Requirements

Requirements for Verified Pain Intelligence milestone. Each maps to roadmap phases.

### Source Discovery

- [x] **DISC-01**: System discovers source URLs from sitemap, SERP, and manual seeds with provenance labels (sitemap/serp/manual)
- [x] **DISC-02**: System detects JS-heavy pages and flags them with `jsHeavyHint` for downstream browser extraction routing
- [x] **DISC-03**: SERP discovery results are cached at prospect level (`serpDiscoveredAt`) to prevent API credit burn on re-runs
- [x] **DISC-04**: Per-source URL caps prevent URL explosion during the merge step
- [x] **DISC-05**: Duplicate URLs are deduplicated during merge via normalized URL comparison

### Browser Extraction

- [x] **EXTR-01**: Static pages route through Scrapling stealth fetcher first; pages returning <500 chars escalate to Crawl4AI
- [x] **EXTR-02**: REVIEWS URLs and `jsHeavyHint=true` URLs route directly through Crawl4AI; CAREERS and JOB_BOARD own-website pages go stealth-first (per Research Pitfall 3)
- [x] **EXTR-03**: Maximum 5 URLs per prospect use browser-rendered extraction to control pipeline duration

### Pain Gate

- [ ] **GATE-01**: System computes cross-source pain confirmation per workflowTag (count of distinct sourceTypes per tag)
- [ ] **GATE-02**: Quality gate output includes `confirmedPainTags` and `unconfirmedPainTags` arrays
- [ ] **GATE-03**: Pain confirmation gate is advisory-only (warning, not blocking) to accommodate thin-presence Dutch SMBs
- [x] **GATE-04**: Send queue shows pain confirmation status alongside existing quality gate indicator
- [x] **GATE-05**: Admin must provide a reason when proceeding with outreach that has unconfirmed pain tags

### Override Audit

- [x] **AUDT-01**: `GateOverrideAudit` model records every gate bypass with actor, timestamp, reason, and gate type
- [x] **AUDT-02**: Override reason is mandatory in the UI when bypassing any gate
- [x] **AUDT-03**: "Bypassed" badge appears in admin prospect list for prospects with overridden gates
- [x] **AUDT-04**: Override history is visible on research run detail view

## Future Requirements

### Pain Gate Enhancements

- **GATE-06**: Configurable gate strictness per campaign (soft default, hard opt-in via `Campaign.strictGate`)
- **GATE-07**: Auto-calibrated thresholds based on industry/sector evidence availability

### Source Discovery Enhancements

- **DISC-06**: Admin can manually add/remove source URLs per prospect via UI
- **DISC-07**: Source discovery scheduling (periodic re-discovery for active prospects)

## Out of Scope

| Feature                           | Reason                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Hard-blocking pain gate           | Dutch SMBs structurally fail cross-source confirmation through thin web presence, not absence of pain |
| Crawl4AI for all URLs             | 3-5x pipeline slowdown; two-tier routing (Scrapling-first) is validated architecture                  |
| Real-time source monitoring       | Overkill for current prospect volumes (20-50)                                                         |
| Pain gate per-industry thresholds | Insufficient data to calibrate; defer to v2.3+ after more prospects                                   |

## Traceability

| Requirement | Phase | Status   |
| ----------- | ----- | -------- |
| DISC-01     | 28    | Complete |
| DISC-02     | 28    | Complete |
| DISC-03     | 28    | Complete |
| DISC-04     | 28    | Complete |
| DISC-05     | 28    | Complete |
| EXTR-01     | 29    | Complete |
| EXTR-02     | 29    | Complete |
| EXTR-03     | 29    | Complete |
| GATE-01     | 30    | Pending  |
| GATE-02     | 30    | Pending  |
| GATE-03     | 30    | Pending  |
| GATE-04     | 30    | Complete |
| GATE-05     | 30    | Complete |
| AUDT-01     | 30    | Complete |
| AUDT-02     | 30    | Complete |
| AUDT-03     | 30    | Complete |
| AUDT-04     | 30    | Complete |

**Coverage:**

- v2.2 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---

_Requirements defined: 2026-03-02_
_Last updated: 2026-03-02 after roadmap creation_
