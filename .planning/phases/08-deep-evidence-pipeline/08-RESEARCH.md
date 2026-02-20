# Phase 8: Deep Evidence Pipeline - Research

**Researched:** 2026-02-21
**Domain:** SerpAPI URL discovery + Crawl4AI browser extraction + evidence pipeline integration
**Confidence:** MEDIUM-HIGH (Crawl4AI REST API specifics need live validation)

---

## Summary

Phase 8 adds two new evidence sources — SerpAPI for URL discovery and Crawl4AI for JS-rendered content extraction — and routes them through the existing approval gate. The architecture is already well-prepared: `executeResearchRun` in `lib/research-executor.ts` is the single integration point; the `EvidenceDraft` interface and `dedupeEvidenceDrafts` function are in place; and a new `SERP_RESULT` enum value (or reuse of existing `REVIEWS`/`JOB_BOARD`) is the only schema question.

The SerpAPI integration is the simpler sub-task. The `serpapi` npm package (v2.2.1, TypeScript-first) replaces the deprecated `google-search-results-nodejs` package. SerpAPI discovery requires a two-step flow for Google Maps Reviews: first search the company by name to get `data_id`, then fetch reviews using that ID. The `google_jobs` engine takes a plain text query. Both results are URL lists that feed into Crawl4AI for content extraction.

Crawl4AI is the technically interesting sub-task. The Docker container exposes a REST API at port 11235. The request body uses a specific JSON serialization format: non-primitive config objects must be wrapped as `{"type": "ClassName", "params": {...}}`. Cookie consent handling via `magic: true` is the documented approach, though there are known bugs with `js_code` execution and `remove_overlay_elements` in some versions. The cookie consent requirement (EVID-05) is achievable but needs a defensive strategy: magic mode first, js_code fallback, graceful degradation for pages that still block. On Railway, Crawl4AI runs as a second service in the same project and is reachable via private networking at `crawl4ai.railway.internal:11235`.

**Primary recommendation:** Add `serpapi` npm package (not the legacy `google-search-results-nodejs`). Crawl4AI is called from a new `lib/enrichment/crawl4ai.ts` client using plain `fetch` against the Docker REST API — no extra npm package needed. SerpAPI results are cached on `ResearchRun.inputSnapshot` JSON (no new model needed for Phase 8 scope).

---

<user_constraints>

## User Constraints (from phase_context — no CONTEXT.md exists)

### Locked Decisions

- Use Crawl4AI (open-source, self-hosted Docker container) as the managed browser extraction layer
- Docker image: `unclecode/crawl4ai` (pin to `>=0.8.0`)
- REST API: `POST /crawl` (sync), `POST /crawl/job` (async with webhook), `POST /md` (markdown)
- Cookie consent: via `after_goto` hooks / magic mode
- Caching: via `cache_mode` parameter in Crawl4AI; SerpAPI results cached per prospect
- Runs as sidecar container on Railway alongside the Next.js app
- No per-request cost (just container resource cost)
- Playwright NEVER runs inside Next.js API route or tRPC handler

### Claude's Discretion

- How to structure SerpAPI caching (in-memory vs DB column vs inputSnapshot JSON)
- Whether to add a new `SERP_RESULT` EvidenceSourceType enum value or reuse existing values
- Exact Crawl4AI request parameters for cookie consent (magic vs js_code vs combination)
- How `deepCrawl` flag is surfaced in the research router (separate mutation vs flag on startRun)
- Evidence deduplication strategy for SERP-discovered URLs that overlap with default research URLs

### Deferred Ideas (OUT OF SCOPE for Phase 8)

- Crawl4AI LLM extraction strategies
- Webhook-based async Crawl4AI job pattern (use sync /crawl for Phase 8)
- Glassdoor review extraction (likely blocked by anti-bot; discover-only approach safer)
- Support docs discovery beyond default /docs and /help URLs
  </user_constraints>

---

## Standard Stack

### Core

