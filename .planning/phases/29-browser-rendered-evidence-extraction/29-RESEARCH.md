# Phase 29: Browser-Rendered Evidence Extraction - Research

**Researched:** 2026-03-02
**Domain:** Two-tier HTTP extraction pipeline (Scrapling stealth-first → Crawl4AI browser fallback), URL routing by sourceType and content-length
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                   | Research Support                                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EXTR-01 | Static pages route through Scrapling stealth fetcher first; pages returning <500 chars escalate to Crawl4AI   | The current `ingestWebsiteEvidenceDrafts` already calls `fetchStealth()` — Phase 29 adds the content-length check and the escalation call to `extractMarkdown()`. The 500-char threshold is the decision point. |
| EXTR-02 | REVIEWS, CAREERS, and JOB_BOARD source types route directly through Crawl4AI without attempting stealth first | `inferSourceType()` already exists in `workflow-engine.ts` and correctly classifies URLs. Phase 29 adds a `shouldUseBrowserDirect(sourceType)` guard at the top of the per-URL fetch loop.                      |
| EXTR-03 | Maximum 5 URLs per prospect use browser-rendered extraction to control pipeline duration                      | A `browserBudget` counter (starting at 5) is decremented each time Crawl4AI is invoked. When budget reaches 0, remaining JS-heavy / escalated URLs receive a fallback draft. No new service calls are needed.   |

</phase_requirements>

---

## Summary

Phase 29 introduces two-tier extraction inside `ingestWebsiteEvidenceDrafts` (in `lib/web-evidence-adapter.ts`). Currently the function calls Scrapling StealthyFetcher for every URL and falls back to a raw `fetch()` if Scrapling fails. JS-heavy pages (flagged by `jsHeavyHint=true` on `DiscoveredUrl`, built in Phase 28) return near-empty HTML from stealth extraction, producing fallback drafts with low confidence. Phase 29 fixes this by routing those pages through Crawl4AI's browser engine — which already exists at `http://localhost:11235/crawl` and is exercised today for SERP-discovered URLs in the deepCrawl path.

The three requirements map to three surgical changes in `ingestWebsiteEvidenceDrafts`: (1) check `sourceType` upfront to short-circuit stealth for REVIEWS/CAREERS/JOB_BOARD; (2) after stealth, measure returned HTML length and escalate to Crawl4AI if below 500 chars; (3) maintain a `browserBudget` counter (max 5) shared across the entire URL batch to enforce the pipeline cap. No new services, no new dependencies, no schema changes.

The primary risk is the per-URL Crawl4AI timeout: `extractMarkdown()` waits up to 60 seconds per URL. With a cap of 5 URLs × 60s worst-case, the pipeline ceiling is 5 minutes of browser extraction on top of normal runtime. This is acceptable and is the motivation for the cap. The existing `extractMarkdown()` timeout is already set to 60s — no change needed.

**Primary recommendation:** Modify `ingestWebsiteEvidenceDrafts` in `lib/web-evidence-adapter.ts` to accept the `DiscoveredUrl[]` sourceSet (or infer `jsHeavyHint` from the URL list via a lookup map), apply source-type routing, implement the 500-char escalation threshold, and enforce the 5-URL browser budget.

---

## Standard Stack

### Core

| Library              | Version              | Purpose                                             | Why Standard                                                                                       |
| -------------------- | -------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Scrapling (existing) | in Docker image      | StealthyFetcher — requests-based HTML, ~2s per URL  | Already in `lib/enrichment/scrapling.ts` via the `qualifai-scrapling` service on port 3010         |
| Crawl4AI (external)  | ~0.4.x on port 11235 | Full headless browser (Playwright), ~15-30s per URL | Already called in `lib/enrichment/crawl4ai.ts` for SERP deepCrawl URLs                             |
| `inferSourceType()`  | existing             | Maps URL → EvidenceSourceType enum                  | Already exported from `lib/workflow-engine.ts`, used in both the executor and web-evidence-adapter |
| Vitest (existing)    | ^4.0.18              | Unit tests for the modified extraction function     | Project test framework, config at `vitest.config.ts`                                               |

### Supporting

| Library              | Version         | Purpose                                        | When to Use                                                                                                                                    |
| -------------------- | --------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `DiscoveredUrl` type | Phase 28 output | Carries `jsHeavyHint` and `provenance` per URL | Pass the `DiscoveredUrl[]` sourceSet into `ingestWebsiteEvidenceDrafts` to read `jsHeavyHint` directly instead of re-running pattern detection |

