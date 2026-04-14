/**
 * Favicon URL helper for prospects without Apollo logos.
 *
 * Phase 61.1 POLISH-04: Manual prospects (and Apollo-orphaned prospects
 * like Marfa) need a logo. Google's free s2/favicons service covers ~99%
 * of domains; DuckDuckGo is the secondary fallback.
 *
 * Usage:
 *   const url = await getFaviconUrl('marfa.nl');
 *   // -> 'https://www.google.com/s2/favicons?domain=marfa.nl&sz=128'
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
 * Probe Google, then DuckDuckGo, and return the first working favicon URL.
 * Returns null if both fail or the domain is empty.
 */
export async function getFaviconUrl(domain: string): Promise<string | null> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;

  const googleUrl = `${GOOGLE_FAVICON_BASE}?domain=${encodeURIComponent(normalized)}&sz=128`;
  if (await headProbe(googleUrl)) {
    return googleUrl;
  }

  const duckUrl = `${DUCKDUCKGO_FAVICON_BASE}/${encodeURIComponent(normalized)}.ico`;
  if (await headProbe(duckUrl)) {
    return duckUrl;
  }

  return null;
}

/**
 * Build a Google favicon URL without probing — used by the ProspectLogo
 * component's `<img src>` fallback path where the browser's own
 * `onError` handler is the "probe".
 *
 * Exported so Plan 04's ProspectLogo component can use the same base URL
 * without duplicating the string.
 */
export function buildInlineGoogleFaviconUrl(
  domain: string,
  sizePx: number = 64,
): string | null {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;
  return `${GOOGLE_FAVICON_BASE}?domain=${encodeURIComponent(normalized)}&sz=${sizePx}`;
}
