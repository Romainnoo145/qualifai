import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveLogoUrl } from './logo-pipeline';
import * as ogLogoModule from './og-logo';

describe('resolveLogoUrl', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns null for empty domain without calling anything', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
    const ogSpy = vi.spyOn(ogLogoModule, 'getHighResLogoUrl');

    const result = await resolveLogoUrl('');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ogSpy).not.toHaveBeenCalled();
  });

  it('returns Apollo logoUrl first if it HEAD-probes OK', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'content-length': '5432' },
      }),
    ) as typeof fetch;

    const result = await resolveLogoUrl('example.com', {
      apolloLogoUrl: 'https://logo.example.com/logo.png',
    });

    expect(result).toBe('https://logo.example.com/logo.png');
  });

  it('skips Apollo logoUrl when HEAD probe fails and falls through to og-logo', async () => {
    global.fetch = vi
      .fn()
      // Apollo HEAD → 404
      .mockResolvedValueOnce(
        new Response(null, { status: 404 }),
      ) as typeof fetch;
    vi.spyOn(ogLogoModule, 'getHighResLogoUrl').mockResolvedValue(
      'https://example.com/og-image.png',
    );

    const result = await resolveLogoUrl('example.com', {
      apolloLogoUrl: 'https://broken.example.com/logo.png',
    });

    expect(result).toBe('https://example.com/og-image.png');
  });

  it('returns og-logo URL when Apollo is absent and og-logo succeeds', async () => {
    vi.spyOn(ogLogoModule, 'getHighResLogoUrl').mockResolvedValue(
      'https://marfa.nl/og-banner.jpg',
    );

    const result = await resolveLogoUrl('marfa.nl');

    expect(result).toBe('https://marfa.nl/og-banner.jpg');
  });

  it('falls through to DuckDuckGo favicon when og-logo returns null and DDG 200s', async () => {
    vi.spyOn(ogLogoModule, 'getHighResLogoUrl').mockResolvedValue(null);
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'content-length': '1150' },
      }),
    ) as typeof fetch;

    const result = await resolveLogoUrl('smallco.nl');

    expect(result).toBe('https://icons.duckduckgo.com/ip3/smallco.nl.ico');
  });

  it('falls through to Google s2 when og-logo and DDG both fail', async () => {
    vi.spyOn(ogLogoModule, 'getHighResLogoUrl').mockResolvedValue(null);
    global.fetch = vi
      .fn()
      // DDG HEAD → 404
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      // Google HEAD → 200 with body
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'content-length': '2048' },
        }),
      ) as typeof fetch;

    const result = await resolveLogoUrl('stb-kozijnen.nl');

    expect(result).toBe(
      'https://www.google.com/s2/favicons?domain=stb-kozijnen.nl&sz=128',
    );
  });

  it('returns null when all sources fail', async () => {
    vi.spyOn(ogLogoModule, 'getHighResLogoUrl').mockResolvedValue(null);
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 })) as typeof fetch;

    const result = await resolveLogoUrl('nonexistent.fake');

    expect(result).toBeNull();
  });

  it('rejects HEAD responses with zero content-length (generic globe path)', async () => {
    vi.spyOn(ogLogoModule, 'getHighResLogoUrl').mockResolvedValue(null);
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'content-length': '0' },
      }),
    ) as typeof fetch;

    const result = await resolveLogoUrl('empty-body.example');

    expect(result).toBeNull();
  });

  it('rejects Apollo URL that times out (AbortError)', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    }) as typeof fetch;
    vi.spyOn(ogLogoModule, 'getHighResLogoUrl').mockResolvedValue(
      'https://example.com/og.png',
    );

    const result = await resolveLogoUrl('example.com', {
      apolloLogoUrl: 'https://slow.example.com/logo.png',
    });

    // Apollo timed out → fell through to og-logo
    expect(result).toBe('https://example.com/og.png');
  });
});
