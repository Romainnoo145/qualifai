/**
 * Favicon URL helper for prospects without Apollo logos.
 *
 * Phase 61.1 POLISH-04: Manual prospects (and Apollo-orphaned prospects
 * like Marfa) need a logo. DuckDuckGo's ip3 service scrapes the site's
 * own favicon directly and works for small Dutch SMBs; Google's s2 only
 * covers what's in its crawl index and returns a generic globe fallback
 * for misses, so it is the secondary probe.
 *
 * Usage:
 *   const url = await getFaviconUrl('marfa.nl');
 *   // -> 'https://icons.duckduckgo.com/ip3/marfa.nl.ico'
 */

const GOOGLE_FAVICON_BASE = 'https://www.google.com/s2/favicons';
const DUCKDUCKGO_FAVICON_BASE = 'https://icons.duckduckgo.com/ip3';
const FAVICON_TIMEOUT_MS = 3000;

/**
 * Strip protocol, www prefix, and any path from a raw domain input.
 * "https://www.marfa.nl/foo" -> "marfa.nl"
 */
function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/i, '')
    .split('/')[0]!
    .toLowerCase();
}

async function headProbe(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(FAVICON_TIMEOUT_MS),
    });
    return res.ok && res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Probe DuckDuckGo, then Google, and return the first working favicon URL.
 * Returns null if both fail or the domain is empty.
 *
 * DuckDuckGo is the primary because it scrapes the site's own favicon
 * directly. Google's s2 only serves what's in its crawl index and
 * returns a generic globe fallback (with HTTP 200 + real bytes) for
 * misses, which makes client-side `<img onError>` chains fail silently.
 */
export async function getFaviconUrl(domain: string): Promise<string | null> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;

  const duckUrl = `${DUCKDUCKGO_FAVICON_BASE}/${encodeURIComponent(normalized)}.ico`;
  if (await headProbe(duckUrl)) {
    return duckUrl;
  }

  const googleUrl = `${GOOGLE_FAVICON_BASE}?domain=${encodeURIComponent(normalized)}&sz=128`;
  if (await headProbe(googleUrl)) {
    return googleUrl;
  }

  return null;
}

/**
 * Build a DuckDuckGo favicon URL without probing — used by the
 * ProspectLogo component's `<img src>` primary fallback path. DuckDuckGo
 * is the primary because it scrapes site favicons directly and honors
 * real 404s (unlike Google's s2 which masquerades misses as generic
 * globes).
 */
export function buildInlineDuckDuckGoFaviconUrl(domain: string): string | null {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;
  return `${DUCKDUCKGO_FAVICON_BASE}/${encodeURIComponent(normalized)}.ico`;
}

/**
 * Build a Google favicon URL without probing — used by the ProspectLogo
 * component's `<img src>` secondary fallback path after DuckDuckGo fails.
 * The caller should request sz=128 and rely on CSS scaling to avoid
 * Google's low-quality non-standard-bucket behavior.
 */
export function buildInlineGoogleFaviconUrl(
  domain: string,
  sizePx: number = 128,
): string | null {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;
  return `${GOOGLE_FAVICON_BASE}?domain=${encodeURIComponent(normalized)}&sz=${sizePx}`;
}
