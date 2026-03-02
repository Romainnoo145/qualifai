import { inferSourceType, type EvidenceDraft } from '@/lib/workflow-engine';
import type { EvidenceSourceType } from '@prisma/client';
import { fetchStealth } from '@/lib/enrichment/scrapling';
import { extractMarkdown } from '@/lib/enrichment/crawl4ai';
import { detectJsHeavy } from '@/lib/enrichment/source-discovery';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of URLs that may use browser-rendered extraction (Crawl4AI)
 * per call to `ingestWebsiteEvidenceDrafts`. This bounds pipeline duration:
 * worst-case is BROWSER_BUDGET_MAX × 60s (extractMarkdown timeout) = 5 minutes.
 * Both direct-route (REVIEWS / jsHeavyHint) and stealth-escalation paths share
 * this budget. The SERP deep-crawl path in research-executor.ts is separate.
 */
export const BROWSER_BUDGET_MAX = 5;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type WorkflowTag =
  | 'planning'
  | 'handoff'
  | 'billing'
  | 'lead-intake'
  | 'workflow-context';

// ---------------------------------------------------------------------------
// Workflow pattern detection
// ---------------------------------------------------------------------------

const WORKFLOW_PATTERNS: Array<{
  workflowTag: WorkflowTag;
  keywords: string[];
}> = [
  {
    workflowTag: 'planning',
    keywords: [
      'planning',
      'afspraak',
      'wachttijd',
      'doorlooptijd',
      'vertraging',
      'rooster',
      'dispatch',
      'schedule',
    ],
  },
  {
    workflowTag: 'handoff',
    keywords: [
      'overdracht',
      'handoff',
      'coordinatie',
      'communicatie',
      'status',
      'follow-up',
      'reactietijd',
      'response',
    ],
  },
  {
    workflowTag: 'billing',
    keywords: [
      'factuur',
      'invoice',
      'betaling',
      'offerte',
      'quote',
      'meerwerk',
      'scope',
      'prijs',
    ],
  },
  {
    workflowTag: 'lead-intake',
    keywords: [
      'offerteaanvraag',
      'contactformulier',
      'aanvraag',
      'intake',
      'lead',
      'request',
      'onboarding',
    ],
  },
];

