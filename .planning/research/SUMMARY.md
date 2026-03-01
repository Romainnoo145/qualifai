# Project Research Summary

**Project:** Qualifai v2.2 — Verified Pain Intelligence
**Domain:** Sales intelligence pipeline — automated evidence gathering with cross-source pain confirmation
**Researched:** 2026-03-02
**Confidence:** HIGH

## Executive Summary

Qualifai v2.2 extends a mature, 8-source AI-scored evidence pipeline (already shipping in v2.1) with four tightly-scoped capabilities: automatic source URL discovery with provenance, browser-rendered extraction for JS-heavy pages, a cross-source pain confirmation gate, and an immutable override audit trail. All four capabilities are achievable with zero new npm dependencies — the existing stack (Next.js 16, tRPC 11, Prisma 7, Scrapling, Crawl4AI, SerpAPI, Gemini Flash, Zod 4) already provides every primitive needed. The architectural pattern is consistent across all four features: extend existing modules rather than replace them, persist structured data to the existing Prisma schema, and keep gate logic in pure TypeScript library functions with no I/O — matching the already-validated `evaluateQualityGate` / `quality-config.ts` pattern.

The recommended approach is a sequential three-phase build: source discovery with provenance first (Phase 28), browser-rendered extraction second (Phase 29), and the pain gate plus audit trail last (Phase 30). This order is dictated by hard data dependencies — the pain gate evaluates the full evidence set including browser-extracted items, so extraction must be wired before the gate runs. Source discovery must be refactored first because it produces the `jsHeavyHint` flags that control browser extraction routing. The schema migration (two new fields on `ResearchRun`, one new `GateOverrideAudit` model) is safest in the final phase, minimising migration risk on a live system with 7 real prospects.

The primary risk is the Dutch SMB "thin web presence" problem, already documented in the decision log. The pain confirmation gate must be implemented as a soft advisory gate, not a second hard block layered on top of the existing AMBER quality gate. Hard-blocking on cross-source confirmation would leave most Dutch SMB prospects permanently unactionable — a failure mode explicitly ruled out in v2.1 design decisions. A second risk is SerpAPI credit burn if automatic discovery is not guarded by a prospect-level cache. Both risks have concrete, research-validated mitigations.

---

## Key Findings

### Recommended Stack

Zero new npm dependencies are required for v2.2. All four capability areas are handled by the existing dependency tree, verified against the codebase directly. The only schema additions are two new Prisma models (`inputSnapshot.sourceSet` JSON structure and `GateOverrideAudit` as a proper relational model) and two new fields on `ResearchRun` (`painGatePassed Boolean?`, `painGateDetails Json?`).

**Core technologies — v2.2 usage:**

- `sitemapper@^4.1.4` + `serpapi@^2.2.1`: Source URL discovery — already installed and functional; gap is persisting discovered URLs as a provenance-tagged `sourceSet` in `inputSnapshot` rather than computing inline and discarding
- Scrapling `/fetch-dynamic` endpoint: Browser-rendered extraction — `fetchDynamic()` in `lib/enrichment/scrapling.ts` already exists but is not called from the main pipeline; needs wiring, not new code
- Crawl4AI v0.8.x with `remove_consent_popups`, `flatten_shadow_dom`, `process_iframes`: Enhanced extraction for review platforms and job boards — configuration-only change, no library update
- Prisma 7 `$transaction` + composite unique index: Atomic override logging — established pattern already used in the send queue idempotency guard
- `@google/generative-ai@^0.24.1` (Gemini Flash): Existing `scoreEvidenceBatch()` unchanged; pain gate evaluates already-scored `aiRelevance` fields
- Built-in `URL` class (Node.js stdlib): URL normalisation — 4 lines of logic, no new dependency needed

**Critical version constraint:** Crawl4AI service must be on v0.8.x for `remove_consent_popups` and `flatten_shadow_dom` to be available. Verify service version before deploying enhanced config.

