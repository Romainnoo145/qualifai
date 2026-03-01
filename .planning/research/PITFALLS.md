# Pitfalls Research

**Domain:** Adding automatic source discovery, browser-rendered evidence extraction, pain confirmation gates, and override audit trails to an existing 8-source sales intelligence pipeline targeting Dutch/Belgian SMBs with thin web presence
**Researched:** 2026-03-02
**Confidence:** HIGH — derived from direct codebase analysis (`lib/research-executor.ts`, `lib/enrichment/serp.ts`, `lib/enrichment/crawl4ai.ts`, `lib/evidence-scorer.ts`, `lib/quality-config.ts`, `lib/workflow-engine.ts`, `prisma/schema.prisma`) plus web research on domain-specific failure modes

---

## Critical Pitfalls

Mistakes that cause pipeline failures, system-wide blocks, or outreach quality regressions.

---

### Pitfall 1: URL Discovery Explosion Breaking Per-Prospect Crawl Budget

**What goes wrong:**
Automatic source discovery per prospect (Google + sitemap + manual merge) generates far more URLs than the existing pipeline's `slice(0, 10)` cap in `ingestCrawl4aiEvidenceDrafts`. A large e-commerce or franchise prospect can have a sitemap with thousands of URLs. The current `discoverSitemapUrls` already feeds into `researchUrls` — adding automatic Google source discovery on top multiplies this. If no deduplication-aware cap is enforced per source category, a single prospect run can attempt 100+ Crawl4AI extractions, each with a 60-second timeout, turning one research run into a 90-minute blocking operation.

**Why it happens:**
The current pipeline caps `ingestCrawl4aiEvidenceDrafts` at 10 URLs (`capped = urls.slice(0, 10)`) but does not cap the sitemap URL pool fed to `ingestWebsiteEvidenceDrafts`. When automatic discovery merges Google-discovered URLs with sitemap URLs with manual seeds, the pre-cap merge can produce 200+ URLs before any slice is applied. Developers add the merge without auditing the total URL count entering each extractor.

**How to avoid:**

- Enforce per-source-category URL caps **before** feeding into extractors, not inside them:
  - Sitemap URLs: max 20 (prioritize `/over`, `/diensten`, `/werkwijze`, `/vacatures` paths)
  - Google-discovered URLs: max 10 (already in `discoverGoogleSearchMentions` with `slice(0, 12)`)
  - Manual seed URLs: max 10 (user-provided, high-quality)
  - SERP job/review URLs: max 5 each (already in `discoverSerpUrls` with `slice(0, 5)`)
- Add a total pre-extraction URL count log: if total > 30, emit a diagnostic warning with count
- Keep the `evidenceDrafts.slice(0, 60)` ceiling already in place as the final safety net
- Score-and-prune before Crawl4AI: score snippets from SerpAPI alone first; only browser-extract URLs where the snippet score is insufficient to establish evidence

**Warning signs:**
Research runs exceeding 3 minutes per prospect. Crawl4AI service logging concurrent connection saturation. Memory usage on the Scrapling service spiking during research. `evidenceRecords.length` regularly hitting the 60-item cap (means input was much larger and important items may be cut).

**Phase to address:** Source discovery phase — define per-source URL caps as named constants in `quality-config.ts` before writing the discovery merge logic.

---

### Pitfall 2: Pain Confirmation Gate Becomes a Stricter Hard Block for Thin-Presence Prospects

**What goes wrong:**
The existing quality gate learned from experience that hard blocking Dutch SMBs creates an unusable system (`Out of Scope: Research completeness as hard blocker — Makes system unusable for thin-presence Dutch SMBs`). The v2.2 pain confirmation gate adds a stricter requirement: minimum cross-source evidence confirming pain. If this gate is implemented as a second hard block (like AMBER already is), thin-presence prospects will never pass two sequential hard gates. The admin will face a queue of permanently blocked prospects with no path to outreach.

**Why it happens:**
The existing `evaluatePainConfirmation` in `workflow-engine.ts` (lines 381-428) already requires: 3+ observed evidence items, 1+ context source, 1+ external pain source (reviews or jobs), 1+ distinct pain workflow tag. These conditions often cannot be satisfied for a small Dutch tradesperson with no Glassdoor presence, no job listings, and no Google reviews. Adding a new gate that also requires cross-source confirmation on top of these existing checks is additive blocking.