| Library                       | Version   | Purpose                                          | Why Standard                                                                                                                               |
| ----------------------------- | --------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `serpapi`                     | `^2.2.1`  | SerpAPI HTTP client, TypeScript-first            | Replaces deprecated `google-search-results-nodejs`; native async/await; full TypeScript types; officially maintained by SerpAPI as of 2024 |
| `unclecode/crawl4ai` (Docker) | `>=0.8.0` | Browser-rendered content extraction via REST API | User decision (locked). Open-source, self-hosted, Playwright-backed. No per-request cost.                                                  |

### Supporting

| Library                         | Version | Purpose                                                      | When to Use                                                                  |
| ------------------------------- | ------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Node.js `fetch` (built-in)      | N/A     | HTTP client to call Crawl4AI REST API                        | No new npm package needed — Crawl4AI is called via plain fetch in Next.js 16 |
| Existing `dedupeEvidenceDrafts` | —       | Dedup SERP-discovered evidence with existing pipeline output | Already in `lib/research-executor.ts` — extend to handle new evidence batch  |

### Alternatives Considered

| Instead of      | Could Use                                | Tradeoff                                                                                           |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `serpapi` npm   | `google-search-results-nodejs`           | Legacy package, last published 2023-02-17, no TypeScript types, no async/await                     |
| `serpapi` npm   | Raw `fetch` against `serpapi.com/search` | Duplicates auth, retry, and type logic — package is thin and correct to use                        |
| Crawl4AI Docker | Playwright worker service                | Crawl4AI is the locked decision; worker would require separate Railway service and nixpacks config |

**Installation:**

```bash
npm install serpapi
```

No other npm installs needed. Crawl4AI is called via native `fetch`.

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── enrichment/
│   ├── index.ts             # existing (Apollo enrichment — don't touch)
│   ├── serp.ts              # NEW: SerpAPI URL discovery client
│   └── crawl4ai.ts          # NEW: Crawl4AI REST API client
├── research-executor.ts     # MODIFY: add deepCrawl branch calling serp + crawl4ai
server/
└── routers/
    └── research.ts          # MODIFY: add deepCrawl flag to startRun input
prisma/
└── schema.prisma            # MAYBE: add SERP_RESULT to EvidenceSourceType enum
```

### Pattern 1: SerpAPI Two-Step for Google Maps Reviews

**What:** Discover a company's Google Maps `data_id` via `google_maps` engine, then fetch reviews with `google_maps_reviews` engine.

**When to use:** When `deepCrawl: true` is passed and prospect has a company name.

**Example:**

```typescript
// Source: serpapi.com/google-maps-reviews-api + official npm package docs
import { getJson, config as serpConfig } from 'serpapi';

serpConfig.api_key = env.SERP_API_KEY;

// Step 1: Find data_id for company
const mapsResult = await getJson({
  engine: 'google_maps',
  q: `${companyName} ${domain}`,
  hl: 'nl',
  gl: 'nl',
});
const dataId: string | undefined = mapsResult?.place_results?.data_id;

// Step 2: Fetch reviews using data_id
if (dataId) {
  const reviewsResult = await getJson({
    engine: 'google_maps_reviews',
    data_id: dataId,
    hl: 'nl',
    sort_by: 'newestFirst',
  });
  const reviewUrls: string[] =
    reviewsResult?.reviews
      ?.map((r: { link?: string }) => r.link)
      .filter(Boolean) ?? [];
}
```

**Confidence:** MEDIUM — two-step pattern confirmed by official SerpAPI docs. `data_id` field name confirmed. TypeScript types in `serpapi` package (v2.2.1) should cover this.

### Pattern 2: SerpAPI Google Jobs Discovery

**What:** Discover job listing URLs for a prospect domain via `google_jobs` engine.

**When to use:** Part of deepCrawl — job listings reveal hiring pain points (existing `JOB_BOARD` sourceType already has `confidenceScore: 0.72`).

**Example:**

```typescript
// Source: serpapi.com/google-jobs-api
const jobsResult = await getJson({
  engine: 'google_jobs',
  q: `${companyName} vacatures OR jobs`,
  gl: 'nl',
  hl: 'nl',
  no_cache: false, // use SerpAPI's own cache when available
});

