import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHighResLogoUrl } from './og-logo';

describe('getHighResLogoUrl', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns og:image URL when homepage has og:image and HEAD probe succeeds', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://example.com/og.jpg">
        </head>
      </html>
    `;

    const fetchMock = vi
      .fn()
      // GET homepage
      .mockResolvedValueOnce(
        new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      )
      // HEAD probe for og:image
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'content-length': '50000' },
        }),
      );
    global.fetch = fetchMock as typeof fetch;

    const result = await getHighResLogoUrl('example.com');

    expect(result).toBe('https://example.com/og.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://example.com');
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: 'HEAD' });
  });

  it('falls through to twitter:image when og:image HEAD probe fails', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://example.com/og.jpg">
          <meta name="twitter:image" content="https://example.com/twitter.jpg">
        </head>
      </html>
    `;

    const fetchMock = vi
      .fn()
      // GET homepage
      .mockResolvedValueOnce(new Response(html, { status: 200 }))
      // HEAD probe for og:image — fails (ok=false)
      .mockResolvedValueOnce(
        new Response(null, {
          status: 404,
          headers: { 'content-length': '0' },
        }),
      )
      // HEAD probe for twitter:image — succeeds
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'content-length': '42000' },
        }),
      );
    global.fetch = fetchMock as typeof fetch;

    const result = await getHighResLogoUrl('example.com');

    expect(result).toBe('https://example.com/twitter.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('extracts og:image in reversed attribute order (content= before property=)', async () => {
    const html = `
      <html>
        <head>
          <meta content="https://example.com/og-reversed.jpg" property="og:image">
        </head>
      </html>
    `;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(html, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'content-length': '30000' },
        }),
      );
    global.fetch = fetchMock as typeof fetch;

    const result = await getHighResLogoUrl('example.com');

    expect(result).toBe('https://example.com/og-reversed.jpg');
  });

  it('resolves relative og:image URL against the domain before HEAD probe', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="/og-image.png">
        </head>
      </html>
    `;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(html, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'content-length': '12345' },
        }),
      );
    global.fetch = fetchMock as typeof fetch;

    const result = await getHighResLogoUrl('example.com');

    expect(result).toBe('https://example.com/og-image.png');
    // Verify the HEAD probe was called with the resolved absolute URL
    expect(fetchMock.mock.calls[1]![0]).toBe(
      'https://example.com/og-image.png',
    );
  });

  it('returns null when all candidates exist but all HEAD probes fail', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://example.com/og.jpg">
          <meta name="twitter:image" content="https://example.com/twitter.jpg">
        </head>
      </html>
    `;

    const fetchMock = vi
      .fn()
      // GET homepage
      .mockResolvedValueOnce(new Response(html, { status: 200 }))
      // HEAD probes all fail
      .mockResolvedValue(
        new Response(null, {
          status: 404,
          headers: { 'content-length': '0' },
        }),
      );
    global.fetch = fetchMock as typeof fetch;

    const result = await getHighResLogoUrl('example.com');

    expect(result).toBeNull();
  });

  it('returns null when homepage GET throws AbortError (timeout)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await getHighResLogoUrl('slow.example.com');

    expect(result).toBeNull();
    // Only the GET was attempted, not any HEAD probes
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('extracts apple-touch-icon and picks the largest sizes= value when multiple are present', async () => {
    const html = `
      <html>
        <head>
          <link rel="apple-touch-icon" sizes="57x57" href="/apple-57.png">
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-180.png">
          <link rel="apple-touch-icon" sizes="120x120" href="/apple-120.png">
        </head>
      </html>
    `;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(html, { status: 200 }))
      // HEAD probe for apple-180.png (largest) — succeeds
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'content-length': '8000' },
        }),
      );
    global.fetch = fetchMock as typeof fetch;

    const result = await getHighResLogoUrl('example.com');

    expect(result).toBe('https://example.com/apple-180.png');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null for empty or invalid domain without calling fetch', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    const result = await getHighResLogoUrl('');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