**How to avoid:**

- The pain confirmation gate must be a soft gate only — show the admin WHY pain confirmation is weak, but do not block outreach a second time
- Use the traffic-light metaphor: pain gate shows its own AMBER/RED/GREEN state next to the existing quality gate — admin sees both, decides whether to proceed
- Never make two sequential hard blocks — the current AMBER quality gate is the single hard block; pain confirmation must be advisory
- Define "thin presence" explicitly: if `sourceTypeCount < 3` (which triggers AMBER on the quality gate), the pain gate should automatically label itself as "limited signal — thin web presence expected" rather than firing another warning
- The pain confirmation gate's purpose is to tell admin "this outreach is backed by X cross-source pain signals" — not to block low-scoring prospects

**Warning signs:**
Prospects with `gateStatus: 'amber'` that also fail pain confirmation creating a backlog with no action path. Admin reports "nothing can be sent" despite researched prospects in the queue. The `qualityApproved` override gets used on 80%+ of prospects (indicates gate is too strict for the market).

**Phase to address:** Pain confirmation gate phase — design the gate as a display/advisory widget alongside the existing traffic-light, not as a new `qualityApproved`-style field that blocks the send queue.

---

### Pitfall 3: Browser Extraction Used Systematically for All Sources, Not Just JS-Heavy Pages

**What goes wrong:**
Crawl4AI (`extractMarkdown` with `wait_for_timeout: 15000` and `delay_before_return_html: 2`) is expensive per call — each extraction takes 5-20 seconds for a real browser render. If v2.2 "systematically uses browser extraction for all sources," it means every discovered URL (sitemap, Google mentions, SERP jobs, manual seeds) gets routed through Crawl4AI instead of through the faster `web-evidence-adapter` (which uses the Scrapling stealth fetcher). This multiplies extraction time by 3-5x for pages that would return equivalent content via a plain HTTP fetch.

**Why it happens:**
The current pipeline uses two extractors at two cost levels: `ingestWebsiteEvidenceDrafts` (fast, stealth HTTP) for homepage/sitemap URLs and `ingestCrawl4aiEvidenceDrafts` (slow, full browser) for SERP-discovered URLs. Systematizing browser extraction collapses this distinction in the name of consistency, ignoring the cost difference.

**How to avoid:**

- Keep the two-tier approach: use Scrapling stealth fetcher for static/server-rendered pages; use Crawl4AI only for URLs that return low-content after a stealth fetch (`markdown.length < 500`)
- Add a routing decision: attempt stealth fetch first → if `markdown.length >= 500`, use that content; if `< 500`, escalate to Crawl4AI
- Tag the extraction path in metadata (`adapter: 'scrapling-stealth'` vs `adapter: 'crawl4ai'`) so diagnostics show which tier handled each URL
- Only auto-escalate to Crawl4AI for domains known to require JS render (SPAs, cookie-wall sites)

**Warning signs:**
Research run time exceeding 5 minutes per prospect. Crawl4AI service timeout errors appearing in diagnostics for simple HTML pages. Scrapling service underutilized (showing near-zero requests in logs while Crawl4AI service is saturated).

**Phase to address:** Browser extraction phase — write a routing function that decides stealth vs. browser based on content length, before connecting discovery to extraction.

---

### Pitfall 4: Override Audit Trail Stored in Unqueryable JSON Metadata

**What goes wrong:**
The existing pattern for storing auxiliary information in the codebase is to embed it in `inputSnapshot` (a `Json` column on `ResearchRun`) or in `metadata` (a `Json` column on `EvidenceItem`). If the override audit trail for manual gate bypasses is stored the same way, it becomes unqueryable — you cannot efficiently answer "how many overrides happened this week" or "which admin user bypassed the gate for prospect X" without scanning and parsing all JSON rows. This defeats the purpose of an audit trail: accountability requires queryable, indexed records.

**Why it happens:**
Adding a JSON column is one migration with no schema design cost. Adding a proper `GateOverride` table requires defining the model, the relation, running a migration, and writing a new router. Developers under time pressure take the JSON path.

**How to avoid:**

- Create a dedicated `GateOverride` model in the Prisma schema:
  ```
  model GateOverride {
    id          String   @id @default(cuid())
    prospectId  String
    runId       String?
    overriddenBy String  // admin userId or 'system'
    reason      String?
    gateBefore  String   // 'amber' | 'red'
    createdAt   DateTime @default(now())
    prospect    Prospect @relation(fields: [prospectId], references: [id])
  }
  ```