See `.planning/research/STACK.md` for full capability-by-capability analysis.

### Expected Features

All four features are rated P1 — all must ship in v2.2 for the "Verified Pain Intelligence" milestone to deliver value.

**Must have (table stakes — v2.2):**

- Discovered source URL list stored per prospect with provenance — admin trust foundation; without this, there is no way to verify what was researched or add targeted manual seeds
- Browser-rendered extraction for all REVIEWS, CAREERS, and JOB_BOARD URL types — unblocks JS-heavy pages that are the highest-signal sources for pain detection
- Cross-source pain confirmation gate — the core milestone deliverable; extends `evaluateQualityGate` to output `confirmedPainTags[]` and `unconfirmedPainTags[]`, displayed to admin before send; soft gate with mandatory override reason
- Override audit trail with mandatory reason — reason field enforced in UI on bypass; `GateOverrideAudit` row created in same `$transaction` as approval; "bypassed" badge visible in dashboard

**Should have (competitive differentiators — add within v2.2 scope if time allows):**

- Source provenance labels on individual evidence cards (`manually added`, `auto-discovered`, `sitemap`, `SERP`) — improves admin confidence in individual items with minimal implementation cost
- Source discovery UI panel — dedicated interface to review discovered sources and add manual seeds; implement once admin is manually editing source lists more than twice per week

**Defer to v2.x (after validation):**

- Per-campaign confirmation threshold configuration — premature at current 7-50 prospect volumes
- Override analytics (frequency charts, most-commonly-unconfirmed pain tags) — meaningful only after 20+ prospects with visible override patterns
- Sector-specific source URL templates — defer until 50+ prospects across 5+ sectors

**Anti-features confirmed as out of scope:**

- Hard cross-source pain gate blocking ALL outreach (Dutch SMBs have thin web presence — would block most NL prospects)
- Real-time source discovery triggered on prospect import (burns SerpAPI credits on prospects that may never be researched)
- Storing full rendered HTML per discovered URL (storage bloat, no practical benefit at current volumes)
- Per-source-type confidence thresholds (configuration surface area; AI source weights already handle this)

See `.planning/research/FEATURES.md` for full competitor comparison and feature dependency graph.

### Architecture Approach

The v2.2 architecture follows a strict "extend, don't replace" philosophy. Three new library modules are added, two existing files are modified, and two tRPC routers receive targeted additions. All other existing modules are unchanged. The pipeline orchestrator (`lib/research-executor.ts`) remains the single integration point — new modules are called from within it in sequence.

**Major components:**

1. `lib/enrichment/source-discovery.ts` (NEW) — `discoverSourcesForProspect()` returning `ProspectSourceSet` with provenance-tagged URLs (`sitemap`, `serp`, `manual`, `default`) and `jsHeavyHint` flags per URL; consolidates inline sitemap + SERP + default-path logic currently scattered in `research-executor.ts`; persists to `inputSnapshot.sourceSet`
2. `lib/browser-evidence-adapter.ts` (NEW) — wraps existing `fetchDynamic()` from `scrapling.ts`; receives URLs where stealth returned < 500 chars or `jsHeavyHint: true`; caps at 5 URLs per run (~50s worst-case addition); sets `metadata.adapter = 'browser-dynamic'` so pain gate counts these as observed evidence
3. `lib/pain-gate.ts` (NEW) — pure function `evaluatePainConfirmationGate(items, domain)` with no I/O; threshold constants in `quality-config.ts`; returns `PainGateResult` with `passed`, `reasons`, `externalConfirmationCount`, `distinctPainTags`; called after `evaluateQualityGate()` in pipeline; result persisted to `ResearchRun.painGatePassed` and `painGateDetails`
4. `GateOverrideAudit` schema model (NEW) — append-only, immutable audit log; `gateType` discriminator (`'quality_gate'` | `'pain_gate'`) covers both gates with one model; includes `gateSnapshot` JSON for point-in-time record; relation on `ResearchRun` enables `getRun` to include full override history
5. `lib/research-executor.ts` (MODIFIED) — pipeline orchestration updated to call source discovery, browser extraction, and pain gate in sequence; backward-compatible with existing `sitemapCache` / `serpCache` keys for retries of old runs; `painGatePassed IS NULL` pass-through in send queue protects existing 7 prospects from sudden blocking