const jobUrls: string[] =
  jobsResult?.jobs_results
    ?.map(
      (job: { link?: string; apply_options?: Array<{ link: string }> }) =>
        job.link ?? job.apply_options?.[0]?.link,
    )
    .filter(Boolean) ?? [];
```

**Confidence:** HIGH — `jobs_results` response structure confirmed by official SerpAPI docs.

### Pattern 3: SerpAPI Result Caching (Per-Prospect)

**What:** Cache SerpAPI search results inside `ResearchRun.inputSnapshot` JSON field to avoid repeat API costs within a session.

**When to use:** Every time `deepCrawl` runs — check cache first, skip API call if fresh.

**Why inputSnapshot (not a new DB model):** `inputSnapshot` is already `Json?` and is read by `manualUrlsFromSnapshot()` for retry runs. Storing SERP cache there keeps Phase 8 schema-migration-free. A new `SerpCache` model would be cleaner long-term but adds a migration and is not required for Phase 8.

**Cache structure in inputSnapshot:**

```typescript
// inputSnapshot shape after deepCrawl
{
  manualUrls: string[],
  campaignId?: string,
  serpCache?: {
    discoveredAt: string,       // ISO timestamp
    reviewUrls: string[],
    jobUrls: string[],
    mapsDataId?: string,
  }
}
```

**Cache read logic in executeResearchRun:**

```typescript
const snapshot = input.existingRunId
  ? manualUrlsFromSnapshot(existingRun.inputSnapshot)
  : null;
const serpCache = extractSerpCache(existingRun?.inputSnapshot);
const isCacheValid =
  serpCache &&
  Date.now() - new Date(serpCache.discoveredAt).getTime() < 24 * 60 * 60 * 1000;

const { reviewUrls, jobUrls } = isCacheValid
  ? serpCache
  : await discoverSerpUrls(prospect);
```

**Confidence:** HIGH — `inputSnapshot` is `Json?`, existing pattern confirmed by codebase inspection.

### Pattern 4: Crawl4AI REST API Client

**What:** A typed `fetch`-based wrapper around the Crawl4AI Docker REST API.

**When to use:** Called from `lib/enrichment/crawl4ai.ts` for all browser-extracted content. NEVER called from within a tRPC handler directly — always via `executeResearchRun`.

**Critical REST API request format:**

```typescript
// Source: docs.crawl4ai.com/core/self-hosting/ + pondhouse-data.com tutorial
// Non-primitive config values MUST use {"type": "ClassName", "params": {...}} format

const body = {
  urls: [url],
  browser_config: {
    type: 'BrowserConfig',
    params: { headless: true },
  },
  crawler_config: {
    type: 'CrawlerRunConfig',
    params: {
      cache_mode: 'bypass', // always bypass Crawl4AI's own cache (SerpAPI handles ours)
      magic: true, // attempts cookie consent + overlay removal automatically
      simulate_user: true, // reduces bot-detection signals
      wait_for_timeout: 15000, // 15s page load timeout
      delay_before_return_html: 2, // 2s settle time for dynamic content
    },
  },
};

const response = await fetch(`${env.CRAWL4AI_BASE_URL}/crawl`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(60_000), // 60s total timeout
});

const result = (await response.json()) as {
  success: boolean;
  results?: Array<{
    markdown?: string;
    cleaned_html?: string;
    metadata?: { title?: string; description?: string };
  }>;
};

