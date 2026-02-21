import { inferSourceType, type EvidenceDraft } from '@/lib/workflow-engine';
import type { EvidenceSourceType } from '@prisma/client';

type WorkflowTag =
  | 'planning'
  | 'handoff'
  | 'billing'
  | 'lead-intake'
  | 'workflow-context';

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
  return value.length >= 30 ? value.slice(0, 260) : null;
}

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

function firstReadableSnippet(text: string): string {
  const sentences = normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 35 && line.length <= 260);
  return sentences[0] ?? normalizeWhitespace(text).slice(0, 220);
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
    default:
      return 0.68;
  }
}

function sourceTypeForUrl(url: string): EvidenceSourceType {
  const inferred = inferSourceType(url);
  return inferred === 'REVIEWS' ? 'MANUAL_URL' : inferred;
}

export function extractWebsiteEvidenceFromHtml(input: {
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  html: string;
}): EvidenceDraft[] {
  const title = extractTitle(input.html);
  const metaDescription = extractMetaDescription(input.html);
  const text = stripHtml(input.html);
  const snippet = metaDescription ?? firstReadableSnippet(text);
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

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
}

export async function ingestWebsiteEvidenceDrafts(
  urls: string[],
): Promise<EvidenceDraft[]> {
  const drafts: EvidenceDraft[] = [];
  for (const sourceUrl of uniqueUrls(urls)) {
    const sourceType = sourceTypeForUrl(sourceUrl);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const response = await fetch(sourceUrl, {
        method: 'GET',
        headers: {
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Qualifai/1.0',
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        drafts.push(fallbackDraft(sourceUrl, sourceType));
        continue;
      }

      const html = await response.text();
      drafts.push(
        ...extractWebsiteEvidenceFromHtml({
          sourceUrl,
          sourceType,
          html,
        }),
      );
    } catch (error) {
      console.error('website ingestion failed for source', sourceUrl, error);
      drafts.push(fallbackDraft(sourceUrl, sourceType));
    }
  }
  return drafts.slice(0, 20);
}