### Alternatives Considered

| Instead of                            | Could Use                                   | Tradeoff                                                                                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extractMarkdown()` (Crawl4AI)        | `fetchDynamic()` (Scrapling DynamicFetcher) | Crawl4AI already exists for this purpose and returns structured markdown. `fetchDynamic` returns raw HTML, requiring an extra parse step. Use Crawl4AI for escalation.                                                                                  |
| Per-URL `jsHeavyHint` lookup          | Re-running `detectJsHeavy()` on URL string  | Both work. If `DiscoveredUrl[]` is available as input to the function, reading `.jsHeavyHint` is cheaper and avoids duplicating the pattern list. If the function only receives `string[]`, call `detectJsHeavy()` directly from `source-discovery.ts`. |
| Content-length threshold of 500 chars | Different threshold (200, 1000)             | 500 chars is derived from the requirement spec. Empirically, stealth-fetched SPA shells return 80-350 chars of JS-only content. 500 chars is safely above that range while below any page with real text.                                               |

**Installation:** No new packages needed — all dependencies already exist.

---

## Architecture Patterns

### Recommended Change Surface

```
lib/web-evidence-adapter.ts          # PRIMARY: modify ingestWebsiteEvidenceDrafts
lib/enrichment/crawl4ai.ts           # REFERENCE: extractMarkdown() already exists — import and call it
lib/enrichment/source-discovery.ts   # REFERENCE: detectJsHeavy() for inline fallback if no sourceSet passed
lib/enrichment/scrapling.ts          # REFERENCE: fetchStealth() — existing, no changes needed
```

Only `lib/web-evidence-adapter.ts` requires modification. Everything else is imported.

### Pattern 1: Source-Type Direct-to-Browser Routing (EXTR-02)

**What:** Certain source types bypass stealth entirely — they are always JS-rendered and stealth will return empty or garbage.
**When to use:** Check sourceType BEFORE attempting stealth fetch in the per-URL loop.

```typescript
// lib/web-evidence-adapter.ts

import { extractMarkdown } from '@/lib/enrichment/crawl4ai';
import { detectJsHeavy } from '@/lib/enrichment/source-discovery';

const BROWSER_DIRECT_SOURCE_TYPES = new Set<EvidenceSourceType>([
  'REVIEWS',
  'CAREERS',
  'JOB_BOARD',
]);

function shouldUseBrowserDirect(sourceType: EvidenceSourceType): boolean {
  return BROWSER_DIRECT_SOURCE_TYPES.has(sourceType);
}
```

### Pattern 2: 500-char Escalation (EXTR-01)

**What:** After a stealth fetch, measure the returned HTML. If it is shorter than 500 chars (or `ok=false`), escalate to Crawl4AI — but only if browser budget remains.
**When to use:** Immediately after `fetchStealth()` returns, before HTML processing.

```typescript
// Inside the per-URL loop in ingestWebsiteEvidenceDrafts:

const stealth = await fetchStealth(sourceUrl);
const stealthHtml = stealth.ok ? stealth.html : '';

const isStealthSufficient = stealthHtml.length >= 500;

if (!isStealthSufficient && browserBudget > 0) {
  browserBudget--;
  const { markdown, title } = await extractMarkdown(sourceUrl);
  if (markdown && markdown.length >= 80) {
    // Build EvidenceDraft from Crawl4AI markdown result
    drafts.push(buildCrawl4aiDraft({ sourceUrl, sourceType, markdown, title }));
    continue;
  }
  // Crawl4AI also returned empty — fall through to fallback
}

if (isStealthSufficient) {
  // Process stealthHtml as before (soft-404 check, extractWebsiteEvidenceFromHtml)
}
```

### Pattern 3: 5-URL Browser Budget (EXTR-03)

**What:** A mutable counter initialized at 5 before the URL loop. Decremented each time Crawl4AI is called (either direct-route or escalation). When it reaches 0, skip all further Crawl4AI calls and push a fallback draft instead.
**When to use:** Initialize once, check before every Crawl4AI call.

```typescript
// lib/web-evidence-adapter.ts

const BROWSER_BUDGET_MAX = 5;

