import { describe, it, expect } from 'vitest';
import {
  buildSourceSet,
  defaultResearchUrls,
  normalizeUrlForDedup,
  detectJsHeavy,
  extractSourceSet,
  CAPS,
  type SourceSet,
} from './source-discovery';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUrls(
  count: number,
  prefix = 'https://example.com/page',
): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

// ---------------------------------------------------------------------------
// CAPS enforcement (DISC-04)
// ---------------------------------------------------------------------------

describe('buildSourceSet — cap enforcement', () => {
  it('caps sitemap at CAPS.sitemap (25) when given 50 URLs', () => {
    const sitemapUrls = makeUrls(50, 'https://site.nl/p');
    const result = buildSourceSet({
      sitemapUrls,
      serpUrls: [],
      defaultUrls: [],
    });

    const sitemapItems = result.urls.filter((u) => u.provenance === 'sitemap');
    expect(sitemapItems).toHaveLength(CAPS.sitemap);
    expect(result.rawCounts.sitemap).toEqual({ discovered: 50, capped: 25 });
  });

  it('caps serp at CAPS.serp (15) when given 20 URLs', () => {
    const serpUrls = makeUrls(20, 'https://review.nl/r');
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls,
      defaultUrls: [],
    });

    const serpItems = result.urls.filter((u) => u.provenance === 'serp');
    expect(serpItems).toHaveLength(CAPS.serp);
    expect(result.rawCounts.serp).toEqual({ discovered: 20, capped: 15 });
  });

  it('caps default at CAPS.default (20) when given 25 URLs', () => {
    const defaultUrls = makeUrls(25, 'https://default.nl/d');
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls: [],
      defaultUrls,
    });

    const defaultItems = result.urls.filter((u) => u.provenance === 'default');
    expect(defaultItems).toHaveLength(CAPS.default);
    expect(result.rawCounts.default).toEqual({ discovered: 25, capped: 20 });
  });

  it('rawCounts reflects pre-cap discovered and post-cap capped values', () => {
    const result = buildSourceSet({
      sitemapUrls: makeUrls(50, 'https://s.nl/p'),
      serpUrls: makeUrls(20, 'https://serp.nl/r'),
      defaultUrls: makeUrls(25, 'https://def.nl/d'),
    });

    expect(result.rawCounts.sitemap).toEqual({ discovered: 50, capped: 25 });
    expect(result.rawCounts.serp).toEqual({ discovered: 20, capped: 15 });
    expect(result.rawCounts.default).toEqual({ discovered: 25, capped: 20 });
  });

  it('does not cap when source has fewer URLs than the cap', () => {
    const result = buildSourceSet({
      sitemapUrls: makeUrls(5, 'https://sm.nl/p'),
      serpUrls: makeUrls(3, 'https://se.nl/r'),
      defaultUrls: makeUrls(7, 'https://df.nl/d'),
    });

    expect(result.rawCounts.sitemap).toEqual({ discovered: 5, capped: 5 });
    expect(result.rawCounts.serp).toEqual({ discovered: 3, capped: 3 });
    expect(result.rawCounts.default).toEqual({ discovered: 7, capped: 7 });
  });
});

// ---------------------------------------------------------------------------
// Deduplication (DISC-05)
// ---------------------------------------------------------------------------