const markdown = result.results?.[0]?.markdown ?? '';
```

**Confidence:** MEDIUM — confirmed from official docs and tutorial. The `{"type": "ClassName"}` wrapping is the critical detail that's not obvious. Needs live validation against running container.

### Pattern 5: Cookie Consent Handling (EVID-05)

**What:** Multi-strategy approach to handling Cookiebot and similar consent banners.

**Strategy (defense in depth):**

1. `magic: true` — Crawl4AI's automatic overlay/popup handler (experimental, first attempt)
2. `simulate_user: true` — reduces bot detection that triggers consent walls
3. `remove_overlay_elements` is documented but has known bugs in v0.8.x; don't rely on it as primary
4. `js_code` for Cookiebot specifically (known Cookiebot button selectors):
   - `document.getElementById('CybotCookiebotDialogBodyButtonAccept')?.click()`
   - `document.querySelector('.cookie-consent-accept')?.click()`
5. Graceful degradation: if `markdown` is empty or < 100 chars after extraction, return a fallback `EvidenceDraft` (same pattern as existing `fallbackDraft` in `web-evidence-adapter.ts`)

**Confidence for magic mode working:** LOW — multiple bug reports exist for `remove_overlay_elements`. Magic mode is experimental. EVID-05 compliance requires the js_code fallback approach.

**Cookiebot-specific js_code:**

```typescript
const COOKIEBOT_DISMISS_JS = `
  (function() {
    const btn = document.getElementById('CybotCookiebotDialogBodyButtonAccept') ||
                document.querySelector('[id*="CookiebotDialogBodyButton"]') ||
                document.querySelector('.cookie-accept, .gdpr-accept');
    if (btn) btn.click();
  })();
`;
```

**However:** `js_code` has a known bug in v0.8.x (Issue #1007, #1128 on GitHub). The bug is that `js_code` may not execute reliably. The real-world fix may require using `wait_for` with a CSS selector that's only present after consent is granted, combined with `delay_before_return_html`.

### Pattern 6: Integration into executeResearchRun (08-03)

**What:** Add `deepCrawl` optional boolean to `executeResearchRun` input. When true: discover URLs via SerpAPI, extract content via Crawl4AI, merge into existing `evidenceDrafts` array before deduplication.

**When to use:** Admin explicitly triggers deep research (separate button in UI or flag in tRPC mutation).

**Integration point:**

```typescript
// In executeResearchRun, after existing researchUrls/websiteEvidenceDrafts block:
if (input.deepCrawl) {
  const serpUrls = await discoverSerpUrls(prospect, existingSnapshot);
  const serpEvidenceDrafts = await ingestCrawl4aiEvidenceDrafts([
    ...serpUrls.reviewUrls,
    ...serpUrls.jobUrls,
  ]);
  evidenceDrafts.push(...serpEvidenceDrafts);
  // serpCache persisted back to inputSnapshot before final evidence deduplication
}
```

**Anti-patterns to avoid:**

- **Calling Crawl4AI from tRPC mutation handler:** executeResearchRun is called from the tRPC handler and runs synchronously in the Railway Next.js process. Crawl4AI is an external HTTP call — this is acceptable because we're delegating to the sidecar, not running Playwright in-process.
- **Running SerpAPI calls per-evidence-item:** Group all URL discovery first, then batch extract.

---

## Don't Hand-Roll

| Problem                             | Don't Build                             | Use Instead                        | Why                                                                                 |
| ----------------------------------- | --------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| SerpAPI authentication + pagination | Custom fetch wrapper with auth header   | `serpapi` npm package              | Package handles auth, pagination token, error types, TypeScript types               |
| Browser content extraction          | Playwright in Next.js process           | Crawl4AI Docker REST API           | Playwright binary = 800MB container bloat; Railway container kills; locked decision |
| Cookie consent detection logic      | Parsing DOM for consent button patterns | `magic: true` + js_code fallback   | Crawl4AI already handles common patterns; custom detection is fragile               |
| SerpAPI response type definitions   | Custom TypeScript interfaces            | `serpapi` package types (built-in) | Package ships `mod.d.ts` with typed responses                                       |

**Key insight:** The existing codebase has all the data flow patterns needed — `EvidenceDraft`, `dedupeEvidenceDrafts`, `fallbackDraft`. Phase 8 is about adding two new source adapters (`serp.ts`, `crawl4ai.ts`) that produce `EvidenceDraft[]` and plugging them into `executeResearchRun`. No new architectural patterns are required.

---

## Common Pitfalls

### Pitfall 1: Wrong Crawl4AI Request Body Format

**What goes wrong:** Sending `crawler_config: { cache_mode: "bypass" }` (flat object) instead of `crawler_config: { type: "CrawlerRunConfig", params: { cache_mode: "bypass" } }` (wrapped object).
**Why it happens:** The REST API mirrors the Python SDK class hierarchy — non-primitive values must be wrapped with type name.
**How to avoid:** Always use the `{"type": "ClassName", "params": {...}}` format. Test with the `/playground` endpoint at `http://localhost:11235/playground` before coding.
**Warning signs:** API returns 200 but `results[0].markdown` is empty or null; or 422 validation error.