**Key patterns to enforce:**

- Gate logic as pure functions in lib modules with no I/O — matches `evaluateQualityGate` / `assessEmailForOutreach` pattern
- Thresholds as named exports in `quality-config.ts` — never hardcoded in gate components or routers
- Override as explicit `db.gateOverrideAudit.create()` in `$transaction` — not Prisma middleware or DB triggers
- Two-tier extraction: stealth-first, browser escalation only for < 500 chars or `jsHeavyHint: true`

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, component boundary table, and schema SQL.

### Critical Pitfalls

Research identified 8 pitfalls derived from direct codebase analysis and validated architectural decisions. Top 5 by severity:

1. **Pain confirmation gate implemented as a second hard block** — Dutch SMBs with thin web presence structurally cannot pass cross-source confirmation; adding a second hard block on top of AMBER creates a permanently blocked prospect queue with no action path. Prevention: implement as advisory only; AMBER quality gate remains the single hard block; pain confirmation displays its state but always permits override with a written reason.

2. **Source provenance lost when automatic discovery merges with manual seeds** — without `discoveryMethod` in `EvidenceDraft.metadata` before the deduplicate pass, provenance is permanently discarded; evidence items cannot be traced to their origin; admin cannot distinguish manually-seeded (high-credibility) from auto-discovered (lower-credibility) evidence. Prevention: add `discoveryMethod` to draft metadata at point of discovery, before any merge or dedup step.

3. **Override audit trail stored in `inputSnapshot` JSON** — JSON blobs cannot be efficiently queried; compliance questions ("who approved what, when") require manual JSON parsing; override records cannot be joined to user or prospect tables. Prevention: always use a proper `GateOverrideAudit` relational model with indexed columns; never store override records in unstructured JSON fields.

4. **SerpAPI credit burn from automatic per-prospect discovery** — without a prospect-level cache, every re-run triggers 3-5 SerpAPI calls per prospect; a batch re-run of 20 prospects exhausts monthly quota in hours. Prevention: store `serpDiscoveredAt` timestamp at prospect level; skip SerpAPI if cache is < 24h old; never trigger SerpAPI at import time.

5. **Pain gate thresholds not calibrated against actual prospect data** — intuition-derived thresholds produce always-RED (too strict) or always-GREEN (too lenient) gates; the Dutch NL/BE market has structurally thinner web evidence than UK/US benchmarks assume. Prevention: run calibration SQL against the 7 existing real prospects before writing any threshold constants; thresholds must pass at least 5 of 7 existing prospects.

See `.planning/research/PITFALLS.md` for remaining pitfalls, recovery strategies, performance traps, and the "looks done but isn't" checklist.

---

## Implications for Roadmap

Research is unambiguous on build order. All three phases are independently shippable and testable. Phase 30 gates on both Phase 28 and Phase 29 completing first.

### Phase 28: Source Discovery with Provenance

**Rationale:** Foundation for everything else. Browser extraction uses `jsHeavyHint` flags from source discovery. Pain gate benefits from knowing evidence came from distinct discovered sources. Provenance metadata must be attached to `EvidenceDraft` before any merge step — once the merge runs without provenance, the information is unrecoverable. This phase also establishes the prospect-level SerpAPI cache that prevents credit exhaustion in all subsequent runs.