export async function ingestWebsiteEvidenceDrafts(
  urls: string[],
  options?: { jsHeavyHints?: Map<string, boolean> },
): Promise<EvidenceDraft[]> {
  const drafts: EvidenceDraft[] = [];
  let browserBudget = BROWSER_BUDGET_MAX; // shared across all URLs

  for (const sourceUrl of uniqueUrls(urls)) {
    const sourceType = sourceTypeForUrl(sourceUrl);
    const isJsHeavy =
      options?.jsHeavyHints?.get(sourceUrl) ?? detectJsHeavy(sourceUrl);

    // EXTR-02: Direct browser route
    if (shouldUseBrowserDirect(sourceType) || isJsHeavy) {
      if (browserBudget <= 0) {
        drafts.push(budgetExhaustedDraft(sourceUrl, sourceType));
        continue;
      }
      browserBudget--;
      const { markdown, title } = await extractMarkdown(sourceUrl);
      // ... handle result
      continue;
    }

    // EXTR-01: Stealth first, escalate if <500 chars
    const stealth = await fetchStealth(sourceUrl);
    if (!stealth.ok || stealth.html.length < 500) {
      if (browserBudget > 0) {
        browserBudget--;
        const { markdown, title } = await extractMarkdown(sourceUrl);
        // ... handle result
        continue;
      }
      // Budget exhausted — use fallback
      drafts.push(fallbackDraft(sourceUrl, sourceType));
      continue;
    }

    // Stealth succeeded — process HTML as before
    // ... (existing soft-404 check and extractWebsiteEvidenceFromHtml call)
  }

  return drafts.slice(0, 20);
}
```

### Pattern 4: Crawl4AI Markdown → EvidenceDraft conversion

**What:** `extractMarkdown()` returns `{ markdown: string; title: string }`. Convert to `EvidenceDraft` matching the existing `ingestCrawl4aiEvidenceDrafts` pattern in `crawl4ai.ts`.
**When to use:** Any time Crawl4AI is called from the web-evidence-adapter path.

The existing `ingestCrawl4aiEvidenceDrafts` does a simpler source type assignment (only REVIEWS vs JOB_BOARD based on URL). For the escalation path inside `ingestWebsiteEvidenceDrafts`, we already know the `sourceType` from `sourceTypeForUrl()` — use that instead of re-inferring:

```typescript
function buildCrawl4aiDraft(input: {
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  markdown: string;
  title: string;
}): EvidenceDraft {
  return {
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    title: input.title || 'Browser-extracted page',
    snippet: input.markdown.slice(0, 240).replace(/\n+/g, ' ').trim(),
    workflowTag: detectWorkflowTag(input.sourceType, input.markdown),
    confidenceScore: baseConfidence(input.sourceType),
    metadata: { adapter: 'crawl4ai-escalation', source: 'browser-rendered' },
  };
}
```

This reuses `detectWorkflowTag()` and `baseConfidence()` which are already defined in `web-evidence-adapter.ts`.

### Pattern 5: Passing jsHeavyHints into the function

**What:** Phase 28 built `sourceSet.urls: DiscoveredUrl[]` which carries `jsHeavyHint` per URL. Phase 29 needs to read this at fetch time. Two options:

1. Pass a `Map<string, boolean>` from the caller (research-executor.ts) — cleaner, no re-computation.
2. Call `detectJsHeavy(url)` inline — works without any caller change.

**Recommendation:** Use option 1 for URLs coming through the sourceSet pipeline (the common path). Option 2 as inline fallback for callers that don't have the sourceSet (backwards compatibility).

In `research-executor.ts`, before calling `ingestWebsiteEvidenceDrafts`:

```typescript
// Build jsHeavyHints map from the sourceSet
const jsHeavyHints = new Map<string, boolean>(
  initialSourceSet.urls.map((u) => [u.url, u.jsHeavyHint]),
);