- Do NOT store override records inside `inputSnapshot` or `metadata` — those are unindexed blobs
- The override audit trail's primary use cases require SQL queries: "who approved this", "how often is AMBER overridden", "show all overrides for this prospect" — these require proper columns and indexes
- The `overriddenBy` field must be the admin session user ID, not just a boolean flag

**Warning signs:**
Reporting on override frequency requires raw SQL with `jsonb_path_exists`. Override records cannot be joined to user or prospect tables. Audit review means manually reading the `inputSnapshot` JSON blob per run.

**Phase to address:** Override audit trail phase — design the `GateOverride` model before writing any UI that triggers overrides.

---

### Pitfall 5: Source Provenance Lost When Automatic Discovery Merges with Manual Seeds

**What goes wrong:**
The current pipeline takes `manualUrls` from the research run input and merges them with sitemap-discovered URLs and SERP-discovered URLs in `researchUrls`. When automatic source discovery adds another origin (Google search results), the merged URL list loses provenance — there is no way to tell which evidence item came from which discovery method. When a hypothesis references an evidence item, the admin cannot tell whether that item came from a manually-provided URL (high credibility) or an automatically-discovered URL that may be a false match (lower credibility).

**Why it happens:**
The `uniqueUrls` function and `dedupeEvidenceDrafts` operate on raw URL strings and draft objects. The draft's `metadata` field exists but is only populated with adapter type, not with the discovery method that found the URL. Provenance is discarded at the merge step.

**How to avoid:**

- Add a `discoveryMethod` field to `EvidenceDraft.metadata` at the point of discovery:
  - `'manual'` — admin-provided URL
  - `'sitemap'` — found in `sitemap.xml`
  - `'serp-google-maps'` — found via SerpAPI Maps engine
  - `'serp-google-jobs'` — found via SerpAPI Jobs engine
  - `'serp-google-search'` — found via Google search mentions
  - `'auto-google-discovery'` — new v2.2 source discovery
- This field is already conceptually available in `adapter` in the current metadata but is not set for sitemap-sourced evidence
- Display discovery method in the admin evidence tab — admins need to know "this came from an auto-discovered Google result" vs "this came from the site's own sitemap"

**Warning signs:**
Admin cannot explain to a prospect why a particular piece of evidence was included. Evidence items with suspicious URLs (unrelated domains) cannot be filtered. Hypothesis AI incorrectly weights auto-discovered noise as high-credibility manual evidence.

**Phase to address:** Source discovery phase — add `discoveryMethod` to the draft metadata contract before the merge step is built.

---

### Pitfall 6: SerpAPI Credit Burn from Automatic Per-Prospect Discovery

**What goes wrong:**
The current pipeline uses SerpAPI only in `deepCrawl` mode, which is manually triggered. v2.2 adds automatic source discovery per prospect, which may trigger SerpAPI calls on every new prospect import (or every re-run). SerpAPI's current plan has a monthly quota, and the plan's hourly cap is 20% of the monthly quota. Each prospect research run already burns 3-5 SerpAPI calls (Maps lookup + Maps reviews + Jobs search + 3 Google Search queries). Automatic discovery that triggers on every prospect import could burn through the quota in hours if a batch of 20 prospects is imported.

**Why it happens:**
The discovery logic is triggered in response to a prospect event (import or re-run). Without a per-prospect daily discovery cache that is respected across re-runs, each re-run triggers fresh SerpAPI calls. The current SERP cache in `inputSnapshot` only persists across re-runs of the same `existingRunId` — a new run created from scratch bypasses the cache.

**How to avoid:**

- Store a `serpDiscoveredAt` timestamp directly on the `Prospect` model (not just in `ResearchRun.inputSnapshot`), so all re-runs for the same prospect check prospect-level cache before calling SerpAPI
- Add a global SerpAPI call counter (Redis incr or DB counter) per day — emit a warning diagnostic when calls-per-day exceeds a configured threshold (e.g., 50)
- Never auto-trigger SerpAPI discovery on batch imports — discovery should be triggered lazily when a research run is started, not at import time
- The `discoverGoogleSearchMentions` function runs 3 queries per call — the v2.2 automatic discovery must not add additional parallel discovery calls without also caching results at the prospect level

