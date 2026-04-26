import { inferSourceType, type EvidenceDraft } from '@/lib/workflow-engine';
import type { EvidenceSourceType } from '@prisma/client';
import { fetchStealth } from '@/lib/enrichment/scrapling';
import { extractMarkdown } from '@/lib/enrichment/crawl4ai';
import {
  detectJsHeavy,
  type UrlProvenance,
} from '@/lib/enrichment/source-discovery';

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
const WEBSITE_DRAFT_MAX = 20;

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
  'deze pagina bestaat niet',
  'oops!',
  'helaas',
  'the page you',
  'de pagina die je zoekt',
  'er ging iets mis',
  'something went wrong',
];

const SOFT_404_RECOVERY_HINTS = [
  'back to home',
  'ga naar home',
  'terug naar home',
  'back to homepage',
  'zoek opnieuw',
  'search again',
  'naar de homepage',
  'terug naar de',
  'ga terug',
  'return to',
];

function hasSoft404Marker(text: string): boolean {
  return SOFT_404_INDICATORS.some((i) => text.includes(i));
}

function looksLikeSoft404(html: string): boolean {
  const title = extractTitle(html).toLowerCase();
  if (hasSoft404Marker(title)) return true;

  const text = normalizeWhitespace(stripHtml(html)).toLowerCase();
  const leadText = text.slice(0, 1600);
  if (!hasSoft404Marker(leadText)) return false;

  // Most soft-404 templates are short; for long pages require an additional cue.
  if (text.length <= 5000) return true;
  return SOFT_404_RECOVERY_HINTS.some((i) => leadText.includes(i));
}

/**
 * Detect whether Crawl4AI extracted a 404 page (same indicators as soft-404
 * but applied to markdown content instead of HTML).
 */
function looksLikeCrawled404(markdown: string): boolean {
  const lower = markdown.toLowerCase();
  const headingMatch =
    /^\s{0,3}#{0,4}\s*(404|page not found|pagina niet gevonden)\b/im;
  if (headingMatch.test(lower)) return true;

  const leadText = lower.slice(0, 1600);
  if (!hasSoft404Marker(leadText)) return false;
  if (lower.length <= 5000) return true;
  return SOFT_404_RECOVERY_HINTS.some((i) => leadText.includes(i));
}

// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
}

function fallbackMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as Record<string, unknown>).fallback === true;
}

function sourceTypeForUrl(url: string): EvidenceSourceType {
  const inferred = inferSourceType(url);
  return inferred === 'REVIEWS' ? 'MANUAL_URL' : inferred;
}

function urlPath(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return pathname || '/';
  } catch {
    return '';
  }
}

