# Feature Research

**Domain:** Sales Intelligence — Verified Pain Intelligence (v2.2 extension)
**Researched:** 2026-03-02
**Milestone:** v2.2 — Verified Pain Intelligence
**Confidence:** HIGH (codebase analysis) / MEDIUM (industry patterns from WebSearch)

---

## Scope Boundary

This file covers only what is NEW in v2.2. The following already exist and are not re-researched:

- 8-source evidence pipeline (sitemap, Google, KvK, LinkedIn, employee reviews, job postings, Google Reviews, industry news) — v2.1
- AI evidence scoring via Gemini Flash (formula: sourceWeight*0.30 + relevance*0.45 + depth\*0.25) — v2.1
- Traffic-light quality gate (RED/AMBER/GREEN) with AMBER as hard send blocker — v2.1
- Manual URL seeds via `manualUrls` in `ResearchRun.inputSnapshot` — v1.1
- `ResearchRun.qualityApproved`, `qualityReviewedAt`, `qualityNotes` schema fields — v2.0
- Crawl4AI wired for SERP-discovered URLs in deep crawl path — v1.1
- Sitemap discovery (`discoverSitemapUrls`) — v2.0
- SerpAPI discovery (`discoverSerpUrls`) — v1.1
- One-click send queue with idempotency guards — v2.0
- Prospect pipeline stage tracking (7-stage chip) — v2.0

The four NEW features for v2.2:

1. Automatic source URL discovery per prospect (stored with provenance)
2. Browser-rendered evidence extraction for JS-heavy pages (expanded routing)
3. Pain confirmation gate — cross-source evidence thresholds blocking outreach
4. Override audit trail — mandatory reason + history surfaced in admin dashboard

---

## Industry Patterns Observed

Research across sales intelligence tools (Apollo.io, Clay, Gong, Outreach, Lavender, Salesforce),
web scraping platforms (Crawl4AI, Bright Data, ZenRows, Scrapfly), and audit/compliance tooling
(Datadog, Salesforce audit trail, SOC2 guidance) reveals the following relevant patterns:

**Source discovery:** Commodity tools like Hunter.io crawl the web for email addresses and expose
which domains were found and from where. Clay aggregates 150+ providers with "waterfall enrichment"
that queries multiple sources and falls back when one fails. Neither tool stores a human-readable
URL inventory per prospect with discovery method provenance — that is a Qualifai-specific gap that
would improve admin trust.

**Browser-rendered extraction:** As of 2026, headless browser scraping is the default rather than
the exception — the web is predominantly client-side rendered. Crawl4AI v0.8.x supports Playwright
execution, shadow DOM flattening (`flatten_shadow_dom=True`), and session management for multi-step
flows. Tools that rely on raw HTML fetch miss the majority of JS-heavy review sites, job boards,
and careers pages — exactly the highest-signal sources for pain detection.

**Evidence-based gating:** Signal-based personalization campaigns backed by validated signals
achieve 15-25% reply rates versus 3.43% for unvalidated cold email (5x improvement, per AutoBound
2026). The general pattern in tools like Clay and HubSpot Breeze is a score threshold that blocks
sequence enrollment if the prospect score is below a configurable floor. No tool explicitly
implements "cross-source pain confirmation" as a named gate — this is a Qualifai-specific
architectural concept that extends the general evidence quality pattern into pain-point specificity.

**Override audit trails:** The compliance standard for any SaaS with approval gates is: who
approved, what was the decision, when did it happen, why (reason code or free text). This is
required for SOC2 Type II and GDPR evidence trails. Salesforce, Datadog, and AuditBoard all
implement this pattern. The "72% of organizations experienced compliance violations related to
inadequate audit trails" finding (Deloitte 2026 Compliance Technology Study, per WebSearch)
establishes this as a hygiene requirement, not a differentiator.

---

## Table Stakes (Users Expect These)

Features the admin expects once the concept of "verified pain intelligence" is introduced.
Missing these makes the system feel like research theater rather than a real gate.

