import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SerpDiscoveryResult } from './serp';

// Mock the serpapi module before importing the module under test
vi.mock('serpapi', () => ({
  getJson: vi.fn(),
  config: { api_key: '' },
}));

// We must import after vi.mock to get the mocked version
import { getJson } from 'serpapi';
import { discoverSerpUrls } from './serp';

const mockGetJson = vi.mocked(getJson);

describe('discoverSerpUrls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset env
    delete process.env.SERP_API_KEY;
  });

  it('returns empty arrays when SERP_API_KEY is not set', async () => {
    // Ensure no API key is set
    delete process.env.SERP_API_KEY;

    const result: SerpDiscoveryResult = await discoverSerpUrls({
      companyName: 'Acme',
      domain: 'acme.nl',
    });

    expect(result.reviewUrls).toEqual([]);
    expect(result.jobUrls).toEqual([]);
    expect(result.discoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it('performs Google Maps two-step flow and returns review URLs with mapsDataId', async () => {
    process.env.SERP_API_KEY = 'test-key-123';

    mockGetJson
      .mockResolvedValueOnce({
        place_results: { data_id: 'abc123' },
      })
      .mockResolvedValueOnce({
        reviews: [
          { link: 'https://example.com/review1' },
          { link: 'https://example.com/review2' },
        ],
      })
      .mockResolvedValueOnce({
        jobs_results: [],
      });

    const result = await discoverSerpUrls({
      companyName: 'Acme',
      domain: 'acme.nl',
    });

    expect(result.reviewUrls).toEqual([
      'https://example.com/review1',
      'https://example.com/review2',
    ]);
    expect(result.mapsDataId).toBe('abc123');
    expect(result.jobUrls).toEqual([]);
    expect(result.discoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns empty reviewUrls and skips google_maps_reviews when no data_id found', async () => {
    process.env.SERP_API_KEY = 'test-key-123';

    mockGetJson
      .mockResolvedValueOnce({
        place_results: {},
      })
      .mockResolvedValueOnce({
        jobs_results: [],
      });

    const result = await discoverSerpUrls({
      companyName: 'Acme',
      domain: 'acme.nl',
    });

    expect(result.reviewUrls).toEqual([]);
    expect(result.mapsDataId).toBeUndefined();

    // Only 2 calls: google_maps and google_jobs (no google_maps_reviews)
    const calls = mockGetJson.mock.calls;
    const engines = calls.map(
      (call) => (call[0] as unknown as Record<string, unknown>).engine,
    );
    expect(engines).not.toContain('google_maps_reviews');
  });

  it('discovers job listing URLs from jobs_results', async () => {
    process.env.SERP_API_KEY = 'test-key-123';

    mockGetJson
      .mockResolvedValueOnce({
        place_results: {},
      })
      .mockResolvedValueOnce({
        jobs_results: [
          { link: 'https://example.com/job1' },
          { apply_options: [{ link: 'https://example.com/job2' }] },
        ],
      });

    const result = await discoverSerpUrls({
      companyName: 'Acme',
      domain: 'acme.nl',
    });

    expect(result.jobUrls).toContain('https://example.com/job1');
    expect(result.jobUrls).toContain('https://example.com/job2');
  });

  it('returns empty arrays when getJson throws for both engines', async () => {
    process.env.SERP_API_KEY = 'test-key-123';

    mockGetJson.mockRejectedValue(new Error('API error'));

    const result = await discoverSerpUrls({
      companyName: 'Acme',
      domain: 'acme.nl',
    });

    expect(result.reviewUrls).toEqual([]);
    expect(result.jobUrls).toEqual([]);
    expect(result.discoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('caps reviewUrls at 5 and jobUrls at 5', async () => {
    process.env.SERP_API_KEY = 'test-key-123';

    const manyReviews = Array.from({ length: 12 }, (_, i) => ({
      link: `https://example.com/review${i + 1}`,
    }));
    const manyJobs = Array.from({ length: 10 }, (_, i) => ({
      link: `https://example.com/job${i + 1}`,
    }));

    mockGetJson
      .mockResolvedValueOnce({
        place_results: { data_id: 'data123' },
      })
      .mockResolvedValueOnce({
        reviews: manyReviews,
      })
      .mockResolvedValueOnce({
        jobs_results: manyJobs,
      });

    const result = await discoverSerpUrls({
      companyName: 'Acme',
      domain: 'acme.nl',
    });

    expect(result.reviewUrls).toHaveLength(5);
    expect(result.jobUrls).toHaveLength(5);
  });
});
