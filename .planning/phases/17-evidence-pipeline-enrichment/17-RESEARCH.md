# Phase 17: Evidence Pipeline Enrichment - Research

**Researched:** 2026-02-22
**Domain:** Sitemap discovery, Google search enrichment, LinkedIn extraction, KvK registry integration
**Confidence:** HIGH for EVID-06/EVID-07/EVID-09 | MEDIUM-LOW for EVID-08 (LinkedIn)

---

## Summary

Phase 17 enriches the evidence pipeline with four new source types: sitemap-driven URL discovery (EVID-06), broader Google search queries via SerpAPI (EVID-07), LinkedIn company page extraction (EVID-08), and KvK registry data (EVID-09). The architecture is already well-positioned — `executeResearchRun` in `lib/research-executor.ts` is the central integration point, the `EvidenceDraft` interface and `dedupeEvidenceDrafts` are in place, and the existing SerpAPI and Crawl4AI clients can be extended rather than replaced.

Three of the four sources are implementable with high confidence. EVID-06 (sitemap) is pure HTTP + XML parsing with a well-supported npm package. EVID-07 (Google search) extends the already-integrated SerpAPI using the `google_search` engine which is already installed. EVID-09 (KvK) is a clean REST API with an `apikey` header, €0.02/query per Basisprofiel call after a €6.40/month subscription, and a free test environment. EVID-08 (LinkedIn) is the significant risk: LinkedIn's anti-scraping measures and login-wall redirect block unauthenticated access to company pages reliably in 2025/2026; the approach must degrade gracefully and cannot be a hard dependency.

**Primary recommendation:** Implement EVID-06, EVID-07, and EVID-09 as reliable sources. Implement EVID-08 as a best-effort Crawl4AI attempt with graceful failure as the expected outcome for most prospects — the success criterion ("where the page is publicly accessible") accepts this constraint.

---

## Codebase State (What Phase 8 Already Built)

Phase 8 built and shipped the following — Phase 17 extends, does not replace:

| File                          | What It Does                                                                                   | Phase 17 Touches?                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `lib/enrichment/serp.ts`      | SerpAPI Google Maps 2-step + Google Jobs                                                       | Extend with `google_search` engine            |
| `lib/enrichment/crawl4ai.ts`  | Crawl4AI REST API wrapper for browser extraction                                               | Extend with fallback detection for LinkedIn   |
| `lib/research-executor.ts`    | Orchestrates all evidence collection; `deepCrawl` flag already exists                          | Add sitemap, search, KvK branches             |
| `server/routers/research.ts`  | `startRun` mutation with `deepCrawl: z.boolean()`                                              | No changes needed                             |
| `env.mjs`                     | `SERP_API_KEY`, `CRAWL4AI_BASE_URL` already defined                                            | Add `KVK_API_KEY`                             |
| `prisma/schema.prisma`        | `EvidenceSourceType` enum: WEBSITE, DOCS, CAREERS, HELP_CENTER, JOB_BOARD, REVIEWS, MANUAL_URL | Assess whether to add SITEMAP, NEWS, REGISTRY |
| `lib/web-evidence-adapter.ts` | `ingestWebsiteEvidenceDrafts` — plain `fetch` HTML extraction with soft-404 detection          | Used for sitemap-discovered URLs              |

**Critical discrepancy found in existing code:** `lib/enrichment/crawl4ai.ts` skips minimal-content pages entirely (`continue`) but `lib/enrichment/crawl4ai.test.ts` at line 167 expects a fallback draft with `confidenceScore: 0.55` and `metadata.fallback: true` for minimal content. The test was written against the Phase 8 research spec (which said "create fallback draft") but the implementation chose "skip entirely". The test currently fails (or was added expecting a not-yet-implemented behavior). This must be resolved in Phase 17 — the test expectation is the correct behavior for EVID-08 (LinkedIn), where we want a placeholder stub even when content fails, not silent skip.

---

## Standard Stack

### Core

| Library                                 | Version                                | Purpose                                                     | Why Standard                                                                                                     |
| --------------------------------------- | -------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `sitemapper`                            | `4.1.4` (published 2026-02-22, active) | Parse sitemap.xml + sitemap index recursively               | TypeScript-first, handles nested sitemap indexes, configurable timeout/concurrency. Zero dep on native XML libs. |
| `serpapi` (already installed)           | `^2.2.1`                               | Google Search (`google_search` engine) for company mentions | Already in package.json. Extend with `google_search` engine for EVID-07 — no new install.                        |
| Node.js `fetch` (built-in)              | N/A                                    | KvK REST API HTTP calls                                     | KvK is a plain JSON REST API — no SDK needed.                                                                    |
| `lib/enrichment/crawl4ai.ts` (existing) | —                                      | Browser extraction for LinkedIn                             | Re-use existing client. EVID-08 attempt goes through same `extractMarkdown` function.                            |

### Supporting

