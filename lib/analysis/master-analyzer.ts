/**
 * AI master analysis generation engine — calls Gemini 2.5 Pro to produce
 * structured analysis from evidence items, RAG passages, prospect profile,
 * and SPV data.
 *
 * Supports two output shapes:
 *   - NarrativeAnalysis (analysis-v2): flowing narrative sections (new)
 *   - MasterAnalysis (analysis-v1): rigid trigger/track JSON (legacy)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  GenerativeModel,
  GenerateContentResult,
} from '@google/generative-ai';
import { GEMINI_MODEL_PRO, GEMINI_MODEL_FLASH } from '@/lib/ai/constants';
import { buildMasterPrompt } from './master-prompt';
import type {
  MasterAnalysis,
  NarrativeAnalysis,
  NarrativeAnalysisInput,
  NarrativeSection,
  SPVRecommendation,
  AnalysisContext,
  AnalysisTrigger,
  AnalysisTrack,
  AnalysisKPI,
  TriggerCategory,
  KlarifaiNarrativeInput,
  KlarifaiNarrativeAnalysis,
  UseCaseRecommendation,
} from './types';

// Lazy init — same pattern as intent-extractor.ts
let genaiClient: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genaiClient) {
    genaiClient = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }
  return genaiClient;
}

// ---------------------------------------------------------------------------
// Retry + fallback layer (Phase 61.1 POLISH-01/02 + SC #2)
// PHASE 61.1 POLISH: retry layer inlined — candidate for extraction to lib/analysis/retry.ts
// ---------------------------------------------------------------------------

/**
 * Return envelope for callGeminiWithRetry. Callers MUST destructure this —
 * the `fallbackUsed` flag is the fidelity signal that drives the Plan 04 UI
 * fallback-used warning (ROADMAP SC #2).
 */
export type GeminiCallResult = {
  result: GenerateContentResult;
  fallbackUsed: boolean;
  modelUsed: 'gemini-2.5-pro' | 'gemini-2.5-flash';
  attempts: number;
};

const RETRYABLE_PATTERNS = [
  /5\d\d/, // any HTTP 5xx in the message
  /Service Unavailable/i,
  /quota/i,
  /429/,
  /rate.?limit/i,
];

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_PATTERNS.some((rx) => rx.test(message));
}

/**
 * Call Gemini with exponential backoff + optional fallback model.
 *
 * Retry matrix:
 *   - 3 primary attempts, backoff 1s -> 4s -> 16s (Math.pow(4, attempt) * 1000)
 *   - 1 fallback attempt if opts.fallbackModel provided
 *   - Non-retryable errors (4xx except 429) bubble immediately
 *
 * Returns a GeminiCallResult envelope so callers can propagate the
 * `fallbackUsed` + `modelUsed` signals to the UI layer (Plan 04).
 *
 * Exported for unit testing.
 */