| Feature                                         | Why Expected                                                                                                                                    | Complexity | Notes                                                                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source URL list visible per prospect            | Admin needs to know which URLs were checked. "Where did we look?" is a basic trust requirement for any research tool.                           | LOW        | Already partially exists via `sourceUrl` on every `EvidenceItem`. Gap is a deduplicated URL inventory surfaced in the UI — not new infrastructure.               |
| Provenance label on each source URL             | Each URL should be tagged with how it was found ("via sitemap", "via SERP", "added manually") so admin understands research coverage            | LOW        | Already stored as `metadata.adapter` on `EvidenceItem`. Gap is standardizing provenance labels and surfacing them in the UI.                                     |
| Manual URL seed input as first-class UI control | Admin must be able to add known URLs that automated discovery misses (Trustpilot page, sector association membership, specific review platform) | LOW        | Backend already built: `manualUrls` in `ResearchRun.inputSnapshot`. Gap is surfacing this as a UI control rather than a script/API parameter.                    |
| Re-run research after adding new source URLs    | Once manual seeds are added, admin expects to re-trigger extraction without rebuilding all evidence from scratch                                | MEDIUM     | Re-run path exists via scripts. Gap is exposing this in UI with source-merge semantics (new sources appended, not a full reset that discards existing evidence). |
| Clear gate status reason on send queue          | Admin expects transparency about WHY a prospect is blocked — not just a red badge but "blocked: 0 cross-source pain confirmations"              | LOW        | Existing AMBER hard gate already blocks send. Gap is making the threshold reason explicit in the UI surface.                                                     |
| Reason field required when bypassing gate       | Any manual override of a quality gate should require a written reason. This is standard in any compliance-adjacent internal tool.               | LOW        | `ResearchRun.qualityNotes` already exists in schema. Gap is enforcing this field as mandatory in the UI when bypassing (client-side validation).                 |

### Confidence: HIGH

These are all established patterns in compliance tooling, CRM systems, and sales intelligence
platforms. The specific implementations vary but the expected behaviors are consistent.

---

## Differentiators (Competitive Advantage)

Features that go beyond what any commodity sales intelligence tool provides.

| Feature                                                                | Value Proposition                                                                                                                                                                                                                                                                                                                                  | Complexity | Notes                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatic source discovery (Google + sitemap combined) with provenance | Most tools rely on a single discovery method. Combining sitemap traversal (free, zero API cost) with SerpAPI discovery (paid, high-signal) produces a materially larger and more accurate source inventory. Storing the result as a named, per-prospect URL list with provenance lets admin see and trust the research coverage.                   | MEDIUM     | Sitemap discovery already exists. SerpAPI discovery already exists. Gap is persisting discovered URLs as a `discoveredSources` structure in `ResearchRun.inputSnapshot` with `{ url, discoveryMethod, discoveredAt }` per entry, then merging manual seeds into the same structure.                                                                                       |
| Browser-rendered extraction as default for all high-signal URL types   | Most tools give up on JS-heavy pages (dynamic review sites, careers pages, job boards). Using Crawl4AI Playwright engine as the default for REVIEWS, CAREERS, and JOB_BOARD URL types — regardless of which discovery method found them — means Qualifai extracts evidence that competitors miss.                                                  | MEDIUM     | Crawl4AI already wired for SERP-discovered URLs in deepCrawl path. Gap is expanding routing: any URL whose inferred source type is REVIEWS, CAREERS, or JOB_BOARD gets routed through Crawl4AI, not the lightweight `ingestWebsiteEvidenceDrafts` fetcher. Originating URL must be preserved in evidence metadata.                                                        |
| Cross-source pain confirmation threshold                               | Signal-based personalization achieves 5x better reply rates when backed by validated signals versus unconfirmed intent. A gate that requires the same pain point (`workflowTag`) to appear in 2+ distinct `sourceType` values converts "suspected pain" into "confirmed pain" — directly elevating the evidence-backed outreach value proposition. | HIGH       | No equivalent exists in current pipeline. Requires: (a) workflowTag clustering across source types, (b) threshold configuration (default: 2 source types per workflowTag), (c) gate evaluation extending `evaluateQualityGate` in workflow-engine.ts, (d) UI surfacing which pain tags are confirmed vs. suspected, (e) send queue blocking on unconfirmed-only evidence. |
| Override audit trail with mandatory reason + history view              | Compliance-grade record of who bypassed which gate, when, and why. Enables quality review cadences and prevents "soft gate creep" where overrides become the default. Unlike generic audit logging, this is surfaced in the admin dashboard as a first-class data point — "bypassed N times" — so the admin can see patterns.                      | LOW        | Schema already supports this: `qualityApproved`, `qualityReviewedAt`, `qualityNotes` on `ResearchRun`. Gap is: (a) mandatory reason in UI on bypass, (b) "bypassed" badge visible in dashboard, (c) override history surfaced on research run detail.                                                                                                                     |
| Source provenance chain ("where we found this → how we extracted it")  | Evidence items tagged with their full discovery chain ("discovered via SERP → extracted via Crawl4AI") give the admin a clear audit trail of the research process, not just the result.                                                                                                                                                            | LOW        | Partially exists via `metadata.adapter`. Gap is standardizing to a consistent provenance schema: `{ discoveryMethod, extractionMethod, discoveredAt }` stored in `EvidenceItem.metadata` for all items.                                                                                                                                                                   |