| Library           | Version                   | Purpose                                              | When to Use                                                                                                                                                                              |
| ----------------- | ------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `robots-parser`   | `3.0.1`                   | Parse robots.txt to discover additional sitemap URLs | OPTIONAL — only needed if `sitemap.xml` discovery should also check `robots.txt`. Most Dutch SMBs won't have this configured. Skip for Phase 17; sitemap.xml direct fetch is sufficient. |
| `fast-xml-parser` | `^5.3.5` (sitemapper dep) | XML parsing                                          | Already pulled in by sitemapper — not used directly                                                                                                                                      |

### Alternatives Considered

| Instead of   | Could Use                        | Tradeoff                                                                                         |
| ------------ | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `sitemapper` | `fast-xml-parser` + custom fetch | More control but requires handling sitemap indexes, gzip decompression, and concurrency manually |
| `sitemapper` | `sitemap-xml-parser`             | Smaller but lacks index recursion support — Dutch SMB sites often have nested indexes            |
| KvK REST API | Open Data bulk dataset           | Free bulk dataset has no company names or KvK numbers — useless for per-prospect lookup          |
| KvK REST API | Third-party registries (Kyckr)   | Extra cost layer with no benefit vs. direct KvK API                                              |

**Installation:**

```bash
npm install sitemapper
```

No other new packages needed. `serpapi` and `fetch` are already available.

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── enrichment/
│   ├── serp.ts              # MODIFY: add discoverSerpSearchUrls() for EVID-07
│   ├── crawl4ai.ts          # MODIFY: fix fallback draft behavior, add LinkedIn attempt
│   ├── sitemap.ts           # NEW: discoverSitemapUrls() for EVID-06
│   └── kvk.ts               # NEW: fetchKvkData() for EVID-09
├── research-executor.ts     # MODIFY: integrate sitemap + search + KvK into executeResearchRun
```

### Pattern 1: Sitemap URL Discovery (EVID-06)

**What:** Fetch `/sitemap.xml` for the prospect domain. If it is a sitemap index, recursively parse the nested sitemaps. Return the list of discovered URLs, filtered to the same domain and capped at a reasonable limit (20-30 URLs max per prospect to avoid excessive crawling).

**When to use:** Always — called before `defaultResearchUrls()` so discovered URLs replace the guessed `/careers`, `/help`, `/docs` paths. If sitemap is missing (404), fall back to `defaultResearchUrls()` unchanged.

**Key sitemapper configuration:**

```typescript
// Source: https://github.com/seantomburke/sitemapper (v4.1.4)
import Sitemapper from 'sitemapper';

export async function discoverSitemapUrls(domain: string): Promise<string[]> {
  const sitemapper = new Sitemapper({
    url: `https://${domain}/sitemap.xml`,
    timeout: 15000, // 15s — consistent with Crawl4AI timeout
    concurrency: 3, // Low concurrency for Dutch SMB sites
    retries: 1,
  });

  try {
    const { sites, errors } = await sitemapper.fetch();
    if (errors.length > 0) {
      // Log but don't throw — sitemap might partially succeed
      console.error('[sitemap] errors:', errors);
    }
    // Filter to same domain only (security: don't crawl external URLs)
    // Prioritize content pages over assets
    const filtered = sites
      .filter((url) => url.includes(domain))
      .filter(
        (url) =>
          !url.match(/\.(jpg|jpeg|png|gif|svg|pdf|xml|css|js|woff|ttf)$/i),
      )
      .slice(0, 25);
    return filtered;
  } catch {
    return []; // Sitemap not found or malformed — fail gracefully
  }
}
```

**Confidence:** HIGH — sitemapper v4.1.4 published actively (19 hours before research date), TypeScript types included, dependency count is 3 (fast-xml-parser, got, p-limit).

**Integration into executeResearchRun:**

```typescript
// Replace defaultResearchUrls with sitemap-first approach
const sitemapUrls = await discoverSitemapUrls(prospect.domain);
const researchUrls = uniqueUrls(
  sitemapUrls.length > 0
    ? [...sitemapUrls, ...nonReviewManualUrls]
    : [...defaultResearchUrls(prospect.domain), ...nonReviewManualUrls],
);
```

### Pattern 2: Google Search Enrichment (EVID-07)

**What:** Use SerpAPI `google_search` engine to find external mentions of the company: reviews, job postings, news. Returns `organic_results` array with `link` and `snippet` fields that become `EvidenceDraft` entries directly (snippet is already extracted — no Crawl4AI pass needed).

**When to use:** Always — called alongside existing SerpAPI Maps/Jobs discovery. The `google_search` results include snippets that can be stored as evidence directly without browser extraction.

**Key implementation:**

```typescript
// Extends lib/enrichment/serp.ts
// Source: https://serpapi.com/search-api + serpapi npm package

interface GoogleOrganicResult {
  link?: string;
  title?: string;
  snippet?: string;
}

interface GoogleSearchResult {
  organic_results?: GoogleOrganicResult[];
}