**Delivers:** `lib/enrichment/source-discovery.ts` with `discoverSourcesForProspect()` and `ProspectSourceSet` type; `discoveryMethod` field in evidence draft metadata contract; `inputSnapshot.sourceSet` persisted per research run; per-source URL caps as named constants in `quality-config.ts` (`MAX_SITEMAP_URLS = 20`, `MAX_SERP_URLS = 10`, etc.); prospect-level `serpDiscoveredAt` field (schema addition).

**Addresses:** Source URL list visible per prospect (table stakes), source provenance labels (differentiator), SerpAPI credit burn protection (critical pitfall).

**Avoids:** Source provenance lost at merge (Pitfall 2 in pitfalls research), URL discovery explosion (Pitfall 1 — per-source caps defined before discovery merge logic is written), SerpAPI credit burn (Pitfall 6).

**Research flag:** No additional research needed. Pattern is a mechanical refactor of inline `research-executor.ts` logic into a dedicated module. Direct codebase inspection gives HIGH confidence on all integration points.

---

### Phase 29: Browser-Rendered Evidence Extraction

**Rationale:** Depends on Phase 28's `jsHeavyHint` flags to identify which URLs need browser rendering. `fetchDynamic()` in `lib/enrichment/scrapling.ts` already exists — this phase is exclusively wiring, not new service code. Must complete before Phase 30 so the pain gate evaluates the full evidence set including browser-extracted items, giving calibration a realistic baseline.

**Delivers:** `lib/browser-evidence-adapter.ts` wrapping `fetchDynamic()`; stealth-first routing in `research-executor.ts` with escalation to browser for URLs returning < 500 chars or with `jsHeavyHint: true`; 5-URL cap per run; `metadata.adapter = 'browser-dynamic'` provenance tag; Crawl4AI enhanced config (`remove_consent_popups`, `flatten_shadow_dom`, `process_iframes`, `word_count_threshold: 50`) applied to REVIEWS and JOB_BOARD URL types.

**Addresses:** Browser-rendered extraction for high-signal URL types (P1 table stakes), JS-heavy page extraction as competitive differentiator.

**Avoids:** Crawl4AI systematic overuse for all URLs (Pitfall 3 — stealth-first routing enforced), Crawl4AI timeout cascade (Pitfall 7 — 5-URL cap + reduced timeout for non-SPA pages), pipeline time explosion (50s max addition, acceptable at current admin console wait times).

**Research flag:** No additional research needed. `fetchDynamic()` is confirmed in the codebase. Scrapling `/fetch-dynamic` endpoint is confirmed in `services/scrapling/app.py`. Crawl4AI v0.8.x parameters are verified against official documentation (HIGH confidence).

---

### Phase 30: Pain Confirmation Gate + Override Audit Trail

**Rationale:** Requires Phases 28 and 29 complete so the gate evaluates the full evidence set including browser-extracted items. Schema migration is safest last — minimises the window where production data could be affected by migration issues. Override audit is meaningless without a gate to override. Pain gate and audit trail are logically coupled and jointly testable as a single phase.

**Delivers:** Prisma schema migration (`painGatePassed Boolean?`, `painGateDetails Json?` on `ResearchRun`; `GateOverrideAudit` model with `gateType`, `gatePassed`, `overrideReason`, `overriddenBy`, `gateSnapshot`); `lib/pain-gate.ts` pure gate function; `PAIN_GATE_*` threshold constants in `quality-config.ts` (calibrated against 7 real prospects before writing); pain gate wired into `research-executor.ts` after `evaluateQualityGate()`; `GateOverrideAudit.create()` in `$transaction` in `research.approveQuality` tRPC mutation; pain gate check in `outreach.ts` send queue with `IS NULL` legacy pass-through; UI: collapsible override audit timeline in research run detail, pain tag confirmed/suspected display in send queue, "bypassed" badge in admin dashboard, mandatory reason field enforcement on override form.

**Addresses:** Cross-source pain confirmation gate (core P1 milestone deliverable), override audit trail with mandatory reason (P1 compliance hygiene).

