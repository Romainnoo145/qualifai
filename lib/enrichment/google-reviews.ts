import { getJson, config as serpConfig } from 'serpapi';
import type { EvidenceDraft } from '@/lib/workflow-engine';

/**
 * Fetch Google Reviews for a company via SerpAPI.
 *
 * Strategy:
 * 1. If mapsDataId is provided, fetch reviews directly from Google Maps Reviews engine
 * 2. Otherwise, search Google Maps to find the business, then fetch reviews
 * 3. If no Maps listing exists, fall back to Google Search for review mentions
 *
 * Returns up to 5 EvidenceDraft items with sourceType REVIEWS.
 * Returns [] if no reviews found — caller handles empty-result recording.
 */
export async function fetchGoogleReviews(input: {
  companyName: string;
  domain: string;
  mapsDataId?: string;
}): Promise<EvidenceDraft[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return [];

  serpConfig.api_key = apiKey;

  try {
    // Try Maps reviews first (structured review data)
    const dataId =
      input.mapsDataId ?? (await findMapsDataId(input.companyName));

    if (dataId) {
      const drafts = await fetchMapsReviews(dataId, input.companyName);
      if (drafts.length > 0) return drafts;
    }

    // Fallback: Google Search for review mentions
    return await fetchSearchReviews(input.companyName, input.domain);
  } catch {
    return [];
  }
}

async function findMapsDataId(
  companyName: string,
): Promise<string | undefined> {
  try {
    const result = (await getJson({
      engine: 'google_maps',
      q: companyName,
      gl: 'nl',
      hl: 'nl',
    })) as { place_results?: { data_id?: string } };
    return result.place_results?.data_id;
  } catch {
    return undefined;
  }
}

async function fetchMapsReviews(
  dataId: string,
  companyName: string,
): Promise<EvidenceDraft[]> {
  const result = (await getJson({
    engine: 'google_maps_reviews',
    data_id: dataId,
    hl: 'nl',
    sort_by: 'newestFirst',
  })) as {
    reviews?: Array<{
      snippet?: string;
      rating?: number;
      date?: string;
      user?: { name?: string };
    }>;
  };

  return (result.reviews ?? [])
    .filter((r) => r.snippet && r.snippet.length >= 20)
    .slice(0, 5)
    .map(
      (r): EvidenceDraft => ({
        sourceType: 'REVIEWS',
        sourceUrl: `https://www.google.com/maps/search/${encodeURIComponent(companyName)}`,
        title: `${companyName} - Google Review${r.user?.name ? ` (${r.user.name})` : ''}`,
        snippet: r.snippet!.slice(0, 400),
        workflowTag: 'workflow-context',
        confidenceScore: 0.75,
        metadata: {
          adapter: 'google-maps-reviews-serpapi',
          source: 'google-maps',
          rating: r.rating,
          date: r.date,
        },
      }),
    );
}

async function fetchSearchReviews(
  companyName: string,
  domain: string,
): Promise<EvidenceDraft[]> {
  const result = (await getJson({
    engine: 'google',
    q: `"${companyName}" reviews ervaringen beoordelingen`,
    gl: 'nl',
    hl: 'nl',
    google_domain: 'google.nl',
    num: 5,
  })) as {
    organic_results?: Array<{
      link?: string;
      title?: string;
      snippet?: string;
    }>;
  };

  return (result.organic_results ?? [])
    .filter(
      (r) =>
        r.link &&
        r.title &&
        r.snippet &&
        r.snippet.length >= 30 &&
        !r.link.includes(domain),
    )
    .slice(0, 5)
    .map(
      (r): EvidenceDraft => ({
        sourceType: 'REVIEWS',
        sourceUrl: r.link!,
        title: `${companyName} - ${r.title}`,
        snippet: r.snippet!.slice(0, 400),
        workflowTag: 'workflow-context',
        confidenceScore: 0.65,
        metadata: {
          adapter: 'google-search-reviews-serpapi',
          source: 'google-search',
        },
      }),
    );
}
