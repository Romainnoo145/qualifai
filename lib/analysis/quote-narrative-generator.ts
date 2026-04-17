/**
 * quote-narrative-generator.ts — AI-powered offerte narrative drafting.
 *
 * Takes meeting notes + prospect analysis + firmographics, produces
 * Dutch boardroom-quality narrative for the brochure + suggested line items.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL_PRO } from '@/lib/ai/constants';

let genaiClient: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genaiClient) {
    genaiClient = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }
  return genaiClient;
}

export interface NarrativeGenerationInput {
  meetingNotes: string;
  prospectName: string;
  prospectDomain: string | null;
  prospectIndustry: string | null;
  prospectCity: string | null;
  prospectEmployeeCount: number | null;
  analysisContent: unknown | null;
}

export interface GeneratedNarrative {
  introductie: string;
  uitdaging: string;
  aanpak: string;
  suggestedLines: {
    omschrijving: string;
    uren: number;
    tarief: number;
  }[];
}

const SYSTEM_PROMPT = `Je bent een senior consultant bij Klarifai, een Nederlands softwareontwikkelingsbureau.
Je schrijft offerte-narratieven voor prospect-voorstellen. Je toon is professioneel, direct, en zakelijk.
Schrijf in het Nederlands. Geen filler, geen smalltalk, elk woord telt.

Je ontvangt:
1. Gespreksnotities van een meeting/telefoongesprek met de prospect
2. AI-onderzoeksdata over de prospect (als beschikbaar)
3. Firmographics (branche, omvang, locatie)

Produceer een JSON object met exact deze structuur:
{
  "introductie": "1-2 alinea's: waarom we dit voorstel schrijven, context van het gesprek",
  "uitdaging": "2-3 alinea's: wat er stuk is of beter kan, onderbouwd met feiten uit het gesprek en onderzoek",
  "aanpak": "2-3 alinea's: hoe Klarifai dit oplost, concreet en gefaseerd",
  "suggestedLines": [
    { "omschrijving": "Wat wordt opgeleverd", "uren": 20, "tarief": 95 }
  ]
}

Regels:
- Schrijf vanuit Klarifai's perspectief ("wij", "ons team")
- Refereer aan specifieke pijnpunten die in het gesprek naar voren kwamen
- Als er onderzoeksdata is, verrijk de uitdaging met concrete feiten
- Tarieven variëren van €80-€120 per uur afhankelijk van complexiteit
- Suggereer realistische uren per regel (discovery 16-24u, development 40-120u, support 8-16u)
- Antwoord ALLEEN met valid JSON, geen markdown, geen uitleg`;

export async function generateQuoteNarrative(
  input: NarrativeGenerationInput,
): Promise<GeneratedNarrative> {
  const genai = getGenAI();
  const model = genai.getGenerativeModel({ model: GEMINI_MODEL_PRO });

  const parts: string[] = [];
  parts.push(`## Gespreksnotities\n\n${input.meetingNotes}`);
  parts.push(
    `\n\n## Prospect profiel\n` +
      `Bedrijf: ${input.prospectName}\n` +
      `Website: ${input.prospectDomain ?? 'onbekend'}\n` +
      `Branche: ${input.prospectIndustry ?? 'onbekend'}\n` +
      `Locatie: ${input.prospectCity ?? 'onbekend'}\n` +
      `Medewerkers: ${input.prospectEmployeeCount ?? 'onbekend'}`,
  );

  if (input.analysisContent) {
    const analysis = input.analysisContent as Record<string, unknown>;
    const sections =
      (analysis.sections as Array<{ title: string; body: string }>) ?? [];
    const summary = (analysis.executiveSummary as string) ?? '';
    if (summary || sections.length > 0) {
      parts.push(`\n\n## AI-onderzoeksdata\n`);
      if (summary) parts.push(`Samenvatting: ${summary}\n`);
      for (const s of sections.slice(0, 5)) {
        parts.push(`### ${s.title}\n${s.body}\n`);
      }
    }
  }

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: parts.join('\n') }] }],
    systemInstruction: { role: 'model', parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  const text = result.response.text();
  const parsed = JSON.parse(text) as GeneratedNarrative;

  if (!parsed.introductie || !parsed.uitdaging || !parsed.aanpak) {
    throw new Error('AI response missing required narrative fields');
  }
  if (!Array.isArray(parsed.suggestedLines)) {
    parsed.suggestedLines = [];
  }

  return parsed;
}