**Avoids:** Pain gate as second hard block (Pitfall 2 in pitfalls research — advisory only, AMBER quality gate remains single hard block), override audit in JSON metadata (Pitfall 4 — proper relational model enforced), uncalibrated thresholds (Pitfall 8 — run calibration SQL query against 7 real prospects before writing constants), `organizationId` missing from audit model (security mistake — all models require `organizationId` per global multi-tenant rules).

**Research flag:** Pain gate threshold calibration against real data is the one area of MEDIUM confidence. Run the calibration SQL query against the live DB before committing threshold values:

```sql
SELECT p."companyName", ei."sourceType", COUNT(*)
FROM "EvidenceItem" ei
JOIN "Prospect" p ON ei."prospectId" = p.id
WHERE ei."confidenceScore" >= 0.55
GROUP BY p."companyName", ei."sourceType"
ORDER BY p."companyName", ei."sourceType";
```

If fewer than 5 of 7 existing prospects would pass the proposed thresholds, reduce them before shipping. The architecture and code pattern are HIGH confidence; only the numeric values need empirical validation.

---

### Phase Ordering Rationale

- **Source discovery must come first** because `jsHeavyHint` flags are a data dependency for browser extraction routing, and `discoveryMethod` metadata must be attached before the merge step — provenance is permanently unrecoverable once the merge runs without it.
- **Browser extraction must come before the pain gate** because the gate evaluates the full evidence set; adding browser-extracted items after gate calibration would shift the threshold baseline and invalidate initial calibration.
- **Schema migration is last** because it operates on a live production database with 7 real prospects. Phasing new nullable fields as the final step means Phases 28 and 29 can be verified with no migration risk.
- **Override audit is bundled with the pain gate (not a separate phase)** because an audit trail for a gate that does not yet exist has no value. The two features are logically coupled and jointly testable.
- **Each phase is independently shippable and testable** — Phase 28 can go to production before Phase 29 is built; Phase 29 can go to production before the schema migration in Phase 30.

### Research Flags

Phases needing deeper research or calibration during planning:

- **Phase 30:** Pain gate threshold calibration — run the calibration SQL above against the live DB before writing `PAIN_GATE_*` constants in `quality-config.ts`. MEDIUM confidence on numeric values only.

Phases with standard patterns (skip `/gsd:research-phase`):

- **Phase 28:** Source discovery refactor is a mechanical extraction of inline logic into a dedicated module. No unknown integrations. HIGH confidence from direct codebase inspection.
- **Phase 29:** Browser extraction wiring is fully confirmed from codebase — `fetchDynamic()` exists, Scrapling endpoint exists, Crawl4AI parameters are documented. No research needed.

---

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                                                                                                                                                                                  |
| ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Zero new dependencies confirmed by direct codebase inspection. All capabilities trace back to already-installed packages. Only Crawl4AI service version needs pre-deploy verification (must be v0.8.x for `remove_consent_popups` and `flatten_shadow_dom`).                                                           |
| Features     | HIGH       | Table stakes and differentiators derived from direct codebase analysis plus established industry patterns. Cross-source pain confirmation gate is novel but built entirely on verified primitives (`workflowTag`, `sourceType`, `aiRelevance` fields exist in schema and are already populated).                       |
| Architecture | HIGH       | All findings from direct codebase inspection. `fetchDynamic()` confirmed in `scrapling.ts`. `evaluatePainConfirmation` prototype confirmed in `workflow-engine.ts`. `GateOverrideAudit` pattern confirmed against `NotificationLog` model. Backward compat strategy (`IS NULL` pass-through) is explicit and verified. |
| Pitfalls     | HIGH       | Pitfalls derived from codebase analysis plus validated architectural decisions in MEMORY.md and PROJECT.md. The "thin web presence" constraint is already a Key Decision. SerpAPI quota mechanics confirmed from provider documentation.                                                                               |

**Overall confidence:** HIGH

### Gaps to Address

