/**
 * og-logo.ts — Logo extraction from homepage favicon / apple-touch-icon.
 *
 * Priority chain (ICONS FIRST — og:image is a social banner, not a logo):
 *   1. <link rel="apple-touch-icon">       — picks largest sizes= attribute
 *   2. <link rel="icon" type="image/png">  — picks largest sizes= attribute
 *   3. <link rel="icon"> (any type)        — favicon fallback
 *   4. <meta property="og:image">          — LAST RESORT (often social cards)
 *
 * Each candidate URL is HEAD-probed for 200 + non-zero content-length before
 * returning. Falls through to the next candidate on probe failure.
 *
 * No new dependencies. Plain fetch + AbortSignal.timeout. Regex-only HTML parsing.
 */

const TIMEOUT_MS = 5000;

/**
 * Strip protocol and path from a domain input, returning just the bare hostname.
 * "https://www.example.com/path" -> "example.com"
 * Returns null if the input is blank or unparseable.
 */
function normalizeDomain(domain: string): string | null {
  if (!domain) return null;
  const d = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim();
  return d || null;
}

/**
 * Resolve a potentially-relative href against the domain.
 * "/og-image.png" -> "https://example.com/og-image.png"
 * "https://cdn.example.com/og.jpg" -> unchanged
 */
function resolveUrl(href: string, domain: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return `https://${domain}${href.startsWith('/') ? '' : '/'}${href}`;
}

/**
 * GET the homepage HTML. Returns null on any network / timeout / non-2xx error.
 */
async function fetchHomepageHtml(domain: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${domain}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Qualifai/1.0)' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * HEAD-probe a URL to confirm it is alive and non-empty.
 * Returns false on any error, non-2xx status, or zero content-length.
 */
async function headProbe(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Accept any 2xx — some CDNs (Framer) don't send content-length on HEAD
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Parse the homepage HTML and return candidate logo URLs in priority order.
 * All relative URLs are resolved to absolute using the domain.
 */
function extractCandidates(html: string, domain: string): string[] {
  const candidates: string[] = [];

  // Priority 1: apple-touch-icon — clean square icon, best quality
  // Match both: <link rel="apple-touch-icon" href="..."> and <link href="..." rel="apple-touch-icon">
  const applePatterns = [
    /<link[^>]+rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["'][^>]*/gi,
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["'][^>]*/gi,
  ];
  let bestApple: { url: string; size: number } | null = null;
  for (const pattern of applePatterns) {
    let appleMatch: RegExpExecArray | null;
    while ((appleMatch = pattern.exec(html)) !== null) {
      const sizeMatch = /sizes=["'](\d+)x\d+["']/.exec(appleMatch[0]);
      const size = sizeMatch ? parseInt(sizeMatch[1]!, 10) : 1;
      if (!bestApple || size > bestApple.size) {
        bestApple = { url: resolveUrl(appleMatch[1]!, domain), size };
      }
    }
  }
  if (bestApple) candidates.push(bestApple.url);

  // Priority 2: icon type=image/png — pick the one with the largest sizes= attribute
  const iconPngPatterns = [
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+type=["']image\/png["'][^>]*href=["']([^"']+)["'][^>]*/gi,
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["'][^>]+type=["']image\/png["'][^>]*/gi,
  ];
  let bestIconPng: { url: string; size: number } | null = null;
  for (const pattern of iconPngPatterns) {
    let iconPngMatch: RegExpExecArray | null;
    while ((iconPngMatch = pattern.exec(html)) !== null) {
      const sizeMatch = /sizes=["'](\d+)x\d+["']/.exec(iconPngMatch[0]);
      const size = sizeMatch ? parseInt(sizeMatch[1]!, 10) : 1;
      if (!bestIconPng || size > bestIconPng.size) {
        bestIconPng = { url: resolveUrl(iconPngMatch[1]!, domain), size };
      }
    }
  }
  if (bestIconPng) candidates.push(bestIconPng.url);

  // Priority 3: any <link rel="icon"> (including .ico, .svg)
  // Handle both orderings: rel before href AND href before rel
  const iconAnyPatternA =
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["'][^>]*/gi;
  const iconAnyPatternB =
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["'][^>]*/gi;
  for (const pattern of [iconAnyPatternA, iconAnyPatternB]) {
    let iconAnyMatch: RegExpExecArray | null;
    while ((iconAnyMatch = pattern.exec(html)) !== null) {
      const url = resolveUrl(iconAnyMatch[1]!, domain);
      if (!candidates.includes(url)) candidates.push(url);
    }
  }

  // Priority 4 (LAST RESORT): og:image — often a social card banner, not a logo.
  // Only use if no icon candidates were found above.
  if (candidates.length === 0) {
    const ogForward =
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(
        html,
      );
    const ogReverse =
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(
        html,
      );
    const ogMatch = ogForward ?? ogReverse;
    if (ogMatch?.[1]) candidates.push(resolveUrl(ogMatch[1], domain));
  }

  return candidates;
}

/**
 * Fetch the highest-quality logo URL available on the prospect's homepage.
 *
 * Checks og:image → twitter:image → apple-touch-icon (largest) → icon png (largest).
 * Each candidate is HEAD-probed for 200 + non-zero content-length before returning.
 * Falls through to the next candidate on probe failure.
 *
 * Returns null if:
 *   - domain is empty / invalid
 *   - homepage GET fails or times out
 *   - no meta image tags found
 *   - all found candidates fail the HEAD probe
 */
export async function getHighResLogoUrl(
  domain: string,
): Promise<string | null> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;

  const html = await fetchHomepageHtml(normalized);
  if (!html) return null;

  const candidates = extractCandidates(html, normalized);
  for (const url of candidates) {
    if (await headProbe(url)) return url;
  }
  return null;
}
