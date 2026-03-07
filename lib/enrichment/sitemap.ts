import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';

export type SitemapDiscoveryStatus = 'ok' | 'blocked' | 'empty' | 'error';

export type SitemapDiscoveryErrorCode =
  | 'HTTP_401'
  | 'HTTP_403'
  | 'HTTP_404'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'NETWORK'
  | 'UNKNOWN';

export interface SitemapCandidate {
  url: string;
  normalizedUrl: string;
  lastmod: string | null;
  sourceSitemap: string;
  pathDepth: number;
  topSegment: string;
}

export interface SitemapDiscoveryResult {
  status: SitemapDiscoveryStatus;
  errorCode?: SitemapDiscoveryErrorCode;
  candidates: SitemapCandidate[];
  seedUrls: string[];
  crawledSitemaps: string[];
  discoveredTotal: number;
}

/**
 * Cached result shape for sitemap URL discovery.
 *
 * `urls` is retained for backwards compatibility with pre-v2 snapshots.
 */
export interface SitemapCache {
  discoveredAt: string;
  urls: string[];
  result?: SitemapDiscoveryResult;
}

const MAX_SITEMAPS = 400;
const MAX_DISCOVERED_URLS = 20_000;
const FETCH_TIMEOUT_MS = 15_000;
const CURL_TIMEOUT_SECONDS = Math.ceil(FETCH_TIMEOUT_MS / 1000);
const CURL_STATUS_MARKER = '\n__CURL_STATUS__:';
const ENABLE_CURL_FALLBACK =
  process.env.NODE_ENV !== 'test' && process.env.SITEMAP_CURL_FALLBACK !== '0';

const execFileAsync = promisify(execFile);

const NON_CONTENT_FILE_RE =
  /\.(jpg|jpeg|png|gif|svg|pdf|xml|css|js|woff|woff2|ttf|ico|mp4|mp3|zip|webp)$/i;

const TRACKING_QUERY_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
  '_ga',
  '_gl',
]);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
const BROWSER_ACCEPT =
  'application/xml,text/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8';
const BROWSER_ACCEPT_LANGUAGE = 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7';

const BROWSER_HEADERS: HeadersInit = {
  'user-agent': BROWSER_USER_AGENT,
  accept: BROWSER_ACCEPT,
  'accept-language': BROWSER_ACCEPT_LANGUAGE,
  'accept-encoding': 'gzip, deflate, br',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/g, '');
}

function stripTrackingParams(url: URL): void {
  const toDelete: string[] = [];
  url.searchParams.forEach((_, key) => {
    const lower = key.toLowerCase();
    if (TRACKING_QUERY_KEYS.has(lower)) {
      toDelete.push(key);
      return;
    }
    if (lower.startsWith('utm_')) {
      toDelete.push(key);
    }
  });

  for (const key of toDelete) {
    url.searchParams.delete(key);
  }

  if (toDelete.length > 0) {
    const sortedEntries = Array.from(url.searchParams.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    url.search = '';
    for (const [k, v] of sortedEntries) {
      url.searchParams.append(k, v);
    }
  }
}

function normalizeCandidateUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    stripTrackingParams(parsed);

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    const query = parsed.search;
    return `${parsed.protocol}//${host}${path}${query}`;
  } catch {
    return null;
  }
}

function normalizedKey(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${host}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

function topSegment(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'root';
  return segments[0]!.toLowerCase();
}

function pathDepth(pathname: string): number {
  return pathname.split('/').filter(Boolean).length;
}

function hostMatchesDomain(hostname: string, rootDomain: string): boolean {
  const cleanHost = hostname.toLowerCase().replace(/^www\./, '');
  return cleanHost === rootDomain || cleanHost.endsWith(`.${rootDomain}`);
}

function isLikelySitemapUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.xml') ||
    lower.endsWith('.xml.gz') ||
    lower.includes('sitemap')
  );
}

function extractLocValues(xml: string): string[] {
  const values: string[] = [];
  const re = /<loc>([\s\S]*?)<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const raw = (match[1] ?? '').trim();
    if (!raw) continue;
    values.push(
      raw
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
    );
  }
  return values;
}

function extractUrlEntries(xml: string): Array<{ loc: string; lastmod: string | null }> {
  const entries: Array<{ loc: string; lastmod: string | null }> = [];
  const urlBlockRe = /<url>([\s\S]*?)<\/url>/gi;
  let block: RegExpExecArray | null;
  while ((block = urlBlockRe.exec(xml)) !== null) {
    const inner = block[1] ?? '';
    const locMatch = inner.match(/<loc>([\s\S]*?)<\/loc>/i);
    if (!locMatch?.[1]) continue;
    const loc = locMatch[1]
      .trim()
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    if (!loc) continue;

    const lastmodMatch = inner.match(/<lastmod>([\s\S]*?)<\/lastmod>/i);
    const lastmod = lastmodMatch?.[1]?.trim() ?? null;
    entries.push({ loc, lastmod });
  }

  // Fallback for very minimal urlset where no <url> blocks are present.
  if (entries.length === 0 && /<urlset/i.test(xml)) {
    for (const loc of extractLocValues(xml)) {
      entries.push({ loc, lastmod: null });
    }
  }

  return entries;
}