### Confidence: MEDIUM-HIGH

Cross-source pain confirmation gate: MEDIUM — no direct comparator in commercial tools. The
underlying concept (validate signals from multiple sources before acting) is well-established in
intent data platforms. The specific workflowTag-based cross-source implementation is novel.

All others: HIGH — built directly on established infrastructure (Crawl4AI, SerpAPI, existing schema).

---

## Anti-Features (Commonly Requested, Often Problematic)

| Feature                                                              | Why Requested                                                          | Why Problematic                                                                                                                                                                                                                          | Alternative                                                                                                                                                                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hard gate that blocks ALL outreach without cross-source confirmation | "Confirm pain is real before spending outreach budget" sounds rigorous | Dutch SMBs have thin web presence. A hard cross-source gate would block most NL prospects in the current 7-prospect DB. The existing decision to use soft AMBER gate was made explicitly for this reason (see PROJECT.md Key Decisions). | Keep as configurable threshold: default is SOFT (warn + require reason to proceed). Allow campaigns to opt into STRICT mode (hard block) via existing `Campaign.strictGate` boolean already in schema. |
| Automatic URL discovery that replaces manual seeds entirely          | "Zero-maintenance research" sounds fast                                | Automated discovery misses proprietary URLs the admin knows about: a specific Trustpilot page, a sector association membership, an industry news mention. Removing manual seeds degrades coverage for thin-presence prospects.           | Keep manual seeds as first-class input, merge with automated discovery, show provenance for each.                                                                                                      |
| Real-time source discovery triggered on prospect import              | "Discover sources immediately" sounds fast                             | Adds latency to import flow, burns SerpAPI credits on prospects that may never be researched, creates a partial state that confuses the research run status.                                                                             | Keep discovery as part of the research run trigger, not the import step.                                                                                                                               |
| Store full rendered HTML per discovered URL                          | "We want to see the original page" sounds useful for debugging         | Full HTML per URL across 7+ sources per prospect × 50 prospects = significant storage bloat. Most of the content is irrelevant to pain signals.                                                                                          | Store extracted snippets with source URL link. Admin can click through to live URL. Only store rendered HTML on explicit debug request via a separate diagnostic endpoint.                             |
| Per-source-type confidence thresholds                                | "REVIEWS should require 0.80+, WEBSITE only 0.55" sounds precise       | Adds configuration surface area that becomes a maintenance burden. The AI scoring formula already adjusts effective weight via source-type weights (REVIEWS 0.90, LINKEDIN 0.88).                                                        | Use AI scoring weights to influence final confidence; keep gate threshold as a single configurable number (current: `MIN_AVERAGE_CONFIDENCE = 0.55`).                                                  |
| Pain confirmation gate that blocks at the hypothesis level           | "Only generate hypotheses with confirmed pain" sounds strict           | Hypotheses are generated from the full evidence set, including unconfirmed signals. Some of the most valuable hypotheses come from weak signals that probe the prospect's situation.                                                     | Gate at the outreach-send level, not the hypothesis-generation level. Generate hypotheses from all evidence. Block send until the specific hypothesis's pain tag is confirmed cross-source.            |

---

## Feature Dependencies

