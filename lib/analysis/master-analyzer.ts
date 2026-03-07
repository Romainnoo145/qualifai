/**
 * AI master analysis generation engine — calls Claude Sonnet to produce
 * structured MasterAnalysis from intent variables, RAG passages, prospect
 * profile, and SPV data.
 */

import { env } from '@/env.mjs';
import Anthropic from '@anthropic-ai/sdk';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages/messages';
import { CLAUDE_MODEL_SONNET } from '@/lib/ai/constants';
import { buildMasterPrompt } from './master-prompt';
import type {
  MasterAnalysis,
  MasterAnalysisInput,
  AnalysisContext,
  AnalysisTrigger,
  AnalysisTrack,
  AnalysisKPI,
  TriggerCategory,
} from './types';

// Lazy init — same pattern as workflow-engine.ts
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  }
  return anthropicClient;
}

const VALID_TRIGGER_CATEGORIES: TriggerCategory[] = [
  'market',
  'compliance_esg',
  'capital_derisking',
];

const VALID_URGENCY = ['high', 'medium', 'low'] as const;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function validateKPI(raw: unknown): AnalysisKPI | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.label) ||
    !isNonEmptyString(obj.value) ||
    !isNonEmptyString(obj.context)
  ) {
    return null;
  }
  return { label: obj.label, value: obj.value, context: obj.context };
}

function validateContext(raw: unknown): AnalysisContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.hook) || !isNonEmptyString(obj.executiveHook)) {
    return null;
  }
  if (!Array.isArray(obj.kpis) || obj.kpis.length !== 3) return null;
  const kpis: AnalysisKPI[] = [];
  for (const kpiRaw of obj.kpis) {
    const kpi = validateKPI(kpiRaw);
    if (!kpi) return null;
    kpis.push(kpi);
  }
  return { hook: obj.hook, kpis, executiveHook: obj.executiveHook };
}

function validateTrigger(raw: unknown): AnalysisTrigger | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.category) ||
    !VALID_TRIGGER_CATEGORIES.includes(obj.category as TriggerCategory)
  ) {
    return null;
  }
  if (!isNonEmptyString(obj.title) || !isNonEmptyString(obj.narrative)) {
    return null;
  }
  if (!isStringArray(obj.numbers)) return null;
  if (
    !isNonEmptyString(obj.urgency) ||
    !VALID_URGENCY.includes(obj.urgency as (typeof VALID_URGENCY)[number])
  ) {
    return null;
  }
  return {
    category: obj.category as TriggerCategory,
    title: obj.title,
    narrative: obj.narrative,
    numbers: obj.numbers,
    urgency: obj.urgency as 'high' | 'medium' | 'low',
  };
}

function validateTrack(raw: unknown): AnalysisTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.spvName) ||
    !isNonEmptyString(obj.spvCode) ||
    !isNonEmptyString(obj.scope) ||
    !isNonEmptyString(obj.relevance)
  ) {
    return null;
  }
  if (!isStringArray(obj.strategicTags) || obj.strategicTags.length === 0) {
    return null;
  }
  return {
    spvName: obj.spvName,
    spvCode: obj.spvCode,
    scope: obj.scope,
    relevance: obj.relevance,
    strategicTags: obj.strategicTags,
  };
}

/**
 * Validate a raw parsed object against the MasterAnalysis shape.
 * Returns null on any structural or content violation.
 */
export function validateMasterAnalysis(raw: unknown): MasterAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // Context section
  const context = validateContext(obj.context);
  if (!context) return null;

  // Triggers section — exactly 3 with correct categories
  if (!Array.isArray(obj.triggers) || obj.triggers.length !== 3) return null;
  const triggers: AnalysisTrigger[] = [];
  const seenCategories = new Set<string>();
  for (const triggerRaw of obj.triggers) {
    const trigger = validateTrigger(triggerRaw);
    if (!trigger) return null;
    if (seenCategories.has(trigger.category)) return null;
    seenCategories.add(trigger.category);
    triggers.push(trigger);
  }

  // Tracks section — 2-3 items
  if (
    !Array.isArray(obj.tracks) ||
    obj.tracks.length < 2 ||
    obj.tracks.length > 3
  ) {
    return null;
  }
  const tracks: AnalysisTrack[] = [];
  for (const trackRaw of obj.tracks) {
    const track = validateTrack(trackRaw);
    if (!track) return null;
    tracks.push(track);
  }

  return {
    version: 'analysis-v1',
    context,
    triggers,
    tracks,
    generatedAt: '', // filled by caller
    modelUsed: '', // filled by caller
  };
}

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

function extractJSON(text: string): unknown | null {
  // Try parsing the whole text first
  try {
    return JSON.parse(text);
  } catch {
    // noop
  }

  // Try extracting from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {
      // noop
    }
  }

  // Try finding first { to last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      // noop
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Generate a MasterAnalysis by calling Claude Sonnet with the constructed prompt.
 * Validates the response and retries once on parse/validation failure.
 */
export async function generateMasterAnalysis(
  input: MasterAnalysisInput,
): Promise<MasterAnalysis> {
  const client = getAnthropicClient();
  const prompt = buildMasterPrompt(input);
  const model = CLAUDE_MODEL_SONNET;

  const startMs = Date.now();
  console.log(
    `[master-analyzer] Generating analysis for ${input.prospect.companyName} using ${model}...`,
  );

  let lastRawText = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: Anthropic.MessageParam[] =
      attempt === 0
        ? [{ role: 'user', content: prompt }]
        : [
            { role: 'user', content: prompt },
            { role: 'assistant', content: lastRawText },
            {
              role: 'user',
              content:
                'De JSON was ongeldig of voldeed niet aan het schema. Corrigeer het en retourneer ALLEEN valide JSON in exact het gevraagde formaat. Zorg voor: exact 3 KPIs, exact 3 triggers (market, compliance_esg, capital_derisking), 2-3 tracks, en alle string-velden niet-leeg.',
            },
          ];

    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      messages,
    });

    const textBlock = response.content.find(
      (block): block is TextBlock => block.type === 'text',
    );
    if (!textBlock) {
      lastRawText = '[no text block in response]';
      continue;
    }

    lastRawText = textBlock.text;
    const parsed = extractJSON(lastRawText);
    if (!parsed) {
      console.warn(
        `[master-analyzer] Attempt ${attempt + 1}: failed to extract JSON`,
      );
      continue;
    }

    const validated = validateMasterAnalysis(parsed);
    if (!validated) {
      console.warn(
        `[master-analyzer] Attempt ${attempt + 1}: JSON did not match MasterAnalysis schema`,
      );
      continue;
    }

    const durationMs = Date.now() - startMs;
    console.log(
      `[master-analyzer] Analysis generated in ${durationMs}ms (attempt ${attempt + 1})`,
    );

    return {
      ...validated,
      generatedAt: new Date().toISOString(),
      modelUsed: model,
    };
  }

  const durationMs = Date.now() - startMs;
  throw new Error(
    `[master-analyzer] Failed to generate valid MasterAnalysis for ${input.prospect.companyName} after 2 attempts (${durationMs}ms). Last response: ${lastRawText.slice(0, 500)}`,
  );
}