function looksBlockedHtml(payload: string): boolean {
  const lower = payload.toLowerCase();
  if (!lower.includes('<html')) return false;
  return (
    lower.includes('cloudflare') ||
    lower.includes('attention required') ||
    lower.includes('you have been blocked') ||
    lower.includes('access denied')
  );
}

function mapStatusToErrorCode(status: number): SitemapDiscoveryErrorCode {
  if (status === 401) return 'HTTP_401';
  if (status === 403) return 'HTTP_403';
  if (status === 404) return 'HTTP_404';
  return 'UNKNOWN';
}

type FetchTextResult = {
  ok: boolean;
  status: number;
  text?: string;
  errorCode?: SitemapDiscoveryErrorCode;
};

async function fetchTextViaNodeFetch(url: string): Promise<FetchTextResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: BROWSER_HEADERS,
      signal: controller.signal,
    });

    const status = response.status;

    if (!response.ok) {
      return {
        ok: false,
        status,
        errorCode: mapStatusToErrorCode(status),
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

    let text: string;
    const shouldTryGunzip =
      url.toLowerCase().endsWith('.gz') ||
      contentType.includes('application/gzip') ||
      contentType.includes('application/x-gzip');

    if (shouldTryGunzip) {
      try {
        text = gunzipSync(body).toString('utf-8');
      } catch {
        text = body.toString('utf-8');
      }
    } else {
      text = body.toString('utf-8');
    }

    return { ok: true, status, text };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return { ok: false, status: 0, errorCode: 'TIMEOUT' };
    }
    return { ok: false, status: 0, errorCode: 'NETWORK' };
  } finally {
    clearTimeout(timeout);
  }
}

function parseCurlStatus(payload: string): { body: string; status: number } | null {
  const markerIndex = payload.lastIndexOf(CURL_STATUS_MARKER);
  if (markerIndex === -1) return null;

  const body = payload.slice(0, markerIndex);
  const tail = payload.slice(markerIndex + CURL_STATUS_MARKER.length).trim();
  const firstLine = tail.split(/\r?\n/, 1)[0] ?? '';
  const status = Number.parseInt(firstLine, 10);
  if (!Number.isFinite(status)) return null;

  return { body, status };
}

async function fetchTextViaCurl(url: string): Promise<FetchTextResult> {
  try {
    const { stdout } = await execFileAsync('curl', [
      '--location',
      '--compressed',
      '--silent',
      '--show-error',
      '--max-time',
      String(CURL_TIMEOUT_SECONDS),
      '-A',
      BROWSER_USER_AGENT,
      '-H',
      `Accept: ${BROWSER_ACCEPT}`,
      '-H',
      `Accept-Language: ${BROWSER_ACCEPT_LANGUAGE}`,
      '-H',
      'Pragma: no-cache',
      '-H',
      'Cache-Control: no-cache',
      '-w',
      `${CURL_STATUS_MARKER}%{http_code}\n`,
      url,
    ]);

    const parsed = parseCurlStatus(stdout);
    if (!parsed) {
      return { ok: false, status: 0, errorCode: 'PARSE_ERROR' };
    }

    if (parsed.status < 200 || parsed.status >= 300) {
      return {
        ok: false,
        status: parsed.status,
        errorCode: mapStatusToErrorCode(parsed.status),
      };
    }

    return { ok: true, status: parsed.status, text: parsed.body };
  } catch (error) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: string | number }).code !== 'undefined'
        ? (error as { code: string | number }).code
        : null;
    if (code === 28) {
      return { ok: false, status: 0, errorCode: 'TIMEOUT' };
    }
    return { ok: false, status: 0, errorCode: 'NETWORK' };
  }
}

function shouldTryCurlFallback(result: FetchTextResult): boolean {
  if (!ENABLE_CURL_FALLBACK) return false;
  if (!result.ok) return true;
  if (!result.text) return false;
  return looksBlockedHtml(result.text);
}

async function fetchTextWithMetadata(url: string): Promise<FetchTextResult> {
  const primary = await fetchTextViaNodeFetch(url);

  if (!shouldTryCurlFallback(primary)) {
    return primary;
  }

  const curlResult = await fetchTextViaCurl(url);
  if (curlResult.ok && curlResult.text && !looksBlockedHtml(curlResult.text)) {
    return curlResult;
  }
  if (!primary.ok && curlResult.ok) {
    return curlResult;
  }

  return primary;
}