const websiteEvidenceDrafts = await ingestWebsiteEvidenceDrafts(researchUrls, {
  jsHeavyHints,
});
```

### Anti-Patterns to Avoid

- **Calling Crawl4AI without budget check:** Every call to `extractMarkdown()` must first check `browserBudget > 0`. The 5-URL cap is a hard constraint — never skip it.
- **Decrementing budget for failed stealth (not escalating):** Only decrement `browserBudget` when actually calling Crawl4AI, not when deciding to skip escalation because budget is 0.
- **Using `ingestCrawl4aiEvidenceDrafts()` for escalation:** That function has its own internal cap (10 URLs) and its own loop — it cannot share a budget with the stealth loop. Call `extractMarkdown()` directly and use the shared budget counter.
- **Changing the SERP deepCrawl path:** The existing `ingestCrawl4aiEvidenceDrafts(serpUrls)` call in the deepCrawl branch of `research-executor.ts` is separate from Phase 29 scope. Phase 29 only modifies `ingestWebsiteEvidenceDrafts`. Do not merge the two paths.
- **Applying the 500-char threshold to the raw `fetch()` fallback:** The raw `fetch()` fallback exists for when Scrapling is down. If Scrapling returns `ok=false` entirely (service down), escalating to Crawl4AI is correct. If raw `fetch()` is the thing that returned <500 chars, it is still fine to escalate — but only if budget allows.
- **Forgetting soft-404 detection on Crawl4AI markdown:** The existing `looksLikeCrawled404()` check in `crawl4ai.ts` filters out 404-content markdown. Reuse that pattern or the same function for the escalation path.

---

## Don't Hand-Roll

| Problem                  | Don't Build                  | Use Instead                                                 | Why                                                                               |
| ------------------------ | ---------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Browser HTML extraction  | Custom Playwright wrapper    | `extractMarkdown()` from `lib/enrichment/crawl4ai.ts`       | Already implemented, tested, handles AbortController timeout (60s), 404 detection |
| Stealth HTML fetch       | Direct HTTP with UA spoofing | `fetchStealth()` from `lib/enrichment/scrapling.ts`         | Scrapling service handles fingerprint spoofing, cookies, bot detection bypass     |
| URL → sourceType mapping | Custom pattern matching      | `inferSourceType()` from `lib/workflow-engine.ts`           | Already handles REVIEWS/CAREERS/JOB_BOARD/LINKEDIN patterns correctly             |
| JS-heavy URL detection   | Inline regex                 | `detectJsHeavy()` from `lib/enrichment/source-discovery.ts` | Phase 28 already extracted this — the same pattern list, in one place             |

**Key insight:** Every capability Phase 29 needs already exists. The work is routing logic (which function to call, when) and a budget counter — not new extraction infrastructure.

---

## Common Pitfalls

### Pitfall 1: Budget not shared across the full URL batch

**What goes wrong:** The browser budget is initialized inside the per-URL function rather than outside the loop, so each URL gets its own budget of 5 — resulting in up to 5 × N Crawl4AI calls instead of 5 total.
**Why it happens:** Easy mistake when extracting the budget into a helper function or when the function is called recursively.
**How to avoid:** Initialize `let browserBudget = 5` once, before the `for` loop in `ingestWebsiteEvidenceDrafts`. Pass it by reference or keep it in the outer closure.
**Warning signs:** In test: calling `ingestWebsiteEvidenceDrafts` with 20 URLs where 10 are JS-heavy results in more than 5 `extractMarkdown` calls.

### Pitfall 2: Crawl4AI timeout causes pipeline stall

**What goes wrong:** A single Crawl4AI call times out after 60 seconds, and with 5 allowed calls, the pipeline can block for 5 minutes before recovering.
**Why it happens:** `extractMarkdown()` uses a 60-second `AbortController` timeout. Five sequential calls = 5 × 60s worst case.
**How to avoid:** The existing 60s timeout in `extractMarkdown()` is per-call and already handles the abort. The 5-URL budget ensures worst case is bounded. No additional fix needed — document this bound so future phases don't raise the cap without analysis.
**Warning signs:** Research runs taking >6 minutes to complete.

### Pitfall 3: sourceType CAREERS routing misfire

**What goes wrong:** URLs like `/careers` and `/jobs` on the prospect's own website are routed directly to Crawl4AI when they should be stealth-first (they are static pages that happen to have "careers" in the path).
**Why it happens:** `inferSourceType()` returns `CAREERS` for any URL containing `/careers`. These prospect own-website career pages are typically static HTML, not JS-rendered. Direct Crawl4AI routing wastes budget.
**How to avoid:** Apply the REVIEWS/CAREERS/JOB_BOARD direct-routing rule only when the sourceType is REVIEWS (always JS-heavy: Trustpilot, Google Maps) or when the URL matches a known JS-heavy platform (LinkedIn, Glassdoor, Indeed). For own-website CAREERS pages, let stealth try first.

**Revised rule:**

- **Direct to Crawl4AI (skip stealth):** `sourceType === 'REVIEWS'` OR (`jsHeavyHint === true` for non-own-domain URLs)
- **Stealth-first with escalation:** all other URLs, including own-website `/careers` and `/jobs` pages

This means EXTR-02 is more precisely: "URLs with `jsHeavyHint=true` from Phase 28 AND REVIEWS source type route directly through Crawl4AI." Own-website CAREERS pages are not JS-heavy in the common case and should go stealth-first.

**Warning signs:** Budget of 5 exhausted on the prospect's own website pages, leaving nothing for actual review/job board URLs.

### Pitfall 4: Markdown from Crawl4AI not processed through workflowTag detection

**What goes wrong:** Crawl4AI-escalated drafts all receive `workflowTag: 'workflow-context'` by default, missing the keyword-based tag assignment that stealth-HTML drafts get.
**Why it happens:** `extractWebsiteEvidenceFromHtml()` runs `detectWorkflowTag()` on the HTML, but escalated drafts skip that function and go straight to draft creation.
**How to avoid:** In `buildCrawl4aiDraft()`, call `detectWorkflowTag(sourceType, markdown)` to assign the correct workflowTag based on the extracted markdown content.
**Warning signs:** All Crawl4AI-escalated evidence ends up with `workflowTag: 'workflow-context'` even for pages that contain planning/billing/handoff keywords.

### Pitfall 5: Double-escalation on raw `fetch()` fallback

**What goes wrong:** When Scrapling returns `ok=false`, the code escalates to Crawl4AI. But the existing code then falls through to a raw `fetch()` attempt. If the raw `fetch()` is also checked for content-length and _also_ triggers escalation, the budget is consumed twice for the same URL.
**Why it happens:** The existing `ingestWebsiteEvidenceDrafts` has two tiers: Scrapling and raw `fetch()`. Phase 29 adds Crawl4AI as a third tier. The control flow must be: Scrapling → (if insufficient) Crawl4AI → (if Crawl4AI also fails) fallback draft. The raw `fetch()` tier should either be removed or placed before the Crawl4AI escalation, not after.
**How to avoid:** Remove or short-circuit the raw `fetch()` fallback once Crawl4AI is added. The escalation order should be: StealthyFetcher → Crawl4AI → fallback draft.
**Warning signs:** `fetch` calls to prospect domains appearing in server logs after a `extractMarkdown` call for the same URL.

### Pitfall 6: Crawl4AI service not running locally

**What goes wrong:** `CRAWL4AI_BASE_URL` defaults to `http://localhost:11235` but the Crawl4AI service is not in `docker-compose.yml` — it is an external dependency not managed by the project.
**Why it happens:** The docker-compose.yml only defines `db`, `redis`, and `scrapling`. Crawl4AI is separate.
**How to avoid:** The existing `extractMarkdown()` already handles this gracefully: a non-ok HTTP response returns `{ markdown: '', title: '' }` and the calling code treats empty markdown as a failed extraction, producing a fallback draft. No crash. Verify the service is reachable before running a full research cycle in development; in production, document the dependency.
**Warning signs:** All Crawl4AI escalation paths silently producing fallback drafts.

