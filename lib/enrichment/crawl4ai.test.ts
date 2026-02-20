import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractMarkdown,
  ingestCrawl4aiEvidenceDrafts,
} from '@/lib/enrichment/crawl4ai';

describe('crawl4ai client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractMarkdown', () => {
    it('returns markdown and title on successful extraction', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: [
            {
              markdown: '# Page Title\nContent here',
              metadata: { title: 'Page Title' },
            },
          ],
        }),
      } as Response);

      const result = await extractMarkdown('https://example.com');

      expect(result).toEqual({
        markdown: '# Page Title\nContent here',
        title: 'Page Title',
      });
    });

    it('returns empty strings when markdown is empty', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: [{ markdown: '', metadata: {} }],
        }),
      } as Response);

      const result = await extractMarkdown('https://example.com');

      expect(result).toEqual({ markdown: '', title: '' });
    });

    it('returns empty strings on non-200 response without throwing', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await extractMarkdown('https://example.com');

      expect(result).toEqual({ markdown: '', title: '' });
    });

    it('returns empty strings on network timeout (AbortError) without throwing', async () => {
      const mockFetch = vi.mocked(fetch);
      const abortError = new DOMException(
        'The operation was aborted',
        'AbortError',
      );
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await extractMarkdown('https://example.com');

      expect(result).toEqual({ markdown: '', title: '' });
    });

    it('sends request body with correct wrapped format including browser_config and crawler_config', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: [{ markdown: 'content', metadata: { title: 'Test' } }],
        }),
      } as Response);

      await extractMarkdown('https://example.com');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;

      expect(body.browser_config).toEqual({
        type: 'BrowserConfig',
        params: { headless: true },
      });
      expect(body.crawler_config).toEqual({
        type: 'CrawlerRunConfig',
        params: {
          cache_mode: 'bypass',
          magic: true,
          simulate_user: true,
          wait_for_timeout: 15000,
          delay_before_return_html: 2,
        },
      });
    });
  });

  describe('ingestCrawl4aiEvidenceDrafts', () => {
    it('returns EvidenceDraft with sourceType REVIEWS for google.com/maps URL', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: [
            {
              markdown:
                'This restaurant has great reviews and excellent service with many happy customers who return frequently.',
              metadata: { title: 'Restaurant Reviews' },
            },
          ],
        }),
      } as Response);

      const drafts = await ingestCrawl4aiEvidenceDrafts([
        'https://www.google.com/maps/place/restaurant',
      ]);

      expect(drafts.length).toBeGreaterThan(0);
      expect(drafts[0]?.sourceType).toBe('REVIEWS');
    });

    it('returns EvidenceDraft with sourceType JOB_BOARD for non-review URL', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: [
            {
              markdown:
                'We are hiring a senior developer to join our team and work on exciting projects with modern technology stacks.',
              metadata: { title: 'Job Opening - Senior Dev' },
            },
          ],
        }),
      } as Response);

      const drafts = await ingestCrawl4aiEvidenceDrafts([
        'https://example.com/jobs/dev',
      ]);

      expect(drafts.length).toBeGreaterThan(0);
      expect(drafts[0]?.sourceType).toBe('JOB_BOARD');
    });

    it('creates fallback draft with confidenceScore 0.55 and metadata.fallback true for minimal content', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: [{ markdown: 'Too short', metadata: { title: 'Short' } }],
        }),
      } as Response);

      const drafts = await ingestCrawl4aiEvidenceDrafts([
        'https://example.com/page',
      ]);

      expect(drafts.length).toBe(1);
      expect(drafts[0]?.confidenceScore).toBe(0.55);
      expect(drafts[0]?.metadata?.fallback).toBe(true);
    });

    it('caps URLs at 10 and only calls fetch 10 times for 15 URLs', async () => {
      const mockFetch = vi.mocked(fetch);
      // Mock 10 successful responses
      for (let i = 0; i < 10; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            results: [
              {
                markdown:
                  'This is a sufficiently long piece of content with many words to exceed the eighty character minimum threshold.',
                metadata: { title: `Page ${i}` },
              },
            ],
          }),
        } as Response);
      }

      const urls = Array.from(
        { length: 15 },
        (_, i) => `https://example.com/page-${i}`,
      );
      await ingestCrawl4aiEvidenceDrafts(urls);

      expect(mockFetch).toHaveBeenCalledTimes(10);
    });

    it('truncates snippet to ~240 chars with newlines replaced by spaces', async () => {
      const mockFetch = vi.mocked(fetch);
      const longMarkdown =
        'A'.repeat(200) + '\n' + 'B'.repeat(200) + '\n' + 'C'.repeat(100);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          results: [
            { markdown: longMarkdown, metadata: { title: 'Long Page' } },
          ],
        }),
      } as Response);

      const drafts = await ingestCrawl4aiEvidenceDrafts([
        'https://example.com/long',
      ]);

      expect(drafts.length).toBe(1);
      const snippet = drafts[0]?.snippet ?? '';
      expect(snippet.length).toBeLessThanOrEqual(242);
      expect(snippet).not.toContain('\n');
    });
  });
});