async function discoverSeedSitemaps(domain: string): Promise<string[]> {
  const normalizedDomain = normalizeDomain(domain);
  const seeds = new Set<string>([
    `https://${normalizedDomain}/sitemap.xml`,
    `https://www.${normalizedDomain}/sitemap.xml`,
  ]);

  const robotsUrls = [
    `https://${normalizedDomain}/robots.txt`,
    `https://www.${normalizedDomain}/robots.txt`,
  ];

  for (const robotsUrl of robotsUrls) {
    const result = await fetchTextWithMetadata(robotsUrl);
    if (!result.ok || !result.text) continue;

    for (const line of result.text.split(/\r?\n/)) {
      const match = line.match(/^\s*Sitemap:\s*(\S+)\s*$/i);
      if (!match?.[1]) continue;
      seeds.add(match[1]);
    }
  }

  return Array.from(seeds);
}

export async function discoverSitemapUrls(
  domain: string,
): Promise<SitemapDiscoveryResult> {
  const normalizedDomain = normalizeDomain(domain);
  const seedUrls = await discoverSeedSitemaps(normalizedDomain);
  const queue = [...seedUrls];
  const seenSitemaps = new Set<string>();
  const candidatesByKey = new Map<string, SitemapCandidate>();

  let blockedSignals = 0;
  let firstErrorCode: SitemapDiscoveryErrorCode | undefined;

  while (queue.length > 0 && seenSitemaps.size < MAX_SITEMAPS) {
    const sitemapUrl = queue.shift()!;
    if (seenSitemaps.has(sitemapUrl)) continue;

    seenSitemaps.add(sitemapUrl);
    const result = await fetchTextWithMetadata(sitemapUrl);

    if (!result.ok || !result.text) {
      if (result.errorCode === 'HTTP_401' || result.errorCode === 'HTTP_403') {
        blockedSignals += 1;
      }
      if (!firstErrorCode && result.errorCode) {
        firstErrorCode = result.errorCode;
      }
      continue;
    }

    const payload = result.text;

    if (looksBlockedHtml(payload)) {
      blockedSignals += 1;
      if (!firstErrorCode) firstErrorCode = 'HTTP_403';
      continue;
    }

    if (!payload.includes('<loc>')) {
      if (!firstErrorCode) firstErrorCode = 'PARSE_ERROR';
      continue;
    }

    if (/<sitemapindex/i.test(payload)) {
      for (const loc of extractLocValues(payload)) {
        if (!isLikelySitemapUrl(loc)) continue;
        if (!seenSitemaps.has(loc)) {
          queue.push(loc);
        }
      }
      continue;
    }

    const entries = extractUrlEntries(payload);
    for (const entry of entries) {
      if (candidatesByKey.size >= MAX_DISCOVERED_URLS) break;

      let parsed: URL;
      try {
        parsed = new URL(entry.loc);
      } catch {
        continue;
      }

      if (!hostMatchesDomain(parsed.hostname, normalizedDomain)) continue;
      if (NON_CONTENT_FILE_RE.test(parsed.pathname.toLowerCase())) continue;

      const normalized = normalizeCandidateUrl(entry.loc);
      if (!normalized) continue;

      const key = normalizedKey(normalized);
      if (!key) continue;
      if (candidatesByKey.has(key)) continue;

      const finalParsed = new URL(normalized);
      candidatesByKey.set(key, {
        url: normalized,
        normalizedUrl: key,
        lastmod: entry.lastmod,
        sourceSitemap: sitemapUrl,
        pathDepth: pathDepth(finalParsed.pathname),
        topSegment: topSegment(finalParsed.pathname),
      });
    }
  }

  const candidates = Array.from(candidatesByKey.values());

  if (candidates.length > 0) {
    return {
      status: 'ok',
      candidates,
      seedUrls,
      crawledSitemaps: Array.from(seenSitemaps),
      discoveredTotal: candidates.length,
    };
  }

  if (blockedSignals > 0) {
    return {
      status: 'blocked',
      errorCode: firstErrorCode ?? 'HTTP_403',
      candidates: [],
      seedUrls,
      crawledSitemaps: Array.from(seenSitemaps),
      discoveredTotal: 0,
    };
  }

  if (seenSitemaps.size > 0) {
    return {
      status: 'empty',
      errorCode: firstErrorCode,
      candidates: [],
      seedUrls,
      crawledSitemaps: Array.from(seenSitemaps),
      discoveredTotal: 0,
    };
  }

  return {
    status: 'error',
    errorCode: firstErrorCode ?? 'UNKNOWN',
    candidates: [],
    seedUrls,
    crawledSitemaps: Array.from(seenSitemaps),
    discoveredTotal: 0,
  };
}