export async function discoverGoogleSearchMentions(input: {
  companyName: string | null;
  domain: string;
}): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return [];

  serpConfig.api_key = apiKey;
  const query = input.companyName ?? input.domain;
  const mentions: Array<{ url: string; title: string; snippet: string }> = [];

  const searchTerms = [
    `${query} reviews ervaringen`,
    `${query} vacatures werken bij`,
    `${query} nieuws`,
  ];

  for (const q of searchTerms) {
    try {
      const result = (await getJson({
        engine: 'google',
        q,
        gl: 'nl',
        hl: 'nl',
        google_domain: 'google.nl',
        num: 5, // 5 results per query
      })) as GoogleSearchResult;

      for (const r of result.organic_results ?? []) {
        if (r.link && r.snippet && r.snippet.length > 30) {
          mentions.push({
            url: r.link,
            title: r.title ?? query,
            snippet: r.snippet,
          });
        }
      }
    } catch (err) {
      console.error(`[SerpAPI] google search failed for "${q}":`, err);
    }
  }

  return mentions.slice(0, 12); // Cap at 12 total mentions
}
```

**Confidence:** HIGH — `google` engine with `organic_results` returning `link`, `snippet` confirmed by official SerpAPI docs and official npm package.

**EvidenceSourceType mapping:** Use `WEBSITE` for general mentions. No new enum value needed.

**SerpAPI cost implication:** 3 `google` engine queries per prospect = 3 API credits per prospect. At 250 free credits/month: ~83 prospects/month on free tier. At $25/1000 paid: $0.075 per prospect for EVID-07 alone. Acceptable for the target volume (20-50 active prospects).

### Pattern 3: LinkedIn Company Page Extraction (EVID-08)

**What:** Attempt to extract the public LinkedIn company page via Crawl4AI. LinkedIn `linkedin.com/company/{slug}` pages are publicly visible in theory but heavily guarded by login-wall redirects after 1-2 requests per IP session.

**Reality check (MEDIUM-LOW confidence):**

- Unauthenticated access to LinkedIn company pages works for the first few requests from a given IP but then redirects to `/authwall`
- LinkedIn's anti-bot detection (TLS fingerprinting, behavioral analysis, JA3 signatures) means even Crawl4AI's `magic: true` + `simulate_user: true` will fail after warming up
- LinkedIn has won legal cases against scrapers (Proxycurl, 2025) and filed suits against unauthorized data extraction
- The Crawl4AI container does not use proxy rotation — same Railway IP for all requests = blocked after first few prospects
- **Expected outcome for most real runs:** Crawl4AI returns redirect HTML (the LinkedIn login page) or empty markdown

**Best-effort implementation:**

```typescript
// In executeResearchRun, as an optional enrichment
// Source: linkedin.com/company/{slug} is the standard URL format
// linkedinUrl field is already stored on Prospect model

if (prospect.linkedinUrl) {
  const { markdown, title } = await extractMarkdown(prospect.linkedinUrl);

  // Detect LinkedIn authwall redirect
  const isAuthwall =
    markdown.toLowerCase().includes('authwall') ||
    markdown.toLowerCase().includes('log in to linkedin') ||
    markdown.toLowerCase().includes('join linkedin') ||
    markdown.length < 200;

  if (!isAuthwall && markdown.length > 200) {
    allDrafts.push({
      sourceType: 'WEBSITE',
      sourceUrl: prospect.linkedinUrl,
      title: title || `${prospect.companyName ?? prospect.domain} - LinkedIn`,
      snippet: markdown.slice(0, 240).replace(/\n+/g, ' ').trim(),
      workflowTag: 'workflow-context',
      confidenceScore: 0.72,
      metadata: { adapter: 'crawl4ai', source: 'linkedin' },
    });
  }
  // If authwall: skip silently — do NOT create a fallback stub for LinkedIn
  // (stub would pollute evidence with noise)
}
```

**Confidence:** LOW for real-world success rate. The `linkedinUrl` field exists on Prospect model (confirmed in schema). The logic is correct. Whether Crawl4AI can successfully retrieve it depends on the Railway IP address state.

**Alternative approach (MEDIUM confidence):** Apollo (the existing enrichment provider) returns `linkedinUrl` as a field but also returns `description`, `industry`, `specialties`, `employeeRange` which are already stored on `Prospect`. Rather than scraping LinkedIn, Phase 17 can surface the _already stored Apollo data_ as an evidence item. This converts LinkedIn data (which Apollo already fetched) into a structured evidence record without any new network call.

```typescript
// Better approach: Convert existing Apollo-enriched fields to EvidenceDraft
if (prospect.description || prospect.specialties.length > 0) {
  const linkedinSnippet = [
    prospect.description,
    prospect.specialties.length > 0
      ? `Specialties: ${prospect.specialties.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  if (linkedinSnippet.length > 30) {
    allDrafts.push({
      sourceType: 'WEBSITE',
      sourceUrl:
        prospect.linkedinUrl ??
        `https://www.linkedin.com/company/${prospect.domain}`,
      title: `${prospect.companyName ?? prospect.domain} - Company Profile`,
      snippet: linkedinSnippet.slice(0, 240),
      workflowTag: 'workflow-context',
      confidenceScore: 0.74, // Apollo-sourced = trustworthy
      metadata: { adapter: 'apollo-derived', source: 'linkedin-profile' },
    });
  }
}
```

**Recommendation:** Implement BOTH approaches. (1) Try Crawl4AI extraction if `linkedinUrl` is set. (2) Also always create a draft from `description`/`specialties` if they exist in the DB. The Apollo-derived approach is reliable and adds evidence without an API call.

### Pattern 4: KvK Registry Enrichment (EVID-09)

**What:** Two-step API flow: (1) Search KvK by company name to get KvK number. (2) Fetch Basisprofiel for that number to get SBI codes, employee count, legal form, founding date, registered address.

**Authentication:** `apikey` header (not OAuth). Production key requires €6.40/month subscription + €0.02 per Basisprofiel call. Test environment at `api.kvk.nl/test/...` with shared key `l7xx1f2691f2520d487b902f4e0b57a0b197` is free and requires no registration.

**Implementation:**

```typescript
// NEW: lib/enrichment/kvk.ts
// Source: https://developers.kvk.nl/documentation/zoeken-api
//         https://developers.kvk.nl/documentation/basisprofiel-api

