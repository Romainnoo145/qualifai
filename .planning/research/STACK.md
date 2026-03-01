# Technology Stack — v2.2 Verified Pain Intelligence

**Project:** Qualifai — v2.2 milestone additions
**Researched:** 2026-03-02
**Scope:** NEW capabilities only. Existing validated stack (Next.js 16, tRPC 11, Prisma 7, PostgreSQL, Anthropic Claude SDK, @google/generative-ai, Apollo API, SerpAPI via `serpapi@^2.2.1`, Crawl4AI REST at localhost:11235, Scrapling stealth fetcher at localhost:3010, Resend, Cal.com, Zod 4, Tailwind 4, Framer Motion 12, TanStack Query 5, Lucide React, Playwright in devDependencies) is NOT re-researched here.
**Confidence:** HIGH for areas verified via codebase inspection + official docs. MEDIUM for specific version pins of new items.

---

## Decision: Zero New npm Dependencies

All four v2.2 capability areas are achievable using the existing dependency tree. The sections below explain exactly what to use for each feature, why no new packages are needed, and what integration patterns to apply.

---

## Capability Area 1: Automatic Source URL Discovery with Provenance

### Decision: Extend Existing SerpAPI + Sitemapper Pattern — No New Libraries

**What the current system does:**

`lib/enrichment/sitemap.ts` uses `sitemapper@^4.1.4` to pull up to 25 URLs from `sitemap.xml`.
`lib/enrichment/serp.ts` uses `serpapi@^2.2.1` to discover review URLs (Google Maps Reviews engine) and job URLs (Google Jobs engine) via SerpAPI.
`lib/research-executor.ts` calls both, then passes discovered URLs to Crawl4AI and Scrapling for extraction.

**What is missing for v2.2:**

Source URLs currently flow through the system without a provenance record. The same URL can be discovered multiple times (once from sitemap, once from a Google Search result) and there is no deduplicated, per-prospect registry of discovered source URLs with their origin.

Additionally, manual seed URLs (used for review sites: Trustpilot, Google Maps, Indeed, Glassdoor) are hardcoded in `lib/research-refresh.ts:buildDefaultReviewSeedUrls()` and passed as `inputSnapshot.manualUrls` at run time. They are never stored with provenance metadata.

**What to build (no new packages):**

A new Prisma model `DiscoveredSource` (schema addition only) that stores:

```typescript
// Schema addition — no npm package change
model DiscoveredSource {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  prospectId  String
  prospect    Prospect @relation(fields: [prospectId], references: [id], onDelete: Cascade)
  researchRunId String?
  researchRun   ResearchRun? @relation(fields: [researchRunId], references: [id], onDelete: SetNull)

  url           String
  normalizedUrl String   // lowercase, no trailing slash, no fragment
  discoveryMethod String  // 'sitemap' | 'serp_maps' | 'serp_jobs' | 'serp_google' | 'manual_seed' | 'crawl4ai_link'
  sourceCategory  String  // 'website' | 'review' | 'career' | 'news' | 'registry'
  isActive      Boolean  @default(true)
  lastCrawledAt DateTime?
  crawlError    String?

  @@unique([prospectId, normalizedUrl])
  @@index([prospectId, discoveryMethod])
  @@index([prospectId, isActive])
}
```

**URL normalization (pure TypeScript, no library):**

```typescript
// lib/enrichment/url-normalize.ts
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim().toLowerCase());
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return raw.trim().toLowerCase();
  }
}
```

The built-in `URL` class (Node.js standard library, already used throughout the codebase) handles parsing. No new dependency needed.

**Deduplication strategy (pure TypeScript, no library):**

The `@@unique([prospectId, normalizedUrl])` constraint on `DiscoveredSource` makes the database enforce uniqueness. Use Prisma `upsert` with `createOrUpdate` semantics when persisting discovered URLs:

```typescript
await db.discoveredSource.upsert({
  where: { prospectId_normalizedUrl: { prospectId, normalizedUrl } },
  update: { lastCrawledAt: new Date(), isActive: true },
  create: {
    prospectId,
    researchRunId,
    url,
    normalizedUrl,
    discoveryMethod,
    sourceCategory,
  },
});
```