### Pitfall 2: SerpAPI Google Maps Reviews Requires Two API Calls

**What goes wrong:** Passing domain name directly to `google_maps_reviews` engine — it requires `data_id`, not a company name.
**Why it happens:** The reviews engine works on a specific place identifier, not a search query.
**How to avoid:** Always call `google_maps` first to get `data_id`, then `google_maps_reviews`. Cache the `data_id` alongside review URLs.
**Warning signs:** SerpAPI returns `error: "data_id parameter is required"`.

### Pitfall 3: Crawl4AI Timeout on Cookie-Blocked Pages

**What goes wrong:** Crawl4AI hangs for 60+ seconds on pages with Cookiebot when `magic` mode fails to dismiss the banner, eventually returning empty markdown.
**Why it happens:** Playwright waits for the page to reach a "ready" state, but consent banners intercept all interaction.
**How to avoid:** Set `wait_for_timeout: 15000` (15 seconds max), `delay_before_return_html: 1`. Accept that some pages will return fallback drafts. Don't block the entire research run on one URL failing.
**Warning signs:** Crawl4AI calls taking >30s consistently.

### Pitfall 4: SerpAPI Cost Without Caching

**What goes wrong:** Re-running deep research re-issues all SerpAPI calls (google_maps + google_maps_reviews + google_jobs = 3+ API calls per run, $0.015-0.025 each at Starter plan).
**Why it happens:** No cache check before API call.
**How to avoid:** Always read `serpCache` from `inputSnapshot` before calling SerpAPI. Cache TTL of 24 hours per prospect is sufficient for Phase 8.
**Warning signs:** Rapidly growing SerpAPI credit usage in dashboard.

### Pitfall 5: `js_code` Parameter Bug in Crawl4AI v0.8.x

**What goes wrong:** Passing `js_code` to Crawl4AI REST API does nothing — console.log doesn't show, buttons aren't clicked.
**Why it happens:** Confirmed bug in GitHub issues #1007 and #1128 — JS code injection may not execute reliably in the Docker REST API.
**How to avoid:** Use `magic: true` as primary. If magic fails (detected by empty markdown), retry without js_code at all. Don't build critical consent-handling logic on js_code until the bug is resolved in a future release.
**Warning signs:** Pages that require consent return `markdown` with only the consent banner text.

### Pitfall 6: Railway Private Networking DNS Resolution

**What goes wrong:** Next.js service cannot reach `crawl4ai.railway.internal:11235` in development or build time.
**Why it happens:** Railway private networking (`.railway.internal`) only resolves at runtime within Railway's network, not locally and not during build.
**How to avoid:** Use `CRAWL4AI_BASE_URL` env var that defaults to `http://localhost:11235` in development and `http://crawl4ai.railway.internal:11235` in Railway production.
**Warning signs:** `getaddrinfo ENOTFOUND crawl4ai.railway.internal` in logs.

### Pitfall 7: EvidenceSourceType Enum Migration Timing

**What goes wrong:** Adding a new `SERP_RESULT` enum value requires a Prisma migration and DB restart. If the code uses `SERP_RESULT` before migration runs, all evidence inserts fail.
**Why it happens:** PostgreSQL `ENUM` type changes require `ALTER TYPE`.
**How to avoid:** Reuse existing `REVIEWS` sourceType for Google Maps review content and `JOB_BOARD` for job listing content — both already exist and have appropriate confidence scores. Only add `SERP_RESULT` if a truly distinct display/filtering use case is identified.
**Confidence:** HIGH — `EvidenceSourceType` enum confirmed to have `REVIEWS` and `JOB_BOARD`.

---

## Code Examples

Verified patterns from official sources:

### SerpAPI Google Maps Reviews (full two-step flow)

