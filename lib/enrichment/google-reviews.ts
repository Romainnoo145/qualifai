import { fetchStealth } from '@/lib/enrichment/scrapling';
import type { EvidenceDraft } from '@/lib/workflow-engine';

/**
 * Fetch Google Reviews for a company by scraping the Google Search results page
 * for review snippets via Scrapling StealthyFetcher.
 *
 * Uses the Google Search reviews URL pattern with Dutch locale.
 * Returns up to 5 EvidenceDraft items with sourceType REVIEWS.
 * Returns [] if no reviews found — caller handles empty-result recording.
 */
export async function fetchGoogleReviews(input: {
  companyName: string;
  domain: string;
  mapsDataId?: string;
}): Promise<EvidenceDraft[]> {
  try {
    const query = encodeURIComponent(`${input.companyName} reviews ervaringen`);
    const url = `https://www.google.com/search?q=${query}&hl=nl&gl=nl`;

    const result = await fetchStealth(url, {
      google_search: true,
      network_idle: true,
    });

    if (!result.ok || result.html.length < 500) {
      return [];
    }

    const snippets = extractReviewSnippets(result.html);

    const filtered = snippets.filter((s) => s.length >= 40 && s.length <= 400);

    const sourceUrl = `https://www.google.com/search?q=${encodeURIComponent(`${input.companyName} reviews`)}`;

    return filtered.slice(0, 5).map(
      (snippet): EvidenceDraft => ({
        sourceType: 'REVIEWS',
        sourceUrl,
        title: `${input.companyName} - Google Reviews`,
        snippet: snippet.slice(0, 400),
        workflowTag: 'workflow-context',
        confidenceScore: 0.75,
        metadata: {
          adapter: 'google-reviews-scrapling',
          source: 'google-maps',
        },
      }),
    );
  } catch {
    return [];
  }
}

/**
 * Extract review text snippets from a Google Search HTML response.
 *
 * Google embeds review text in various span/div elements. We use regex patterns
 * to identify candidate text blocks and filter out navigation/UI strings.
 * No external HTML parser — regex + string operations only.
 */
function extractReviewSnippets(html: string): string[] {
  const snippets: string[] = [];

  // Pattern 1: Text inside <span> tags with data-ved attribute (Google review snippets)
  const dataVedPattern = /<span[^>]+data-ved[^>]*>([^<]{40,400})<\/span>/gi;
  let match: RegExpExecArray | null;
  while ((match = dataVedPattern.exec(html)) !== null) {
    const captured = match[1];
    if (!captured) continue;
    const text = decodeHtmlEntities(captured.trim());
    if (isValidReviewSnippet(text)) {
      snippets.push(text);
    }
  }

  // Pattern 2: Quoted review content (Google often wraps review text in quotation marks)
  const quotedPattern = /\u201c([^"]{40,400})\u201d/g;
  while ((match = quotedPattern.exec(html)) !== null) {
    const captured = match[1];
    if (!captured) continue;
    const text = decodeHtmlEntities(captured.trim());
    if (isValidReviewSnippet(text)) {
      snippets.push(text);
    }
  }

  // Pattern 3: Text inside review card blocks (class patterns Google uses for review cards)
  const reviewCardPattern =
    /<div[^>]+(?:review|sxaTd|LbKnB|IiChCb)[^>]*>([^<]{40,400})<\/div>/gi;
  while ((match = reviewCardPattern.exec(html)) !== null) {
    const captured = match[1];
    if (!captured) continue;
    const text = decodeHtmlEntities(captured.trim());
    if (isValidReviewSnippet(text)) {
      snippets.push(text);
    }
  }

  // Pattern 4: Snippets from organic results (title + snippet pairs on reviews search)
  const organicSnippetPattern =
    /<span[^>]*class="[^"]*(?:st|aCOpRe|VwiC3b)[^"]*"[^>]*>([^<]{40,400})<\/span>/gi;
  while ((match = organicSnippetPattern.exec(html)) !== null) {
    const captured = match[1];
    if (!captured) continue;
    const text = decodeHtmlEntities(captured.trim());
    if (isValidReviewSnippet(text)) {
      snippets.push(text);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of snippets) {
    const key = s.toLowerCase().slice(0, 80);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }

  return unique;
}

/**
 * Filter out navigation/UI text and short snippets that are not real reviews.
 */
function isValidReviewSnippet(text: string): boolean {
  if (text.length < 40 || text.length > 400) return false;

  // Exclude common Dutch navigation/UI strings
  const uiPatterns = [
    /^meer$/i,
    /^lees meer$/i,
    /^bekijk$/i,
    /^terug$/i,
    /^volgende$/i,
    /^zoeken$/i,
    /^instellingen$/i,
    /^privacybeleid$/i,
    /^gebruiksvoorwaarden$/i,
    /^advertentie$/i,
    /^gesponsord$/i,
    /^alle reviews$/i,
    /^recensies$/i,
    /^schrijf een review$/i,
    /^\d+(\.\d+)?\s*(van\s+5\s+)?sterren?$/i,
    /^copyright/i,
    /^\s*google\s*$/i,
  ];

  for (const pattern of uiPatterns) {
    if (pattern.test(text.trim())) return false;
  }

  // Exclude strings with too many HTML entities remaining
  if (
    text.includes('&amp;') ||
    text.includes('&lt;') ||
    text.includes('&gt;')
  ) {
    return false;
  }

  return true;
}

/**
 * Decode basic HTML entities in extracted text.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim();
}
