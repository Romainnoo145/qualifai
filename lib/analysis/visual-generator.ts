/**
 * Visual data generator for narrative sections — PROMPT-03.
 *
 * Generates per-section visual data using a single Gemini Flash batch call
 * after the masterprompt has returned its sections. Soft-fails on any error
 * so analysis is always persisted regardless of visual enrichment status.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL_FLASH } from '@/lib/ai/constants';
import type {
  NarrativeSection,
  EvidenceItem,
  VisualType,
  VisualData,
} from './types';

let genaiClient: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genaiClient) {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error('GOOGLE_AI_API_KEY not set');
    genaiClient = new GoogleGenerativeAI(key);
  }
  return genaiClient;
}

export type SectionVisualResult = {
  sectionId: string;
  visualType?: VisualType;
  visualData?: VisualData;
};

function buildVisualPrompt(
  sections: NarrativeSection[],
  evidence: EvidenceItem[],
): string {
  const sectionList = sections
    .map(
      (s, i) =>
        `[Sectie ${i + 1}: ${s.id}]\nTitel: ${s.title}\nBody: ${s.body}\nBronnen: ${s.citations.join(', ')}`,
    )
    .join('\n\n');

  const evidenceList = evidence
    .map(
      (e, i) =>
        `[${i + 1}] ${e.sourceType} | ${e.title ?? 'Geen titel'}\n${e.snippet.slice(0, 200)}`,
    )
    .join('\n');

  return `Je bent een data-visualisatie expert. Analyseer de volgende secties en het onderliggende bewijs.
Kies voor elke sectie het meest passende visualisatietype op basis van de beschikbare data.

SECTIES:
${sectionList}

BEWIJS:
${evidenceList}

VISUALISATIETYPES:
- "quote": wanneer er een krachtig citaat of review-fragment beschikbaar is
  visualData: { "type": "quote", "quote": "het citaat", "attribution": "bron" }
- "comparison": wanneer er een voor/na vergelijking mogelijk is
  visualData: { "type": "comparison", "items": [{ "label": "aspect", "before": "huidig", "after": "mogelijk" }] } (2-4 items)
- "signals": wanneer er meetbare signalen of trends zijn
  visualData: { "type": "signals", "items": [{ "label": "signaal", "value": "waarde", "trend": "up"|"down"|"neutral" }] } (2-4 items)
- "stats": wanneer er concrete cijfers beschikbaar zijn
  visualData: { "type": "stats", "items": [{ "label": "metric", "value": "getal", "context": "toelichting" }] } (2-4 items)

REGELS:
- visualData moet ALTIJD afgeleid zijn van echt bewijs — NOOIT verzonnen
- Als er geen geschikte data is voor een sectie, laat visualType en visualData weg voor die sectie
- Retourneer ALLEEN een JSON array

Retourneer een JSON array met exact ${sections.length} objecten:
[{ "sectionId": "slug-id", "visualType": "stats", "visualData": { ... } }, ...]

Retourneer ALLEEN de JSON array, geen markdown, geen uitleg.`;
}

function extractJSON(text: string): unknown | null {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }
  // Try extracting from markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match?.[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch {
      /* continue */
    }
  }
  // Try finding array brackets
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {
      /* continue */
    }
  }
  return null;
}

/**
 * Generate per-section visual data using a single Gemini Flash batch call.
 *
 * Returns a SectionVisualResult for each input section. On any error (API
 * failure, malformed JSON, unexpected shape), returns a fallback array with
 * only sectionId populated — never throws.
 */
export async function generateSectionVisuals(
  sections: NarrativeSection[],
  evidence: EvidenceItem[],
): Promise<SectionVisualResult[]> {
  if (sections.length === 0) return [];

  const fallback = sections.map((s) => ({ sectionId: s.id }));

  try {
    const genai = getGenAI();
    const model = genai.getGenerativeModel({ model: GEMINI_MODEL_FLASH });
    const prompt = buildVisualPrompt(sections, evidence);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = extractJSON(text);

    if (!Array.isArray(parsed) || parsed.length !== sections.length) {
      console.warn(
        '[visual-generator] Flash returned unexpected shape, skipping visuals',
      );
      return fallback;
    }

    return sections.map((s, i) => {
      const item = parsed[i] as Record<string, unknown> | undefined;
      if (!item || item.sectionId !== s.id) {
        return { sectionId: s.id };
      }
      return {
        sectionId: s.id,
        visualType: item.visualType as VisualType | undefined,
        visualData: item.visualData as VisualData | undefined,
      };
    });
  } catch (err) {
    console.warn(
      '[visual-generator] Flash call failed, proceeding without visuals:',
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}