**Confidence:** HIGH — codebase confirms `sitemapper` and `serpapi` are already installed and functional. URL normalization with `URL` class is a Node.js standard pattern. Prisma upsert with composite unique index is a well-established pattern already used for `CampaignProspect` in the schema.

---

## Capability Area 2: Browser-Rendered Extraction for JS-Heavy Pages

### Decision: Extend Existing Crawl4AI Configuration — No New Library

**What the current system does:**

`lib/enrichment/crawl4ai.ts:extractMarkdown()` calls the Crawl4AI REST API at `/crawl` with:

```typescript
crawler_config: {
  type: 'CrawlerRunConfig',
  params: {
    cache_mode: 'bypass',
    magic: true,
    simulate_user: true,
    wait_for_timeout: 15000,
    delay_before_return_html: 2,
  },
}
```

This configuration works well for standard pages. It does not handle:

- Sites with GDPR/cookie consent overlays blocking content
- Pages where content is inside Shadow DOM (Web Components)
- iframes containing review content
- Pages that require explicit JavaScript interaction to reveal content (click "Load more")

**What to add (configuration changes only, no new package):**

Crawl4AI v0.8.x (the current documented version, verified via docs.crawl4ai.com) supports these parameters directly in `CrawlerRunConfig.params`:

| Parameter                 | Value                               | Purpose                                                                                             |
| ------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `remove_consent_popups`   | `true`                              | Auto-clicks "Accept All" on GDPR/CMP popups (OneTrust, Cookiebot, etc.), then removes them from DOM |
| `remove_overlay_elements` | `true`                              | Removes modal dialogs and overlays blocking main content                                            |
| `process_iframes`         | `true`                              | Inlines iframe content into the extracted markdown — important for review widgets                   |
| `flatten_shadow_dom`      | `true`                              | Exposes Web Component content hidden in Shadow DOM                                                  |
| `word_count_threshold`    | `50`                                | Reduce from default ~200 to catch shorter review snippets and job posting fields                    |
| `excluded_tags`           | `["header","footer","nav","aside"]` | Strip navigation chrome from output — already known pattern for Dutch SMB sites                     |

**Recommended config for JS-heavy sources (reviews, job boards, LinkedIn):**

```typescript
// lib/enrichment/crawl4ai.ts — enhanced config for JS-heavy pages
const HEAVY_PAGES_CONFIG = {
  cache_mode: 'bypass',
  magic: true,
  simulate_user: true,
  wait_for_timeout: 20000, // +5s for JS-heavy pages
  delay_before_return_html: 3, // extra delay for React/Vue hydration
  remove_consent_popups: true, // NEW: handle GDPR overlays
  remove_overlay_elements: true, // NEW: handle blocking modals
  process_iframes: true, // NEW: capture iframe review widgets
  flatten_shadow_dom: true, // NEW: Web Component content
  word_count_threshold: 50, // NEW: lower threshold for short snippets
  excluded_tags: ['header', 'footer', 'nav', 'aside', 'script', 'style'],
};
```

Add a second exported function `extractMarkdownDeep(url: string)` that uses `HEAVY_PAGES_CONFIG`. Use the existing `extractMarkdown()` (lighter config) for internal website pages, and `extractMarkdownDeep()` for external sources: review platforms, job boards, LinkedIn.

**Confidence:** HIGH — parameters verified against official Crawl4AI v0.8.x documentation (docs.crawl4ai.com/api/parameters/). No new library required — these are configuration options on the existing REST API call.

**What NOT to add:**

Do not add Puppeteer, Playwright (for production scraping), or any other headless browser library as a server-side dependency. Crawl4AI already manages a headless Chromium instance via its REST API. Adding a second browser process on the same host would conflict and create resource contention. Playwright is already a devDependency for E2E testing — keep it there.

---

## Capability Area 3: Pain Confirmation Gate

### Decision: Pure TypeScript Business Logic in Existing tRPC Layer — No New Library

