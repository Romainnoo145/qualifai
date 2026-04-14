/**
 * og-logo.ts — High-resolution logo extraction from homepage og:image / apple-touch-icon.
 *
 * Priority chain:
 *   1. <meta property="og:image">          — first match (both attribute orderings)
 *   2. <meta name="twitter:image">         — fallback (both orderings)
 *   3. <link rel="apple-touch-icon">       — picks largest sizes= attribute
 *   4. <link rel="icon" type="image/png">  — picks largest sizes= attribute
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
    const cl = Number(res.headers.get('content-length') ?? '0');
    return res.ok && cl > 0;
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

  // Priority 1: og:image — handle both attribute orderings
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

  // Priority 2: twitter:image — handle both attribute orderings
  const twForward =
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(
      html,
    );
  const twReverse =
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i.exec(
      html,
    );
  const twMatch = twForward ?? twReverse;
  if (twMatch?.[1]) candidates.push(resolveUrl(twMatch[1], domain));

  // Priority 3: apple-touch-icon — pick the one with the largest sizes= attribute
  const applePattern =
    /<link[^>]+rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["'][^>]*/gi;
  let bestApple: { url: string; size: number } | null = null;
  let appleMatch: RegExpExecArray | null;
  while ((appleMatch = applePattern.exec(html)) !== null) {
    const sizeMatch = /sizes=["'](\d+)x\d+["']/.exec(appleMatch[0]);
    const size = sizeMatch ? parseInt(sizeMatch[1]!, 10) : 1;
    if (!bestApple || size > bestApple.size) {
      bestApple = { url: resolveUrl(appleMatch[1]!, domain), size };
    }
  }
  if (bestApple) candidates.push(bestApple.url);

  // Priority 4: icon type=image/png — pick the one with the largest sizes= attribute
  const iconPattern =
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+type=["']image\/png["'][^>]*href=["']([^"']+)["'][^>]*/gi;
  let bestIcon: { url: string; size: number } | null = null;
  let iconMatch: RegExpExecArray | null;
  while ((iconMatch = iconPattern.exec(html)) !== null) {
    const sizeMatch = /sizes=["'](\d+)x\d+["']/.exec(iconMatch[0]);
    const size = sizeMatch ? parseInt(sizeMatch[1]!, 10) : 1;
    if (!bestIcon || size > bestIcon.size) {
      bestIcon = { url: resolveUrl(iconMatch[1]!, domain), size };
    }
  }
  if (bestIcon) candidates.push(bestIcon.url);

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
