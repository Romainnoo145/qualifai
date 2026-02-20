import { getJson, config as serpConfig } from 'serpapi';

export interface SerpDiscoveryResult {
  reviewUrls: string[];
  jobUrls: string[];
  mapsDataId?: string;
  discoveredAt: string;
}

interface GoogleMapsResult {
  place_results?: {
    data_id?: string;
  };
}

interface GoogleMapsReviewsResult {
  reviews?: Array<{ link?: string }>;
}

interface GoogleJobsResult {
  jobs_results?: Array<{
    link?: string;
    apply_options?: Array<{ link?: string }>;
  }>;
}

/**
 * Discover Google Maps review URLs and job listing URLs for a given prospect.
 *
 * Uses SerpAPI as the evidence discovery layer — finds URLs that Crawl4AI (plan 08-02)
 * will later extract content from. Discovery and extraction are separate concerns.
 *
 * Accesses SERP_API_KEY via process.env directly (not env.mjs) to keep the module
 * testable without full env setup, consistent with the lazy init pattern.
 */
export async function discoverSerpUrls(input: {
  companyName: string | null;
  domain: string;
}): Promise<SerpDiscoveryResult> {
  const apiKey = process.env.SERP_API_KEY;

  if (!apiKey) {
    return {
      reviewUrls: [],
      jobUrls: [],
      discoveredAt: new Date().toISOString(),
    };
  }

  // Lazy init — set API key before each call
  serpConfig.api_key = apiKey;

  const query = input.companyName ?? input.domain;
  let reviewUrls: string[] = [];
  let mapsDataId: string | undefined;
  const jobUrls: string[] = [];

  // Step 1a: Google Maps — find data_id for the company
  try {
    const mapsResult = (await getJson({
      engine: 'google_maps',
      q: query,
      gl: 'nl',
      hl: 'nl',
    })) as GoogleMapsResult;

    const dataId = mapsResult.place_results?.data_id;

    if (dataId) {
      mapsDataId = dataId;

      // Step 1b: Google Maps Reviews — fetch reviews using data_id
      try {
        const reviewsResult = (await getJson({
          engine: 'google_maps_reviews',
          data_id: dataId,
          hl: 'nl',
          sort_by: 'newestFirst',
        })) as GoogleMapsReviewsResult;

        reviewUrls = (reviewsResult.reviews ?? [])
          .map((r) => r.link)
          .filter(
            (link): link is string =>
              typeof link === 'string' && link.length > 0,
          );
      } catch (error) {
        console.error('[SerpAPI] google_maps_reviews failed:', error);
      }
    }
  } catch (error) {
    console.error('[SerpAPI] google_maps failed:', error);
  }

  // Step 2: Google Jobs — find job listing URLs
  try {
    const jobsResult = (await getJson({
      engine: 'google_jobs',
      q: `${query} jobs vacatures`,
      gl: 'nl',
      hl: 'nl',
    })) as GoogleJobsResult;

    for (const job of jobsResult.jobs_results ?? []) {
      if (typeof job.link === 'string' && job.link.length > 0) {
        jobUrls.push(job.link);
      } else if (job.apply_options?.[0]?.link) {
        jobUrls.push(job.apply_options[0].link);
      }
    }
  } catch (error) {
    console.error('[SerpAPI] google_jobs failed:', error);
  }

  return {
    reviewUrls: reviewUrls.slice(0, 5),
    jobUrls: jobUrls.slice(0, 5),
    ...(mapsDataId !== undefined ? { mapsDataId } : {}),
    discoveredAt: new Date().toISOString(),
  };
}