**What the pain confirmation gate needs:**

Before outreach is allowed for a prospect, verify that evidence meets a minimum threshold:

1. At least N evidence items with `aiRelevance >= threshold`
2. Evidence comes from at least M distinct source types (cross-source requirement)
3. At least one high-weight source (REVIEWS or LINKEDIN — the external validation sources) is represented

**What to build (no new packages):**

A pure TypeScript module `lib/outreach/pain-gate.ts` that reads from the existing `EvidenceItem` schema fields (`aiRelevance`, `sourceType`, `confidenceScore`) and applies threshold logic.

```typescript
// lib/outreach/pain-gate.ts
export interface PainGateResult {
  passed: boolean;
  score: number; // 0-1 aggregate
  evidenceCount: number;
  sourceTypes: string[]; // distinct EvidenceSourceType values present
  hasExternalValidation: boolean; // REVIEWS or LINKEDIN present
  reasons: string[]; // why it failed (if not passed)
}

export interface PainGateInput {
  evidenceItems: Array<{
    sourceType: string;
    aiRelevance: number | null;
    confidenceScore: number;
    isApproved: boolean;
  }>;
  thresholds?: {
    minEvidenceCount: number; // default: 3
    minAiRelevance: number; // default: 0.50
    minSourceTypes: number; // default: 2
    requireExternalValidation: boolean; // default: true
    minAverageConfidence: number; // default: 0.55 (matches existing MIN_AVERAGE_CONFIDENCE)
  };
}

export function evaluatePainGate(input: PainGateInput): PainGateResult {
  // ... pure logic, no I/O, easily testable
}
```

This function has no I/O and operates entirely on data passed to it — same design pattern as the existing `assessEmailForOutreach()` and `scoreContactForOutreach()` in `lib/outreach/quality.ts`.

**Integration point:** The pain gate check runs at the tRPC procedure for approving outreach (`research.approve` or similar). The existing `qualityApproved` field on `ResearchRun` already tracks the research-quality gate; a new `painGateApproved` field tracks the cross-source pain confirmation.

**Confidence:** HIGH — the existing `lib/outreach/quality.ts` establishes the exact pattern. All input data (`aiRelevance`, `sourceType`, `confidenceScore`) already exists in the `EvidenceItem` schema. No new library is needed for this gate logic.

---

## Capability Area 4: Override Audit Trail

### Decision: Prisma Model + Application-Level Logging — No External Audit Package

**Rationale for application-level audit (not trigger-based):**

PostgreSQL trigger-based audit approaches (pgMemento, Bemi) capture every row change at the database level. This is overkill for Qualifai's specific need: track when a human manually overrides a quality gate or pain gate, with their stated reason.

The existing `qualityNotes` field on `ResearchRun` already stores the "why" for quality gate overrides. The v2.2 requirement is to make overrides a first-class, queryable audit event — not just a text field on the run.

**What to build (schema addition + tRPC procedure, no new npm package):**

A new `GateOverrideLog` model:

```typescript
// Schema addition
model GateOverrideLog {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())

  // What was overridden
  gateType    String   // 'quality' | 'pain_confirmation'
  prospectId  String
  prospect    Prospect @relation(fields: [prospectId], references: [id], onDelete: Cascade)
  researchRunId String?
  researchRun   ResearchRun? @relation(fields: [researchRunId], references: [id], onDelete: SetNull)

  // Override details
  previousStatus String  // 'blocked' | 'amber' | 'insufficient_evidence'
  overrideReason String  // required free-text (not optional — forces accountability)
  gateSummaryAtOverride Json? // snapshot of gate result at time of override

  // Who (admin-only app — capture session identifier for traceability)
  adminNote   String?   // optional additional context

  @@index([prospectId])
  @@index([gateType, createdAt])
  @@index([researchRunId])
}
```

**Why NOT use a Prisma extension or middleware for this:**

