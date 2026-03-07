/**
 * AI-powered intent extraction — analyzes quality-gated evidence items
 * into structured intent variables with source attribution.
 *
 * Uses Gemini Flash (same pattern as generateHypothesisDraftsAI in workflow-engine.ts).
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL_FLASH } from '@/lib/ai/constants';
import {
  type IntentVariables,
  type IntentSignal,
  type IntentCategory,
  type ExtraCategory,
  INTENT_CATEGORIES,
} from './types';

// Lazy init — same pattern as workflow-engine.ts
let genaiClient: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genaiClient) {
    genaiClient = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }
  return genaiClient;
}

/** Evidence item shape expected by the extractor */
export type ExtractionEvidenceInput = {
  id: string;
  sourceType: string;
  sourceUrl: string;
  snippet: string;
  title: string | null;
  confidenceScore: number;
  workflowTag: string;
  metadata: unknown;
};

/** Prospect profile context for extraction */
export type ExtractionProspectProfile = {
  companyName: string | null;
  industry: string | null;
  description: string | null;
  specialties: string[];
};

/** Raw AI response shape for a single signal */
type AISignalItem = {
  category: string;
  signal: string;
  confidence: number;
  sourceUrl: string;
  snippet: string;
  sourceType: string;
};

const MIN_CONFIDENCE = 0.5;

/**
 * Extract structured intent variables from quality-gated evidence items.
 *
 * Filters to items with confidenceScore >= 0.50 and excludes RAG_DOCUMENT sources.
 * Calls Gemini Flash to classify evidence into 5 core categories + optional extras.
 */
export async function extractIntentVariables(
  evidenceItems: ExtractionEvidenceInput[],
  prospect: ExtractionProspectProfile,
): Promise<IntentVariables> {
  // Filter: quality gate + exclude RAG documents (extraction is from scraped evidence only)
  const filtered = evidenceItems.filter(
    (item) =>
      item.confidenceScore >= MIN_CONFIDENCE &&
      item.sourceType !== 'RAG_DOCUMENT',
  );

  // If no evidence passes the filter, return empty structure
  if (filtered.length === 0) {
    return emptyIntentVariables();
  }

  const evidenceLines = filtered
    .map(
      (item, i) =>
        `[${i + 1}] [${item.sourceType}] ${item.sourceUrl}\n${item.snippet.slice(0, 800)}`,
    )
    .join('\n\n');

  const prompt = `You are an intent extraction analyst. Analyze the following evidence items collected about a company and classify each relevant signal into intent categories.

COMPANY CONTEXT:
- Name: ${prospect.companyName ?? 'Unknown'}
- Industry: ${prospect.industry ?? 'Unknown'}
- Description: ${prospect.description ?? 'No description available'}
- Specialties: ${prospect.specialties.length > 0 ? prospect.specialties.join(', ') : 'Unknown'}

CORE CATEGORIES (use these exact keys):
- sector_fit: Signals about the company's sector alignment, market position, industry focus, and strategic direction
- operational_pains: Operational challenges, process bottlenecks, inefficiencies, customer complaints about service delivery
- esg_csrd: ESG commitments, sustainability initiatives, CSRD compliance signals, green certifications, carbon targets
- investment_growth: Investment activity, expansion plans, M&A signals, revenue growth, new market entry, capital expenditure
- workforce: Hiring patterns, talent gaps, organizational changes, headcount growth/decline, skills shortages

RULES:
1. Each evidence item can contribute signals to MULTIPLE categories (multi-map).
2. For each signal, provide a 0-1 confidence score reflecting how clearly the evidence supports this signal.
3. Always include the exact sourceUrl and a brief backing snippet from the original evidence.
4. If you find signals that don't fit any core category, create additional categories with descriptive keys (e.g., "digital_maturity", "supply_chain_risk").
5. Only extract signals that are genuinely supported by the evidence. Do not invent or speculate.
6. Each signal description should be a concise, specific statement (1-2 sentences max).

EVIDENCE ITEMS:
${evidenceLines}

Respond with a JSON array of signal objects. Each object must have:
{
  "category": "<category_key>",
  "signal": "<concise signal description>",
  "confidence": <0.0 to 1.0>,
  "sourceUrl": "<exact source URL from evidence>",
  "snippet": "<brief backing quote from evidence>",
  "sourceType": "<source type from evidence>"
}

Return ONLY a JSON array, no other text.`;

  const model = getGenAI().getGenerativeModel({
    model: GEMINI_MODEL_FLASH,
  });
  const response = await model.generateContent(prompt);
  const text = response.response.text();

  // Parse JSON array from response (handle markdown code fences)
  const cleaned = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('[extractIntentVariables] No JSON array in AI response');
    return emptyIntentVariables();
  }

  let parsed: AISignalItem[];
  try {
    parsed = JSON.parse(jsonMatch[0]) as AISignalItem[];
  } catch {
    console.warn('[extractIntentVariables] Failed to parse AI response JSON');
    return emptyIntentVariables();
  }

  if (!Array.isArray(parsed)) {
    return emptyIntentVariables();
  }

  // Build IntentVariables from parsed signals
  const categories: Record<IntentCategory, IntentSignal[]> = {
    sector_fit: [],
    operational_pains: [],
    esg_csrd: [],
    investment_growth: [],
    workforce: [],
  };
  const extrasMap = new Map<string, IntentSignal[]>();
  const coreSet = new Set<string>(INTENT_CATEGORIES);

  for (const item of parsed) {
    if (!item.category || !item.signal) continue;

    const signal: IntentSignal = {
      signal: String(item.signal).slice(0, 500),
      confidence: clampConfidence(item.confidence),
      sourceUrl: String(item.sourceUrl ?? ''),
      snippet: String(item.snippet ?? '').slice(0, 400),
      sourceType: String(item.sourceType ?? ''),
    };

    if (coreSet.has(item.category)) {
      categories[item.category as IntentCategory].push(signal);
    } else {
      const key = String(item.category);
      if (!extrasMap.has(key)) extrasMap.set(key, []);
      extrasMap.get(key)!.push(signal);
    }
  }

  const extras: ExtraCategory[] = Array.from(extrasMap.entries()).map(
    ([category, signals]) => ({ category, signals }),
  );

  const populatedCount = INTENT_CATEGORIES.filter(
    (cat) => categories[cat].length > 0,
  ).length;

  return {
    categories,
    extras,
    populatedCount,
    sparse: populatedCount < 3,
  };
}

/** Create an empty IntentVariables structure */
function emptyIntentVariables(): IntentVariables {
  return {
    categories: {
      sector_fit: [],
      operational_pains: [],
      esg_csrd: [],
      investment_growth: [],
      workforce: [],
    },
    extras: [],
    populatedCount: 0,
    sparse: true,
  };
}

/** Clamp confidence to 0-1 range, default 0.5 if invalid */
function clampConfidence(val: unknown): number {
  if (typeof val !== 'number' || isNaN(val)) return 0.5;
  return Math.min(1, Math.max(0, val));
}