export async function callGeminiWithRetry(
  primaryModel: GenerativeModel,
  prompt: string,
  opts: {
    modelName: 'gemini-2.5-pro' | 'gemini-2.5-flash';
    fallbackModel?: GenerativeModel;
    fallbackModelName?: 'gemini-2.5-pro' | 'gemini-2.5-flash';
  },
): Promise<GeminiCallResult> {
  const maxAttempts = 3;
  let lastError: unknown = null;
  let attemptsConsumed = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    attemptsConsumed = attempt + 1;
    try {
      const result = await primaryModel.generateContent(prompt);
      return {
        result,
        fallbackUsed: false,
        modelUsed: opts.modelName,
        attempts: attemptsConsumed,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error)) {
        throw error;
      }
      if (attempt < maxAttempts - 1) {
        const delay = Math.pow(4, attempt) * 1000; // 1s, 4s, 16s
        console.warn(
          `[master-analyzer] ${opts.modelName} attempt ${attempt + 1}/${maxAttempts} failed (retryable), waiting ${delay}ms: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  if (opts.fallbackModel && opts.fallbackModelName) {
    console.warn(
      `[master-analyzer] Falling back to ${opts.fallbackModelName} after ${maxAttempts} retries on ${opts.modelName}`,
    );
    try {
      const result = await opts.fallbackModel.generateContent(prompt);
      return {
        result,
        fallbackUsed: true,
        modelUsed: opts.fallbackModelName,
        attempts: attemptsConsumed,
      };
    } catch (fallbackError) {
      throw new Error(
        `[master-analyzer] Failed after ${maxAttempts} primary + 1 fallback attempt. Primary=${opts.modelName} Fallback=${opts.fallbackModelName}. Last primary error: ${lastError instanceof Error ? lastError.message.slice(0, 200) : String(lastError)}. Fallback error: ${fallbackError instanceof Error ? fallbackError.message.slice(0, 200) : String(fallbackError)}`,
      );
    }
  }

  throw new Error(
    `[master-analyzer] Failed after ${maxAttempts} attempts on ${opts.modelName} (no fallback configured). Last error: ${lastError instanceof Error ? lastError.message.slice(0, 200) : String(lastError)}`,
  );
}

// ---------------------------------------------------------------------------
// Persistence helpers (Plan 03 wires these into research-executor.ts)
// ---------------------------------------------------------------------------

type ProspectFailureDb = {
  prospect: {
    update: (args: {
      where: { id: string };
      data: {
        lastAnalysisError: string | null;
        lastAnalysisAttemptedAt: Date | null;
        lastAnalysisModelUsed?: string | null;
      };
    }) => Promise<unknown>;
  };
};

/**
 * Persist master-analyzer HARD FAILURE state on the Prospect row. Called
 * when retry + fallback both exhausted.
 */
export async function recordAnalysisFailure(
  db: ProspectFailureDb,
  prospectId: string,
  errorMessage: string,
): Promise<void> {
  await db.prospect.update({
    where: { id: prospectId },
    data: {
      lastAnalysisError: errorMessage.slice(0, 500),
      lastAnalysisAttemptedAt: new Date(),
      // NOTE: lastAnalysisModelUsed intentionally untouched on failure —
      // we want the previous successful model to remain as a history breadcrumb.
    },
  });
}

/**
 * Persist master-analyzer SUCCESS state on the Prospect row. Called on
 * BOTH clean primary success AND fallback success. The `modelUsed`
 * argument is the discriminator — when it's 'gemini-2.5-flash' this is
 * the "fallback used" persisted signal that drives the Plan 04 UI warning
 * (ROADMAP SC #2).
 *
 * - Clears lastAnalysisError
 * - Stamps lastAnalysisAttemptedAt = now
 * - Writes lastAnalysisModelUsed = modelUsed
 */
export async function recordAnalysisSuccess(
  db: ProspectFailureDb,
  prospectId: string,
  modelUsed: 'gemini-2.5-pro' | 'gemini-2.5-flash',
): Promise<void> {
  await db.prospect.update({
    where: { id: prospectId },
    data: {
      lastAnalysisError: null,
      lastAnalysisAttemptedAt: new Date(),
      lastAnalysisModelUsed: modelUsed,
    },
  });
}

const VALID_TRIGGER_CATEGORIES: TriggerCategory[] = [
  'market',
  'compliance_esg',
  'capital_derisking',
];

const VALID_URGENCY = ['high', 'medium', 'low'] as const;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

// ---------------------------------------------------------------------------
// analysis-v2 validation
// ---------------------------------------------------------------------------

function validateNarrativeSection(raw: unknown): NarrativeSection | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.id) ||
    !isNonEmptyString(obj.title) ||
    !isNonEmptyString(obj.body)
  ) {
    return null;
  }
  if (!isStringArray(obj.citations)) return null;
  return {
    id: obj.id,
    title: obj.title,
    body: obj.body,
    citations: obj.citations,
  };
}

function validateSPVRecommendation(raw: unknown): SPVRecommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.spvName) ||
    !isNonEmptyString(obj.spvCode) ||
    !isNonEmptyString(obj.relevanceNarrative)
  ) {
    return null;
  }
  if (!isStringArray(obj.strategicTags)) return null;
  return {
    spvName: obj.spvName,
    spvCode: obj.spvCode,
    relevanceNarrative: obj.relevanceNarrative,
    strategicTags: obj.strategicTags,
  };
}

/**
 * Validate a raw parsed object against the NarrativeAnalysis shape (analysis-v2).
 * Returns null on any structural or content violation.
 */
export function validateNarrativeAnalysis(
  raw: unknown,
): NarrativeAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (obj.version !== 'analysis-v2') return null;
  if (!isNonEmptyString(obj.openingHook)) return null;
  if (!isNonEmptyString(obj.executiveSummary)) return null;

  // sections: array of 2-7 items
  if (!Array.isArray(obj.sections)) return null;
  if (obj.sections.length < 2 || obj.sections.length > 7) return null;
  const sections: NarrativeSection[] = [];
  for (const sectionRaw of obj.sections) {
    const section = validateNarrativeSection(sectionRaw);
    if (!section) return null;
    sections.push(section);
  }

  // spvRecommendations: array of 1-4 items
  if (!Array.isArray(obj.spvRecommendations)) return null;
  if (obj.spvRecommendations.length < 1 || obj.spvRecommendations.length > 4) {
    return null;
  }
  const spvRecommendations: SPVRecommendation[] = [];
  for (const recRaw of obj.spvRecommendations) {
    const rec = validateSPVRecommendation(recRaw);
    if (!rec) return null;
    spvRecommendations.push(rec);
  }

  return {
    version: 'analysis-v2',
    openingHook: obj.openingHook,
    executiveSummary: obj.executiveSummary,
    sections,
    spvRecommendations,
    generatedAt: '', // filled by caller
    modelUsed: '', // filled by caller
  };
}

// ---------------------------------------------------------------------------
// analysis-v1 validation (legacy)
// ---------------------------------------------------------------------------

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
 * Validate a raw parsed object against the MasterAnalysis shape (analysis-v1).
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
// JSON extraction (shared)
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
// analysis-v2 generation
// ---------------------------------------------------------------------------

/**
 * Generate a NarrativeAnalysis (analysis-v2) by calling Gemini 2.5 Pro
 * with raw evidence items and RAG passages. Validates the response and
 * retries once on parse/validation failure.
 */
export async function generateNarrativeAnalysis(
  input: NarrativeAnalysisInput,
): Promise<NarrativeAnalysis & { fallbackUsed: boolean }> {
  const genai = getGenAI();
  const prompt = buildMasterPrompt(input);
  const model = GEMINI_MODEL_PRO;

  const startMs = Date.now();
  console.log(
    `[master-analyzer] Generating narrative analysis (v2) for ${input.prospect.companyName} using ${model}...`,
  );

  let lastRawText = '';
  let outerFallbackUsed = false;
  let outerModelUsed: 'gemini-2.5-pro' | 'gemini-2.5-flash' = GEMINI_MODEL_PRO;

  for (let attempt = 0; attempt < 2; attempt++) {
    const geminiModel = genai.getGenerativeModel({ model });

    let response;
    if (attempt === 0) {
      const fallback = genai.getGenerativeModel({ model: GEMINI_MODEL_FLASH });
      const { result, fallbackUsed, modelUsed } = await callGeminiWithRetry(
        geminiModel,
        prompt,
        {
          modelName: model as 'gemini-2.5-pro' | 'gemini-2.5-flash',
          fallbackModel: fallback,
          fallbackModelName: GEMINI_MODEL_FLASH,
        },
      );
      response = result;
      // Stash for the top-level return value. The outer schema-validation retry
      // loop may loop once more, but fallbackUsed only changes on transport errors
      // — not on schema errors — so the last-seen value is authoritative.
      outerFallbackUsed = fallbackUsed;
      outerModelUsed = modelUsed;
    } else {
      const chat = geminiModel.startChat({
        history: [
          { role: 'user', parts: [{ text: prompt }] },
          { role: 'model', parts: [{ text: lastRawText }] },
        ],
      });
      response = await chat.sendMessage(
        'De JSON was ongeldig of voldeed niet aan het schema. Corrigeer het en retourneer ALLEEN valide JSON in exact het gevraagde analysis-v2 formaat. Zorg voor: version "analysis-v2", niet-lege openingHook en executiveSummary, 2-7 sections met id/title/body/citations, en 1-4 spvRecommendations met spvName/spvCode/relevanceNarrative/strategicTags.',
      );
    }

    const text = response.response.text();
    if (!text) {
      lastRawText = '[no text in response]';
      continue;
    }

    lastRawText = text;
    const parsed = extractJSON(lastRawText);
    if (!parsed) {
      console.warn(
        `[master-analyzer] Attempt ${attempt + 1}: failed to extract JSON`,
      );
      continue;
    }

    const validated = validateNarrativeAnalysis(parsed);
    if (!validated) {
      console.warn(
        `[master-analyzer] Attempt ${attempt + 1}: JSON did not match NarrativeAnalysis schema`,
      );
      continue;
    }

    const durationMs = Date.now() - startMs;
    console.log(
      `[master-analyzer] Narrative analysis generated in ${durationMs}ms (attempt ${attempt + 1})`,
    );

    return {
      ...validated,
      generatedAt: new Date().toISOString(),
      modelUsed: outerModelUsed,
      fallbackUsed: outerFallbackUsed,
    };
  }

  const durationMs = Date.now() - startMs;
  throw new Error(
    `[master-analyzer] Failed to generate valid NarrativeAnalysis for ${input.prospect.companyName} after 2 attempts (${durationMs}ms). Last response: ${lastRawText.slice(0, 500)}`,
  );
}

// ---------------------------------------------------------------------------
// Klarifai narrative validation and generation
// ---------------------------------------------------------------------------

function validateUseCaseRecommendation(
  raw: unknown,
): UseCaseRecommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.useCaseTitle) ||
    !isNonEmptyString(obj.category) ||
    !isNonEmptyString(obj.relevanceNarrative)
  ) {
    return null;
  }
  if (!isStringArray(obj.applicableOutcomes)) return null;
  return {
    useCaseTitle: obj.useCaseTitle,
    category: obj.category,
    relevanceNarrative: obj.relevanceNarrative,
    applicableOutcomes: obj.applicableOutcomes,
  };
}

/**
 * Validate a raw parsed object against the KlarifaiNarrativeAnalysis shape (analysis-v2).
 * Returns null on any structural or content violation.
 */
export function validateKlarifaiNarrativeAnalysis(
  raw: unknown,
): KlarifaiNarrativeAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (obj.version !== 'analysis-v2') return null;
  if (!isNonEmptyString(obj.openingHook)) return null;
  if (!isNonEmptyString(obj.executiveSummary)) return null;

  // sections: array of 2-7 items
  if (!Array.isArray(obj.sections)) return null;
  if (obj.sections.length < 2 || obj.sections.length > 7) return null;
  const sections: NarrativeSection[] = [];
  for (const sectionRaw of obj.sections) {
    const section = validateNarrativeSection(sectionRaw);
    if (!section) return null;
    sections.push(section);
  }

  // useCaseRecommendations: array of 1-6 items
  if (!Array.isArray(obj.useCaseRecommendations)) return null;
  if (
    obj.useCaseRecommendations.length < 1 ||
    obj.useCaseRecommendations.length > 6
  ) {
    return null;
  }
  const useCaseRecommendations: UseCaseRecommendation[] = [];
  for (const recRaw of obj.useCaseRecommendations) {
    const rec = validateUseCaseRecommendation(recRaw);
    if (!rec) return null;
    useCaseRecommendations.push(rec);
  }

  return {
    version: 'analysis-v2',
    openingHook: obj.openingHook,
    executiveSummary: obj.executiveSummary,
    sections,
    useCaseRecommendations,
    generatedAt: '', // filled by caller
    modelUsed: '', // filled by caller
  };
}

/**
 * Generate a KlarifaiNarrativeAnalysis (analysis-v2) by calling Gemini 2.5 Pro
 * with raw evidence items and Use Cases as domain knowledge. Validates the response
 * and retries once on parse/validation failure.
 */
export async function generateKlarifaiNarrativeAnalysis(
  input: KlarifaiNarrativeInput,
): Promise<KlarifaiNarrativeAnalysis & { fallbackUsed: boolean }> {
  const genai = getGenAI();
  const prompt = buildMasterPrompt(input);
  const model = GEMINI_MODEL_PRO;

  const startMs = Date.now();
  console.log(
    `[master-analyzer] Generating Klarifai narrative analysis for ${input.prospect.companyName} using ${model}...`,
  );

  let lastRawText = '';
  let outerFallbackUsed = false;
  let outerModelUsed: 'gemini-2.5-pro' | 'gemini-2.5-flash' = GEMINI_MODEL_PRO;

  for (let attempt = 0; attempt < 2; attempt++) {
    const geminiModel = genai.getGenerativeModel({ model });

    let response;
    if (attempt === 0) {
      const fallback = genai.getGenerativeModel({ model: GEMINI_MODEL_FLASH });
      const { result, fallbackUsed, modelUsed } = await callGeminiWithRetry(
        geminiModel,
        prompt,
        {
          modelName: model as 'gemini-2.5-pro' | 'gemini-2.5-flash',
          fallbackModel: fallback,
          fallbackModelName: GEMINI_MODEL_FLASH,
        },
      );
      response = result;
      // Stash for the top-level return value. The outer schema-validation retry
      // loop may loop once more, but fallbackUsed only changes on transport errors
      // — not on schema errors — so the last-seen value is authoritative.
      outerFallbackUsed = fallbackUsed;
      outerModelUsed = modelUsed;
    } else {
      const chat = geminiModel.startChat({
        history: [
          { role: 'user', parts: [{ text: prompt }] },
          { role: 'model', parts: [{ text: lastRawText }] },
        ],
      });
      response = await chat.sendMessage(
        'De JSON was ongeldig of voldeed niet aan het schema. Corrigeer het en retourneer ALLEEN valide JSON in exact het gevraagde analysis-v2 formaat. Zorg voor: version "analysis-v2", niet-lege openingHook en executiveSummary, 2-7 sections met id/title/body/citations, en 1-6 useCaseRecommendations met useCaseTitle/category/relevanceNarrative/applicableOutcomes.',
      );
    }

    const text = response.response.text();
    if (!text) {
      lastRawText = '[no text in response]';
      continue;
    }

    lastRawText = text;
    const parsed = extractJSON(lastRawText);
    if (!parsed) {
      console.warn(
        `[master-analyzer] Attempt ${attempt + 1}: failed to extract JSON`,
      );
      continue;
    }

    const validated = validateKlarifaiNarrativeAnalysis(parsed);
    if (!validated) {
      console.warn(
        `[master-analyzer] Attempt ${attempt + 1}: JSON did not match KlarifaiNarrativeAnalysis schema`,
      );
      continue;
    }

    const durationMs = Date.now() - startMs;
    console.log(
      `[master-analyzer] Klarifai narrative analysis generated in ${durationMs}ms (attempt ${attempt + 1})`,
    );

    return {
      ...validated,
      generatedAt: new Date().toISOString(),
      modelUsed: outerModelUsed,
      fallbackUsed: outerFallbackUsed,
    };
  }

  const durationMs = Date.now() - startMs;
  throw new Error(
    `[master-analyzer] Failed to generate valid KlarifaiNarrativeAnalysis for ${input.prospect.companyName} after 2 attempts (${durationMs}ms). Last response: ${lastRawText.slice(0, 500)}`,
  );
}

// generateMasterAnalysis (analysis-v1) deleted in 56-02 — use generateNarrativeAnalysis (analysis-v2)