- **Pain gate numeric thresholds:** Architecture is clear but the specific values (`aiRelevance >= 0.65`, 1 external item, 2 distinct pain tags) are proposed, not calibrated. Run the calibration query against 7 real prospects before writing constants. If fewer than 5 of 7 pass, reduce thresholds.
- **Prospect-level SerpAPI cache field:** The strategy (`serpDiscoveredAt` on `Prospect` model) is specified in pitfalls research but requires a schema addition not included in the main STACK.md schema summary. This field must be added in the Phase 28 migration — note it explicitly in the phase plan.
- **Scrapling service `max_workers` limit:** The architecture notes a hard ceiling of 4 concurrent browser sessions. With a 5-URL cap and sequential processing, this is safe at current volumes. Revisit if runs are queued concurrently for multiple prospects.
- **Crawl4AI v0.8.x service version:** The enhanced config parameters (`remove_consent_popups`, `flatten_shadow_dom`) are v0.8.x features. Verify the running service version before Phase 29 ships. If the service is on an older version, the params will silently fail (not error).
- **`/discover/` validation session (existing tech debt):** MEMORY.md notes a pending validation session on the client-facing prospect dashboard before building features that depend on hypothesis confirmation. Phase 30's pain gate display is in the admin UI only and is independent of this. Do not build any v2.2 client-facing confirmation features until this session runs.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `lib/research-executor.ts` — full 8-source pipeline orchestration, URL merge logic, 60-item cap
- `lib/enrichment/scrapling.ts` — `fetchStealth()` and `fetchDynamic()` clients confirmed
- `lib/enrichment/crawl4ai.ts` — Crawl4AI client, current config baseline, sequential extraction pattern
- `lib/enrichment/serp.ts` — SerpAPI discovery, 3 queries per call, 5-URL caps per engine
- `lib/enrichment/sitemap.ts` — sitemapper usage confirmed
- `lib/evidence-scorer.ts` — Gemini Flash scoring formula and batch size
- `lib/quality-config.ts` — existing gate thresholds, calibration notes
- `lib/workflow-engine.ts` — `evaluatePainConfirmation` prototype (advisory), `isObservedEvidence` filter
- `lib/outreach/quality.ts` — design pattern for pure-function gate logic
- `server/routers/research.ts` — `approveQuality` mutation integration point
- `server/routers/outreach.ts` — send queue gate check pattern
- `services/scrapling/app.py` — `/fetch` and `/fetch-dynamic` endpoints confirmed
- `prisma/schema.prisma` — full schema, `NotificationLog` as audit model reference
- `.planning/PROJECT.md` — v2.2 target features, key decisions (soft gate rationale, `Campaign.strictGate`)

### Secondary (HIGH confidence — official documentation)

- `docs.crawl4ai.com/api/parameters/` — `remove_consent_popups`, `flatten_shadow_dom`, `process_iframes` parameters verified for v0.8.x
- `docs.crawl4ai.com/core/content-selection/` — `word_count_threshold`, `excluded_tags` verified
- Prisma 7 documentation — `$transaction`, composite unique index, upsert semantics confirmed

### Secondary (MEDIUM confidence — industry patterns and external sources)

- AutoBound 2026: Signal-driven personalization achieves 15-25% reply rates vs. 3.43% for unvalidated cold email (5x improvement)
- G2 2026 State of AI Sales Intelligence: data quality as primary criterion for platform selection
- Fortra / Chris Dermody audit log best practices: who/when/why requirements for compliance-adjacent SaaS
- Deloitte 2026 Compliance Technology Study: 72% of organizations experienced compliance violations from inadequate audit trails
- Bright Data 2026: headless browser scraping now the default for JS-heavy pages
- SerpAPI 2025 changelog: no breaking changes to `getJson()` interface
- PostgreSQL audit trail patterns: trigger-based approach confirmed over-engineered for application-level concerns at current scale

---

_Research completed: 2026-03-02_
_Ready for roadmap: yes_
