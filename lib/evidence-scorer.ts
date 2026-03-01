import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EvidenceSourceType } from '@prisma/client';

let genaiClient: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genaiClient) {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error('GOOGLE_AI_API_KEY not set');
    genaiClient = new GoogleGenerativeAI(key);
  }
  return genaiClient;
}

/**
 * Source weights reflecting user priority: external pain signals > website context.
 */
const SOURCE_WEIGHTS: Record<string, number> = {
  REVIEWS: 0.9,
  LINKEDIN: 0.88,
  NEWS: 0.85,
  CAREERS: 0.85,
  JOB_BOARD: 0.85,
  REGISTRY: 0.8,
  DOCS: 0.75,
  HELP_CENTER: 0.75,
  WEBSITE: 0.65,
  MANUAL_URL: 0.65,
};

function getSourceWeight(sourceType: string): number {
  return SOURCE_WEIGHTS[sourceType] ?? 0.65;
}

export interface EvidenceToScore {
  index: number;
  sourceType: EvidenceSourceType;
  sourceUrl: string;
  title: string | null;
  snippet: string;
  metadata?: unknown;
}

export interface ScoredEvidence {
  index: number;
  aiRelevance: number;
  aiDepth: number;
  aiReason: string;
  finalConfidence: number;
}

/**
 * Score evidence items for workflow/automation relevance using Gemini Flash.
 *
 * Each item is rated on two dimensions:
 * - relevance (0.0-1.0): How useful for identifying workflow/automation pain?
 * - depth (0.0-1.0): How specific/detailed is the content?
 *
 * Final confidence = sourceWeight * 0.30 + relevance * 0.45 + depth * 0.25
 *
 * Cost: ~$0.0004 per run (1-2 Gemini Flash calls). Negligible.
 */
export async function scoreEvidenceBatch(
  items: EvidenceToScore[],
  prospectContext: {
    companyName: string | null;
    industry: string | null;
  },
): Promise<ScoredEvidence[]> {
  if (items.length === 0) return [];

  // Skip scoring for notFound placeholders
  const toScore: EvidenceToScore[] = [];
  const skipped: ScoredEvidence[] = [];

  for (const item of items) {
    const meta = item.metadata as Record<string, unknown> | null;
    if (meta?.notFound === true) {
      skipped.push({
        index: item.index,
        aiRelevance: 0,
        aiDepth: 0,
        aiReason: 'Placeholder — source not found',
        finalConfidence: 0.1,
      });
    } else {
      toScore.push(item);
    }
  }

  if (toScore.length === 0) return skipped;

  // Process in batches of 15
  const scored: ScoredEvidence[] = [...skipped];
  const batchSize = 15;

  for (let i = 0; i < toScore.length; i += batchSize) {
    const batch = toScore.slice(i, i + batchSize);
    const batchResults = await scoreBatch(batch, prospectContext);
    scored.push(...batchResults);
  }

  return scored;
}

async function scoreBatch(
  items: EvidenceToScore[],
  prospectContext: { companyName: string | null; industry: string | null },
): Promise<ScoredEvidence[]> {
  const evidenceLines = items
    .map(
      (item, i) =>
        `[${i}] ${item.sourceType} | ${item.title ?? 'No title'} | ${item.snippet.slice(0, 300)}`,
    )
    .join('\n');

  const prompt = `Score each evidence item for workflow/automation relevance. This is for ${prospectContext.companyName ?? 'a company'} in ${prospectContext.industry ?? 'unknown industry'}.

Rate each item on two dimensions:
- relevance (0.0-1.0): How useful is this for identifying workflow bottlenecks, manual processes, or automation opportunities?
  - 0.0-0.2: Completely irrelevant (generic about page, unrelated content)
  - 0.3-0.5: Some context but no workflow signal (company description, team info)
  - 0.6-0.7: Indirect workflow signal (hiring patterns, service descriptions suggesting process complexity)
  - 0.8-0.9: Direct workflow signal (mentions of manual processes, operational pain, automation needs)
  - 0.95-1.0: Explicit workflow pain (employee complaints about systems, documented process issues)

- depth (0.0-1.0): How specific and detailed is the content?
  - 0.0-0.2: Empty or placeholder content
  - 0.3-0.5: Surface-level, generic statements
  - 0.6-0.7: Some specifics (named tools, concrete processes)
  - 0.8-1.0: Rich detail (specific pain points, quantified impacts, named workflows)

Only output JSON. No markdown fences. No explanation.

Evidence items:
${evidenceLines}

Return a JSON array:
[{"i":0,"r":0.5,"d":0.4,"reason":"Brief explanation"}]`;

  try {
    const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' });
    const response = await model.generateContent(prompt);
    const text = response.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return fallbackScores(items);
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      i: number;
      r: number;
      d: number;
      reason?: string;
    }>;

    if (!Array.isArray(parsed)) {
      return fallbackScores(items);
    }

    // Build lookup from AI index to result
    const aiResults = new Map<
      number,
      { r: number; d: number; reason: string }
    >();
    for (const p of parsed) {
      if (typeof p.i === 'number') {
        aiResults.set(p.i, {
          r: clamp(p.r ?? 0.5, 0, 1),
          d: clamp(p.d ?? 0.4, 0, 1),
          reason: p.reason ?? '',
        });
      }
    }

    return items.map((item, i) => {
      const ai = aiResults.get(i) ?? { r: 0.5, d: 0.4, reason: 'No AI score' };
      const sourceWeight = getSourceWeight(item.sourceType);
      const finalConfidence = round2(
        sourceWeight * 0.3 + ai.r * 0.45 + ai.d * 0.25,
      );

      return {
        index: item.index,
        aiRelevance: round2(ai.r),
        aiDepth: round2(ai.d),
        aiReason: ai.reason,
        finalConfidence,
      };
    });
  } catch (err) {
    console.warn('[evidence-scorer] AI scoring failed, using fallback:', err);
    return fallbackScores(items);
  }
}

function fallbackScores(items: EvidenceToScore[]): ScoredEvidence[] {
  return items.map((item) => {
    const sourceWeight = getSourceWeight(item.sourceType);
    // Without AI, use moderate defaults
    const relevance = 0.5;
    const depth = 0.4;
    return {
      index: item.index,
      aiRelevance: relevance,
      aiDepth: depth,
      aiReason: 'Fallback — AI scoring unavailable',
      finalConfidence: round2(
        sourceWeight * 0.3 + relevance * 0.45 + depth * 0.25,
      ),
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