**Warning signs:**
SerpAPI dashboard shows unexpected quota spikes. `serpDiscoveredAt` is missing from the prospect record and every run triggers fresh calls. Research runs creating new `ResearchRun` records (not reusing `existingRunId`) always hit SerpAPI even for recently-researched prospects.

**Phase to address:** Source discovery phase — add prospect-level SerpAPI cache column before building automatic discovery logic.

---

### Pitfall 7: Crawl4AI Timeout Cascade Blocking the Entire Research Run

**What goes wrong:**
The current `extractMarkdown` in `crawl4ai.ts` sets a 60-second `AbortController` timeout. This means a single slow URL (e.g., a JS-heavy SPA that never finishes loading) blocks one Crawl4AI slot for 60 seconds. The current code extracts URLs sequentially (`for (const url of capped)`) — 10 URLs × 60-second timeout = up to 10 minutes of blocking time if all URLs are JS-heavy or unreachable. If v2.2 systematically routes more URLs through Crawl4AI, this cascade becomes worse.

**Why it happens:**
Sequential extraction is safe (no concurrency management needed) but slow. The `AbortController` timeout is per-request, not per-batch. There is no "fast timeout" for clearly broken pages and a "slow timeout" for pages that are loading — all pages get 60 seconds regardless of whether they returned a 404 in 100ms or are a live SPA.

**How to avoid:**

- Implement a two-phase timeout: fast head request (3 seconds) to check if URL is reachable before committing a full browser render
- For URLs that respond quickly with short content (< 500 chars), skip Crawl4AI and use the content as-is
- Reduce Crawl4AI timeout from 60 seconds to 30 seconds for non-SPA pages (use `wait_until: 'domcontentloaded'` instead of `wait_for_timeout: 15000`)
- Run Crawl4AI extractions with `Promise.allSettled` with a concurrency limit of 3 (not sequentially) — this keeps total batch time bounded at `ceil(urls.length / 3) * 30s`
- Add a circuit breaker: if 3 consecutive Crawl4AI calls time out, stop extracting that batch and emit an `error` diagnostic

**Warning signs:**
Research runs regularly taking 5+ minutes. Crawl4AI service logs showing many simultaneous timeout events. The `diagnostics` array showing `crawl4ai: error` for most URL batches. Scrapling service idle while Crawl4AI service is saturated.

**Phase to address:** Browser extraction pipeline phase — rewrite sequential extraction to concurrent with circuit breaker before expanding the URL set fed to Crawl4AI.

---

### Pitfall 8: Pain Confirmation Gate Thresholds Not Calibrated Against Actual Prospect Data

**What goes wrong:**
The existing quality gate thresholds (`MIN_EVIDENCE_COUNT = 3`, `MIN_AVERAGE_CONFIDENCE = 0.55`, `GREEN_MIN_SOURCE_TYPES = 3`) were calibrated against 7 real prospects before v2.1 shipped. The pain confirmation gate for v2.2 introduces new thresholds (minimum cross-source pain evidence). If those thresholds are set during development without calibration against the same 7 real prospects, they will produce either an always-RED gate (too strict, blocks everything) or an always-GREEN gate (too lenient, adds no value).

**Why it happens:**
New thresholds are typically chosen from intuition ("3 sources seems right") without testing against real data. The Dutch SMB market has structurally different evidence availability than the UK/US market that most pain gate benchmarks assume.

**How to avoid:**

- Before implementing the pain confirmation gate logic, run a calibration query against the 7 existing prospects in DB to see what cross-source pain evidence they currently have:
  ```sql
  SELECT p.companyName, ei.sourceType, COUNT(*)
  FROM "EvidenceItem" ei
  JOIN "Prospect" p ON ei.prospectId = p.id
  WHERE ei.confidenceScore >= 0.55
  GROUP BY p.companyName, ei.sourceType
  ORDER BY p.companyName, ei.sourceType;
  ```
- The gate thresholds must pass at least 5 of the 7 existing prospects — if they don't, the thresholds are wrong for this market
- Store thresholds in `quality-config.ts` alongside existing thresholds — not hardcoded in the gate component
- The first implementation should be a display-only gate (shows scores, no blocking) — run it for one milestone before adding any blocking behavior

