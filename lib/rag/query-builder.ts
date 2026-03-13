/**
 * AI-driven RAG query builder — uses Gemini Flash to generate semantically
 * targeted queries from prospect evidence, replacing keyword-stuffed packs.
 *
 * Primary export: buildEvidenceAwareQueries
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL_FLASH } from '@/lib/ai/constants';

type QueryBuilderInput = {
  companyName: string;
  industry: string | null;
  description: string | null;
  spvName: string | null;
  evidence: Array<{
    sourceType: string;
    workflowTag: string;
    snippet: string;
    confidenceScore: number;
    title: string | null;
  }>;
};

type RagQueryInput = {
  query: string;
  workflowTag: string;
};

// Lazy init — same pattern as master-analyzer.ts
let genaiClient: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genaiClient) {
    genaiClient = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }
  return genaiClient;
}

const MAX_EVIDENCE_ITEMS = 20;
const MAX_SNIPPET_LENGTH = 150;
const MAX_QUERY_LENGTH = 120;
const MAX_QUERIES = 6;
const TEMPERATURE = 0.3;

function buildPrompt(input: QueryBuilderInput): string {
  const topEvidence = input.evidence
    .filter((e) => e.snippet.trim().length > 0)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map((e, i) => {
      const snippet = e.snippet.trim().slice(0, MAX_SNIPPET_LENGTH);
      const tag = e.workflowTag || e.sourceType;
      return `${i + 1}. [${tag}] "${snippet}"`;
    })
    .join('\n');

  const partnershipContext = input.spvName
    ? `The prospect is being approached for a partnership with Atlantis / Europe's Gate (specifically SPV: ${input.spvName}).`
    : `The prospect is being approached for a partnership with Atlantis / Europe's Gate.`;

  return `You are a strategic analyst preparing for a partnership outreach meeting.

PROSPECT PROFILE:
- Company: ${input.companyName}
- Industry: ${input.industry ?? 'unknown'}
- Description: ${input.description?.slice(0, 200) ?? 'not available'}
- Partnership context: ${partnershipContext}

EVIDENCE FROM PROSPECT RESEARCH (top ${MAX_EVIDENCE_ITEMS} items by confidence):
${topEvidence}

TASK:
Generate exactly 4-6 semantic search queries that a human analyst would type to find the most relevant Atlantis / Europe's Gate partnership documents for this specific prospect.

Each query must target a different angle:
1. Sector capabilities & infrastructure fit
2. Operational pain relief & bottleneck solutions
3. ESG / compliance / regulatory alignment
4. Financial fit: investment, capex, subsidies, returns
5. Strategic partnership value & market timing
6. (Optional) Any other highly specific angle revealed by the evidence

RULES:
- Base each query on the actual evidence above, not generic sector assumptions
- Each query must be in Dutch, English, or a natural mix — whichever fits the content
- Maximum ${MAX_QUERY_LENGTH} characters per query
- The workflowTag must be one of: workflow-context, planning, billing, reporting, lead-intake, intent-sector, intent-operational, intent-esg, intent-capital, intent-strategic
- Return ONLY valid JSON — no markdown, no explanation

OUTPUT FORMAT (JSON array):
[
  { "query": "...", "workflowTag": "..." },
  { "query": "...", "workflowTag": "..." }
]`;
}

function isValidQueryArray(value: unknown): value is RagQueryInput[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).query === 'string' &&
      typeof (item as Record<string, unknown>).workflowTag === 'string' &&
      ((item as Record<string, unknown>).query as string).trim().length > 0,
  );
}

/**
 * Generate semantically targeted RAG queries from prospect evidence using
 * Gemini Flash. Returns empty array on failure — callers must apply fallback.
 */
export async function buildEvidenceAwareQueries(
  input: QueryBuilderInput,
): Promise<RagQueryInput[]> {
  if (input.evidence.length === 0) {
    return [];
  }

  try {
    const genai = getGenAI();
    const model = genai.getGenerativeModel({
      model: GEMINI_MODEL_FLASH,
      generationConfig: {
        temperature: TEMPERATURE,
        responseMimeType: 'application/json',
      },
    });

    const prompt = buildPrompt(input);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Sometimes the model wraps in markdown code fences despite mime type
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      parsed = JSON.parse(jsonMatch[0]);
    }

    if (!isValidQueryArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        query: item.query.trim().slice(0, MAX_QUERY_LENGTH),
        workflowTag: item.workflowTag.trim() || 'workflow-context',
      }))
      .filter((item) => item.query.length > 0)
      .slice(0, MAX_QUERIES);
  } catch {
    // LLM call failed — caller applies fallback
    return [];
  }
}
