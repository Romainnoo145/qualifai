import type { EvidenceDraft } from '@/lib/workflow-engine';

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Fetch recent news mentions via Google News RSS feed.
 *
 * Uses the public Google News RSS endpoint — no auth, no bot detection, plain XML.
 * Returns up to 5 EvidenceDraft items with sourceType NEWS.
 * Returns [] if no relevant news found — caller handles empty-result recording.
 *
 * Filters out own-domain results (already covered by WEBSITE source type)
 * and items older than 12 months.
 */
export async function fetchGoogleNewsRss(input: {
  companyName: string;
  domain: string;
}): Promise<EvidenceDraft[]> {
  try {
    const query = encodeURIComponent(input.companyName);
    const url = `https://news.google.com/rss/search?q=${query}&hl=nl&gl=NL&ceid=NL:nl`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; news-reader/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      return [];
    }

    const body = await response.text();

    if (!body || body.length < 100) {
      return [];
    }

    const items = parseRssItems(body);

    const cutoff = Date.now() - TWELVE_MONTHS_MS;

    const filtered = items
      .filter((item) => {
        // Exclude own-domain URLs (already covered by WEBSITE source type)
        if (item.link.includes(input.domain)) return false;
        // Exclude items older than 12 months
        if (item.pubDate) {
          const pubTime = new Date(item.pubDate).getTime();
          if (!isNaN(pubTime) && pubTime < cutoff) return false;
        }
        return true;
      })
      .slice(0, 5);

    return filtered.map(
      (item): EvidenceDraft => ({
        sourceType: 'NEWS',
        sourceUrl: item.link,
        title: item.title.slice(0, 120),
        snippet: stripHtmlTags(item.description).trim().slice(0, 400),
        workflowTag: 'workflow-context',
        confidenceScore: 0.7,
        metadata: { adapter: 'google-news-rss', pubDate: item.pubDate },
      }),
    );
  } catch {
    return [];
  }
}

interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

/**
 * Parse RSS XML string into item objects using regex.
 * No external XML parser — RSS is simple enough for regex extraction.
 */
function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // Extract all <item> blocks
  const itemPattern = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemPattern.exec(xml)) !== null) {
    const block = itemMatch[1];
    if (!block) continue;

    const title = extractTagContent(block, 'title');
    const description = extractTagContent(block, 'description');
    const link =
      extractTagContent(block, 'link') || extractLinkFromBlock(block);
    const pubDate = extractTagContent(block, 'pubDate');

    // Skip items with no link or no title
    if (!link || !title) continue;

    items.push({
      title: stripHtmlTags(decodeCdata(title)).trim(),
      description: decodeCdata(description),
      link: decodeCdata(link).trim(),
      pubDate: pubDate.trim(),
    });
  }

  return items;
}

/**
 * Extract text content of the first occurrence of a named XML/HTML tag.
 */
function extractTagContent(xml: string, tagName: string): string {
  // Handle CDATA sections: <tag><![CDATA[...]]></tag>
  const cdataPattern = new RegExp(
    `<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`,
    'i',
  );
  const cdataMatch = cdataPattern.exec(xml);
  if (cdataMatch?.[1] !== undefined) {
    return cdataMatch[1];
  }

  // Handle plain text content: <tag>...</tag>
  const plainPattern = new RegExp(
    `<${tagName}[^>]*>([^<]*(?:<(?!\\/${tagName}>)[^<]*)*)<\\/${tagName}>`,
    'i',
  );
  const plainMatch = plainPattern.exec(xml);
  if (plainMatch?.[1] !== undefined) {
    return plainMatch[1];
  }

  return '';
}

/**
 * Google News RSS sometimes uses a bare <link> element without closing tag (self-closing style).
 * Try to extract from the text node after <link>.
 */
function extractLinkFromBlock(block: string): string {
  // Google News RSS uses <link> as a URL text node without </link>
  const match = /<link>([^<]+)/.exec(block);
  return match?.[1] ?? '';
}

/**
 * Decode CDATA wrapper if present.
 */
function decodeCdata(text: string): string {
  const cdataMatch = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(text.trim());
  return cdataMatch?.[1] ?? text;
}

/**
 * Strip HTML tags from a string, replacing tags with spaces.
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