**Warning signs:**
All 7 existing prospects fail the pain confirmation gate on first implementation. Gate is disabled immediately after shipping because it blocks everything. Gate thresholds are hardcoded in the gate component, not in `quality-config.ts`.

**Phase to address:** Pain confirmation gate phase — run calibration query before writing any gate logic.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut                                                                       | Immediate Benefit       | Long-term Cost                                                                                                  | When Acceptable                                                        |
| ------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Store override audit in `inputSnapshot` JSON                                   | Zero schema migration   | Cannot query "who approved what when", cannot join to user table, compliance audit requires manual JSON parsing | Never — create a `GateOverride` model                                  |
| Automatic discovery triggers SerpAPI on every re-run (no prospect-level cache) | Always fresh data       | Quota exhaustion on batch re-runs, unpredictable monthly cost                                                   | Never — add prospect-level `serpDiscoveredAt` column                   |
| Route all discovered URLs through Crawl4AI for consistency                     | Simpler code            | Research runs 5-10x slower, Crawl4AI timeout cascade, no differentiation between static and JS pages            | Never — keep two-tier extraction (stealth + browser)                   |
| Set pain gate thresholds based on intuition without calibration                | Faster implementation   | Always-RED or always-GREEN gate, gate is disabled after first use                                               | Never — calibrate against real prospect data first                     |
| No per-source URL cap in the discovery merge step                              | Simpler URL merge logic | URL count explosion for large sitemaps, `slice(0, 60)` cuts important evidence                                  | Never — define per-source caps as named constants                      |
| Use `qualityApproved` boolean on `ResearchRun` to track pain confirmation      | Reuses existing schema  | Conflates quality approval (existing) with pain confirmation (new), admin cannot tell which approval means what | Never — add a separate `painConfirmed` boolean or `GateOverride` table |

---

## Integration Gotchas

Common mistakes when connecting the new v2.2 features to the existing 8-source pipeline.

| Integration                                     | Common Mistake                                                                                     | Correct Approach                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| SerpAPI + automatic discovery                   | Triggering discovery at prospect import time (before a research run exists)                        | Trigger SerpAPI discovery only when `executeResearchRun` is called, respect prospect-level cache                          |
| Crawl4AI + two-tier extraction                  | Calling `ingestCrawl4aiEvidenceDrafts` for URLs that `ingestWebsiteEvidenceDrafts` already handled | Run stealth fetch first; only escalate to Crawl4AI for URLs returning `< 500` chars                                       |
| Pain gate + existing `evaluatePainConfirmation` | Adding pain gate as a new hard block on top of the existing `passed: reasons.length === 0` check   | Pain gate must be advisory-only; `evaluateQualityGate` already includes pain confirmation reasons in its `reasons` array  |
| Override audit + `qualityApproved`              | Using `qualityApproved = true` as the override record                                              | `qualityApproved` is a boolean — it records the outcome but not the reason, actor, or time of override                    |
| Source discovery + deduplication                | Running `dedupeEvidenceDrafts` after discovery merges URLs, losing provenance                      | Add `discoveryMethod` to metadata before dedup, preserve it through the dedup pass                                        |
| Manual seeds + automatic discovery              | Auto-discovery overwriting manual seed URLs when domains match                                     | Manual seeds take priority — mark them as `discoveryMethod: 'manual'` and prevent auto-discovery from re-classifying them |

---

## Performance Traps

Patterns that work at small scale but fail as prospect count grows.

| Trap                                                                | Symptoms                                                                              | Prevention                                                                                                      | When It Breaks                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Sequential Crawl4AI extraction (current: `for...of` loop)           | Research run time grows linearly with URL count                                       | Rewrite as `Promise.allSettled` with concurrency limit of 3                                                     | At 10+ URLs per run (already hitting this)                     |
| Per-run SerpAPI calls without prospect-level cache                  | Monthly quota exhausted on re-run of 20 prospects                                     | Add `serpDiscoveredAt` to `Prospect` model; skip SerpAPI if cache < 24h                                         | At 15+ prospects with research re-runs                         |
| AI evidence scoring (Gemini Flash) in a single batch of 60 items    | Gemini timeout errors when evidence item list is long                                 | Current batch size of 15 is correct — verify it stays respected when evidence count grows past 60               | At 80+ evidence items (currently capped at 60, so safe)        |
| `evidenceDrafts.slice(0, 60)` cutting pain-signal items             | High-quality pain evidence (reviews, jobs) cut if they appear late in the merge order | Prioritize merge order: reviews + jobs first, website content last before the slice                             | Whenever URL discovery adds more than 40 website-content items |
| `evaluateQualityGate` running over all items including placeholders | Confidence average skewed by 0.1-score notFound placeholders                          | Already filtered in `isPlaceholder` — verify new discovery sources also emit notFound placeholders consistently | If new sources skip the notFound placeholder pattern           |