const TECH_CLUES: Array<{ label: string; pattern: RegExp }> = [
  { label: 'nextjs', pattern: /(?:__NEXT_DATA__|_next\/static|next\/dist)/i },
  { label: 'wordpress', pattern: /(wp-content|wp-includes|wordpress)/i },
  { label: 'shopify', pattern: /(cdn\.shopify|shopify\.theme)/i },
  { label: 'hubspot', pattern: /(js\.hs-scripts|hsforms|hubspot)/i },
  {
    label: 'google-analytics',
    pattern: /(gtag\(|google-analytics\.com|googletagmanager)/i,
  },
];

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return 'Page signal';
  return normalizeWhitespace(match[1]).slice(0, 120) || 'Page signal';
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(
    /<meta[^>]+(?:name=["']description["']|property=["']og:description["'])[^>]+content=["']([^"']+)["'][^>]*>/i,
  );
  if (!match?.[1]) return null;
  const value = normalizeWhitespace(match[1]);
  return value.length >= 30 ? value.slice(0, 700) : null;
}

// ---------------------------------------------------------------------------
// Workflow tag + confidence
// ---------------------------------------------------------------------------

function detectWorkflowTag(
  sourceType: EvidenceSourceType,
  text: string,
): WorkflowTag {
  if (sourceType === 'CAREERS') return 'handoff';
  if (sourceType === 'HELP_CENTER') return 'lead-intake';

  const lowered = text.toLowerCase();
  let best: { workflowTag: WorkflowTag; score: number } = {
    workflowTag: 'workflow-context',
    score: 0,
  };
  for (const pattern of WORKFLOW_PATTERNS) {
    const score = pattern.keywords.filter((keyword) =>
      lowered.includes(keyword),
    ).length;
    if (score > best.score) {
      best = { workflowTag: pattern.workflowTag, score };
    }
  }
  return best.workflowTag;
}

function detectTechClues(html: string): string[] {
  return TECH_CLUES.filter((clue) => clue.pattern.test(html)).map(
    (clue) => clue.label,
  );
}

function baseConfidence(sourceType: EvidenceSourceType): number {
  switch (sourceType) {
    case 'WEBSITE':
      return 0.7;
    case 'DOCS':
      return 0.76;
    case 'CAREERS':
      return 0.74;
    case 'HELP_CENTER':
      return 0.75;
    case 'JOB_BOARD':
      return 0.72;
    case 'MANUAL_URL':
      return 0.68;
    case 'REVIEWS':
      return 0.78;
    case 'REGISTRY':
      return 0.82;
    default:
      return 0.68;
  }
}

// ---------------------------------------------------------------------------
// Text relevance
// ---------------------------------------------------------------------------

const WORKFLOW_KEYWORDS = [
  // Dutch
  'werkwijze',
  'proces',
  'stappen',
  'handmatig',
  'overdracht',
  'planning',
  'factuur',
  'offerte',
  'wachttijd',
  'doorlooptijd',
  'aanvraag',
  'intake',
  'afstemming',
  'registratie',
  'controle',
  'kwaliteit',
  // English
  'workflow',
  'automation',
  'process',
  'manual',
  'handoff',
  'scheduling',
  'intake',
  'invoice',
  'quote',
];

function paragraphRelevanceScore(text: string): number {
  const lower = text.toLowerCase();
  return WORKFLOW_KEYWORDS.filter((kw) => lower.includes(kw)).length;
}

function extractRelevantParagraphs(text: string): string {
  const normalized = normalizeWhitespace(text);
  const paragraphs = normalized
    .split(/(?<=[.!?])\s+/)
    .map((p) => normalizeWhitespace(p))
    .filter((p) => p.length >= 40 && p.length <= 1000);

  // Score by workflow keyword density, take top 3
  const scored = paragraphs
    .map((p) => ({ text: p, score: paragraphRelevanceScore(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored.map((s) => s.text).join(' ');
}

function firstReadableSnippet(text: string): string {
  const normalized = normalizeWhitespace(text);

  // Prefer body text with workflow relevance over generic first sentence
  if (normalized.length > 200) {
    const relevant = extractRelevantParagraphs(text);
    if (relevant.length >= 60) {
      return relevant.slice(0, 2000);
    }
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 35 && line.length <= 1000);
  return (
    sentences.slice(0, 3).join(' ').slice(0, 2000) || normalized.slice(0, 2000)
  );
}

// ---------------------------------------------------------------------------
// 404 detection
// ---------------------------------------------------------------------------

const SOFT_404_INDICATORS = [
  'page not found',
  'pagina niet gevonden',
  'niet gevonden',
  'does not exist',
  'bestaat niet',
  '404 error',
  '404 not found',
];

function looksLikeSoft404(html: string): boolean {
  const text = stripHtml(html).toLowerCase();
  // Only flag short pages — real content pages are long even if they mention "404"
  if (text.length > 3000) return false;
  return SOFT_404_INDICATORS.some((i) => text.includes(i));
}

/**
 * Detect whether Crawl4AI extracted a 404 page (same indicators as soft-404
 * but applied to markdown content instead of HTML).
 */
function looksLikeCrawled404(markdown: string): boolean {
  if (markdown.length > 3000) return false;
  const lower = markdown.toLowerCase();
  return SOFT_404_INDICATORS.some((i) => lower.includes(i));
}

// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
}

function sourceTypeForUrl(url: string): EvidenceSourceType {
  const inferred = inferSourceType(url);
  return inferred === 'REVIEWS' ? 'MANUAL_URL' : inferred;
}

// ---------------------------------------------------------------------------
// Routing helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a URL should bypass stealth entirely and go directly to
 * Crawl4AI browser extraction.
 *
 * Rules (per Phase 29 research, Pitfall 3):
 * - inferSourceType returns REVIEWS → always browser-direct (Trustpilot, Google Maps)
 * - jsHeavyHint=true → browser-direct (known JS-heavy platforms from Phase 28)
 *
 * Note: We check the raw inferred source type (before the REVIEWS→MANUAL_URL
 * storage remapping) because routing must distinguish review platforms from
 * MANUAL_URL stored type. Own-website CAREERS pages are NOT auto-routed to
 * browser — they are typically static HTML.
 */
function shouldUseBrowserDirect(url: string, jsHeavyHint: boolean): boolean {
  return inferSourceType(url) === 'REVIEWS' || jsHeavyHint;
}

// ---------------------------------------------------------------------------
// Draft builders
// ---------------------------------------------------------------------------

/**
 * Build an EvidenceDraft from Crawl4AI markdown extraction.
 * Uses detectWorkflowTag for correct tag (not hardcoded 'workflow-context').
 */
function buildCrawl4aiDraft(input: {
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  markdown: string;
  title: string;
}): EvidenceDraft {
  return {
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    title: input.title || 'Browser-extracted page',
    snippet: input.markdown.slice(0, 240).replace(/\n+/g, ' ').trim(),
    workflowTag: detectWorkflowTag(input.sourceType, input.markdown),
    confidenceScore: baseConfidence(input.sourceType),
    metadata: { adapter: 'crawl4ai-escalation', source: 'browser-rendered' },
  };
}

/**
 * Fallback draft when extraction failed (stealth + crawl4ai both failed/skipped).
 */
function fallbackDraft(
  sourceUrl: string,
  sourceType: EvidenceSourceType,
): EvidenceDraft {
  return {
    sourceType,
    sourceUrl,
    title: 'Manual source seed',
    snippet: 'Source queued for manual validation (fetch failed or blocked).',
    workflowTag: 'workflow-context',
    confidenceScore: baseConfidence(sourceType) - 0.1,
    metadata: {
      adapter: 'web-ingestion',
      fallback: true,
    },
  };
}

/**
 * Fallback draft pushed when the browser budget is exhausted.
 * Distinct from fallbackDraft so callers can identify budget-exhausted URLs.
 */
function budgetExhaustedDraft(
  sourceUrl: string,
  sourceType: EvidenceSourceType,
): EvidenceDraft {
  return {
    sourceType,
    sourceUrl,
    title: 'Manual source seed',
    snippet:
      'Source queued for manual validation (browser extraction budget exhausted).',
    workflowTag: 'workflow-context',
    confidenceScore: baseConfidence(sourceType) - 0.1,
    metadata: {
      adapter: 'web-ingestion',
      fallback: true,
      budgetExhausted: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API: HTML extraction
// ---------------------------------------------------------------------------

export function extractWebsiteEvidenceFromHtml(input: {
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  html: string;
}): EvidenceDraft[] {
  const title = extractTitle(input.html);
  const metaDescription = extractMetaDescription(input.html);
  const text = stripHtml(input.html);
  // Prefer body text over meta description when body has substantial content
  const bodySnippet = firstReadableSnippet(text);
  const snippet =
    bodySnippet.length > 200 ? bodySnippet : (metaDescription ?? bodySnippet);
  const workflowTag = detectWorkflowTag(
    input.sourceType,
    `${title} ${snippet}`,
  );
  const techClues = detectTechClues(input.html);

  const drafts: EvidenceDraft[] = [
    {
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl,
      title,
      snippet,
      workflowTag,
      confidenceScore: baseConfidence(input.sourceType),
      metadata: {
        adapter: 'web-ingestion',
        extractedFrom: metaDescription ? 'meta-description' : 'page-text',
        techClues,
      },
    },
  ];

  if (techClues.length > 0) {
    drafts.push({
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl,
      title: `${title} - stack clues`,
      snippet: `Public stack clues detected: ${techClues.join(', ')}.`,
      workflowTag: 'workflow-context',
      confidenceScore: Math.min(baseConfidence(input.sourceType) + 0.04, 0.86),
      metadata: {
        adapter: 'web-ingestion',
        techClues,
        signalType: 'stack-clue',
      },
    });
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Crawl4AI result handler (shared between Tier 1 and Tier 2 escalation)
// ---------------------------------------------------------------------------

/**
 * Process a Crawl4AI extraction result into an EvidenceDraft or null.
 *
 * Returns the draft to push, or 'skip' if the URL should be skipped (404 content).
 * Returns a fallback draft when content is empty or below the 80-char minimum.
 *
 * Order of checks (deliberate):
 * 1. Empty markdown → fallback (service may be down)
 * 2. 404 detection → skip (correct: a 404 should never produce a fallback)
 * 3. Minimum 80-char content → fallback (browser extraction returned shell)
 * 4. Build full crawl4ai draft with workflowTag detection
 */
function processCrawl4aiResult(
  sourceUrl: string,
  sourceType: EvidenceSourceType,
  markdown: string,
  title: string,
): EvidenceDraft | 'skip' {
  if (!markdown) return fallbackDraft(sourceUrl, sourceType);
  if (looksLikeCrawled404(markdown)) return 'skip';
  if (markdown.length < 80) return fallbackDraft(sourceUrl, sourceType);
  return buildCrawl4aiDraft({ sourceUrl, sourceType, markdown, title });
}

// ---------------------------------------------------------------------------
// Public API: Two-tier website ingestion
// ---------------------------------------------------------------------------

/**
 * Ingest evidence drafts from a list of URLs using a two-tier extraction pipeline:
 *
 * Tier 1 (browser-direct): URLs with sourceType=REVIEWS or jsHeavyHint=true
 *   → Crawl4AI browser extraction (skip stealth entirely)
 *
 * Tier 2 (stealth-first):  All other URLs
 *   → Scrapling StealthyFetcher
 *   → If stealth returns <500 chars or fails → escalate to Crawl4AI
 *   → If Crawl4AI also fails → fallback draft
 *
 * A browser budget (BROWSER_BUDGET_MAX = 5) is shared across both tiers per
 * call. URLs that would need browser extraction after budget is exhausted
 * receive a budgetExhaustedDraft fallback instead.
 *
 * The raw fetch() fallback from the previous implementation has been removed.
 * The escalation chain is: StealthyFetcher → Crawl4AI → fallback draft.
 *
 * Signature is backwards-compatible: the `options` parameter is optional.
 * Existing callers that omit it continue to work; detectJsHeavy() is used
 * as the fallback when no jsHeavyHints map is provided.
 *
 * @param urls - URLs to ingest (duplicates are deduplicated)
 * @param options.jsHeavyHints - Optional map of url → jsHeavyHint from Phase 28
 *   sourceSet. When provided, avoids re-running detectJsHeavy() pattern matching.
 */
export async function ingestWebsiteEvidenceDrafts(
  urls: string[],
  options?: { jsHeavyHints?: Map<string, boolean> },
): Promise<EvidenceDraft[]> {
  const drafts: EvidenceDraft[] = [];
  let browserBudget = BROWSER_BUDGET_MAX; // shared across all URLs in this call

  for (const sourceUrl of uniqueUrls(urls)) {
    const sourceType = sourceTypeForUrl(sourceUrl);

    // Resolve jsHeavyHint: prefer caller-provided map, fall back to detection
    const jsHeavyHint =
      options?.jsHeavyHints?.get(sourceUrl) ?? detectJsHeavy(sourceUrl);

    try {
      // ------------------------------------------------------------------
      // Tier 1: Browser-direct path (REVIEWS URL or jsHeavyHint=true)
      // ------------------------------------------------------------------
      if (shouldUseBrowserDirect(sourceUrl, jsHeavyHint)) {
        if (browserBudget <= 0) {
          drafts.push(budgetExhaustedDraft(sourceUrl, sourceType));
          continue;
        }
        browserBudget--;
        const { markdown, title } = await extractMarkdown(sourceUrl);
        const result = processCrawl4aiResult(
          sourceUrl,
          sourceType,
          markdown,
          title,
        );
        if (result !== 'skip') drafts.push(result);
        continue;
      }

      // ------------------------------------------------------------------
      // Tier 2: Stealth-first path
      // ------------------------------------------------------------------
      const stealth = await fetchStealth(sourceUrl);
      const stealthHtml = stealth.ok ? stealth.html : '';
      const isStealthSufficient = stealthHtml.length >= 500;

      if (!isStealthSufficient) {
        // Stealth returned insufficient content — escalate to Crawl4AI
        if (browserBudget <= 0) {
          // Budget exhausted — fall back without browser extraction
          drafts.push(fallbackDraft(sourceUrl, sourceType));
          continue;
        }
        browserBudget--;
        const { markdown, title } = await extractMarkdown(sourceUrl);
        const result = processCrawl4aiResult(
          sourceUrl,
          sourceType,
          markdown,
          title,
        );
        if (result !== 'skip') drafts.push(result);
        continue;
      }

      // Stealth succeeded with sufficient content
      if (looksLikeSoft404(stealthHtml)) {
        // Soft 404 — skip
        continue;
      }

      drafts.push(
        ...extractWebsiteEvidenceFromHtml({
          sourceUrl,
          sourceType,
          html: stealthHtml,
        }),
      );
    } catch (error) {
      console.error('website ingestion failed for source', sourceUrl, error);
      drafts.push(fallbackDraft(sourceUrl, sourceType));
    }
  }

  return drafts.slice(0, 20);
}
