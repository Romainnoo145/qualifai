import { getJson, config as serpConfig } from 'serpapi';
import { fetchStealth } from '@/lib/enrichment/scrapling';
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

const OPERATIONAL_COMPLAINT_KEYWORDS = [
  'vertraging',
  'communicatie',
  'planning',
  'kwaliteit',
  'wachten',
  'onbereikbaar',
  'afspraak',
  'fout',
  'rommel',
  'slordig',
  'deadline',
  'delay',
  'poor communication',
  'disorganized',
  'quality',
  'unprofessional',
];

function hasOperationalComplaint(text: string): boolean {
  const lower = text.toLowerCase();
  return OPERATIONAL_COMPLAINT_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractReviewText(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 800)
    .slice(0, 20);
}

/**
 * Fetch customer reviews from Trustpilot and Werkspot via SerpAPI + Scrapling.
 *
 * Customer complaints reveal operational issues: delays, communication gaps,
 * quality control problems — all workflow automation opportunities.
 *
 * Returns up to 6 EvidenceDraft items with sourceType REVIEWS.
 */
export async function fetchCustomerReviews(input: {
  companyName: string;
  domain: string;
}): Promise<EvidenceDraft[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return [];

  serpConfig.api_key = apiKey;

  const drafts: EvidenceDraft[] = [];

  // Search for Trustpilot and Werkspot reviews
  const queries = [
    `site:trustpilot.com "${input.companyName}"`,
    `site:werkspot.nl "${input.companyName}"`,
  ];

  for (const q of queries) {
    try {
      const result = (await getJson({
        engine: 'google',
        q,
        gl: 'nl',
        hl: 'nl',
        google_domain: 'google.nl',
        num: 3,
      })) as {
        organic_results?: Array<{
          link?: string;
          title?: string;
          snippet?: string;
        }>;
      };

      const results = (result.organic_results ?? [])
        .filter((r) => r.link && r.title && r.snippet && r.snippet.length >= 30)
        .slice(0, 2);

      for (const r of results) {
        const source = r.link!.includes('trustpilot')
          ? 'trustpilot'
          : 'werkspot';

        // Add SERP snippet
        drafts.push({
          sourceType: 'REVIEWS',
          sourceUrl: r.link!,
          title: `${input.companyName} - ${r.title}`,
          snippet: r.snippet!.slice(0, 600),
          workflowTag: 'workflow-context',
          confidenceScore: hasOperationalComplaint(r.snippet!) ? 0.8 : 0.72,
          metadata: {
            adapter: `${source}-serpapi`,
            source,
            hasOperationalComplaint: hasOperationalComplaint(r.snippet!),
          },
        });

        // Try scraping review page for deeper content
        try {
          const scraped = await fetchStealth(r.link!);
          if (scraped.ok && scraped.html.length >= 200) {
            const sentences = extractReviewText(scraped.html);
            const operational = sentences
              .filter(hasOperationalComplaint)
              .slice(0, 2);

            for (const snippet of operational) {
              drafts.push({
                sourceType: 'REVIEWS',
                sourceUrl: r.link!,
                title: `${input.companyName} - ${source} klantreview`,
                snippet: snippet.slice(0, 600),
                workflowTag: 'workflow-context',
                confidenceScore: 0.82,
                metadata: {
                  adapter: `${source}-scrapling`,
                  source,
                  hasOperationalComplaint: true,
                },
              });
            }
          }
        } catch {
          // Scraping failed — continue with SERP snippet
        }
      }
    } catch {
      // SerpAPI query failed — try next
    }
  }

  return drafts.slice(0, 6);
}
