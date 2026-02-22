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

const CRAWLED_404_INDICATORS = [
  'page not found',
  'pagina niet gevonden',
  'niet gevonden',
  'does not exist',
  'bestaat niet',
  '404 error',
  '404 not found',
];

function looksLikeCrawled404(markdown: string): boolean {
  if (markdown.length > 3000) return false;
  const lower = markdown.toLowerCase();
  return CRAWLED_404_INDICATORS.some((i) => lower.includes(i));
}

export async function ingestCrawl4aiEvidenceDrafts(
  urls: string[],
): Promise<EvidenceDraft[]> {
  const capped = urls.slice(0, 10);
  const drafts: EvidenceDraft[] = [];

  for (const url of capped) {
    const { markdown, title } = await extractMarkdown(url);

    // Empty/minimal content = page doesn't exist or is useless — skip entirely
    if (!markdown || markdown.length < 80) {
      continue;
    }

    // Detect 404 content in crawled pages (target returned 404 HTML)
    if (looksLikeCrawled404(markdown)) {
      continue;
    }

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

  return drafts;
}