---

## Security Mistakes

Domain-specific security issues for the v2.2 features.

| Mistake                                                                                | Risk                                                                                                 | Prevention                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Override audit trail writable by any admin without reason capture                      | Gate override becomes a rubber stamp — no accountability, can't audit who and why                    | Require a `reason` string on the override form — can be short, but must be non-empty                                                                                    |
| Automatic discovery submitting arbitrary user-provided domain as a Google search query | Company name with special characters or SQL injection patterns passed raw to SerpAPI                 | Already partially handled via `process.env.SERP_API_KEY` gating; ensure `companyName` is sanitized (strip quotes, limit length) before embedding in search query string |
| Crawl4AI extracting content from user-supplied manual seed URLs without validation     | Admin accidentally submits an internal URL or a competitor's CRM page — content extracted and stored | Validate manual seed URLs against `prospect.domain` before running extraction — warn if URL domain does not match or is clearly unrelated                               |
| Override audit records without `organizationId`                                        | Cross-tenant audit trail queries possible if `GateOverride` model lacks organization scoping         | Add `organizationId` to `GateOverride` model — all models require this per global multi-tenant rules                                                                    |

---

## UX Pitfalls

Common user experience mistakes specific to these v2.2 features.

| Pitfall                                                                                              | User Impact                                                                                     | Better Approach                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pain confirmation gate shown as a second red/amber badge next to the quality gate                    | Admin sees two conflicting signals with different colors and doesn't know which blocks outreach | One primary traffic-light (quality gate, the hard block); pain confirmation as a secondary text label "Pain confirmed by 2/3 required sources"                    |
| Override form requires a long written justification                                                  | Admin avoids using override even when genuinely appropriate — pipeline stalls                   | Short required reason with a dropdown of common reasons: "thin presence expected", "direct referral prospect", "re-run won't improve", "manual verification done" |
| Source discovery result shown to admin as raw URL list                                               | Admin must manually visit URLs to assess relevance                                              | Show source discovery results with domain + page title + discovery method — not raw URLs                                                                          |
| No visual difference between manual-seeded evidence and auto-discovered evidence in the evidence tab | Admin cannot assess which evidence is high-trust vs. auto-generated noise                       | Show a badge on each evidence card: `manually added`, `auto-discovered`, `sitemap`, `SERP`                                                                        |
| Override audit trail only visible in a separate "audit log" page                                     | Admin doesn't see prior overrides when deciding to override again                               | Show override history inline on the prospect research tab: "Overridden 1× on [date] — thin presence"                                                              |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Source discovery:** Often missing prospect-level SerpAPI cache — verify that re-running research for the same prospect within 24 hours skips SerpAPI calls (check `Prospect.serpDiscoveredAt` or equivalent)
- [ ] **URL deduplication with provenance:** Often missing `discoveryMethod` in metadata — verify that evidence items in the Evidence tab show which discovery path produced them
- [ ] **Pain confirmation gate:** Often missing calibration — verify that all 7 existing real prospects produce a meaningful (not all-RED, not all-GREEN) gate result before shipping
- [ ] **Crawl4AI two-tier routing:** Often missing the escalation decision — verify that static HTML pages (returning `>= 500 chars` from stealth fetch) are NOT sent to Crawl4AI
- [ ] **Override audit model:** Often missing `organizationId` — verify the `GateOverride` model has `organizationId NOT NULL` before migration
- [ ] **Override reason capture:** Often missing non-empty validation — verify that the override form cannot be submitted with an empty reason field
- [ ] **URL cap constants:** Often missing centralization — verify that per-source URL caps are defined in `quality-config.ts` as named exports, not as inline `slice()` magic numbers
- [ ] **SerpAPI credit guardrail:** Often missing daily counter — verify that a prospect batch import of 20 companies does not trigger 20× SerpAPI discovery calls in one shot

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall                                                   | Recovery Cost | Recovery Steps                                                                                                                                                                    |
| --------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SerpAPI quota exhausted mid-month                         | MEDIUM        | Switch to `deepCrawl: false` mode for all new runs until next billing cycle; the pipeline still produces 3-source evidence from sitemap + website + KvK                           |
| Crawl4AI timeout cascade making runs fail                 | LOW           | Reduce `wait_for_timeout` from 15000 to 8000 ms in `crawl4ai.ts`; accept that some JS pages will return less content                                                              |
| Pain confirmation gate too strict, all prospects blocked  | LOW           | Set gate to advisory-only (remove any blocking behavior added); ship as display-only and recalibrate thresholds                                                                   |
| Override audit stored in JSON (wrong approach taken)      | HIGH          | Requires data migration: parse existing JSON overrides, create `GateOverride` table, backfill records — this is why the correct approach must be chosen upfront                   |
| URL explosion in a research run (run takes 15+ minutes)   | LOW           | Add per-source URL cap constants to `quality-config.ts` and apply `slice()` at discovery stage, not extraction stage; re-run affected prospects                                   |
| Source provenance lost (merged without `discoveryMethod`) | MEDIUM        | Backfill is impractical (cannot reconstruct which source found which URL after the merge). Must fix the merge logic going forward; existing evidence records will lack provenance |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall                         | Prevention Phase             | Verification                                                                                                         |
| ------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| URL discovery explosion         | Source discovery phase       | Verify: research run on a prospect with a large sitemap (e.g., an e-commerce site) completes in under 3 minutes      |
| Pain gate as second hard block  | Pain confirmation gate phase | Verify: all 7 existing prospects pass through the pain gate in display mode without triggering a new block           |
| Crawl4AI systematic overuse     | Browser extraction phase     | Verify: static HTML pages bypass Crawl4AI (check `adapter` field in evidence metadata)                               |
| Override audit in JSON metadata | Override audit phase         | Verify: `GateOverride` model exists in schema with `organizationId`, `overriddenBy`, `reason`, `createdAt` columns   |
| Source provenance lost          | Source discovery phase       | Verify: all evidence items have `discoveryMethod` in metadata; no item has only `adapter` without a discovery origin |
| SerpAPI credit burn             | Source discovery phase       | Verify: running research twice in 24h for the same prospect shows 0 SerpAPI calls on the second run                  |
| Crawl4AI timeout cascade        | Browser extraction phase     | Verify: a batch of 10 unreachable URLs completes in under 90 seconds (not 10 minutes)                                |
| Uncalibrated gate thresholds    | Pain confirmation gate phase | Verify: calibration query run against real DB before any threshold constant is written                               |

