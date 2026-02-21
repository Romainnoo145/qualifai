import type { EvidenceDraft } from '@/lib/workflow-engine';

type WorkflowTag = 'planning' | 'handoff' | 'billing' | 'workflow-context';

const SIGNAL_PATTERNS: Array<{
  workflowTag: WorkflowTag;
  keywords: string[];
}> = [
  {
    workflowTag: 'planning',
    keywords: [
      'planning',
      'schedule',
      'afspraak',
      'wachttijd',
      'late',
      'vertraging',
      'te laat',
      'doorlooptijd',
    ],
  },
  {
    workflowTag: 'handoff',
    keywords: [
      'communicatie',
      'bereikbaar',
      'terugbellen',
      'overdracht',
      'status update',
      'response',
      'reactie',
      'follow-up',
    ],
  },
  {
    workflowTag: 'billing',
    keywords: [
      'factuur',
      'invoice',
      'offerte',
      'prijs',
      'kosten',
      'meerwerk',
      'quote',
      'betaling',
    ],
  },
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
  const noScript = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  return noScript.replace(/<[^>]+>/g, ' ');
}

function splitSentences(value: string): string[] {
  return normalizeWhitespace(value)
    .split(/(?<=[.!?])\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length >= 40 && part.length <= 240);
}

function detectProvider(url: string): string {
  const lowered = url.toLowerCase();
  if (lowered.includes('trustpilot')) return 'trustpilot';
  if (
    lowered.includes('google.com/maps') ||
    lowered.includes('google.com/search')
  ) {
    return 'google';
  }
  if (lowered.includes('klantenvertellen')) return 'klantenvertellen';
  if (lowered.includes('feedbackcompany')) return 'feedbackcompany';
  return 'generic';
}

function providerBaseConfidence(provider: string): number {
  switch (provider) {
    case 'google':
      return 0.82;
    case 'trustpilot':
      return 0.8;
    case 'klantenvertellen':
      return 0.79;
    case 'feedbackcompany':
      return 0.78;
    default:
      return 0.74;
  }
}

export function extractReviewSignalsFromText(text: string): Array<{
  workflowTag: WorkflowTag;
  snippet: string;
  matchedKeywords: string[];
}> {
  const sentences = splitSentences(stripHtml(text)).slice(0, 400);
  const seenSnippets = new Set<string>();
  const signals: Array<{
    workflowTag: WorkflowTag;
    snippet: string;
    matchedKeywords: string[];
  }> = [];

  for (const sentence of sentences) {
    const lowered = sentence.toLowerCase();
    for (const pattern of SIGNAL_PATTERNS) {
      const matchedKeywords = pattern.keywords.filter((keyword) =>
        lowered.includes(keyword),
      );
      if (matchedKeywords.length === 0) continue;

      const dedupeKey = `${pattern.workflowTag}:${sentence}`;
      if (seenSnippets.has(dedupeKey)) continue;
      seenSnippets.add(dedupeKey);

      signals.push({
        workflowTag: pattern.workflowTag,
        snippet: sentence,
        matchedKeywords,
      });
      break;
    }
    if (signals.length >= 8) break;
  }

  return signals;
}

function toReviewEvidenceDraft(
  sourceUrl: string,
  provider: string,
  signal: {
    workflowTag: WorkflowTag;
    snippet: string;
    matchedKeywords: string[];
  },
  index: number,
): EvidenceDraft {
  const baseConfidence = providerBaseConfidence(provider);
  const confidenceBoost = Math.min(signal.matchedKeywords.length * 0.02, 0.08);
  return {
    sourceType: 'REVIEWS',
    sourceUrl,
    title: `Review signal ${index + 1} (${provider})`,
    snippet: signal.snippet,
    workflowTag: signal.workflowTag,
    confidenceScore: Math.min(baseConfidence + confidenceBoost, 0.9),
    metadata: {
      adapter: 'live-review-ingestion',
      provider,
      matchedKeywords: signal.matchedKeywords,
    },
  };
}

function fallbackReviewDraft(
  sourceUrl: string,
  provider: string,
): EvidenceDraft {
  return {
    sourceType: 'REVIEWS',
    sourceUrl,
    title: `Review source (${provider})`,
    snippet:
      'Review source ingested but no high-quality sentence-level signals extracted yet. Keep as validation source.',
    workflowTag: 'workflow-context',
    confidenceScore: providerBaseConfidence(provider) - 0.08,
    metadata: {
      adapter: 'live-review-ingestion',
      provider,
      fallback: true,
    },
  };
}

export async function ingestReviewEvidenceDrafts(
  reviewUrls: string[],
): Promise<EvidenceDraft[]> {
  const drafts: EvidenceDraft[] = [];

  for (const sourceUrl of reviewUrls) {
    const provider = detectProvider(sourceUrl);
    try {
      const response = await fetch(sourceUrl, {
        method: 'GET',
        headers: {
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Qualifai/1.0',
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      if (!response.ok) {
        drafts.push(fallbackReviewDraft(sourceUrl, provider));
        continue;
      }

      const html = await response.text();
      const signals = extractReviewSignalsFromText(html);
      if (signals.length === 0) {
        drafts.push(fallbackReviewDraft(sourceUrl, provider));
        continue;
      }

      for (const [index, signal] of signals.entries()) {
        drafts.push(toReviewEvidenceDraft(sourceUrl, provider, signal, index));
      }
    } catch (error) {
      console.error('review ingestion failed for source', sourceUrl, error);
      drafts.push(fallbackReviewDraft(sourceUrl, provider));
    }
  }

  return drafts.slice(0, 18);
}