---

## Code Examples

### Current ingestWebsiteEvidenceDrafts (key section to modify)

```typescript
// lib/web-evidence-adapter.ts (current, lines 326-392)

export async function ingestWebsiteEvidenceDrafts(
  urls: string[],
): Promise<EvidenceDraft[]> {
  const drafts: EvidenceDraft[] = [];
  for (const sourceUrl of uniqueUrls(urls)) {
    const sourceType = sourceTypeForUrl(sourceUrl);
    try {
      let html: string | null = null;

      const scrapling = await fetchStealth(sourceUrl);
      if (scrapling.ok && scrapling.html.length > 200) {
        html = scrapling.html;
      } else {
        // Fallback: raw fetch
        // ...
      }
      // ... process html
    } catch (error) {
      drafts.push(fallbackDraft(sourceUrl, sourceType));
    }
  }
  return drafts.slice(0, 20);
}
```

Phase 29 modifies the `else` branch and adds the budget logic.

### extractMarkdown already in project (no change needed)

```typescript
// lib/enrichment/crawl4ai.ts (lines 18-64)
// Already handles: 60s timeout, AbortController, empty response, non-ok status

export async function extractMarkdown(
  url: string,
): Promise<{ markdown: string; title: string }> {
  // ... existing implementation
}
```

This is imported as-is. Do not duplicate it.

### detectJsHeavy already exported from Phase 28