```
[Automatic Source Discovery — stored with provenance]
    └──produces──> [discoveredSources list in ResearchRun.inputSnapshot]
                       └──feeds──> [Browser-Rendered Extraction routing]
                       └──feeds──> [Pain Confirmation Gate evaluation]
                       └──surfaces in──> [Source URL list UI panel]

[Browser-Rendered Extraction — expanded routing]
    └──requires──> [URL type inference (inferSourceType — EXISTS)]
    └──routes──> REVIEWS/CAREERS/JOB_BOARD URLs through Crawl4AI
    └──produces──> [EvidenceItem records with provenance metadata]
                       └──feeds──> [Pain Confirmation Gate]

[Pain Confirmation Gate]
    └──requires──> [EvidenceItem.workflowTag clustering (EXISTS — data is there)]
    └──requires──> [EvidenceItem.sourceType per item (EXISTS)]
    └──extends──> [evaluateQualityGate in workflow-engine.ts (EXISTS)]
    └──adds──> confirmedPainTags[] and unconfirmedPainTags[] to gate output
    └──blocks──> [Send Queue] when confirmation threshold not met
    └──enables──> [Override Audit Trail] when bypassed

[Override Audit Trail]
    └──requires──> [Pain Confirmation Gate output] (something to audit)
    └──extends──> [ResearchRun.qualityApproved/qualityReviewedAt/qualityNotes (EXISTS in schema)]
    └──adds──> mandatory UI enforcement of qualityNotes on bypass
    └──adds──> "bypassed" badge in admin dashboard

[Existing 8-Source Pipeline] ──provides infrastructure for──> all four features
[Existing Traffic-Light Gate] ──extended by──> [Pain Confirmation Gate]
[Existing AMBER Hard Gate] ──extended by──> [Override Audit Trail]
[Existing Crawl4AI integration] ──expanded by──> [Browser-Rendered Extraction routing]
[Existing SerpAPI + Sitemap discovery] ──extended by──> [Automatic Source Discovery storage]
```

### Dependency Notes

- **Source discovery requires no new integrations**: sitemap (`discoverSitemapUrls`) and SERP
  (`discoverSerpUrls`) are both already built. The gap is persisting their output as a named,
  provenance-tagged `discoveredSources` structure in `ResearchRun.inputSnapshot` rather than
  computing URLs inline during a research run and discarding them.

- **Browser-rendered extraction requires source discovery to be maximally useful**: If source
  discovery outputs a richer URL list, browser-rendered extraction has more high-signal URLs to
  process. Build source discovery storage first, then expand Crawl4AI routing.

- **Pain confirmation gate requires workflowTag clustering**: The existing pipeline already stores
  `workflowTag` on every `EvidenceItem`. Cross-source confirmation is a query: count distinct
  `sourceType` values for items sharing the same `workflowTag`. If count >= 2, the pain is
  "confirmed". This is a query-level addition to `evaluateQualityGate`, not a schema change.

- **Override audit trail requires the gate to exist first**: There is nothing to audit until the
  pain confirmation gate produces a blockable state. Sequence: gate → audit trail.

- **All four features depend on the existing evidence pipeline producing `sourceType`-tagged items**:
  This is already the case. The pipeline produces `EvidenceItem` records with `sourceType` from
  the `EvidenceSourceType` enum.

---

## What "Confirmed Pain" Looks Like

This is the operational definition for the pain confirmation gate.

**A pain tag is "confirmed" when:**

- At least 2 distinct `sourceType` values have evidence items with `workflowTag` matching that pain tag
- At least 1 of those items has `aiRelevance >= 0.50` (same threshold already used by quality gate)

**Example — confirmed:**

- WEBSITE evidence: "We manually process invoices in Excel" (workflowTag: `document-processing`)
- REVIEWS evidence: "Their finance team is overwhelmed with manual work" (workflowTag: `document-processing`)
- Result: `document-processing` is confirmed (2 source types: WEBSITE, REVIEWS)

**Example — not confirmed:**

- WEBSITE evidence: "We use Excel for project tracking" (workflowTag: `project-management`)
- More WEBSITE evidence: "Our process uses spreadsheets" (workflowTag: `project-management`)
- Result: `project-management` is NOT confirmed (only 1 source type: WEBSITE)

**Gate behavior:**

- GREEN confirmed: at least 1 pain tag confirmed cross-source → outreach allowed
- AMBER unconfirmed: no pain tags confirmed cross-source → send queue shows warning + requires reason
- Campaign with `strictGate: true` → hard block on AMBER unconfirmed (cannot override without API)

**Confidence: MEDIUM** — The 2-source-type threshold is a reasonable starting point based on the
"multiple independent sources = stronger signal" principle established in evidence quality research.
Should be validated against real prospect data after the first 20 prospects pass through the gate.

---

## MVP Definition

### Launch With (v2.2)

