import type { EvidenceDraft } from '@/lib/workflow-engine';

const CRAWL4AI_BASE_URL =
  process.env.CRAWL4AI_BASE_URL ?? 'http://localhost:11235';

interface Crawl4AiResult {
  markdown?: string;
  metadata?: {
    title?: string;
  };
}

interface Crawl4AiResponse {
  success?: boolean;
  results?: Crawl4AiResult[];
}

export async function extractMarkdown(
  url: string,
): Promise<{ markdown: string; title: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${CRAWL4AI_BASE_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: [url],
        browser_config: {
          type: 'BrowserConfig',
          params: { headless: true },
        },
        crawler_config: {
          type: 'CrawlerRunConfig',
          params: {
            cache_mode: 'bypass',
            magic: true,
            simulate_user: true,
            wait_for_timeout: 15000,
            delay_before_return_html: 2,
          },
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { markdown: '', title: '' };
    }

    const data = (await response.json()) as Crawl4AiResponse;
    const first = data.results?.[0];
    const markdown = first?.markdown ?? '';
    const title = first?.metadata?.title ?? '';

    return { markdown, title };
  } catch {
    clearTimeout(timeoutId);
    return { markdown: '', title: '' };
  }
}

export async function ingestCrawl4aiEvidenceDrafts(
  urls: string[],
): Promise<EvidenceDraft[]> {
  const capped = urls.slice(0, 10);
  const drafts: EvidenceDraft[] = [];

  for (const url of capped) {
    const { markdown, title } = await extractMarkdown(url);

    if (!markdown || markdown.length < 80) {
      drafts.push({
        sourceType: 'REVIEWS',
        sourceUrl: url,
        title: title || 'Source (browser extraction)',
        snippet:
          'Page queued for manual review -- browser extraction returned minimal content.',
        workflowTag: 'workflow-context',
        confidenceScore: 0.55,
        metadata: { adapter: 'crawl4ai', fallback: true },
      });
    } else {
      const sourceType = url.includes('google.com/maps')
        ? 'REVIEWS'
        : 'JOB_BOARD';
      drafts.push({
        sourceType,
        sourceUrl: url,
        title: title || 'Browser-extracted page',
        snippet: markdown.slice(0, 240).replace(/\n+/g, ' ').trim(),
        workflowTag: 'workflow-context',
        confidenceScore: 0.76,
        metadata: { adapter: 'crawl4ai', source: 'serp-discovery' },
      });
    }
  }

  return drafts;
}
