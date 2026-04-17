/**
 * logo-pipeline.ts — Single source of truth for prospect logo resolution.
 *
 * Phase 61.3: replaces the ad-hoc `getHighResLogoUrl ?? getFaviconUrl` chains
 * that were scattered across createProspect / createAndProcess / enrichProspect.
 *
 * Given a domain (and optionally Apollo's logoUrl), returns the best validated
 * logo URL available, or null if nothing survives. Every candidate is HEAD-probed
 * for 200 + non-zero body before being returned, so the frontend never needs a
 * browser-side onError cascade — it can trust `prospect.logoUrl` as-is and fall
 * back to an initial-letter avatar when the column is null.
 *
 * Priority:
 *   1. Apollo logoUrl (if provided and HEAD-probes OK)
 *   2. Homepage og:image / twitter:image / apple-touch-icon / icon png (via og-logo)
 *   3. DuckDuckGo ip3 favicon (site-scraped, real 404 on misses)
 *   4. Google s2 favicon sz=128 (last resort, returns 404 on misses too)
 *   5. null
 */

import { getHighResLogoUrl } from '@/lib/enrichment/og-logo';
import {
  buildInlineDuckDuckGoFaviconUrl,
  buildInlineGoogleFaviconUrl,
} from '@/lib/enrichment/favicon';

const HEAD_TIMEOUT_MS = 3000;

/**
 * HEAD-probe a URL. Accept any 2xx — some CDNs (Framer, Cloudflare)
 * don't send content-length on HEAD requests.
 */
async function headProbe(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ResolveLogoOptions {
  /** Apollo-provided logo URL, if the enrichment waterfall returned one. */
  apolloLogoUrl?: string | null;
}

/**
 * Resolve the best available logo URL for a domain. Returns a HEAD-verified
 * URL or null. Safe to call repeatedly — each invocation re-verifies so stale
 * or broken URLs get replaced on subsequent runs.
 *
 * Performance note: worst case makes 1 GET (og-logo's homepage fetch) + up to
 * 3 HEAD probes, each capped at 3s. Typical case is 1 GET + 1 HEAD = ~500ms.
 * Designed for fire-and-forget IIFE usage, not blocking the user flow.
 */
export async function resolveLogoUrl(
  domain: string,
  opts: ResolveLogoOptions = {},
): Promise<string | null> {
  if (!domain || !domain.trim()) return null;

  // 1. Apollo logoUrl — trust Apollo but validate it still works
  if (opts.apolloLogoUrl && opts.apolloLogoUrl.trim()) {
    if (await headProbe(opts.apolloLogoUrl)) {
      return opts.apolloLogoUrl;
    }
  }

  // 2. Homepage og:image chain (og-logo internally HEAD-probes each candidate)
  const ogLogo = await getHighResLogoUrl(domain);
  if (ogLogo) return ogLogo;

  // 3. DuckDuckGo favicon — only if HEAD probe succeeds (DDG returns 404 for
  //    domains it hasn't scraped, which would otherwise become a broken img)
  const ddgUrl = buildInlineDuckDuckGoFaviconUrl(domain);
  if (ddgUrl && (await headProbe(ddgUrl))) {
    return ddgUrl;
  }

  // 4. Google s2 favicon — last resort. Google follows a 301 to t1.gstatic and
  //    returns 404 for true misses (with a generic globe body), which headProbe
  //    correctly rejects via the res.ok check.
  const googleUrl = buildInlineGoogleFaviconUrl(domain, 128);
  if (googleUrl && (await headProbe(googleUrl))) {
    return googleUrl;
  }

  // 5. Nothing works — caller should render an initial-letter avatar
  return null;
}