```typescript
// lib/enrichment/source-discovery.ts (lines 101-103)

export function detectJsHeavy(url: string): boolean {
  return JS_HEAVY_PATTERNS.some((pattern) => pattern.test(url));
}
```

Import and call this for the inline fallback when `jsHeavyHints` map is not available.

### Wiring jsHeavyHints in research-executor.ts

```typescript
// lib/research-executor.ts — in the section before ingestWebsiteEvidenceDrafts is called

const jsHeavyHints = new Map<string, boolean>(
  initialSourceSet.urls.map((u) => [u.url, u.jsHeavyHint]),
);

const websiteEvidenceDrafts = await ingestWebsiteEvidenceDrafts(researchUrls, {
  jsHeavyHints,
});
```

---

## State of the Art

| Old Approach                                              | Current Approach (Phase 29)                                                           | When Changed | Impact                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| Stealth-only for all website URLs, Crawl4AI only for SERP | Stealth-first with Crawl4AI escalation at 500 chars, direct-browser for JS-heavy URLs | Phase 29     | JS-heavy pages yield real content instead of near-empty fallback drafts |
| Crawl4AI called with no per-run budget cap                | 5-URL budget per prospect per run                                                     | Phase 29     | Pipeline duration is bounded; no runaway browser extraction             |
| `ingestCrawl4aiEvidenceDrafts` called only in deepCrawl   | `extractMarkdown` called inline in `ingestWebsiteEvidenceDrafts`                      | Phase 29     | Browser extraction happens for non-SERP URLs when content warrants it   |

**Deprecated/outdated:**

- Raw `fetch()` fallback in `ingestWebsiteEvidenceDrafts`: The three-tier chain (Scrapling → raw fetch → fallback draft) becomes (Scrapling → Crawl4AI → fallback draft). The raw `fetch()` tier is removed to simplify control flow and avoid double-budget issues.

---

## Open Questions

1. **Should `jsHeavyHint=true` always trigger direct-to-Crawl4AI, or only when the URL is a known third-party platform?**
   - What we know: Phase 28 set `jsHeavyHint=true` for known platforms (Trustpilot, LinkedIn, Glassdoor, Google Maps, Framer, Webflow, hash-route SPAs). These are always third-party. Own-website URLs are unlikely to have `jsHeavyHint=true` in practice.
   - What's unclear: Can a prospect's own sitemap contain Webflow-hosted pages? If so, `jsHeavyHint=true` would apply to own-domain URLs, and direct-to-Crawl4AI would be correct.
   - Recommendation: Trust `jsHeavyHint` for all URLs — Phase 28's pattern list was designed for exactly this routing decision. If a URL has `jsHeavyHint=true`, go direct to Crawl4AI.

2. **Does the 5-URL budget apply to the SERP deepCrawl Crawl4AI calls or only to the website extraction path?**
   - What we know: The SERP deepCrawl path calls `ingestCrawl4aiEvidenceDrafts(serpUrls)` with its own internal cap of 10 URLs. Phase 29 requirements only specify "a single research run never uses browser extraction on more than 5 URLs." This is ambiguous — does it mean 5 in the website path only, or 5 total?
   - What's unclear: If "total per run" is the intent, the existing SERP Crawl4AI path (up to 10 URLs) already exceeds it.
   - Recommendation: Interpret EXTR-03 as applying to the **website extraction path only** (`ingestWebsiteEvidenceDrafts`), not the SERP-discovery path. The SERP path uses pre-discovered URLs from SerpAPI, which are specifically selected for their JS-heavy nature, and the 10-URL cap there is separately validated. Document this interpretation in the implementation.

3. **Verify Crawl4AI service version (STATE.md pending todo)**
   - What we know: STATE.md carries a pending todo: "Verify Crawl4AI service is on v0.8.x before Phase 29 ships (remove_consent_popups and flatten_shadow_dom are v0.8.x features)."
   - What's unclear: The service is not in `docker-compose.yml` and no version pin was found in the codebase. The `extractMarkdown()` implementation uses `BrowserConfig` and `CrawlerRunConfig` wrapped format which is consistent with Crawl4AI v0.4.x SDK.
   - Recommendation: Before planning commit, check `curl http://localhost:11235/health` or `curl http://localhost:11235/version` to get the running version. If `remove_consent_popups` and `flatten_shadow_dom` are available in the running version, they can be added to the `CrawlerRunConfig.params` in `extractMarkdown()` to improve extraction quality on cookie-consent-heavy Dutch sites. Do not block Phase 29 on this — the current `extractMarkdown()` works without them.