const KVK_BASE_URL =
  process.env.KVK_TEST_MODE === 'true'
    ? 'https://api.kvk.nl/test/api'
    : 'https://api.kvk.nl/api';

interface KvkZoekenResult {
  resultaten?: Array<{
    kvkNummer?: string;
    naam?: string;
    straatnaam?: string;
    postcode?: string;
    plaats?: string;
    actief?: string;
  }>;
  totaal?: number;
}

interface KvkBasisprofiel {
  kvkNummer?: string;
  naam?: string;
  formeleRegistratiedatum?: string;
  sbiActiviteiten?: Array<{
    sbiCode?: string;
    sbiOmschrijving?: string;
    indHoofdactiviteit?: string;
  }>;
  totaalWerkzamePersonen?: number;
  voltijdWerkzamePersonen?: number;
  deeltijdWerkzamePersonen?: number;
  rechtsvorm?: string;
  uitgebreideRechtsvorm?: string;
}

export interface KvkEnrichmentData {
  kvkNummer: string;
  naam: string;
  sbiCode?: string;
  sbiOmschrijving?: string;
  werkzamePersonen?: number;
  rechtsvorm?: string;
  registratiedatum?: string;
  plaats?: string;
  postcode?: string;
}

export async function fetchKvkData(
  companyName: string,
): Promise<KvkEnrichmentData | null> {
  const apiKey = process.env.KVK_API_KEY;
  if (!apiKey) return null;

  const headers = { apikey: apiKey };

  try {
    // Step 1: Search by name
    const searchUrl = `${KVK_BASE_URL}/v2/zoeken?naam=${encodeURIComponent(companyName)}&resultatenPerPagina=3`;
    const searchResp = await fetch(searchUrl, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!searchResp.ok) return null;

    const searchData = (await searchResp.json()) as KvkZoekenResult;
    const first =
      searchData.resultaten?.find((r) => r.actief === 'Ja') ??
      searchData.resultaten?.[0];

    if (!first?.kvkNummer) return null;

    // Step 2: Fetch Basisprofiel
    const profileUrl = `${KVK_BASE_URL}/v1/basisprofielen/${first.kvkNummer}`;
    const profileResp = await fetch(profileUrl, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!profileResp.ok) return null;

    const profile = (await profileResp.json()) as KvkBasisprofiel;
    const hoofdactiviteit =
      profile.sbiActiviteiten?.find((s) => s.indHoofdactiviteit === 'Ja') ??
      profile.sbiActiviteiten?.[0];

    return {
      kvkNummer: first.kvkNummer,
      naam: profile.naam ?? first.naam ?? companyName,
      sbiCode: hoofdactiviteit?.sbiCode,
      sbiOmschrijving: hoofdactiviteit?.sbiOmschrijving,
      werkzamePersonen: profile.totaalWerkzamePersonen,
      rechtsvorm: profile.rechtsvorm,
      registratiedatum: profile.formeleRegistratiedatum,
      plaats: first.plaats,
      postcode: first.postcode,
    };
  } catch (err) {
    console.error('[KvK] enrichment failed:', err);
    return null;
  }
}