---

## Sources

- Codebase analysis (direct): `lib/research-executor.ts` (full 8-source pipeline, URL merge logic, dedup, 60-item cap), `lib/enrichment/crawl4ai.ts` (sequential extraction, 60-second timeout, 10-URL cap), `lib/enrichment/serp.ts` (3 Google queries per run, Maps + Jobs discovery, 5-URL caps), `lib/evidence-scorer.ts` (Gemini Flash scoring, batch size 15, formula), `lib/quality-config.ts` (gate thresholds, MIN_EVIDENCE_COUNT, calibration note), `lib/workflow-engine.ts` (evaluatePainConfirmation logic, isObservedEvidence filter, evaluateQualityGate), `prisma/schema.prisma` (qualityApproved boolean, Json inputSnapshot pattern)
- Web research: SerpAPI quota mechanics (20% hourly cap, no rollover, $7k/M at scale); Crawl4AI production failure modes (timeout cascades, version mismatches, sequential extraction bottlenecks); URL explosion patterns in sitemap-based crawling; audit trail database design (JSON vs. proper model tradeoffs); Dutch SMB web presence gap (27% of SMBs have no website — thin evidence is structural, not a pipeline bug)
- Project memory: Validated architectural decisions — "Soft gate (amber = warn + proceed) because Dutch SMBs have thin web presence, hard block unusable"; "Research completeness as hard blocker — Out of Scope"; "Global research threshold — Different industries have different evidence availability"; "AI evidence scoring calibrated 2026-03-02 against 7 prospects, avg conf 0.59-0.70"

---

_Pitfalls research for: Qualifai v2.2 Verified Pain Intelligence — source discovery automation, browser-rendered extraction, pain confirmation gates, override audit trails_
_Researched: 2026-03-02_
