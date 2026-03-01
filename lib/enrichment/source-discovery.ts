/**
 * source-discovery.ts
 *
 * Pure module for URL discovery merging, deduplication, capping, JS-heavy detection,
 * and provenance labelling.
 *
 * Zero side effects — no DB calls, no network calls, no Prisma imports.
 * Only the stdlib URL class is used for normalisation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UrlProvenance = 'sitemap' | 'serp' | 'default';

export interface DiscoveredUrl {
  url: string;
  provenance: UrlProvenance;
  jsHeavyHint: boolean;
}

export interface SourceSet {
  urls: DiscoveredUrl[];
  discoveredAt: string;
  dedupRemovedCount: number;
  rawCounts: {
    sitemap: { discovered: number; capped: number };
    serp: { discovered: number; capped: number };
    default: { discovered: number; capped: number };
  };
  serpDiscoveredAt?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Per-source URL caps.
 * - sitemap: matches the .slice(0, 25) in sitemap.ts
 * - serp: 5 review + 5 job + 5 google-search-mentions = 15 total
 * - default: defaultResearchUrls() returns 17 paths; capped at 20 to give headroom
 */
export const CAPS = {
  sitemap: 25,
  serp: 15,
  default: 20,
} as const;

// ---------------------------------------------------------------------------
// JS-heavy domain patterns
// ---------------------------------------------------------------------------

const JS_HEAVY_PATTERNS: RegExp[] = [
  /trustpilot\.com/i,
  /indeed\.com/i,
  /glassdoor\./i,
  /linkedin\.com/i,
  /google\.com\/maps/i,
  /maps\.app\.goo/i,
  /werkzoeken\./i,
  /jobbird\./i,
  /monsterboard\./i,
  /webflow\.io/i,
  /framer\.website/i,
  /framer\.com/i,
  // Hash-route SPAs
  /#\//,
];

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Normalise a URL for deduplication purposes.
 *
 * Strips scheme, www prefix, and trailing slash. Lowercases hostname + pathname.
 * Falls back to raw string normalisation for malformed URLs.
 */
export function normalizeUrlForDedup(raw: string): string {
  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    const search = parsed.search.toLowerCase();
    return `${hostname}${pathname}${search}`;
  } catch {
    // Fallback: lowercase + trim + strip trailing slash
    return raw.toLowerCase().trim().replace(/\/+$/, '');
  }
}

/**
 * Detect whether a URL points to a JS-heavy page that requires browser rendering.
 *
 * Used to set jsHeavyHint=true so the research executor can route these URLs
 * to the browser (DynamicFetcher) instead of stealth-fetch (StealthyFetcher).
 */
export function detectJsHeavy(url: string): boolean {
  return JS_HEAVY_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Build a SourceSet by merging sitemap, SERP, and default URL lists.
 *
 * Algorithm:
 * 1. Cap each source list to its CAPS limit (slice)
 * 2. Merge with provenance tags in order: sitemap → serp → default
 * 3. Dedup using normalizeUrlForDedup — first-wins (sitemap beats serp beats default)
 * 4. Apply detectJsHeavy to each URL
 * 5. Track dedupRemovedCount and rawCounts
 */
export function buildSourceSet(input: {
  sitemapUrls: string[];
  serpUrls: string[];
  defaultUrls: string[];
  serpDiscoveredAt?: string;
}): SourceSet {
  const { sitemapUrls, serpUrls, defaultUrls, serpDiscoveredAt } = input;

  // --- Step 1: cap each source ---
  const cappedSitemap = sitemapUrls.slice(0, CAPS.sitemap);
  const cappedSerp = serpUrls.slice(0, CAPS.serp);
  const cappedDefault = defaultUrls.slice(0, CAPS.default);

  // --- Step 2 & 3: merge with dedup ---
  const seen = new Set<string>();
  const urls: DiscoveredUrl[] = [];
  let dedupRemovedCount = 0;

  function addUrls(list: string[], provenance: UrlProvenance): void {
    for (const url of list) {
      const key = normalizeUrlForDedup(url);
      if (seen.has(key)) {
        dedupRemovedCount++;
        continue;
      }
      seen.add(key);
      urls.push({
        url,
        provenance,
        jsHeavyHint: detectJsHeavy(url),
      });
    }
  }

  addUrls(cappedSitemap, 'sitemap');
  addUrls(cappedSerp, 'serp');
  addUrls(cappedDefault, 'default');

  // --- Step 5: rawCounts ---
  const rawCounts = {
    sitemap: { discovered: sitemapUrls.length, capped: cappedSitemap.length },
    serp: { discovered: serpUrls.length, capped: cappedSerp.length },
    default: { discovered: defaultUrls.length, capped: cappedDefault.length },
  };

  return {
    urls,
    discoveredAt: new Date().toISOString(),
    dedupRemovedCount,
    rawCounts,
    ...(serpDiscoveredAt ? { serpDiscoveredAt } : {}),
  };
}

/**
 * Default research URLs for a domain.
 *
 * Moved verbatim from research-executor.ts. Covers 17 Dutch + English paths
 * likely to contain workflow / process information.
 */
export function defaultResearchUrls(domain: string): string[] {
  const base = `https://${domain}`;
  return [
    `${base}`,
    // Dutch paths (primary — most prospects are NL)
    `${base}/over-ons`,
    `${base}/diensten`,
    `${base}/vacatures`,
    `${base}/werken-bij`,
    `${base}/projecten`,
    // Dutch business process pages — high-value for workflow analysis
    `${base}/werkwijze`,
    `${base}/aanpak`,
    `${base}/wat-we-doen`,
    `${base}/ons-proces`,
    `${base}/zo-werken-wij`,
    `${base}/tarieven`,
    `${base}/offerte`,
    `${base}/offerte-aanvragen`,
    `${base}/contact`,
    // English fallbacks
    `${base}/about`,
    `${base}/services`,
    `${base}/careers`,
    `${base}/jobs`,
  ];
}

/**
 * Extract a SourceSet from an inputSnapshot JSON blob.
 *
 * Returns null if not present or malformed. Used by both the executor and
 * the tRPC mutation to read persisted source sets.
 */
export function extractSourceSet(snapshot: unknown): SourceSet | null {
  try {
    const payload = snapshot as { sourceSet?: unknown } | null;
    if (!payload?.sourceSet) return null;

    const ss = payload.sourceSet as Partial<SourceSet>;
    if (!Array.isArray(ss.urls) || !ss.discoveredAt || !ss.rawCounts) {
      return null;
    }

    return payload.sourceSet as SourceSet;
  } catch {
    return null;
  }
}