The Prisma extension approach (e.g., `prisma-audit-log-extension`, `@bemi-db/prisma`) automatically logs all table mutations. That captures too much: every research run update, every evidence item write. The `GateOverrideLog` is intentional — it records a human decision, not a schema change. An explicit `db.gateOverrideLog.create()` call in the tRPC override procedure is cleaner, more readable, and self-documenting.

**Integration point:**

The tRPC procedure `research.overrideGate` (new in v2.2) creates a `GateOverrideLog` entry AND sets `qualityApproved = true` (or a new `painGateOverridden = true` field) on `ResearchRun` in a single Prisma transaction:

```typescript
// In the tRPC router — atomic override + audit
await db.$transaction([
  db.researchRun.update({
    where: { id: input.researchRunId },
    data: { qualityApproved: true, qualityNotes: input.reason },
  }),
  db.gateOverrideLog.create({
    data: {
      gateType: input.gateType,
      prospectId: input.prospectId,
      researchRunId: input.researchRunId,
      previousStatus: input.previousStatus,
      overrideReason: input.reason, // required
      gateSummaryAtOverride: input.gateSummary,
    },
  }),
]);
```

The `$transaction` ensures the override and its audit record are always written atomically. This is the same pattern used by the idempotency guard in the send queue (atomic `updateMany` with count check).

**Confidence:** HIGH — Prisma `$transaction` is a core documented feature in Prisma 7, used elsewhere in the codebase. The `GateOverrideLog` model follows the same conventions as `NotificationLog` (prospectId + type + metadata + createdAt). No external audit package needed.

---

## Schema Additions Summary

Two new models added to `prisma/schema.prisma`. No existing model changes.

| Model              | Purpose                                   | Key Fields                                            |
| ------------------ | ----------------------------------------- | ----------------------------------------------------- |
| `DiscoveredSource` | Per-prospect URL registry with provenance | `normalizedUrl`, `discoveryMethod`, `sourceCategory`  |
| `GateOverrideLog`  | Audit trail for manual gate bypasses      | `gateType`, `overrideReason`, `gateSummaryAtOverride` |

One new field on existing model:

| Model         | New Field                   | Purpose                                                                                                                 |
| ------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ResearchRun` | `painGateApproved Boolean?` | Tracks pain confirmation gate status (null = not evaluated, true = passed or overridden, false = insufficient evidence) |

---

## Installation

No new packages required. All v2.2 capabilities use existing dependencies.

```bash
# After schema changes:
npx prisma migrate dev --name add_discovered_sources_and_gate_override_log
```

---

## What NOT to Add

| Package                                          | Why Not                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `puppeteer` / `playwright` (server)              | Crawl4AI already manages a headless browser. Two browser processes on the same host create resource contention. Playwright stays as devDependency only. |
| `cheerio` / `node-html-parser`                   | HTML parsing already handled by Scrapling's built-in parser and Crawl4AI's markdown extraction.                                                         |
| `@bemi-db/prisma` / `prisma-audit-log-extension` | Captures all DB changes generically. Override logging is intentional and explicit — an `create()` call is clearer.                                      |
| `pgMemento` / PostgreSQL triggers                | Adds database-level complexity for what is an application-level concern. Superusers can bypass triggers anyway.                                         |
| `normalization-url` / `normalize-url`            | The built-in `URL` class handles the normalization needed. A 3rd-party package adds a dependency for 4 lines of logic.                                  |
| `p-queue` / `bottleneck` (concurrency)           | The existing sequential `for...of` loop in `ingestCrawl4aiEvidenceDrafts` is correct. Crawl4AI has its own internal concurrency management.             |
| `zod` extensions for gate logic                  | Zod 4 (already installed) handles validation. Gate logic is pure TS math — no schema validation library needed.                                         |

---

## Alternatives Considered

| Category               | Recommended                                        | Alternative                             | Why Not                                                                                                 |
| ---------------------- | -------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| URL registry           | New `DiscoveredSource` Prisma model                | In-memory Set per run                   | Survives runs, enables per-prospect history, deduplication is DB-enforced                               |
| URL normalization      | Native `URL` class                                 | `normalize-url` npm package             | 4 lines of logic vs. a new dependency                                                                   |
| Consent popup handling | Crawl4AI `remove_consent_popups: true`             | Custom JS injection                     | Crawl4AI v0.8.x already handles OneTrust/Cookiebot natively — reinventing adds fragility                |
| Shadow DOM extraction  | Crawl4AI `flatten_shadow_dom: true`                | Puppeteer custom evaluation             | Crawl4AI already manages the browser — stay in one orchestrator                                         |
| Pain gate logic        | Pure TypeScript in `lib/outreach/pain-gate.ts`     | Rule engine library (json-rules-engine) | Logic is simple thresholds — a library adds DSL learning cost with no benefit                           |
| Audit trail            | Explicit `GateOverrideLog.create()` in transaction | Prisma middleware or DB triggers        | Explicit is self-documenting. Middleware captures everything; we want only intentional override events. |

---

## Version Compatibility

All existing. No new version constraints introduced.

| Package                                   | Version in use            | v2.2 compatibility                                                                                                                        |
| ----------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma@^7.3.0` + `@prisma/client@^7.3.0` | 7.3.0                     | `$transaction`, upsert, composite unique index all confirmed in current version                                                           |
| `serpapi@^2.2.1`                          | 2.2.1                     | No changes — same `getJson()` interface                                                                                                   |
| `sitemapper@^4.1.4`                       | 4.1.4                     | No changes — `discoverSitemapUrls()` unchanged                                                                                            |
| Crawl4AI REST API                         | v0.8.x at localhost:11235 | New params (`remove_consent_popups`, `flatten_shadow_dom`, etc.) are v0.8.x features — verify service version before deploying new config |
| `@google/generative-ai@^0.24.1`           | 0.24.1                    | Pain gate uses existing `scoreEvidenceBatch()` — no change                                                                                |
| `zod@^4.3.6`                              | 4.3.6                     | New tRPC procedures use same zod input validation pattern                                                                                 |