```typescript
// Source: serpapi.com/google-maps-api + serpapi.com/google-maps-reviews-api
// lib/enrichment/serp.ts

import { getJson, config as serpConfig } from 'serpapi';
import { env } from '@/env.mjs';

export interface SerpDiscoveryResult {
  reviewUrls: string[];
  jobUrls: string[];
  mapsDataId?: string;
  discoveredAt: string;
}

export async function discoverSerpUrls(prospect: {
  companyName: string | null;
  domain: string;
}): Promise<SerpDiscoveryResult> {
  if (!env.SERP_API_KEY) {
    return {
      reviewUrls: [],
      jobUrls: [],
      discoveredAt: new Date().toISOString(),
    };
  }
  serpConfig.api_key = env.SERP_API_KEY;

  const companyName = prospect.companyName ?? prospect.domain;
  const reviewUrls: string[] = [];
  let mapsDataId: string | undefined;

  try {
    // Step 1: Find Google Maps data_id
    const mapsResult = await getJson({
      engine: 'google_maps',
      q: `${companyName}`,
      gl: 'nl',
      hl: 'nl',
    });
    mapsDataId = mapsResult?.place_results?.data_id as string | undefined;

    // Step 2: Fetch reviews using data_id
    if (mapsDataId) {
      const reviewsResult = await getJson({
        engine: 'google_maps_reviews',
        data_id: mapsDataId,
        hl: 'nl',
        sort_by: 'newestFirst',
      });
      const extracted = (reviewsResult?.reviews ?? []) as Array<{
        link?: string;
      }>;
      reviewUrls.push(
        ...extracted.map((r) => r.link).filter((l): l is string => Boolean(l)),
      );
    }
  } catch (err) {
    console.error('SerpAPI maps discovery failed', err);
  }

  // Jobs discovery (separate, non-blocking)
  const jobUrls: string[] = [];
  try {
    const jobsResult = await getJson({
      engine: 'google_jobs',
      q: `${companyName} jobs vacatures`,
      gl: 'nl',
      hl: 'nl',
    });
    const jobs = (jobsResult?.jobs_results ?? []) as Array<{
      link?: string;
      apply_options?: Array<{ link: string }>;
    }>;
    jobUrls.push(
      ...jobs
        .map((j) => j.link ?? j.apply_options?.[0]?.link)
        .filter((l): l is string => Boolean(l)),
    );
  } catch (err) {
    console.error('SerpAPI jobs discovery failed', err);
  }

  return {
    reviewUrls: reviewUrls.slice(0, 5),
    jobUrls: jobUrls.slice(0, 5),
    mapsDataId,
    discoveredAt: new Date().toISOString(),
  };
}
```

### Crawl4AI REST Client

```typescript
// Source: docs.crawl4ai.com/core/self-hosting/ + pondhouse-data.com tutorial
// lib/enrichment/crawl4ai.ts

import { env } from '@/env.mjs';
import type { EvidenceDraft } from '@/lib/workflow-engine';

const CRAWL4AI_BASE_URL =
  process.env.CRAWL4AI_BASE_URL ?? 'http://localhost:11235';

interface Crawl4AIResult {
  success: boolean;
  results?: Array<{
    markdown?: string;
    metadata?: { title?: string; description?: string };
  }>;
}

async function extractMarkdown(
  url: string,
): Promise<{ markdown: string; title: string }> {
  const body = {
    urls: [url],
    browser_config: {
      type: 'BrowserConfig',
      params: { headless: true },
    },
    crawler_config: {
      type: 'CrawlerRunConfig',
      params: {
        cache_mode: 'bypass',
        magic: true,
        simulate_user: true,
        wait_for_timeout: 15000,
        delay_before_return_html: 2,
      },
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(`${CRAWL4AI_BASE_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { markdown: '', title: '' };
    }

    const result = (await response.json()) as Crawl4AIResult;
    return {
      markdown: result.results?.[0]?.markdown ?? '',
      title: result.results?.[0]?.metadata?.title ?? '',
    };
  } catch {
    clearTimeout(timeout);
    return { markdown: '', title: '' };
  }
}