Minimum to deliver the "Verified Pain Intelligence" milestone value.

- [ ] **Discovered source URL list stored per prospect with provenance** — foundation for admin
      trust. Without this, the admin cannot see what was researched and cannot add targeted manual
      seeds. Stores `{ url, discoveryMethod: 'sitemap'|'serp'|'manual', discoveredAt }` in
      `ResearchRun.inputSnapshot`.
- [ ] **Browser-rendered extraction for all REVIEWS/CAREERS/JOB_BOARD URL types** — unblocks
      JS-heavy pages. Routes all URLs of these types through Crawl4AI regardless of discovery method.
      Preserves originating URL in evidence metadata.
- [ ] **Cross-source pain confirmation gate** — the core milestone deliverable. Extends
      `evaluateQualityGate` to output `confirmedPainTags[]` and `unconfirmedPainTags[]`. Send queue
      blocks when no pain tags are confirmed. UI shows which pains are confirmed vs. suspected.
- [ ] **Override audit trail with mandatory reason** — reason field required in UI when bypassing.
      Override logged to `ResearchRun.qualityNotes` with timestamp. "Bypassed" badge visible in admin
      dashboard. History surfaced on research run detail view.

### Add After Validation (v2.x)

- [ ] **Source discovery UI panel** — dedicated interface to review discovered sources, add manual
      seeds, remove false positives. Trigger: admin starts manually editing the source list more than
      twice per week.
- [ ] **Per-campaign confirmation threshold configuration** — allow campaigns to set their own
      cross-source thresholds. Trigger: current defaults produce too many false blocks or false passes
      across different prospect cohorts.
- [ ] **Override analytics** — count of overrides per time period, which pain tags are most
      commonly unconfirmed. Trigger: 20+ prospects with override patterns visible.

### Future Consideration (v3+)

- [ ] **Sector-specific source templates** — pre-seeded source lists for known sectors. Defer
      until 50+ prospects across 5+ sectors to generalize.
- [ ] **Source health monitoring** — alert when a previously productive source URL returns empty.
      Defer until current volumes justify the maintenance overhead.

---

## Feature Prioritization Matrix

| Feature                                                           | User Value                                                      | Implementation Cost                                                                                 | Priority |
| ----------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| Discovered source URL list stored with provenance                 | HIGH — foundation for admin trust in research coverage          | LOW — no new integrations; gap is storage + light UI                                                | P1       |
| Browser-rendered extraction expanded to all high-signal URL types | HIGH — unblocks JS-heavy review and careers pages               | MEDIUM — Crawl4AI already integrated; gap is routing logic + URL type detection                     | P1       |
| Cross-source pain confirmation gate                               | HIGH — core milestone deliverable                               | HIGH — workflowTag clustering query, threshold config, gate evaluation extension, UI blocking logic | P1       |
| Override audit trail (reason mandatory + history visible)         | MEDIUM — compliance and quality hygiene                         | LOW — schema already supports it; gap is UI enforcement and history display                         | P1       |
| Source provenance labels in evidence UI                           | MEDIUM — improves admin confidence in individual evidence items | LOW — `metadata.adapter` already exists; gap is standardized schema and display                     | P2       |
| Source discovery UI panel                                         | MEDIUM — useful once admin wants to inspect/edit sources        | MEDIUM — new UI component, manual seed merge logic                                                  | P2       |
| Per-campaign gate thresholds                                      | LOW — useful for cohort segmentation                            | MEDIUM — config model extension + gate evaluation parameterization                                  | P3       |

**Priority key:**

- P1: Must have for v2.2 launch
- P2: Should have, add when possible within v2.2 scope
- P3: Future milestone

---

## Integration with Existing Pipeline

### What Does NOT Change

- Evidence scoring formula: `sourceWeight*0.30 + relevance*0.45 + depth*0.25` — unchanged
- AI scoring via Gemini Flash — unchanged
- Traffic-light thresholds (RED/AMBER/GREEN) defined in `quality-config.ts` — unchanged
- AMBER as hard gate on send queue — unchanged
- `EvidenceItem` schema — no new columns needed
- `ResearchRun` schema — `qualityApproved`, `qualityReviewedAt`, `qualityNotes` already exist

### What Changes

**Storage:**

