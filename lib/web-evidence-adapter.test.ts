import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  extractWebsiteEvidenceFromHtml,
  ingestWebsiteEvidenceDrafts,
  BROWSER_BUDGET_MAX,
} from '@/lib/web-evidence-adapter';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/enrichment/scrapling', () => ({
  fetchStealth: vi.fn(),
}));

vi.mock('@/lib/enrichment/crawl4ai', () => ({
  extractMarkdown: vi.fn(),
}));

vi.mock('@/lib/enrichment/source-discovery', () => ({
  detectJsHeavy: vi.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Import mocked modules (must happen after vi.mock)
// ---------------------------------------------------------------------------

import { fetchStealth } from '@/lib/enrichment/scrapling';
import { extractMarkdown } from '@/lib/enrichment/crawl4ai';
import { detectJsHeavy } from '@/lib/enrichment/source-discovery';

const mockFetchStealth = fetchStealth as ReturnType<typeof vi.fn>;
const mockExtractMarkdown = extractMarkdown as ReturnType<typeof vi.fn>;
const mockDetectJsHeavy = detectJsHeavy as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stealthOk(html: string) {
  return { ok: true, html };
}

function stealthFail() {
  return { ok: false, html: '' };
}

function markdownResult(markdown: string, title = 'Test Page') {
  return { markdown, title };
}

// ---------------------------------------------------------------------------
// Existing test (preserved)
// ---------------------------------------------------------------------------

describe('extractWebsiteEvidenceFromHtml', () => {
  it('extracts workflow and stack clues from HTML', () => {
    const html = `
      <html>
        <head>
          <title>Installatiebedrijf Nova | Service en Onderhoud</title>
          <meta
            name="description"
            content="Snelle planning, duidelijke communicatie en vaste monteurs voor onderhoud en storingen."
          />
          <script src="/_next/static/chunks/main.js"></script>
        </head>
        <body>
          <h1>Onderhoud en storingen</h1>
          <p>Vraag direct een offerte aan via ons formulier.</p>
        </body>
      </html>
    `;

    const drafts = extractWebsiteEvidenceFromHtml({
      sourceUrl: 'https://example-installatie.nl',
      sourceType: 'WEBSITE',
      html,
    });

    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts[0]?.workflowTag).toBe('planning');
    expect(drafts[0]?.snippet.toLowerCase()).toContain('planning');
    expect(
      drafts.some((draft) => draft.snippet.toLowerCase().includes('nextjs')),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ingestWebsiteEvidenceDrafts — two-tier routing
// ---------------------------------------------------------------------------

describe('ingestWebsiteEvidenceDrafts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: detectJsHeavy returns false (static site)
    mockDetectJsHeavy.mockReturnValue(false);
  });

  // -------------------------------------------------------------------------
  // BROWSER_BUDGET_MAX constant
  // -------------------------------------------------------------------------

  it('exports BROWSER_BUDGET_MAX = 5', () => {
    expect(BROWSER_BUDGET_MAX).toBe(5);
  });

  // -------------------------------------------------------------------------
  // direct-route: REVIEWS sourceType → extractMarkdown, not fetchStealth
  // -------------------------------------------------------------------------

  it('direct-route: REVIEWS url routes to extractMarkdown without calling fetchStealth', async () => {
    const reviewsUrl = 'https://www.google.com/maps/place/TestBedrijf';
    mockExtractMarkdown.mockResolvedValue(
      markdownResult(
        'Klantreviews: uitstekende service. Planning en factuur goed geregeld.',
      ),
    );

    await ingestWebsiteEvidenceDrafts([reviewsUrl]);

    expect(mockExtractMarkdown).toHaveBeenCalledWith(reviewsUrl);
    expect(mockFetchStealth).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // direct-route: jsHeavyHint=true → extractMarkdown, not fetchStealth
  // -------------------------------------------------------------------------

  it('direct-route: jsHeavyHint=true url routes to extractMarkdown without calling fetchStealth', async () => {
    const url = 'https://www.linkedin.com/company/testbedrijf';
    const hints = new Map([[url, true]]);
    mockExtractMarkdown.mockResolvedValue(
      markdownResult('LinkedIn company page with workflow information.'),
    );

    await ingestWebsiteEvidenceDrafts([url], { jsHeavyHints: hints });

    expect(mockExtractMarkdown).toHaveBeenCalledWith(url);
    expect(mockFetchStealth).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // escalation: stealth returns <500 chars → extractMarkdown called
  // -------------------------------------------------------------------------

  it('escalation: stealth returns <500 chars → extractMarkdown is called', async () => {
    const url = 'https://example.nl/diensten';
    mockFetchStealth.mockResolvedValue(stealthOk('a'.repeat(200))); // below 500
    mockExtractMarkdown.mockResolvedValue(
      markdownResult(
        'Diensten pagina met workflow en planning informatie voor klanten.',
      ),
    );

    await ingestWebsiteEvidenceDrafts([url]);

    expect(mockFetchStealth).toHaveBeenCalledWith(url);
    expect(mockExtractMarkdown).toHaveBeenCalledWith(url);
  });

  // -------------------------------------------------------------------------
  // escalation: stealth fails (ok=false) → extractMarkdown called
  // -------------------------------------------------------------------------

  it('escalation: stealth ok=false → extractMarkdown is called', async () => {
    const url = 'https://example.nl/contact';
    mockFetchStealth.mockResolvedValue(stealthFail());
    mockExtractMarkdown.mockResolvedValue(
      markdownResult(
        'Contact pagina met informatie over het bedrijf en diensten.',
      ),
    );

    await ingestWebsiteEvidenceDrafts([url]);

    expect(mockFetchStealth).toHaveBeenCalledWith(url);
    expect(mockExtractMarkdown).toHaveBeenCalledWith(url);
  });

  // -------------------------------------------------------------------------
  // no-escalation: stealth returns >=500 chars → extractMarkdown NOT called
  // -------------------------------------------------------------------------

  it('no-escalation: stealth returns >=500 chars → extractMarkdown is NOT called', async () => {
    const url = 'https://example.nl/over-ons';
    const richHtml = `<html><body>${'<p>Substantieel content voor de website.</p>'.repeat(20)}</body></html>`;
    mockFetchStealth.mockResolvedValue(stealthOk(richHtml));

    await ingestWebsiteEvidenceDrafts([url]);

    expect(mockFetchStealth).toHaveBeenCalledWith(url);
    expect(mockExtractMarkdown).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // no-escalation: stealth returns >=500 chars → extractWebsiteEvidenceFromHtml used
  // -------------------------------------------------------------------------

  it('no-escalation: stealth returns >=500 chars → result draft has adapter web-ingestion', async () => {
    const url = 'https://example.nl/werkwijze';
    const richHtml = `<html><head><title>Werkwijze</title></head><body>${'<p>Planning en workflow details voor klanten.</p>'.repeat(15)}</body></html>`;
    mockFetchStealth.mockResolvedValue(stealthOk(richHtml));

    const drafts = await ingestWebsiteEvidenceDrafts([url]);

    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts[0]?.metadata).toMatchObject({ adapter: 'web-ingestion' });
  });

  // -------------------------------------------------------------------------
  // budget-cap: 7 JS-heavy URLs → only first 5 call extractMarkdown
  // -------------------------------------------------------------------------

  it('budget-cap: 7 JS-heavy URLs → only first 5 call extractMarkdown, last 2 get budgetExhaustedDraft', async () => {
    const urls = Array.from(
      { length: 7 },
      (_, i) => `https://www.google.com/maps/place/Bedrijf${i}`,
    );

    mockExtractMarkdown.mockResolvedValue(
      markdownResult('a'.repeat(200)), // good markdown
    );

    const drafts = await ingestWebsiteEvidenceDrafts(urls);

    // Only 5 calls to extractMarkdown (budget cap)
    expect(mockExtractMarkdown).toHaveBeenCalledTimes(5);

    // Should have 7 drafts (5 crawl4ai + 2 budget-exhausted fallbacks)
    expect(drafts.length).toBe(7);
  });

  // -------------------------------------------------------------------------
  // budget-shared: 3 direct + 3 escalated → budget tracks across both paths
  // -------------------------------------------------------------------------

  it('budget-shared: 3 direct + 3 escalated → budget tracks across both paths', async () => {
    const directUrls = Array.from(
      { length: 3 },
      (_, i) => `https://www.google.com/maps/place/Direct${i}`,
    );
    const escalatedUrls = Array.from(
      { length: 3 },
      (_, i) => `https://example-${i}.nl/diensten`,
    );

    // Direct URLs route to Crawl4AI (REVIEWS sourceType)
    // Escalated URLs have short stealth content → also Crawl4AI
    mockFetchStealth.mockResolvedValue(stealthOk('a'.repeat(100))); // <500
    mockExtractMarkdown.mockResolvedValue(
      markdownResult('Content from browser rendering'),
    );

    const allUrls = [...directUrls, ...escalatedUrls];
    await ingestWebsiteEvidenceDrafts(allUrls);

    // 3 direct + 2 escalated = 5 total (budget exhausted after 5th call)
    expect(mockExtractMarkdown).toHaveBeenCalledTimes(5);
  });

  // -------------------------------------------------------------------------
  // crawl4ai-draft: markdown gets detectWorkflowTag, not default tag
  // -------------------------------------------------------------------------

  it('crawl4ai-draft: REVIEWS url draft uses detectWorkflowTag, not default workflow-context', async () => {
    const url = 'https://www.google.com/maps/place/TestBedrijf';
    mockExtractMarkdown.mockResolvedValue(
      markdownResult(
        'Klant review: de planning was slecht geregeld. Wachttijd was te lang.',
      ),
    );

    const drafts = await ingestWebsiteEvidenceDrafts([url]);

    expect(drafts.length).toBeGreaterThan(0);
    // 'planning' and 'wachttijd' are planning keywords — should not be 'workflow-context'
    expect(drafts[0]?.workflowTag).toBe('planning');
  });

  // -------------------------------------------------------------------------
  // backwards-compat: calling without options works
  // -------------------------------------------------------------------------

  it('backwards-compat: calling without options param works', async () => {
    const url = 'https://example.nl/over-ons';
    const richHtml = `<html><body>${'<p>Content content content.</p>'.repeat(20)}</body></html>`;
    mockFetchStealth.mockResolvedValue(stealthOk(richHtml));

    // Should not throw when options is omitted
    await expect(ingestWebsiteEvidenceDrafts([url])).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 404-detection: crawl4ai markdown with "page not found" → skipped
  // -------------------------------------------------------------------------

  it('404-detection: crawl4ai markdown with page not found → draft is skipped', async () => {
    const url = 'https://www.google.com/maps/place/GonePlace';
    mockExtractMarkdown.mockResolvedValue(
      markdownResult('Page not found. This page does not exist.'),
    );

    const drafts = await ingestWebsiteEvidenceDrafts([url]);

    // 404 content should be skipped — no drafts
    expect(drafts.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // crawl4ai-draft: metadata has correct adapter tag
  // -------------------------------------------------------------------------

  it('crawl4ai-draft: escalated draft has adapter crawl4ai-escalation metadata', async () => {
    const url = 'https://www.google.com/maps/place/TestPlace';
    mockExtractMarkdown.mockResolvedValue(
      markdownResult(
        'Review page with rich content about service quality and planning.',
      ),
    );

    const drafts = await ingestWebsiteEvidenceDrafts([url]);

    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts[0]?.metadata).toMatchObject({
      adapter: 'crawl4ai-escalation',
      source: 'browser-rendered',
    });
  });

  // -------------------------------------------------------------------------
  // crawl4ai-draft: short markdown (<80 chars) → fallback draft, not skip
  // -------------------------------------------------------------------------

  it('crawl4ai-draft: short markdown <80 chars → fallback draft pushed', async () => {
    const url = 'https://www.google.com/maps/place/TinyPlace';
    mockExtractMarkdown.mockResolvedValue(markdownResult('Too short'));

    const drafts = await ingestWebsiteEvidenceDrafts([url]);

    // Short markdown → fallback draft still pushed
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts[0]?.metadata).toMatchObject({ fallback: true });
  });

  // -------------------------------------------------------------------------
  // raw fetch removed: no raw fetch fallback in the stealth→crawl4ai chain
  // -------------------------------------------------------------------------

  it('raw-fetch-removed: when stealth fails and crawl4ai returns empty, produces fallback draft (no raw fetch)', async () => {
    const url = 'https://example.nl/about';
    mockFetchStealth.mockResolvedValue(stealthFail());
    mockExtractMarkdown.mockResolvedValue(markdownResult('')); // empty crawl4ai

    const drafts = await ingestWebsiteEvidenceDrafts([url]);

    // Should get a fallback draft, not crash
    expect(drafts.length).toBeGreaterThan(0);
    // Crawl4AI was tried
    expect(mockExtractMarkdown).toHaveBeenCalledWith(url);
  });

  // -------------------------------------------------------------------------
  // detectJsHeavy fallback: no hints map → detectJsHeavy called for routing
  // -------------------------------------------------------------------------

  it('detectJsHeavy-fallback: without jsHeavyHints map, detectJsHeavy is called', async () => {
    const url = 'https://example.nl/diensten';
    mockDetectJsHeavy.mockReturnValue(false);
    const richHtml = `<html><body>${'<p>Rich content.</p>'.repeat(25)}</body></html>`;
    mockFetchStealth.mockResolvedValue(stealthOk(richHtml));

    await ingestWebsiteEvidenceDrafts([url]);

    expect(mockDetectJsHeavy).toHaveBeenCalledWith(url);
  });
});