export async function ingestCrawl4aiEvidenceDrafts(
  urls: string[],
): Promise<EvidenceDraft[]> {
  const drafts: EvidenceDraft[] = [];

  for (const url of urls.slice(0, 10)) {
    const { markdown, title } = await extractMarkdown(url);

    if (!markdown || markdown.length < 80) {
      // Fallback draft — same pattern as web-evidence-adapter.ts
      drafts.push({
        sourceType: 'REVIEWS',
        sourceUrl: url,
        title: title || 'Source (browser extraction)',
        snippet:
          'Page queued for manual review — browser extraction returned minimal content.',
        workflowTag: 'workflow-context',
        confidenceScore: 0.55,
        metadata: { adapter: 'crawl4ai', fallback: true },
      });
      continue;
    }

    // Reuse review signal extraction for review URLs, plain snippet for others
    drafts.push({
      sourceType: url.includes('google.com/maps') ? 'REVIEWS' : 'JOB_BOARD',
      sourceUrl: url,
      title: title || 'Browser-extracted page',
      snippet: markdown.slice(0, 240).replace(/\n+/g, ' ').trim(),
      workflowTag: 'workflow-context',
      confidenceScore: 0.76,
      metadata: { adapter: 'crawl4ai', source: 'serp-discovery' },
    });
  }

  return drafts;
}
```

### Environment Variables Required

```typescript
// In env.mjs, add to server config:
SERP_API_KEY: z.string().min(1).optional(),
CRAWL4AI_BASE_URL: z.string().url().optional(),
// CRAWL4AI_BASE_URL defaults to http://localhost:11235 in code if env not set
// In Railway: set to http://crawl4ai.railway.internal:11235
```

---

## State of the Art

| Old Approach                                        | Current Approach                                         | When Changed                | Impact                                                            |
| --------------------------------------------------- | -------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `google-search-results-nodejs` (class-based, no TS) | `serpapi` npm package (function-based, TypeScript-first) | 2023 (SerpAPI announcement) | Use `serpapi`, not legacy package                                 |
| Playwright in-process                               | Crawl4AI Docker sidecar                                  | Locked decision for Phase 8 | CRAWL4AI_BASE_URL replaces direct Playwright calls                |
| `remove_overlay_elements` for cookie banners        | `magic: true` as primary approach                        | v0.8.x                      | `magic` is more reliable; `remove_overlay_elements` has open bugs |

**Deprecated/outdated:**

- `google-search-results-nodejs`: No updates since 2023-02-17; no TypeScript; use `serpapi` package instead.
- `js_code` parameter for cookie consent: Has known execution bugs in Crawl4AI v0.8.x (GitHub issues #1007, #1128). Use only as last resort, not primary strategy.

---

## Open Questions

1. **Does `magic: true` actually dismiss Cookiebot in production?**
   - What we know: `magic: true` is documented as handling cookie consent. But there are bug reports about it failing. The GDPR banner removal feature request (#1005) had no merged fix as of research date.
   - What's unclear: Whether v0.8.0+ resolved the underlying issues, or if this is still flaky.
   - Recommendation: Test against a known Cookiebot-protected NL domain (e.g., a company using it) before committing to the approach. If magic fails, the fallback draft pattern is acceptable for Phase 8 (EVID-05 says "handled so content is still extracted" — a fallback stub does not satisfy this).

2. **What is the correct `cache_mode` string format in REST API?**
   - What we know: Docs show `"bypass"` and `"default"` as values. One source shows `CacheMode.BYPASS` (Python enum) which serializes to the string `"bypass"`.
   - What's unclear: Whether the REST API accepts `"bypass"` or `"BYPASS"` or `0` (integer enum).
   - Recommendation: Test both `"bypass"` and `"BYPASS"` against the live container. The `/playground` endpoint generates valid JSON from Python config, which can verify the correct format.

3. **Does Google Maps Reviews engine return reviewable URLs for NL/BE companies?**
   - What we know: SerpAPI's `google_maps_reviews` returns review objects with `link` fields. NL-region support confirmed (`gl: 'nl'`).
   - What's unclear: Whether small NL/BE service companies (the Klarifai target segment) have enough Google Maps reviews to make this worthwhile.
   - Recommendation: Accept zero results gracefully. The SerpAPI call should not throw on empty `reviews` array — this is a common case.

4. **Railway private networking timing for Crawl4AI sidecar**
   - What we know: Railway private networking (`crawl4ai.railway.internal`) resolves at runtime, not build time. Requires IPv6 support in newer Railway environments.
   - What's unclear: Whether Railway's newer environments (post-October 16, 2025) require IPv6-only addressing, which could affect `fetch` in Node.js.
   - Recommendation: Use `CRAWL4AI_BASE_URL` env var. For local dev, point to `http://localhost:11235`. For Railway, point to `http://crawl4ai.railway.internal:11235`. Test connectivity with a health check on startup.

