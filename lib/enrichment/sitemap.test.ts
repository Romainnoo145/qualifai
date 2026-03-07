import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import {
  discoverSitemapUrls,
  type SitemapDiscoveryResult,
} from './sitemap';

type MockResponse = {
  status?: number;
  body?: string | Buffer;
  headers?: Record<string, string>;
};

function xmlResponse(body: string): MockResponse {
  return {
    status: 200,
    body,
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  };
}

function buildFetchMock(map: Record<string, MockResponse>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const key = String(input);
    const response = map[key] ?? { status: 404, body: 'not found' };
    const status = response.status ?? 200;
    const body = response.body ?? '';
    const headers = response.headers ?? {};
    return new Response(body, { status, headers });
  });
}

describe('discoverSitemapUrls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('discovers nested sitemap index URLs and filters non-content assets', async () => {
    const fetchMock = buildFetchMock({
      'https://example.com/robots.txt': {
        status: 200,
        body: 'User-agent: *\nSitemap: https://www.example.com/sitemap.xml\n',
        headers: { 'content-type': 'text/plain' },
      },
      'https://www.example.com/robots.txt': {
        status: 404,
        body: 'not found',
      },
      'https://example.com/sitemap.xml': {
        status: 404,
        body: 'not found',
      },
      'https://www.example.com/sitemap.xml': xmlResponse(`
        <?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://www.example.com/sitemap-nl.xml</loc></sitemap>
          <sitemap><loc>https://www.example.com/sitemap-en.xml</loc></sitemap>
        </sitemapindex>
      `),
      'https://www.example.com/sitemap-nl.xml': xmlResponse(`
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://www.example.com/nl/nieuws/jaarresultaten</loc>
            <lastmod>2026-03-01</lastmod>
          </url>
          <url>
            <loc>https://www.example.com/assets/logo.png</loc>
          </url>
        </urlset>
      `),
      'https://www.example.com/sitemap-en.xml': xmlResponse(`
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://www.example.com/en/about</loc>
            <lastmod>2025-11-11</lastmod>
          </url>
        </urlset>
      `),
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverSitemapUrls('example.com');

    expect(result.status).toBe('ok');
    expect(result.discoveredTotal).toBe(2);
    expect(result.candidates.map((c) => c.url)).toContain(
      'https://www.example.com/nl/nieuws/jaarresultaten',
    );
    expect(result.candidates.map((c) => c.url)).toContain(
      'https://www.example.com/en/about',
    );
    expect(result.candidates.some((c) => c.url.includes('logo.png'))).toBe(false);

    const nl = result.candidates.find((c) => c.url.includes('/nl/nieuws/'));
    expect(nl?.topSegment).toBe('nl');
    expect(nl?.pathDepth).toBe(3);
  });

  it('returns blocked when seeds are blocked by WAF', async () => {
    const fetchMock = buildFetchMock({
      'https://example.com/robots.txt': { status: 403, body: 'forbidden' },
      'https://www.example.com/robots.txt': { status: 403, body: 'forbidden' },
      'https://example.com/sitemap.xml': { status: 403, body: 'forbidden' },
      'https://www.example.com/sitemap.xml': { status: 403, body: 'forbidden' },
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverSitemapUrls('example.com');

    expect(result.status).toBe('blocked');
    expect(result.errorCode).toBe('HTTP_403');
    expect(result.discoveredTotal).toBe(0);
  });

  it('supports .xml.gz sitemap payloads', async () => {
    const gzPayload = gzipSync(`
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://www.example.com/nl/verhalen</loc></url>
      </urlset>
    `);

    const fetchMock = buildFetchMock({
      'https://example.com/robots.txt': { status: 404, body: 'not found' },
      'https://www.example.com/robots.txt': { status: 404, body: 'not found' },
      'https://example.com/sitemap.xml': { status: 404, body: 'not found' },
      'https://www.example.com/sitemap.xml': xmlResponse(`
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>https://www.example.com/sitemap-pages.xml.gz</loc></sitemap>
        </sitemapindex>
      `),
      'https://www.example.com/sitemap-pages.xml.gz': {
        status: 200,
        body: gzPayload,
        headers: { 'content-type': 'application/gzip' },
      },
    });

    vi.stubGlobal('fetch', fetchMock);

    const result: SitemapDiscoveryResult = await discoverSitemapUrls('example.com');

    expect(result.status).toBe('ok');
    expect(result.discoveredTotal).toBe(1);
    expect(result.candidates[0]?.url).toBe('https://www.example.com/nl/verhalen');
  });
});
