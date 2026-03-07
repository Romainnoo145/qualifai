/**
 * Intent extraction type contract — stable interface for Phase 43 (AI Master Analysis).
 *
 * Each evidence item from the research pipeline is classified into one or more
 * intent categories. The resulting IntentVariables structure provides a structured
 * intermediate representation between raw evidence and AI-generated content.
 */

/** A single extracted signal with source attribution */
export type IntentSignal = {
  signal: string;
  confidence: number;
  sourceUrl: string;
  snippet: string;
  sourceType: string;
};

/** The 5 core intent categories */
export type IntentCategory =
  | 'sector_fit'
  | 'operational_pains'
  | 'esg_csrd'
  | 'investment_growth'
  | 'workforce';

/** All valid core category values */
export const INTENT_CATEGORIES: IntentCategory[] = [
  'sector_fit',
  'operational_pains',
  'esg_csrd',
  'investment_growth',
  'workforce',
];

/** An extra (non-core) category discovered by the AI */
export type ExtraCategory = {
  category: string;
  signals: IntentSignal[];
};

/** The full intent variables structure produced by extraction */
export type IntentVariables = {
  categories: Record<IntentCategory, IntentSignal[]>;
  extras: ExtraCategory[];
  populatedCount: number;
  sparse: boolean;
};