5. **Should `SERP_RESULT` be added as a new EvidenceSourceType enum value?**
   - What we know: Existing `REVIEWS` and `JOB_BOARD` values map well to the two SerpAPI-discovered content types. No schema migration needed if we reuse them.
   - What's unclear: Whether a distinct `SERP_RESULT` type would be useful for filtering/display in Phase 9+ features.
   - Recommendation: Reuse existing enum values for Phase 8. A `SERP_RESULT` value can be added in a future migration if the UI needs to distinguish browser-extracted evidence.

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection (`lib/research-executor.ts`, `lib/web-evidence-adapter.ts`, `lib/review-adapters.ts`, `server/routers/research.ts`, `prisma/schema.prisma`, `env.mjs`) — existing patterns, schema state
- [SerpAPI Google Jobs API docs](https://serpapi.com/google-jobs-api) — `jobs_results` response structure, required params
- [SerpAPI Google Maps Reviews API docs](https://serpapi.com/google-maps-reviews-api) — two-step `data_id` flow confirmed
- [Railway Private Networking docs](https://docs.railway.com/networking/private-networking/how-it-works) — `.railway.internal` DNS format confirmed
- `npm info serpapi` — version 2.2.1, TypeScript types at `./script/mod.d.ts`

### Secondary (MEDIUM confidence)

- [Crawl4AI Self-Hosting Guide v0.8.x](https://docs.crawl4ai.com/core/self-hosting/) — REST API endpoint list, Docker run command, request body format, `{"type": "ClassName"}` wrapping requirement
- [Pondhouse Data Crawl4AI tutorial](https://www.pondhouse-data.com/blog/webcrawling-with-crawl4ai) — async task flow, response fields including `markdown`, `metadata`
- [SerpAPI JavaScript migration guide](https://github.com/serpapi/serpapi-javascript/blob/master/docs/migrating_from_google_search_results_nodejs.md) — `serpapi` vs `google-search-results-nodejs` API diff
- [SerpAPI Pricing page](https://serpapi.com/pricing) — 250 free searches/month; Starter plan $25/1,000 searches

### Tertiary (LOW confidence — needs validation)

- [Crawl4AI discussion #513](https://github.com/unclecode/crawl4ai/discussions/513) — cookie consent via `js_code` (maintainer recommendation, but js_code has known execution bugs)
- [Crawl4AI discussion #1005](https://github.com/unclecode/crawl4ai/discussions/1005) — GDPR banner removal feature request; `remove_overlay_elements` + `magic` recommended
- [Crawl4AI API parameters](https://docs.crawl4ai.com/api/parameters/) — `magic`, `simulate_user`, `wait_for_timeout`, `delay_before_return_html` parameter descriptions

---

## Metadata

**Confidence breakdown:**

- SerpAPI integration: HIGH — two-step maps/reviews flow confirmed by official docs; `serpapi` npm package confirmed TypeScript, v2.2.1
- Crawl4AI REST API format: MEDIUM — `{"type": "ClassName"}` wrapping confirmed by official docs; exact string values for `cache_mode` need live validation
- Cookie consent handling: LOW-MEDIUM — `magic: true` is the documented approach but has known bugs; EVID-05 compliance requires live container testing
- Railway private networking: HIGH — `.railway.internal` DNS pattern confirmed by official Railway docs

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (Crawl4AI is actively developed; cookie consent bugs may be patched)