---

## Sources

- Codebase inspection: `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/crawl4ai.ts` — HIGH confidence (current config baseline)
- Codebase inspection: `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/serp.ts` — HIGH confidence (current discovery pattern)
- Codebase inspection: `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/sitemap.ts` — HIGH confidence (sitemapper usage)
- Codebase inspection: `/home/klarifai/Documents/klarifai/projects/qualifai/lib/evidence-scorer.ts` — HIGH confidence (formula: sourceWeight*0.30 + relevance*0.45 + depth\*0.25, existing MIN_AVERAGE_CONFIDENCE threshold)
- Codebase inspection: `/home/klarifai/Documents/klarifai/projects/qualifai/lib/outreach/quality.ts` — HIGH confidence (design pattern for gate logic)
- Codebase inspection: `/home/klarifai/Documents/klarifai/projects/qualifai/prisma/schema.prisma` — HIGH confidence (existing models, `NotificationLog` as audit pattern reference)
- Crawl4AI v0.8.x parameters: `docs.crawl4ai.com/api/parameters/` — HIGH confidence (official docs, parameter names and types verified)
- Crawl4AI v0.8.x content selection: `docs.crawl4ai.com/core/content-selection/` — HIGH confidence (`word_count_threshold`, `excluded_tags`, `remove_consent_popups` verified)
- Prisma audit log patterns: `medium.com/@gayanper/implementing-entity-audit-log-with-prisma` + `github.com/mediavine/prisma-audit-log-extension` — MEDIUM confidence (patterns confirmed, explicit over middleware is a deliberate architectural choice)
- PostgreSQL audit trail best practices: `bytebase.com/blog/postgres-audit-logging/` + `wiki.postgresql.org/wiki/Audit_trigger` — MEDIUM confidence (confirms trigger-based approach is over-engineered for application-level concerns)
- SerpAPI 2025 changelog: `serpapi.com/blog/whats-new-at-serpapi-july-2025-changelog/` — MEDIUM confidence (no breaking changes to `getJson()` interface)

---

_Stack research for: Qualifai v2.2 Verified Pain Intelligence_
_Researched: 2026-03-02_
