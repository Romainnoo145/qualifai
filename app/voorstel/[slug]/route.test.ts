import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/prisma', () => ({
  default: {
    prospect: { findFirst: vi.fn() },
    quote: { findFirst: vi.fn() },
  },
}));

const prisma = (await import('@/lib/prisma')).default as any;

function makeReq() {
  return new Request('http://localhost/voorstel/test');
}

function makeParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe('GET /voorstel/[slug]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for unknown slug', async () => {
    prisma.prospect.findFirst.mockResolvedValueOnce(null);
    const res = await GET(makeReq(), makeParams('unknown'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for STANDARD prospect (cold-track deferred)', async () => {
    prisma.prospect.findFirst.mockResolvedValueOnce({
      id: 'p1',
      voorstelMode: 'STANDARD',
      bespokeUrl: null,
    });
    const res = await GET(makeReq(), makeParams('cold'));
    expect(res.status).toBe(404);
  });

  it('returns 500 for BESPOKE prospect with no bespokeUrl', async () => {
    prisma.prospect.findFirst.mockResolvedValueOnce({
      id: 'p1',
      voorstelMode: 'BESPOKE',
      bespokeUrl: null,
    });
    const res = await GET(makeReq(), makeParams('warm'));
    expect(res.status).toBe(500);
  });

  it('serves snapshot when present (no live fetch)', async () => {
    prisma.prospect.findFirst.mockResolvedValueOnce({
      id: 'p1',
      voorstelMode: 'BESPOKE',
      bespokeUrl: 'https://example.com',
    });
    prisma.quote.findFirst.mockResolvedValueOnce({
      bespokeHtmlSnapshot: '<html><head></head><body>Frozen</body></html>',
    });
    const fetchSpy = vi.spyOn(global, 'fetch');
    const res = await GET(makeReq(), makeParams('warm'));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('Frozen');
    expect(body).toContain('<base href="https://example.com/">');
    expect(body).toContain('/api/offerte/viewed');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('falls back to live fetch when no snapshot', async () => {
    prisma.prospect.findFirst.mockResolvedValueOnce({
      id: 'p1',
      voorstelMode: 'BESPOKE',
      bespokeUrl: 'https://example.com',
    });
    prisma.quote.findFirst.mockResolvedValueOnce(null);
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><head></head><body>Live</body></html>',
    } as Response);
    const res = await GET(makeReq(), makeParams('warm'));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('Live');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com',
      expect.any(Object),
    );
    fetchSpy.mockRestore();
  });

  it('returns 502 when live fetch fails', async () => {
    prisma.prospect.findFirst.mockResolvedValueOnce({
      id: 'p1',
      voorstelMode: 'BESPOKE',
      bespokeUrl: 'https://unreachable',
    });
    prisma.quote.findFirst.mockResolvedValueOnce(null);
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('network'));
    const res = await GET(makeReq(), makeParams('warm'));
    expect(res.status).toBe(502);
    fetchSpy.mockRestore();
  });
});
