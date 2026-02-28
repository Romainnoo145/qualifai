import { fetchStealth, type StealthOptions } from '@/lib/enrichment/scrapling';
import type { EvidenceDraft } from '@/lib/workflow-engine';

// UI phrases to exclude from post snippets — navigation chrome, not post content
const LINKEDIN_UI_PHRASES = [
  'volgers',
  'connect',
  'volg',
  ' like',
  'reageer',
  'delen',
  'meer weergeven',
  'liken',
  'volgen',
  'bericht sturen',
  'website',
  'medewerkers',
  'bekijk alle',
];

function isUiChrome(text: string): boolean {
  const lower = text.toLowerCase();
  return LINKEDIN_UI_PHRASES.some((phrase) => lower.includes(phrase));
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractPostSnippets(html: string): string[] {
  // Strip script and style tags first
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Find span content blocks with enough text for a post snippet
  const spanMatches = cleaned.match(/<span[^>]*>([\s\S]{80,600}?)<\/span>/g);
  if (!spanMatches) return [];

  const snippets: string[] = [];
  const seen = new Set<string>();

  for (const match of spanMatches) {
    const text = stripHtmlTags(match).replace(/\s+/g, ' ').trim();

    // Length filter
    if (text.length < 60 || text.length > 500) continue;

    // Skip UI chrome
    if (isUiChrome(text)) continue;

    // Deduplicate by first 80 chars lowercased
    const key = text.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);

    snippets.push(text);
  }

  return snippets;
}

export async function fetchLinkedInPosts(input: {
  linkedinUrl: string;
  companyName: string | null;
}): Promise<EvidenceDraft[]> {
  try {
    // Normalize: strip trailing slash, query params, then append /posts/
    const baseUrl = input.linkedinUrl.replace(/\/+$/, '').split('?')[0];
    const postsUrl = `${baseUrl}/posts/`;

    const opts: StealthOptions = {};
    const cookiesEnv = process.env.LINKEDIN_COOKIES;
    if (cookiesEnv) {
      try {
        opts.cookies = JSON.parse(cookiesEnv);
      } catch {
        console.warn(
          '[LinkedIn Posts] LINKEDIN_COOKIES env var is not valid JSON — ignoring',
        );
      }
    } else {
      console.warn(
        '[LinkedIn Posts] LINKEDIN_COOKIES not set — auth wall will likely block scraping',
      );
    }

    const result = await fetchStealth(postsUrl, opts);

    // Basic failure check
    if (!result.ok || result.html.length < 300) {
      return [];
    }

    // Authwall detection — same pattern as existing LinkedIn logic
    const isAuthwall =
      result.html.length < 500 ||
      [
        'authwall',
        'log in to linkedin',
        'join linkedin',
        'sign in',
        'leden login',
      ].some((phrase) => result.html.toLowerCase().includes(phrase));

    if (isAuthwall) return [];

    // Extract post text snippets
    const snippets = extractPostSnippets(result.html);

    if (snippets.length === 0) return [];

    // Map to EvidenceDraft — max 8 post snippets
    return snippets.slice(0, 8).map((snippet) => ({
      sourceType: 'LINKEDIN' as const,
      sourceUrl: postsUrl,
      title: `${input.companyName ?? 'Bedrijf'} - LinkedIn post`,
      snippet: snippet.slice(0, 500),
      workflowTag: 'workflow-context',
      confidenceScore: 0.73,
      metadata: {
        adapter: 'linkedin-posts-scrapling',
        source: 'linkedin-posts',
      },
    }));
  } catch {
    // LinkedIn blocking / network failure — not a pipeline error
    return [];
  }
}