export function kvkDataToEvidenceDraft(data: KvkEnrichmentData): EvidenceDraft {
  const parts: string[] = [];
  if (data.rechtsvorm) parts.push(`Rechtsvorm: ${data.rechtsvorm}`);
  if (data.sbiOmschrijving) parts.push(`Sector: ${data.sbiOmschrijving}`);
  if (data.werkzamePersonen)
    parts.push(`Werkzame personen: ${data.werkzamePersonen}`);
  if (data.plaats) parts.push(`Gevestigd: ${data.plaats}`);
  if (data.registratiedatum)
    parts.push(`Ingeschreven: ${data.registratiedatum}`);

  return {
    sourceType: 'WEBSITE', // No REGISTRY enum yet — use WEBSITE
    sourceUrl: `https://www.kvk.nl/zoeken/?source=all&q=${encodeURIComponent(data.naam)}&start=0&site=kvk`,
    title: `${data.naam} - KvK Handelsregister`,
    snippet: parts.join(' | ').slice(0, 240),
    workflowTag: 'workflow-context',
    confidenceScore: 0.82, // Registry data = high factual confidence
    metadata: {
      adapter: 'kvk',
      kvkNummer: data.kvkNummer,
      sbiCode: data.sbiCode,
      werkzamePersonen: data.werkzamePersonen,
    },
  };
}
```

**Confidence:** HIGH for API structure (test environment confirmed, auth confirmed, response fields confirmed). MEDIUM for match quality (searching by company name for Dutch SMBs may return wrong matches — company name must be exact enough; use `companyName ?? domain` and take first active result).

**KvK cost:** Free for Zoeken API. €0.02 per Basisprofiel call. ~€1-2/month at 50-100 active prospects.

### Pattern 5: EvidenceSourceType — Schema Decision

**Current enum values:** WEBSITE, DOCS, CAREERS, HELP_CENTER, JOB_BOARD, REVIEWS, MANUAL_URL

**New data types needing representation:**

- Sitemap-discovered URLs: use existing type (WEBSITE, CAREERS, etc. — `inferSourceType()` already handles this by URL pattern)
- Google search mentions: WEBSITE (appropriate — these are web pages)
- LinkedIn company profile: WEBSITE (appropriate)
- KvK registry data: needs a distinct type for filtering/display

**Recommendation:** Add `REGISTRY` to `EvidenceSourceType` enum specifically for KvK data. Skip `NEWS` and `SITEMAP` — those map well to WEBSITE. This is the minimum schema change (one Prisma migration adding one enum value).

```prisma
enum EvidenceSourceType {
  WEBSITE
  DOCS
  CAREERS
  HELP_CENTER
  JOB_BOARD
  REVIEWS
  MANUAL_URL
  REGISTRY  // NEW: KvK Handelsregister data
}
```

**Migration:** `prisma migrate dev --name add-registry-source-type`

**Confidence:** HIGH — adding an enum value to PostgreSQL requires `ALTER TYPE`, handled automatically by Prisma migration.

### Anti-Patterns to Avoid

- **Fetching all sitemap URLs through Crawl4AI:** Sitemap can return hundreds of URLs. Only pass the top 10-15 most relevant through `ingestWebsiteEvidenceDrafts` (not Crawl4AI). Crawl4AI is only for JS-rendered content that plain `fetch` can't handle.
- **Hard-blocking the research run on KvK failure:** KvK API may be down, company name may not match. Always wrap in try/catch and treat no-result as normal (Dutch sole traders and foreign companies have no KvK record).
- **Making LinkedIn extraction mandatory for evidence count:** The Phase 18 quality gate cannot require LinkedIn evidence — too unreliable. LinkedIn adds a bonus when it works, never a penalty when it doesn't.
- **Re-crawling all sitemap URLs every time:** Sitemap discovery should be cached in `inputSnapshot.sitemapCache` (same pattern as `serpCache`) with 24-hour TTL. Sitemap changes rarely.
- **Using `sitemapper` with no URL cap:** Sites like WordPress/Shopify can have sitemaps with thousands of URLs. Always `.slice(0, 25)` after filtering.

---

## Don't Hand-Roll

| Problem                       | Don't Build                  | Use Instead                                      | Why                                                                      |
| ----------------------------- | ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Sitemap index recursion       | Custom recursive XML fetcher | `sitemapper` v4.1.4                              | Handles sitemap indexes, gzip decompression, concurrency, error recovery |
| Google organic search parsing | Raw fetch to google.com      | `serpapi` npm (already installed)                | SerpAPI handles captchas, parsing, structured `organic_results`          |
| KvK API client                | None needed                  | Plain `fetch` + types                            | KvK REST API is simple JSON + `apikey` header — no SDK adds value        |
| LinkedIn HTML parsing         | Custom LinkedIn parser       | Graceful skip + Apollo-derived fallback          | LinkedIn actively blocks — custom parser won't survive one update cycle  |
| XML parsing for sitemap       | Custom XML parser            | `fast-xml-parser` (sitemapper dep) or sitemapper | Standard XML quirks (CDATA, namespaces) are already handled              |

**Key insight:** The `lib/web-evidence-adapter.ts` `ingestWebsiteEvidenceDrafts` function already handles plain-fetch HTML extraction well. Sitemap-discovered URLs should go through it — not Crawl4AI (no JS rendering needed for standard company pages).

---

## Common Pitfalls

### Pitfall 1: Sitemapper Returning External URLs

**What goes wrong:** Some sitemaps include URLs from CDNs, external assets, or subdomains not owned by the prospect.
**Why it happens:** Some CMSs (WordPress, HubSpot) include CDN-hosted asset URLs in their sitemaps.
**How to avoid:** Always filter: `sites.filter(url => url.includes(domain))`. Then secondary filter for non-asset extensions.
**Warning signs:** Evidence sources with URLs from `cdn.`, `images.`, `assets.` domains.

### Pitfall 2: KvK Zoeken API Returns Wrong Company

**What goes wrong:** Searching for "Acme" returns "Acme Logistics BV" instead of "Acme Cleaning Services". First result is not necessarily the right company.
**Why it happens:** KvK name search is fuzzy and returns by relevance.
**How to avoid:** Try matching with domain as well. Take only `actief: "Ja"` registrations. Consider adding city matching if `prospect.city` is populated. Accept wrong matches gracefully — KvK evidence is supplementary.
**Warning signs:** `naam` in the Basisprofiel response doesn't match `prospect.companyName`.

### Pitfall 3: SerpAPI `google` Engine Consumes Quota Faster

**What goes wrong:** 3 Google Search queries per prospect (reviews, vacatures, nieuws) = 3 credits. Combined with existing Maps (1) + Maps Reviews (1) + Jobs (1) = 6 total SerpAPI credits per deepCrawl run.
**Why it happens:** Each query is one credit.
**How to avoid:** Gate all SerpAPI calls behind `deepCrawl: true`. Make search queries skippable individually if `SERP_API_KEY` is not set. Consider making EVID-07 a separate optional flag (`searchEnrichment: true`) from the existing deepCrawl flag.
**Warning signs:** SerpAPI quota depleted before end of month.

### Pitfall 4: Sitemapper `got` Dependency vs. Next.js Edge Runtime

**What goes wrong:** `sitemapper` depends on `got` which uses Node.js `http`/`https` modules. If called from an Edge runtime (Next.js Edge API routes), it will fail.
**Why it happens:** `got` is not Edge-compatible.
**How to avoid:** `discoverSitemapUrls` is called from `executeResearchRun` which runs in the Node.js runtime (standard API route, not Edge). Never call it from an Edge route or middleware.
**Warning signs:** `require('http')` module not found in Edge runtime errors.

### Pitfall 5: LinkedIn Authwall Detection

**What goes wrong:** Crawl4AI returns 200 OK but the HTML is the LinkedIn login page ("Join LinkedIn to see more results"), stored as evidence.
**Why it happens:** LinkedIn serves login-wall content with a 200 status code (soft redirect).
**How to avoid:** Detect authwall in markdown output:

```typescript
const isAuthwall = [
  'authwall',
  'log in to linkedin',
  'join linkedin',
  'sign in',
  'leden login',
].some((phrase) => markdown.toLowerCase().includes(phrase));
```

**Warning signs:** Evidence snippets containing "Log in" or "Join LinkedIn" text.

### Pitfall 6: KvK API Key Not Configured in Production

**What goes wrong:** `KVK_API_KEY` not set → `fetchKvkData` returns null silently → EVID-09 never runs.
**Why it happens:** New env var, not in existing deployment config.
**How to avoid:** Log a one-time warning at startup if `KVK_API_KEY` is not set. The `executeResearchRun` function already handles `null` gracefully — the warning is for operator awareness only.
**Warning signs:** No KvK evidence appearing for Dutch prospects after Phase 17 deploy.

### Pitfall 7: Sitemap Caching Pattern (Same as serpCache)

**What goes wrong:** Re-running research on same prospect repeatedly re-fetches the sitemap each time.
**Why it happens:** No cache check before sitemap fetch.
**How to avoid:** Store in `inputSnapshot.sitemapCache` with TTL:

```typescript
interface InputSnapshot {
  manualUrls: string[];
  campaignId?: string;
  deepCrawl?: boolean;
  serpCache?: SerpDiscoveryResult;
  sitemapCache?: {
    discoveredAt: string;
    urls: string[];
  };
}
```

**Warning signs:** Sitemap fetch logs appearing on every retry run.

---

## Code Examples

### EVID-06: Sitemap Discovery Integration into executeResearchRun

```typescript
// lib/enrichment/sitemap.ts
// Source: https://github.com/seantomburke/sitemapper (v4.1.4, MIT)

