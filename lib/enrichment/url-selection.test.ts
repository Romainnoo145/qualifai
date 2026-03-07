import { describe, expect, it } from 'vitest';
import { selectResearchUrls } from './url-selection';

describe('selectResearchUrls', () => {
  it('prioritizes recent and context-relevant URLs', () => {
    const result = selectResearchUrls({
      topN: 2,
      context: {
        industry: 'construction',
        description: 'process automation for project planning',
      },
      candidates: [
        {
          url: 'https://example.com/privacy-policy',
          source: 'sitemap',
          lastmod: '2026-03-01',
        },
        {
          url: 'https://example.com/project-planning-automation',
          source: 'sitemap',
          lastmod: '2026-03-02',
        },
        {
          url: 'https://example.com/news/company',
          source: 'sitemap',
          lastmod: '2023-01-01',
        },
      ],
    });

    expect(result.selectedUrls[0]?.url).toBe(
      'https://example.com/project-planning-automation',
    );
    expect(result.selectedUrls[0]?.score).toBeGreaterThan(
      result.selectedUrls[1]?.score ?? -1,
    );
  });

  it('applies segment-cap in second pass and avoids over-concentration', () => {
    const candidates = [
      ...Array.from({ length: 8 }, (_, i) => ({
        url: `https://example.com/verhalen/article-${i + 1}`,
        source: 'sitemap' as const,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        url: `https://example.com/nieuws/item-${i + 1}`,
        source: 'sitemap' as const,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        url: `https://example.com/projecten/case-${i + 1}`,
        source: 'sitemap' as const,
      })),
    ];

    const result = selectResearchUrls({
      topN: 10,
      candidates,
      context: {
        description: 'nieuws projecten verhalen',
      },
    });

    expect(result.selectedTotal).toBe(10);
    expect((result.selectedBySegment.verhalen ?? 0) <= 5).toBe(true); // cap 35% => 3 in pass2, pass3 may fill remaining only when needed
    expect((result.selectedBySegment.nieuws ?? 0) > 0).toBe(true);
    expect((result.selectedBySegment.projecten ?? 0) > 0).toBe(true);
  });

  it('deduplicates normalized URLs deterministically', () => {
    const result = selectResearchUrls({
      topN: 5,
      candidates: [
        { url: 'https://www.example.com/nl/nieuws/', source: 'sitemap' },
        { url: 'https://example.com/nl/nieuws', source: 'serp_site' },
        { url: 'https://example.com/nl/nieuws?utm_source=test', source: 'seed' },
      ],
    });

    expect(result.discoveredTotal).toBe(2);
    expect(result.selectedTotal).toBe(2);
    expect(result.selectedUrls[0]?.rank).toBe(1);
    expect(result.selectedUrls[1]?.rank).toBe(2);
  });

  it('applies staleness penalty to time-sensitive URLs but not evergreen pages', () => {
    const result = selectResearchUrls({
      topN: 2,
      candidates: [
        {
          url: 'https://example.com/nieuws/jaarresultaten-2024',
          source: 'sitemap',
        },
        {
          url: 'https://example.com/contact',
          source: 'sitemap',
        },
      ],
    });

    expect(result.selectedUrls[0]?.url).toBe('https://example.com/contact');
    expect(result.selectedUrls[1]?.url).toBe(
      'https://example.com/nieuws/jaarresultaten-2024',
    );
  });

  it('prioritizes fresher news pages over stale news pages', () => {
    const result = selectResearchUrls({
      topN: 2,
      candidates: [
        {
          url: 'https://example.com/nieuws/jaarresultaten-2024',
          source: 'sitemap',
          lastmod: '2024-02-01',
        },
        {
          url: 'https://example.com/nieuws/jaarresultaten-2026',
          source: 'sitemap',
          lastmod: '2026-02-20',
        },
      ],
    });

    expect(result.selectedUrls[0]?.url).toBe(
      'https://example.com/nieuws/jaarresultaten-2026',
    );
    expect(result.selectedUrls[0]?.score).toBeGreaterThan(
      result.selectedUrls[1]?.score ?? -1,
    );
  });

  it('demotes old-year annual report URLs even when they have lastmod', () => {
    const result = selectResearchUrls({
      topN: 2,
      candidates: [
        {
          url: 'https://example.com/news/annual-report-2024',
          source: 'sitemap',
          lastmod: '2026-02-20',
        },
        {
          url: 'https://example.com/news/annual-report-2026',
          source: 'sitemap',
          lastmod: '2026-02-20',
        },
      ],
    });

    expect(result.selectedUrls[0]?.url).toBe(
      'https://example.com/news/annual-report-2026',
    );
    expect(result.selectedUrls[0]?.score).toBeGreaterThan(
      result.selectedUrls[1]?.score ?? -1,
    );
  });

  it('penalizes guessed seed subpaths relative to homepage', () => {
    const result = selectResearchUrls({
      topN: 2,
      candidates: [
        { url: 'https://example.com/contact', source: 'seed' },
        { url: 'https://example.com/', source: 'seed' },
      ],
    });

    expect(result.selectedUrls[0]?.url).toBe('https://example.com/');
    expect(result.selectedUrls[1]?.url).toBe('https://example.com/contact');
  });

  it('caps evergreen dominance when there are many alternatives', () => {
    const evergreenCandidates = [
      'https://example.com/',
      'https://example.com/contact',
      'https://example.com/about',
      'https://example.com/services',
      'https://example.com/solutions',
      'https://example.com/team',
      'https://example.com/careers',
      'https://example.com/expertise',
    ].map((url) => ({ url, source: 'sitemap' as const }));

    const newsCandidates = Array.from({ length: 52 }, (_, i) => ({
      url: `https://example.com/news/item-${i + 1}`,
      source: 'sitemap' as const,
      lastmod: '2026-02-20',
    }));

    const result = selectResearchUrls({
      topN: 40,
      candidates: [...evergreenCandidates, ...newsCandidates],
    });

    const evergreenSelected = result.selectedUrls.filter((item) =>
      [
        '/',
        '/contact',
        '/about',
        '/services',
        '/solutions',
        '/team',
        '/careers',
        '/expertise',
      ].some((path) => item.url.endsWith(path)),
    ).length;

    expect(evergreenSelected <= 8).toBe(true);
  });
});
