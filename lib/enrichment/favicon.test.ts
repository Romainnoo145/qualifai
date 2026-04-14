import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getFaviconUrl,
  buildInlineDuckDuckGoFaviconUrl,
  buildInlineGoogleFaviconUrl,
} from './favicon';

describe('getFaviconUrl', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns DuckDuckGo favicon URL when DuckDuckGo probe succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await getFaviconUrl('marfa.nl');

    expect(result).toBe('https://icons.duckduckgo.com/ip3/marfa.nl.ico');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toContain('icons.duckduckgo.com');
  });

  it('falls back to Google when DuckDuckGo returns 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await getFaviconUrl('marfa.nl');

    expect(result).toBe(
      'https://www.google.com/s2/favicons?domain=marfa.nl&sz=128',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when both DuckDuckGo and Google fail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await getFaviconUrl('nonexistent.fake');

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when both probes time out (AbortError)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await getFaviconUrl('slow.example.com');

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null for empty domain without calling fetch', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const result = await getFaviconUrl('');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes domain with protocol, www, and path before probing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await getFaviconUrl('https://www.marfa.nl/contact');

    const probedUrl = fetchMock.mock.calls[0]![0] as string;
    expect(probedUrl).toContain('marfa.nl');
    expect(probedUrl).not.toContain('www.marfa.nl');
    expect(probedUrl).not.toContain('/contact');
  });
});

describe('buildInlineDuckDuckGoFaviconUrl', () => {
  it('builds a DuckDuckGo ip3 URL', () => {
    const url = buildInlineDuckDuckGoFaviconUrl('marfa.nl');
    expect(url).toBe('https://icons.duckduckgo.com/ip3/marfa.nl.ico');
  });

  it('normalizes the domain before building', () => {
    const url = buildInlineDuckDuckGoFaviconUrl('https://www.marfa.nl/contact');
    expect(url).toBe('https://icons.duckduckgo.com/ip3/marfa.nl.ico');
  });

  it('returns null for empty input', () => {
    expect(buildInlineDuckDuckGoFaviconUrl('')).toBeNull();
  });
});

describe('buildInlineGoogleFaviconUrl', () => {
  it('builds a Google s2 URL at the requested size', () => {
    const url = buildInlineGoogleFaviconUrl('marfa.nl', 64);
    expect(url).toBe(
      'https://www.google.com/s2/favicons?domain=marfa.nl&sz=64',
    );
  });

  it('defaults to sz=128 when no size is given', () => {
    const url = buildInlineGoogleFaviconUrl('marfa.nl');
    expect(url).toBe(
      'https://www.google.com/s2/favicons?domain=marfa.nl&sz=128',
    );
  });

  it('normalizes the domain before building', () => {
    const url = buildInlineGoogleFaviconUrl(
      'https://www.marfa.nl/contact',
      128,
    );
    expect(url).toBe(
      'https://www.google.com/s2/favicons?domain=marfa.nl&sz=128',
    );
  });

  it('returns null for empty input', () => {
    expect(buildInlineGoogleFaviconUrl('', 64)).toBeNull();
  });
});
