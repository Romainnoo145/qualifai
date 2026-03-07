export type CandidateSource =
  | 'sitemap'
  | 'katana_site'
  | 'serp_site'
  | 'manual'
  | 'seed';

export interface ResearchUrlCandidate {
  url: string;
  source: CandidateSource;
  lastmod?: string | null;
  topSegment?: string | null;
  pathDepth?: number | null;
}

export interface UrlSelectionInput {
  candidates: ResearchUrlCandidate[];
  topN?: number;
  context?: {
    industry?: string | null;
    description?: string | null;
    specialties?: string[];
    country?: string | null;
    nicheKey?: string | null;
    language?: string | null;
  };
}

export interface ScoredSelectedUrl extends ResearchUrlCandidate {
  rank: number;
  score: number;
  relevanceMatches: number;
}

export interface UrlSelectionResult {
  strategyVersion: 'rank-v1';
  discoveredTotal: number;
  selectedTotal: number;
  selectedUrls: ScoredSelectedUrl[];
  selectedBySource: Record<string, number>;
  selectedBySegment: Record<string, number>;
}

const BASE_SCORES: Record<CandidateSource, number> = {
  sitemap: 0.5,
  katana_site: 0.4,
  serp_site: 0.35,
  manual: 0.25,
  seed: 0.1,
};

const NOISE_PATTERNS = [
  'privacy',
  'cookies',
  'cookie',
  'terms',
  'voorwaarden',
  'disclaimer',
  'login',
  'signin',
  'search',
  '/tag/',
  '/category/',
  '/feed',
  '/author/',
];

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

const TIME_SENSITIVE_PATH_HINTS = [
  '/news',
  '/nieuws',
  '/blog',
  '/insights',
  '/press',
  '/pers',
  '/media',
  '/events',
  '/event',
  '/webinar',
  '/articles',
  '/article',
  '/stories',
  '/story',
  '/resultaten',
  '/results',
  '/annual-report',
  '/jaarverslag',
  '/investor',
];

const YEAR_CRITICAL_PATH_HINTS = [
  '/resultaten',
  '/results',
  '/annual-report',
  '/jaarverslag',
  '/investor',
];

const EVERGREEN_PATH_HINTS = [
  '/',
  '/contact',
  '/contact-us',
  '/over-ons',
  '/about',
  '/about-us',
  '/diensten',
  '/services',
  '/expertise',
  '/solutions',
  '/sectoren',
  '/industries',
  '/team',
  '/careers',
  '/werken-bij',
];

const EVERGREEN_SELECTION_RATIO = 0.2;
const PASS1_SCORE_FLOOR = 0.35;

function normalizeUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${host}${path}${parsed.search}`;
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

function deriveTopSegment(url: string): string {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split('/').filter(Boolean)[0];
    return (segment ?? 'root').toLowerCase();
  } catch {
    return 'root';
  }
}

function deriveDepth(url: string): number {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\-_/\s]/g, ' ')
    .split(/[\s/_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function buildContextTokens(input?: UrlSelectionInput['context']): Set<string> {
  if (!input) return new Set();

  const chunks: string[] = [];
  if (input.industry) chunks.push(input.industry);
  if (input.description) chunks.push(input.description);
  if (input.country) chunks.push(input.country);
  if (input.nicheKey) chunks.push(input.nicheKey);
  if (input.language) chunks.push(input.language);
  for (const specialty of input.specialties ?? []) {
    chunks.push(specialty);
  }

  const tokens = chunks.flatMap(tokenize);
  return new Set(tokens);
}

function relevanceBonus(url: string, contextTokens: Set<string>): {
  bonus: number;
  matches: number;
} {
  if (contextTokens.size === 0) return { bonus: 0, matches: 0 };

  const tokens = new Set(tokenize(url));
  let matches = 0;
  for (const token of contextTokens) {
    if (tokens.has(token)) matches += 1;
  }

  return {
    bonus: Math.min(matches * 0.03, 0.24),
    matches,
  };
}

function depthBonus(depth: number): number {
  if (depth >= 1 && depth <= 4) return 0.1;
  if (depth > 6) return -0.05;
  return 0;
}

function noisePenalty(url: string): number {
  const lower = url.toLowerCase();
  if (NOISE_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return -0.4;
  }
  return 0;
}

function trackingPenalty(url: string): number {
  try {
    const parsed = new URL(url);
    for (const key of parsed.searchParams.keys()) {
      const lower = key.toLowerCase();
      if (TRACKING_QUERY_KEYS.has(lower) || lower.startsWith('utm_')) {
        return -0.1;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

function urlPath(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, '');
    return pathname || '/';
  } catch {
    return '';
  }
}

function stripLocalePrefix(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  const first = segments[0] ?? '';
  const isLocale = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(first);
  if (!isLocale) return path;
  const remaining = segments.slice(1);
  if (remaining.length === 0) return '/';
  return `/${remaining.join('/')}`;
}

function isPathMatch(path: string, hint: string): boolean {
  const candidates = new Set([path, stripLocalePrefix(path)]);
  for (const candidate of candidates) {
    if (hint === '/') {
      if (candidate === '/') return true;
      continue;
    }
    if (candidate === hint) return true;
    if (candidate.startsWith(`${hint}/`)) return true;
  }
  return false;
}

function isTimeSensitiveUrl(url: string): boolean {
  const path = urlPath(url);
  return TIME_SENSITIVE_PATH_HINTS.some((hint) => isPathMatch(path, hint));
}

function isEvergreenUrl(url: string): boolean {
  const path = urlPath(url);
  return EVERGREEN_PATH_HINTS.some((hint) => isPathMatch(path, hint));
}

function isYearCriticalUrl(url: string): boolean {
  const path = urlPath(url);
  return YEAR_CRITICAL_PATH_HINTS.some((hint) => isPathMatch(path, hint));
}

function urlYearHint(url: string): number | null {
  try {
    const parsed = new URL(url);
    const haystack = `${parsed.pathname} ${parsed.search}`;
    const match = haystack.match(/(?:19|20)\d{2}/);
    if (!match) return null;
    const year = Number.parseInt(match[0], 10);
    if (!Number.isFinite(year)) return null;
    return year;
  } catch {
    return null;
  }
}

function recencyScore(
  url: string,
  lastmod: string | null | undefined,
): { bonus: number; penalty: number } {
  const timeSensitive = isTimeSensitiveUrl(url);
  const evergreen = isEvergreenUrl(url);
  const yearCritical = isYearCriticalUrl(url);
  const yearHint = urlYearHint(url);
  const currentYear = new Date().getFullYear();

  if (!lastmod) {
    if (timeSensitive && yearHint !== null && yearHint <= currentYear - 2) {
      return { bonus: 0, penalty: yearCritical ? -0.32 : -0.2 };
    }
    return { bonus: 0, penalty: 0 };
  }

  const dt = new Date(lastmod);
  if (Number.isNaN(dt.getTime())) {
    return { bonus: 0, penalty: 0 };
  }

  const ageDays = (Date.now() - dt.getTime()) / (24 * 60 * 60 * 1000);

  if (timeSensitive) {
    const oldYearPenalty =
      yearHint !== null && yearHint <= currentYear - 2
        ? yearCritical
          ? -0.14
          : -0.08
        : 0;

    if (ageDays <= 30) return { bonus: 0.25, penalty: oldYearPenalty };
    if (ageDays <= 180) return { bonus: 0.15, penalty: oldYearPenalty };
    if (ageDays <= 365) return { bonus: 0.05, penalty: oldYearPenalty };
    if (ageDays <= 730) return { bonus: 0, penalty: -0.08 + oldYearPenalty };
    return { bonus: 0, penalty: -0.18 + oldYearPenalty };
  }

  if (evergreen) {
    if (ageDays <= 180) return { bonus: 0.04, penalty: 0 };
    return { bonus: 0, penalty: 0 };
  }

  if (ageDays <= 30) return { bonus: 0.2, penalty: 0 };
  if (ageDays <= 180) return { bonus: 0.1, penalty: 0 };
  if (ageDays <= 365) return { bonus: 0.03, penalty: 0 };
  return { bonus: 0, penalty: 0 };
}

function seedGuessPenalty(source: CandidateSource, url: string): number {
  if (source !== 'seed') return 0;
  const path = urlPath(url);
  // Keep homepage as viable safety-net; penalize guessed subpaths.
  if (path === '/') return 0;
  return -0.18;
}

export function selectResearchUrls(input: UrlSelectionInput): UrlSelectionResult {
  const topN = Math.max(1, input.topN ?? 60);
  const contextTokens = buildContextTokens(input.context);

  // Deduplicate candidates by normalized URL (first seen wins).
  const deduped: ResearchUrlCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of input.candidates) {
    const normalized = normalizeUrl(candidate.url);
    if (!normalized) continue;
    const key = normalizedKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    deduped.push({
      ...candidate,
      url: normalized,
      topSegment: candidate.topSegment ?? deriveTopSegment(normalized),
      pathDepth: candidate.pathDepth ?? deriveDepth(normalized),
      lastmod: candidate.lastmod ?? null,
    });
  }

  const scored = deduped.map((candidate) => {
    const base = BASE_SCORES[candidate.source] ?? BASE_SCORES.seed;
    const recency = recencyScore(candidate.url, candidate.lastmod);
    const relevance = relevanceBonus(candidate.url, contextTokens);
    const depth = depthBonus(candidate.pathDepth ?? 0);
    const noise = noisePenalty(candidate.url);
    const tracking = trackingPenalty(candidate.url);
    const seedPenalty = seedGuessPenalty(candidate.source, candidate.url);

    const score =
      base +
      recency.bonus +
      recency.penalty +
      relevance.bonus +
      depth +
      noise +
      tracking +
      seedPenalty;

    return {
      ...candidate,
      score,
      relevanceMatches: relevance.matches,
      topSegment: candidate.topSegment ?? 'root',
      pathDepth: candidate.pathDepth ?? 0,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.url.localeCompare(b.url);
  });

  const segmentCap = Math.max(1, Math.floor(topN * 0.35));
  const evergreenCap = Math.max(2, Math.floor(topN * EVERGREEN_SELECTION_RATIO));
  const segmentCounts = new Map<string, number>();
  let evergreenCount = 0;

  const bySegment = new Map<string, typeof scored>();
  for (const candidate of scored) {
    const seg = candidate.topSegment ?? 'root';
    if (!bySegment.has(seg)) bySegment.set(seg, []);
    bySegment.get(seg)!.push(candidate);
  }

  // Pass 1: best URL per segment (coverage breadth)
  const heads = Array.from(bySegment.entries())
    .map(([segment, items]) => ({
      segment,
      head: items[0]!,
    }))
    .sort((a, b) => {
      if (b.head.score !== a.head.score) return b.head.score - a.head.score;
      return a.head.url.localeCompare(b.head.url);
    });

  const selected: typeof scored = [];
  const used = new Set<string>();

  for (const { segment, head } of heads) {
    if (selected.length >= topN) break;
    if (head.score < PASS1_SCORE_FLOOR) continue;
    selected.push(head);
    used.add(head.url);
    segmentCounts.set(segment, 1);
    if (isEvergreenUrl(head.url)) evergreenCount += 1;
  }

  // Pass 2: fill by score while enforcing segment cap.
  for (const candidate of scored) {
    if (selected.length >= topN) break;
    if (used.has(candidate.url)) continue;

    const seg = candidate.topSegment ?? 'root';
    const current = segmentCounts.get(seg) ?? 0;
    if (current >= segmentCap) continue;
    if (isEvergreenUrl(candidate.url) && evergreenCount >= evergreenCap) {
      continue;
    }

    selected.push(candidate);
    used.add(candidate.url);
    segmentCounts.set(seg, current + 1);
    if (isEvergreenUrl(candidate.url)) evergreenCount += 1;
  }

  // Pass 3: if still under topN, ignore cap to avoid underfilling.
  for (const candidate of scored) {
    if (selected.length >= topN) break;
    if (used.has(candidate.url)) continue;

    const seg = candidate.topSegment ?? 'root';
    const current = segmentCounts.get(seg) ?? 0;
    selected.push(candidate);
    used.add(candidate.url);
    segmentCounts.set(seg, current + 1);
    if (isEvergreenUrl(candidate.url)) evergreenCount += 1;
  }

  const selectedWithRank: ScoredSelectedUrl[] = selected.map((candidate, idx) => ({
    url: candidate.url,
    source: candidate.source,
    lastmod: candidate.lastmod ?? null,
    topSegment: candidate.topSegment,
    pathDepth: candidate.pathDepth,
    rank: idx + 1,
    score: candidate.score,
    relevanceMatches: candidate.relevanceMatches,
  }));

  const selectedBySource: Record<string, number> = {};
  const selectedBySegment: Record<string, number> = {};
  for (const candidate of selectedWithRank) {
    selectedBySource[candidate.source] =
      (selectedBySource[candidate.source] ?? 0) + 1;
    selectedBySegment[candidate.topSegment ?? 'root'] =
      (selectedBySegment[candidate.topSegment ?? 'root'] ?? 0) + 1;
  }

  return {
    strategyVersion: 'rank-v1',
    discoveredTotal: deduped.length,
    selectedTotal: selectedWithRank.length,
    selectedUrls: selectedWithRank,
    selectedBySource,
    selectedBySegment,
  };
}
