import { getJson, config as serpConfig } from 'serpapi';
import { fetchStealth } from '@/lib/enrichment/scrapling';
import type { EvidenceDraft } from '@/lib/workflow-engine';

const OPERATIONAL_KEYWORDS = [
  // Dutch
  'handmatig',
  'systeem',
  'proces',
  'tool',
  'deadline',
  'planning',
  'administratie',
  'excel',
  'papier',
  'dubbel',
  'fout',
  'vertraging',
  'wachten',
  'inefficiënt',
  'onoverzichtelijk',
  'communicatie',
  'afstemming',
  'registratie',
  'urenregistratie',
  'facturatie',
  // English
  'manual',
  'spreadsheet',
  'outdated',
  'slow',
  'disorganized',
  'no system',
  'paperwork',
  'miscommunication',
  'bottleneck',
  'workaround',
];

function hasOperationalSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return OPERATIONAL_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractReviewSnippets(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split into sentence-like chunks and filter for operational content
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 800);

  return sentences.filter(hasOperationalSignal).slice(0, 8);
}

/**
 * Discover and extract employee reviews from Indeed.nl and Glassdoor.nl via SerpAPI.
 *
 * Strategy:
 * 1. Search for company reviews on Indeed/Glassdoor via SerpAPI google engine
 * 2. Scrape discovered URLs via Scrapling for review text
 * 3. Filter for operational/workflow keywords that indicate automation pain
 *
 * Returns up to 8 EvidenceDraft items with sourceType REVIEWS.
 */
export async function fetchEmployeeReviews(input: {
  companyName: string;
  domain: string;
}): Promise<EvidenceDraft[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return [];

  serpConfig.api_key = apiKey;

  const drafts: EvidenceDraft[] = [];

  try {
    // Search for employee reviews on Indeed and Glassdoor
    const result = (await getJson({
      engine: 'google',
      q: `site:glassdoor.nl OR site:indeed.nl "${input.companyName}" reviews`,
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

    const urls = (result.organic_results ?? [])
      .filter(
        (r) =>
          r.link &&
          r.title &&
          !r.link.includes(input.domain) &&
          (r.link.includes('glassdoor') || r.link.includes('indeed')),
      )
      .slice(0, 3);

    // Add search result snippets as evidence
    for (const r of urls) {
      if (r.snippet && r.snippet.length >= 30) {
        drafts.push({
          sourceType: 'REVIEWS',
          sourceUrl: r.link!,
          title: `${input.companyName} - ${r.title}`,
          snippet: r.snippet.slice(0, 600),
          workflowTag: 'workflow-context',
          confidenceScore: 0.75,
          metadata: {
            adapter: 'employee-reviews-serpapi',
            source: r.link!.includes('glassdoor') ? 'glassdoor' : 'indeed',
          },
        });
      }
    }

    // Try to scrape review pages for deeper content
    for (const r of urls.slice(0, 2)) {
      try {
        const scraped = await fetchStealth(r.link!);
        if (!scraped.ok || scraped.html.length < 200) continue;

        const snippets = extractReviewSnippets(scraped.html);
        for (const snippet of snippets.slice(0, 3)) {
          drafts.push({
            sourceType: 'REVIEWS',
            sourceUrl: r.link!,
            title: `${input.companyName} - Employee Review Snippet`,
            snippet: snippet.slice(0, 600),
            workflowTag: hasOperationalSignal(snippet)
              ? 'workflow-context'
              : 'workflow-context',
            confidenceScore: hasOperationalSignal(snippet) ? 0.82 : 0.72,
            metadata: {
              adapter: 'employee-reviews-scrapling',
              source: r.link!.includes('glassdoor') ? 'glassdoor' : 'indeed',
              hasOperationalSignal: hasOperationalSignal(snippet),
            },
          });
        }
      } catch {
        // Scraping failed — continue with SERP snippets
      }
    }
  } catch {
    // SerpAPI call failed — return whatever we have
  }

  return drafts.slice(0, 8);
}