- `discoveredSources` structure added to `ResearchRun.inputSnapshot`: `Array<{ url: string, discoveryMethod: 'sitemap'|'serp'|'manual', discoveredAt: string }>`
- `EvidenceItem.metadata` standardized to include `{ discoveryMethod, extractionMethod, discoveredAt }` provenance fields

**Routing:**

- `research-executor.ts`: any URL with inferred sourceType of REVIEWS, CAREERS, or JOB_BOARD gets routed through `ingestCrawl4aiEvidenceDrafts` regardless of discovery method (not just SERP URLs as today)

**Gate evaluation:**

- `workflow-engine.ts` → `evaluateQualityGate`: extended to compute `confirmedPainTags[]` (workflowTags with 2+ distinct sourceTypes) and `unconfirmedPainTags[]` (workflowTags with only 1 sourceType)
- Gate output type extended: `{ trafficLight, confirmedPainTags, unconfirmedPainTags, ... }`

**UI:**

- Send queue: show which pain tags are confirmed vs. suspected per prospect
- Send queue: block send when no confirmed pain tags exist (unless admin provides override reason)
- Override modal: `qualityNotes` field mandatory (client-side validation enforced)
- Admin dashboard: "bypassed" badge on research run rows where `qualityApproved === true` and gate was not GREEN-confirmed
- Research run detail: override history (`qualityNotes`, `qualityReviewedAt`) surfaced

---

## Competitor Feature Analysis

No direct competitor implements all four features together.

| Feature                           | Apollo.io                                                             | Clay                                                   | Qualifai v2.2 Approach                                                                                               |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Source URL inventory per prospect | Not exposed to user                                                   | Not exposed; waterfall is internal logic               | Prospect-domain-specific URL list stored with discovery-method provenance, surfaced in admin UI                      |
| JS-heavy page extraction          | Not a focus — relies on structured APIs                               | Relies on provider APIs, not direct extraction         | Crawl4AI Playwright engine for all REVIEWS/CAREERS/JOB_BOARD URL types; shadow DOM and session supported             |
| Pain/signal confirmation gate     | Score threshold gates sequence enrollment; no cross-source validation | Data quality is user's responsibility; no gate concept | Configurable cross-source workflowTag confirmation threshold; blocks send queue                                      |
| Override audit trail              | Enterprise Salesforce audit trail; not native to Apollo               | No audit trail concept                                 | Lightweight: reason required in UI, timestamp + reason persisted to existing schema field, bypass badge in dashboard |

---

## Sources

- Codebase analysis: `/lib/research-executor.ts`, `/lib/quality-config.ts`, `/prisma/schema.prisma` (HIGH confidence — direct read)
- [Crawl4AI Documentation v0.8.x — Page Interaction](https://docs.crawl4ai.com/core/page-interaction/) — Playwright, shadow DOM, session management (HIGH confidence)
- [Best Ways to Scrape JavaScript-Heavy Sites — Bright Data 2026](https://brightdata.com/blog/web-data/scraping-js-heavy-websites) — headless as default (MEDIUM confidence)
- [G2's 2026 Report: State of AI Sales Intelligence in Prospecting](https://learn.g2.com/ai-sales-intelligence-in-prospecting) — data quality as primary criterion, 94-97% accuracy tier (MEDIUM confidence)
- [Signal-Driven Personalization — AutoBound 2026](https://www.autobound.ai/blog/signal-driven-personalization-buyer-signals-outreach-converts) — 5x reply rate from validated signals (MEDIUM confidence)
- [Audit Log Best Practices — Fortra](https://www.fortra.com/blog/audit-log-best-practices-security-compliance) — who/when/why requirements (HIGH confidence)
- [Best Practices for Audit Logging in SaaS — Chris Dermody](https://chrisdermody.com/best-practices-for-audit-logging-in-a-saas-business-app/) — event structure standards (MEDIUM confidence)
- [Top 12 Sales Intelligence Platforms 2026 — Salesmotion](https://salesmotion.io/blog/best-sales-intelligence-platforms-2026) — Clay waterfall enrichment patterns (MEDIUM confidence)
- PROJECT.md Key Decisions — soft gate rationale for Dutch SMBs, `Campaign.strictGate` boolean (HIGH confidence)

---

_Feature research for: Qualifai v2.2 Verified Pain Intelligence_
_Researched: 2026-03-02_
_Supersedes: v2.0 FEATURES.md (which covered oversight console UX, not evidence pipeline intelligence)_