function isRiskySeedGuess(
  sourceUrl: string,
  provenance: UrlProvenance | undefined,
): boolean {
  return provenance === 'seed' && urlPath(sourceUrl) !== '/';
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
  statusCode: number,
): EvidenceDraft | 'skip' {
  if (statusCode >= 400) return 'skip';
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
  options?: {
    jsHeavyHints?: Map<string, boolean>;
    urlProvenance?: Map<string, UrlProvenance>;
    tuning?: {
      browserBudgetMax?: number;
      maxDrafts?: number;
      targetUniqueSourceUrls?: number | null;
    };
  },
): Promise<EvidenceDraft[]> {
  const maxDrafts = Math.max(
    1,
    options?.tuning?.maxDrafts ?? WEBSITE_DRAFT_MAX,
  );
  const browserBudgetMax = Math.max(
    1,
    options?.tuning?.browserBudgetMax ?? BROWSER_BUDGET_MAX,
  );
  const targetUniqueSourceUrlsRaw = options?.tuning?.targetUniqueSourceUrls;
  const targetUniqueSourceUrls =
    typeof targetUniqueSourceUrlsRaw === 'number' &&
    Number.isFinite(targetUniqueSourceUrlsRaw)
      ? Math.max(1, Math.floor(targetUniqueSourceUrlsRaw))
      : null;

  const drafts: EvidenceDraft[] = [];
  const nonFallbackUniqueSources = new Set<string>();
  let browserBudget = browserBudgetMax; // shared across all URLs in this call

  const pushDraft = (draft: EvidenceDraft): void => {
    if (drafts.length >= maxDrafts) return;
    drafts.push(draft);
    if (!fallbackMetadata(draft.metadata)) {
      nonFallbackUniqueSources.add(draft.sourceUrl);
    }
  };

  const pushDrafts = (items: EvidenceDraft[]): void => {
    for (const draft of items) {
      if (drafts.length >= maxDrafts) break;
      pushDraft(draft);
    }
  };

  const reachedLimit = (): boolean =>
    drafts.length >= maxDrafts ||
    (targetUniqueSourceUrls !== null &&
      nonFallbackUniqueSources.size >= targetUniqueSourceUrls);

  for (const sourceUrl of uniqueUrls(urls)) {
    if (reachedLimit()) break;

    const sourceType = sourceTypeForUrl(sourceUrl);
    const provenance = options?.urlProvenance?.get(sourceUrl);
    const riskySeedGuess = isRiskySeedGuess(sourceUrl, provenance);

    // Resolve jsHeavyHint: prefer caller-provided map, fall back to detection
    const jsHeavyHint =
      options?.jsHeavyHints?.get(sourceUrl) ?? detectJsHeavy(sourceUrl);

    try {
      // ------------------------------------------------------------------
      // Tier 1: Browser-direct path (REVIEWS URL or jsHeavyHint=true)
      // ------------------------------------------------------------------
      if (shouldUseBrowserDirect(sourceUrl, jsHeavyHint)) {
        if (browserBudget <= 0) {
          if (riskySeedGuess) continue;
          pushDraft(budgetExhaustedDraft(sourceUrl, sourceType));
          continue;
        }
        browserBudget--;
        const { markdown, title, statusCode } =
          await extractMarkdown(sourceUrl);
        const result = processCrawl4aiResult(
          sourceUrl,
          sourceType,
          markdown,
          title,
          statusCode,
        );
        if (result !== 'skip') pushDraft(result);
        continue;
      }

      // ------------------------------------------------------------------
      // Tier 2: Stealth-first path
      // ------------------------------------------------------------------
      const stealth = await fetchStealth(sourceUrl);

      // Hard HTTP error (4xx/5xx) — skip entirely, never create evidence
      if (stealth.statusCode >= 400) {
        continue;
      }

      const stealthHtml = stealth.ok ? stealth.html : '';
      const isStealthSufficient = stealthHtml.length >= 500;

      if (!isStealthSufficient) {
        // Stealth returned insufficient content — escalate to Crawl4AI
        if (browserBudget <= 0) {
          // Budget exhausted — fall back without browser extraction
          if (riskySeedGuess) continue;
          pushDraft(fallbackDraft(sourceUrl, sourceType));
          continue;
        }
        browserBudget--;
        const { markdown, title, statusCode } =
          await extractMarkdown(sourceUrl);
        const result = processCrawl4aiResult(
          sourceUrl,
          sourceType,
          markdown,
          title,
          statusCode,
        );
        if (result !== 'skip') {
          if (riskySeedGuess && fallbackMetadata(result.metadata)) {
            continue;
          }
          pushDraft(result);
        }
        continue;
      }

      // Stealth succeeded with sufficient content
      if (looksLikeSoft404(stealthHtml)) {
        // Soft 404 — skip
        continue;
      }

      pushDrafts(
        extractWebsiteEvidenceFromHtml({
          sourceUrl,
          sourceType,
          html: stealthHtml,
        }),
      );
    } catch (error) {
      console.error('website ingestion failed for source', sourceUrl, error);
      if (riskySeedGuess) continue;
      pushDraft(fallbackDraft(sourceUrl, sourceType));
    }
  }

  return drafts.slice(0, maxDrafts);
}