import Sitemapper from 'sitemapper';

export interface SitemapCache {
  discoveredAt: string;
  urls: string[];
}

export async function discoverSitemapUrls(domain: string): Promise<string[]> {
  const sitemapper = new Sitemapper({
    url: `https://${domain}/sitemap.xml`,
    timeout: 12000,
    concurrency: 2,
    retries: 1,
  });

  try {
    const { sites } = await sitemapper.fetch();
    return sites
      .filter((url) => url.includes(domain))
      .filter(
        (url) =>
          !/\.(jpg|jpeg|png|gif|svg|pdf|xml|css|js|woff|ttf|ico)$/i.test(url),
      )
      .slice(0, 25);
  } catch {
    return [];
  }
}
```

### EVID-07: Google Search Mentions (Extending serp.ts)

```typescript
// Add to lib/enrichment/serp.ts
// Source: https://serpapi.com/search-api (organic_results schema)

export interface GoogleSearchMention {
  url: string;
  title: string;
  snippet: string;
}

export async function discoverGoogleSearchMentions(input: {
  companyName: string | null;
  domain: string;
}): Promise<GoogleSearchMention[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return [];

  serpConfig.api_key = apiKey;
  const query = input.companyName ?? input.domain;
  const mentions: GoogleSearchMention[] = [];

  const searches = [
    `"${query}" reviews OR ervaringen`,
    `"${query}" vacatures OR werken bij`,
    `"${query}" nieuws`,
  ];

  for (const q of searches) {
    try {
      const result = (await getJson({
        engine: 'google',
        q,
        gl: 'nl',
        hl: 'nl',
        google_domain: 'google.nl',
        num: 5,
      })) as {
        organic_results?: Array<{
          link?: string;
          title?: string;
          snippet?: string;
        }>;
      };

      for (const r of result.organic_results ?? []) {
        if (r.link && r.snippet && r.snippet.length > 30) {
          mentions.push({
            url: r.link,
            title: r.title ?? query,
            snippet: r.snippet,
          });
        }
      }
    } catch (err) {
      console.error(`[SerpAPI] google search error for "${q}":`, err);
    }
  }

  return mentions.slice(0, 12);
}
```

### EVID-09: KvK Integration in executeResearchRun

```typescript
// In executeResearchRun, after existing evidence collection:
if (prospect.companyName) {
  try {
    const kvkData = await fetchKvkData(prospect.companyName);
    if (kvkData) {
      allDrafts.push(kvkDataToEvidenceDraft(kvkData));
    }
  } catch (err) {
    console.error('[KvK] fetch failed, continuing without:', err);
  }
}
```

### EVID-08: Apollo-Derived LinkedIn Evidence (Reliable Fallback)

```typescript
// Always runs when Apollo data is present — no network call required
const linkedinSnippet = [
  prospect.description,
  prospect.specialties.length > 0
    ? `Specialiteiten: ${prospect.specialties.join(', ')}`
    : null,
  prospect.industry ? `Sector: ${prospect.industry}` : null,
]
  .filter(Boolean)
  .join(' | ');