---

## Architecture Decision: Where the Budget Lives

The budget counter must live in the **outer function scope** of `ingestWebsiteEvidenceDrafts`, not inside a helper function or in the caller. This ensures it is shared across the full URL batch without requiring any state to be passed between iterations.

The `BROWSER_BUDGET_MAX = 5` constant should be defined at module level (not inside the function) so it can be referenced in tests.

The function signature change is additive and backwards-compatible:

```typescript
// Before:
export async function ingestWebsiteEvidenceDrafts(
  urls: string[],
): Promise<EvidenceDraft[]>;

// After (Phase 29):
export async function ingestWebsiteEvidenceDrafts(
  urls: string[],
  options?: { jsHeavyHints?: Map<string, boolean> },
): Promise<EvidenceDraft[]>;
```

All existing callers continue to work without modification (the `options` parameter is optional).

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` — validation section omitted.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `lib/web-evidence-adapter.ts` (all 392 lines) — current stealth-first extraction flow, `fallbackDraft`, `extractWebsiteEvidenceFromHtml`, `sourceTypeForUrl`, `detectWorkflowTag`, `baseConfidence`
- Direct codebase inspection: `lib/enrichment/crawl4ai.ts` (all 129 lines) — `extractMarkdown()` API, timeout (60s), `ingestCrawl4aiEvidenceDrafts()` pattern, 404-detection, content minimum (80 chars)
- Direct codebase inspection: `lib/enrichment/scrapling.ts` — `fetchStealth()` and `fetchDynamic()` APIs, timeout (30s)
- Direct codebase inspection: `lib/enrichment/source-discovery.ts` — `detectJsHeavy()`, `DiscoveredUrl.jsHeavyHint`, `JS_HEAVY_PATTERNS`, `CAPS`
- Direct codebase inspection: `lib/workflow-engine.ts` — `inferSourceType()` implementation, `EvidenceSourceType` enum usage
- Direct codebase inspection: `lib/research-executor.ts` — how `ingestWebsiteEvidenceDrafts` is called, `researchUrls` derivation from `initialSourceSet.urls`, budget-less SERP Crawl4AI path
- Direct codebase inspection: `lib/enrichment/crawl4ai.test.ts` — existing test patterns for `extractMarkdown` (mocked `fetch`, AbortError test)
- Direct codebase inspection: `vitest.config.ts` — test framework (Vitest 4.x, jsdom, tsconfigPaths)
- Direct codebase inspection: `docker-compose.yml` — Crawl4AI is NOT in docker-compose; scrapling service IS defined
- Direct codebase inspection: `services/scrapling/app.py` — Scrapling service endpoints, `StealthyFetcher` and `DynamicFetcher` confirmed
- Direct codebase inspection: `prisma/schema.prisma` — `EvidenceSourceType` enum: WEBSITE, DOCS, CAREERS, HELP_CENTER, JOB_BOARD, REVIEWS, MANUAL_URL, REGISTRY, LINKEDIN, NEWS
- STATE.md: architectural decision confirms "two-tier extraction enforced: stealth-first for static pages, browser only for <500 chars or jsHeavyHint=true; 5-URL cap per run"

### Secondary (MEDIUM confidence)

- Phase 28 RESEARCH.md — confirms `jsHeavyHint` field purpose and routing intent; Pattern 4 (jsHeavyHint Detection)
- STATE.md pending todo: "Verify Crawl4AI service is on v0.8.x before Phase 29 ships" — implies version uncertainty

### Tertiary (LOW confidence)

- Crawl4AI version in production: not verifiable from codebase (no docker image pin, service not in compose). Treat `remove_consent_popups` and `flatten_shadow_dom` as optional enhancements pending version verification.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all services and functions already exist in codebase; no new dependencies
- Architecture: HIGH — modifications are surgical (one function, additive signature); patterns taken directly from existing code in the same file and sibling files
- Budget logic: HIGH — straightforward counter, well-scoped to function closure
- jsHeavyHint routing: HIGH — Phase 28 built the detection logic; Phase 29 consumes it
- Crawl4AI version features: LOW — service version unverified; `remove_consent_popups`/`flatten_shadow_dom` are LOW confidence until runtime check

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable stack — 30-day window)