describe('buildSourceSet — deduplication', () => {
  it('deduplicates the same URL appearing in both sitemap and serp — keeps sitemap provenance', () => {
    const sharedUrl = 'https://example.com/shared-page';
    const result = buildSourceSet({
      sitemapUrls: [sharedUrl],
      serpUrls: [sharedUrl],
      defaultUrls: [],
    });

    const matches = result.urls.filter((u) => u.url === sharedUrl);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.provenance).toBe('sitemap');
    expect(result.dedupRemovedCount).toBe(1);
  });

  it('deduplicates URLs differing only by trailing slash', () => {
    const result = buildSourceSet({
      sitemapUrls: ['https://example.com/page/'],
      serpUrls: ['https://example.com/page'],
      defaultUrls: [],
    });

    expect(result.urls).toHaveLength(1);
    expect(result.dedupRemovedCount).toBe(1);
  });

  it('deduplicates URLs differing only by scheme (http vs https)', () => {
    const result = buildSourceSet({
      sitemapUrls: ['https://example.com/page'],
      serpUrls: ['http://example.com/page'],
      defaultUrls: [],
    });

    expect(result.urls).toHaveLength(1);
    expect(result.dedupRemovedCount).toBe(1);
  });

  it('deduplicates URLs differing only by www prefix', () => {
    const result = buildSourceSet({
      sitemapUrls: ['https://www.example.com/page'],
      serpUrls: ['https://example.com/page'],
      defaultUrls: [],
    });

    expect(result.urls).toHaveLength(1);
    expect(result.dedupRemovedCount).toBe(1);
  });

  it('tracks dedupRemovedCount correctly across multiple duplicates', () => {
    const url = 'https://example.com/page';
    const result = buildSourceSet({
      sitemapUrls: [url],
      serpUrls: [url],
      defaultUrls: [url],
    });

    expect(result.urls).toHaveLength(1);
    expect(result.dedupRemovedCount).toBe(2);
  });

  it('does not remove unique URLs', () => {
    const result = buildSourceSet({
      sitemapUrls: ['https://example.com/a'],
      serpUrls: ['https://example.com/b'],
      defaultUrls: ['https://example.com/c'],
    });

    expect(result.urls).toHaveLength(3);
    expect(result.dedupRemovedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Provenance (DISC-01)
// ---------------------------------------------------------------------------

describe('buildSourceSet — provenance', () => {
  it('assigns correct provenance to each URL by source', () => {
    const result = buildSourceSet({
      sitemapUrls: ['https://example.com/sitemap-page'],
      serpUrls: ['https://trustpilot.com/review/example'],
      defaultUrls: ['https://example.com/over-ons'],
    });

    const sitemapUrl = result.urls.find((u) => u.provenance === 'sitemap');
    const serpUrl = result.urls.find((u) => u.provenance === 'serp');
    const defaultUrl = result.urls.find((u) => u.provenance === 'default');

    expect(sitemapUrl?.url).toBe('https://example.com/sitemap-page');
    expect(serpUrl?.url).toBe('https://trustpilot.com/review/example');
    expect(defaultUrl?.url).toBe('https://example.com/over-ons');
  });

  it('merges in order sitemap → serp → default', () => {
    const result = buildSourceSet({
      sitemapUrls: ['https://example.com/a'],
      serpUrls: ['https://example.com/b'],
      defaultUrls: ['https://example.com/c'],
    });

    expect(result.urls[0]!.provenance).toBe('sitemap');
    expect(result.urls[1]!.provenance).toBe('serp');
    expect(result.urls[2]!.provenance).toBe('default');
  });

  it('sitemap wins over serp when same URL appears in both', () => {
    const url = 'https://example.com/page';
    const result = buildSourceSet({
      sitemapUrls: [url],
      serpUrls: [url],
      defaultUrls: [],
    });

    expect(result.urls[0]!.provenance).toBe('sitemap');
  });

  it('serp wins over default when same URL appears in both', () => {
    const url = 'https://example.com/page';
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls: [url],
      defaultUrls: [url],
    });

    expect(result.urls[0]!.provenance).toBe('serp');
  });
});

// ---------------------------------------------------------------------------
// jsHeavyHint detection (DISC-02)
// ---------------------------------------------------------------------------

describe('buildSourceSet — jsHeavyHint', () => {
  it('marks linkedin.com URLs as jsHeavyHint=true', () => {
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls: ['https://www.linkedin.com/company/example'],
      defaultUrls: [],
    });

    expect(result.urls[0]!.jsHeavyHint).toBe(true);
  });

  it('marks trustpilot.com URLs as jsHeavyHint=true', () => {
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls: ['https://nl.trustpilot.com/review/example.nl'],
      defaultUrls: [],
    });

    expect(result.urls[0]!.jsHeavyHint).toBe(true);
  });

  it('marks indeed.com URLs as jsHeavyHint=true', () => {
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls: ['https://nl.indeed.com/jobs?q=example'],
      defaultUrls: [],
    });

    expect(result.urls[0]!.jsHeavyHint).toBe(true);
  });

  it('marks glassdoor URLs as jsHeavyHint=true', () => {
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls: ['https://www.glassdoor.nl/Overzicht/example'],
      defaultUrls: [],
    });

    expect(result.urls[0]!.jsHeavyHint).toBe(true);
  });

  it('marks regular company website as jsHeavyHint=false', () => {
    const result = buildSourceSet({
      sitemapUrls: ['https://example.nl/over-ons'],
      serpUrls: [],
      defaultUrls: [],
    });

    expect(result.urls[0]!.jsHeavyHint).toBe(false);
  });

  it('marks hash-route SPA URLs as jsHeavyHint=true', () => {
    const result = buildSourceSet({
      sitemapUrls: ['https://app.example.nl/#/dashboard'],
      serpUrls: [],
      defaultUrls: [],
    });

    expect(result.urls[0]!.jsHeavyHint).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectJsHeavy (standalone)
// ---------------------------------------------------------------------------

describe('detectJsHeavy', () => {
  it.each([
    ['https://www.linkedin.com/company/test', true],
    ['https://nl.trustpilot.com/review/test', true],
    ['https://nl.indeed.com/jobs', true],
    ['https://www.glassdoor.nl/review', true],
    ['https://www.google.com/maps/place/test', true],
    ['https://maps.app.goo.gl/abc', true],
    ['https://werkzoeken.nl/vacature', true],
    ['https://jobbird.nl/vacature', true],
    ['https://monsterboard.nl/vacature', true],
    ['https://mysite.webflow.io', true],
    ['https://mysite.framer.website', true],
    ['https://framer.com/sites', true],
    ['https://example.nl/over-ons', false],
    ['https://company.nl/diensten', false],
    ['https://www.bedrijf.nl', false],
  ])('detectJsHeavy(%s) === %s', (url, expected) => {
    expect(detectJsHeavy(url)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// normalizeUrlForDedup (standalone)
// ---------------------------------------------------------------------------

describe('normalizeUrlForDedup', () => {
  it('strips www prefix', () => {
    expect(normalizeUrlForDedup('https://www.example.com/page')).toBe(
      'example.com/page',
    );
  });

  it('strips trailing slash', () => {
    expect(normalizeUrlForDedup('https://example.com/page/')).toBe(
      'example.com/page',
    );
  });

  it('strips scheme', () => {
    expect(normalizeUrlForDedup('http://example.com/page')).toBe(
      'example.com/page',
    );
    expect(normalizeUrlForDedup('https://example.com/page')).toBe(
      'example.com/page',
    );
  });

  it('lowercases the result', () => {
    expect(normalizeUrlForDedup('https://EXAMPLE.COM/Page')).toBe(
      'example.com/page',
    );
  });

  it('handles malformed URLs gracefully', () => {
    const result = normalizeUrlForDedup('not-a-valid-url');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// rawCounts — empty sources
// ---------------------------------------------------------------------------

describe('buildSourceSet — rawCounts with empty sources', () => {
  it('returns all-zero rawCounts when all sources are empty', () => {
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls: [],
      defaultUrls: [],
    });

    expect(result.rawCounts).toEqual({
      sitemap: { discovered: 0, capped: 0 },
      serp: { discovered: 0, capped: 0 },
      default: { discovered: 0, capped: 0 },
    });
    expect(result.urls).toHaveLength(0);
    expect(result.dedupRemovedCount).toBe(0);
  });

  it('sets discoveredAt as a valid ISO timestamp', () => {
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls: [],
      defaultUrls: [],
    });
    expect(result.discoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('includes serpDiscoveredAt when provided', () => {
    const serpTs = '2026-03-01T10:00:00.000Z';
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls: [],
      defaultUrls: [],
      serpDiscoveredAt: serpTs,
    });
    expect(result.serpDiscoveredAt).toBe(serpTs);
  });

  it('omits serpDiscoveredAt when not provided', () => {
    const result = buildSourceSet({
      sitemapUrls: [],
      serpUrls: [],
      defaultUrls: [],
    });
    expect(result.serpDiscoveredAt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractSourceSet
// ---------------------------------------------------------------------------

describe('extractSourceSet', () => {
  const validSourceSet: SourceSet = {
    urls: [
      { url: 'https://example.com', provenance: 'sitemap', jsHeavyHint: false },
    ],
    discoveredAt: '2026-03-01T10:00:00.000Z',
    dedupRemovedCount: 0,
    rawCounts: {
      sitemap: { discovered: 1, capped: 1 },
      serp: { discovered: 0, capped: 0 },
      default: { discovered: 0, capped: 0 },
    },
  };

  it('returns SourceSet from a valid inputSnapshot', () => {
    const snapshot = { sourceSet: validSourceSet };
    const result = extractSourceSet(snapshot);

    expect(result).not.toBeNull();
    expect(result!.urls).toHaveLength(1);
    expect(result!.discoveredAt).toBe('2026-03-01T10:00:00.000Z');
  });

  it('returns null from a null snapshot', () => {
    expect(extractSourceSet(null)).toBeNull();
  });

  it('returns null from an empty object snapshot', () => {
    expect(extractSourceSet({})).toBeNull();
  });

  it('returns null when snapshot has no sourceSet field', () => {
    expect(
      extractSourceSet({ serpCache: { discoveredAt: '2026-03-01' } }),
    ).toBeNull();
  });

  it('returns null when sourceSet is malformed (missing urls)', () => {
    const snapshot = {
      sourceSet: { discoveredAt: '2026-03-01T10:00:00Z', rawCounts: {} },
    };
    expect(extractSourceSet(snapshot)).toBeNull();
  });

  it('returns null when sourceSet is malformed (missing discoveredAt)', () => {
    const snapshot = {
      sourceSet: { urls: [], rawCounts: {} },
    };
    expect(extractSourceSet(snapshot)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// defaultResearchUrls
// ---------------------------------------------------------------------------

describe('defaultResearchUrls', () => {
  it('returns an array of URLs for the given domain', () => {
    const urls = defaultResearchUrls('example.nl');
    expect(Array.isArray(urls)).toBe(true);
    expect(urls.length).toBeGreaterThan(10);
  });

  it('all URLs start with https://example.nl', () => {
    const urls = defaultResearchUrls('example.nl');
    expect(urls.every((u) => u.startsWith('https://example.nl'))).toBe(true);
  });

  it('includes Dutch business paths', () => {
    const urls = defaultResearchUrls('example.nl');
    expect(urls).toContain('https://example.nl/over-ons');
    expect(urls).toContain('https://example.nl/diensten');
    expect(urls).toContain('https://example.nl/werkwijze');
  });

  it('includes English fallback paths', () => {
    const urls = defaultResearchUrls('example.nl');
    expect(urls).toContain('https://example.nl/about');
    expect(urls).toContain('https://example.nl/services');
  });
});
