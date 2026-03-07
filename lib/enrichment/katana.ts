import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const NON_CONTENT_FILE_RE =
  /\.(jpg|jpeg|png|gif|svg|pdf|xml|css|js|woff|woff2|ttf|ico|mp4|mp3|zip|webp)$/i;

function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').trim();
}

function normalizeContentUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function isOwnDomainUrl(raw: string, domain: string): boolean {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const root = normalizeDomain(domain).toLowerCase();
    return host === root || host === `www.${root}` || host.endsWith(`.${root}`);
  } catch {
    return false;
  }
}

function isLikelyContentUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    const path = parsed.pathname.toLowerCase();
    if (NON_CONTENT_FILE_RE.test(path)) return false;
    if (
      path.includes('/wp-json') ||
      path.includes('/feed') ||
      path.includes('/sitemap') ||
      path.includes('/tag/') ||
      path.includes('/category/')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function contentUrlScore(raw: string): number {
  try {
    const parsed = new URL(raw);
    const path = parsed.pathname.toLowerCase().replace(/\/+$/, '');
    if (!path || path === '/') return 0;

    const segments = path.split('/').filter(Boolean);
    let score = 1 + Math.min(segments.length, 4);

    const highIntentPatterns = [
      'project',
      'case',
      'verhaal',
      'news',
      'nieuws',
      'blog',
      'dienst',
      'service',
      'expertise',
      'sector',
      'industry',
      'oploss',
      'solution',
      'approach',
      'werkwijze',
      'aanpak',
      'about',
      'over-ons',
      'contact',
    ];

    if (highIntentPatterns.some((pattern) => path.includes(pattern))) {
      score += 4;
    }

    if (
      path.includes('privacy') ||
      path.includes('cookie') ||
      path.includes('voorwaarden') ||
      path.includes('terms') ||
      path.includes('disclaimer')
    ) {
      score -= 2;
    }

    return score;
  } catch {
    return -1;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseIntOr(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function parseBoolOr(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  if (raw.toLowerCase() === 'true') return true;
  if (raw.toLowerCase() === 'false') return false;
  return fallback;
}

function resolveKatanaBinary(): string {
  const configured = process.env.KATANA_BINARY_PATH?.trim();
  if (configured) return configured;

  // Safe local default for dev/ops where katana is not host-installed.
  const localWrapper = resolve(process.cwd(), 'scripts/katana-wrapper.sh');
  if (existsSync(localWrapper)) return localWrapper;

  return 'katana';
}

type KatanaJsonlRecord = {
  url?: string;
  endpoint?: string;
  request?: {
    endpoint?: string;
    url?: string;
  };
  response?: {
    request?: {
      endpoint?: string;
      url?: string;
    };
  };
};

function extractUrlFromRecord(record: KatanaJsonlRecord): string | null {
  const candidates = [
    record.url,
    record.endpoint,
    record.request?.endpoint,
    record.request?.url,
    record.response?.request?.endpoint,
    record.response?.request?.url,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length === 0) continue;
    const normalized = normalizeContentUrl(candidate);
    if (!normalized) continue;
    return normalized;
  }
  return null;
}

function parseJsonlUrls(stdout: string, domain: string): string[] {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const collected: string[] = [];
  for (const line of lines) {
    try {
      const record = JSON.parse(line) as KatanaJsonlRecord;
      const url = extractUrlFromRecord(record);
      if (!url) continue;
      if (!isOwnDomainUrl(url, domain)) continue;
      if (!isLikelyContentUrl(url)) continue;
      collected.push(url);
    } catch {
      // Skip malformed JSONL line
    }
  }

  const seen = new Set<string>();
  const scored: Array<{ url: string; score: number }> = [];
  for (const url of collected) {
    if (seen.has(url)) continue;
    seen.add(url);
    scored.push({ url, score: contentUrlScore(url) });
  }

  return scored.sort((a, b) => b.score - a.score).map((item) => item.url);
}

export interface KatanaSiteDiscoveryResult {
  status: 'ok' | 'unavailable' | 'error';
  urls: string[];
  errorCode?: 'BINARY_NOT_FOUND' | 'TIMEOUT' | 'EXEC_ERROR';
  stderr?: string;
}

/**
 * Discover own-domain URLs by actively crawling with katana CLI.
 *
 * Used as website URL fallback when sitemap discovery is blocked/empty.
 * This is complementary to SERP-based fallback and avoids paid API usage.
 */
export async function discoverSiteUrlsWithKatana(input: {
  domain: string;
  maxResults?: number;
}): Promise<KatanaSiteDiscoveryResult> {
  const katanaEnabled = parseBoolOr(process.env.KATANA_ENABLED, true);
  if (!katanaEnabled) {
    return { status: 'unavailable', urls: [] };
  }

  const binary = resolveKatanaBinary();
  const domain = normalizeDomain(input.domain);
  const maxResults = clamp(input.maxResults ?? 120, 1, 500);
  const timeoutMs = parseIntOr(process.env.KATANA_TIMEOUT_MS, 60_000, 5_000, 300_000);
  const depth = parseIntOr(process.env.KATANA_DEPTH, 3, 1, 8);
  const crawlDurationSeconds = parseIntOr(
    process.env.KATANA_CRAWL_DURATION_SECONDS,
    45,
    5,
    600,
  );
  const jsCrawl = parseBoolOr(process.env.KATANA_JS_CRAWL, true);
  const includeKnownFiles = parseBoolOr(process.env.KATANA_KNOWN_FILES, true);

  const seeds = [`https://${domain}`, `https://www.${domain}`];
  const allUrls: string[] = [];
  let combinedStderr = '';

  for (const seed of seeds) {
    const args = ['-u', seed, '-jsonl', '-d', String(depth), '-ct', String(crawlDurationSeconds)];
    if (jsCrawl) args.push('-jc');
    if (includeKnownFiles) args.push('-kf', 'all');

    try {
      const { stdout, stderr } = await execFileAsync(binary, args, {
        timeout: timeoutMs,
        maxBuffer: 25 * 1024 * 1024,
      });
      if (stderr) combinedStderr += `${stderr}\n`;
      allUrls.push(...parseJsonlUrls(stdout, domain));
    } catch (error) {
      const err = error as NodeJS.ErrnoException & {
        code?: string;
        stdout?: string;
        stderr?: string;
        killed?: boolean;
        signal?: string;
      };

      if (err.code === 'ENOENT') {
        return {
          status: 'unavailable',
          urls: [],
          errorCode: 'BINARY_NOT_FOUND',
          stderr: err.message,
        };
      }

      if (err.stdout) {
        allUrls.push(...parseJsonlUrls(err.stdout, domain));
      }
      if (err.stderr) combinedStderr += `${err.stderr}\n`;

      const timedOut = err.killed || err.signal === 'SIGTERM';
      if (allUrls.length === 0) {
        return {
          status: 'error',
          urls: [],
          errorCode: timedOut ? 'TIMEOUT' : 'EXEC_ERROR',
          stderr: err.message,
        };
      }
    }
  }

  const deduped = Array.from(new Set(allUrls)).slice(0, maxResults);
  if (deduped.length === 0) {
    return {
      status: 'error',
      urls: [],
      errorCode: 'EXEC_ERROR',
      ...(combinedStderr ? { stderr: combinedStderr.trim() } : {}),
    };
  }

  return {
    status: 'ok',
    urls: deduped,
    ...(combinedStderr ? { stderr: combinedStderr.trim() } : {}),
  };
}