if (linkedinSnippet.length > 30) {
  allDrafts.push({
    sourceType: 'WEBSITE',
    sourceUrl:
      prospect.linkedinUrl ??
      `https://www.linkedin.com/company/${prospect.domain.split('.')[0]}`,
    title: `${prospect.companyName ?? prospect.domain} - Bedrijfsprofiel`,
    snippet: linkedinSnippet.slice(0, 240),
    workflowTag: 'workflow-context',
    confidenceScore: 0.74,
    metadata: { adapter: 'apollo-derived', source: 'linkedin-profile' },
  });
}
```

### env.mjs additions

```typescript
// In server section:
KVK_API_KEY: z.string().min(1).optional(),
KVK_TEST_MODE: z.enum(['true', 'false']).optional(),

// In runtimeEnv section:
KVK_API_KEY: process.env.KVK_API_KEY,
KVK_TEST_MODE: process.env.KVK_TEST_MODE,
```

---

## Crawl4ai.ts Test Discrepancy — Fix Required

The existing test at `lib/enrichment/crawl4ai.test.ts` line 167 expects:

```
drafts[0].confidenceScore === 0.55
drafts[0].metadata.fallback === true
```

...for minimal-content pages. But the current `crawl4ai.ts` implementation does `continue` (skips) for `markdown.length < 80`.

**Resolution:** Update `crawl4ai.ts` to create the fallback draft instead of skipping. The test represents the correct behavior: a fallback stub is better than silence for pages that exist but return minimal content (consent banners, JS-heavy pages, etc.). The 404 skip (`looksLikeCrawled404`) remains correct — skip those.

```typescript
// In ingestCrawl4aiEvidenceDrafts, replace `continue` with fallback:
if (!markdown || markdown.length < 80) {
  drafts.push({
    sourceType: url.includes('google.com/maps') ? 'REVIEWS' : 'JOB_BOARD',
    sourceUrl: url,
    title: 'Bron (browser-extractie mislukt)',
    snippet:
      'Pagina bestaat maar leverde minimale inhoud op bij browser-extractie.',
    workflowTag: 'workflow-context',
    confidenceScore: 0.55,
    metadata: { adapter: 'crawl4ai', fallback: true },
  });
  continue;
}
```

---

## State of the Art

| Old Approach                             | Current Approach                                  | When Changed | Impact                                           |
| ---------------------------------------- | ------------------------------------------------- | ------------ | ------------------------------------------------ |
| Guess `/careers`, `/jobs`, `/docs` paths | Discover URLs from `sitemap.xml`                  | Phase 17     | Eliminates 404 evidence stubs from guessed paths |
| Homepage only evidence                   | 3 Google queries per prospect                     | Phase 17     | External mentions surface customer pain signals  |
| No registry data                         | KvK Basisprofiel (SBI, employees, rechtsvorm)     | Phase 17     | Structural business context for Dutch prospects  |
| LinkedIn scraping attempt                | Apollo-derived profile + optional browser attempt | Phase 17     | Reliable baseline + optional bonus               |

**Deprecated/outdated:**

- `defaultResearchUrls()` guessed paths: Demoted to fallback — only used when sitemap is missing/empty.
- Silent skip for minimal Crawl4AI content: Replaced with fallback draft (fixes test discrepancy).

---

## Open Questions

1. **Should EVID-07 (Google search) be gated behind `deepCrawl: true` or always-on?**
   - What we know: 3 extra SerpAPI credits per prospect. Free tier = 250/month total. At 50 prospects, deepCrawl uses 6 credits each = 300 total, exceeding free tier.
   - What's unclear: How many prospects are researched with deepCrawl per month in practice.
   - Recommendation: Gate behind `deepCrawl: true` for Phase 17. Can move to always-on later.

2. **Should sitemap discovery always run or only on deepCrawl?**
   - What we know: Sitemap fetch = 1-2 HTTP requests, very cheap. No API cost.
   - What's unclear: Whether running it on every research run causes rate-limit issues for SMBs with shared hosting.
   - Recommendation: Always run sitemap discovery (even without deepCrawl). It replaces guessed URLs, not adds to them. The benefit outweighs the risk.

3. **How should KvK name matching handle mismatches?**
   - What we know: `prospect.companyName` is Apollo-derived, may differ from KvK registration name ("ACME BV" vs "Acme Business Solutions B.V.").
   - What's unclear: False positive rate for small Dutch companies.
   - Recommendation: Take first `actief: "Ja"` result. Store `kvkNummer` in evidence metadata so mismatch is detectable. If `prospect.domain` domain-name matches `naam` loosely, accept with lower confidence (0.65 instead of 0.82).

4. **Should `REGISTRY` be added to EvidenceSourceType enum?**
   - What we know: KvK data is structurally different from web pages — factual registry data, not behavioral evidence.
   - What's unclear: Whether Phase 18 quality gate needs to distinguish registry evidence from web evidence.
   - Recommendation: Add `REGISTRY` enum value in Phase 17 migration. It's one line in schema.prisma and makes Phase 18 filtering cleaner.

5. **What happens to the existing crawl4ai.ts fallback test?**
   - What we know: Test expects fallback draft, implementation does silent skip.
   - What's unclear: Was this test intentionally testing unimplemented behavior, or was implementation wrong from the start?
   - Recommendation: Fix implementation to match test (create fallback draft). Test was written from Phase 8 research spec which specified fallback behavior.

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection (`lib/research-executor.ts`, `lib/enrichment/serp.ts`, `lib/enrichment/crawl4ai.ts`, `prisma/schema.prisma`, `env.mjs`, `package.json`) — confirmed existing patterns, schema state, installed packages
- [KvK Developer Portal - Testing](https://developers.kvk.nl/documentation/testing) — confirmed test environment, API key header `apikey`, test base URLs
- [KvK Developer Portal - Basisprofiel API](https://developers.kvk.nl/documentation/basisprofiel-api) — confirmed fields: sbiActiviteiten, totaalWerkzamePersonen, rechtsvorm, formeleRegistratiedatum
- [KvK Developer Portal - Zoeken API](https://developers.kvk.nl/documentation/zoeken-api) — confirmed endpoint `api.kvk.nl/api/v2/zoeken`, `naam` parameter, response `kvkNummer`, `actief`
- [KvK Pricing](https://developers.kvk.nl/pricing) — confirmed €6.40/month + €0.02/Basisprofiel query, Zoeken is free
- [SerpAPI Search API](https://serpapi.com/search-api) — confirmed `organic_results` fields: `link`, `snippet`, `title`. `gl=nl` for Netherlands.
- `npm info sitemapper` — confirmed version 4.1.4, MIT, TypeScript, 3 deps (fast-xml-parser, got, p-limit)

### Secondary (MEDIUM confidence)

- [SerpAPI Google Jobs API](https://serpapi.com/google-jobs-api) — confirmed `jobs_results` structure, `apply_options`, `hl`/`gl` params
- [Scrapfly: How to Scrape LinkedIn 2026](https://scrapfly.io/blog/posts/how-to-scrape-linkedin) — confirmed login-wall behavior for unauthenticated access, confirmed company data is "hidden unless logged in" in 2025/2026
- [GitHub sitemapper README](https://github.com/seantomburke/sitemapper) — usage examples, configuration options (timeout, concurrency, retries)

### Tertiary (LOW confidence — needs validation)

- LinkedIn scraping guides (multiple sources) — consistent finding that unauthenticated public page access fails after 1-2 requests per IP, but exact behavior may vary by Railway IP reputation
- KvK name matching accuracy for Dutch SMBs — no empirical data found; assumption that fuzzy name match works for registered business names

---

## Metadata

**Confidence breakdown:**

- EVID-06 (Sitemap): HIGH — sitemapper is proven, integration pattern is clear
- EVID-07 (Google search): HIGH — extends existing SerpAPI integration with `google` engine
- EVID-08 (LinkedIn): LOW for browser extraction, HIGH for Apollo-derived fallback
- EVID-09 (KvK): HIGH — REST API confirmed, test environment available, fields documented

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (KvK API is stable; sitemapper actively maintained; LinkedIn anti-bot policies change frequently — check before implementing EVID-08)
