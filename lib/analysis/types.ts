/**
 * AI Master Analysis type contract — stable interface for Phase 44 (Discover Rendering).
 *
 * Defines the structured output of the AI master analysis engine that combines
 * intent variables and RAG passages into three-section discover page content:
 * Context (hook + KPIs) → Triggers (market / compliance-ESG / capital de-risking) → Partnership (SPV tracks).
 */

import type { IntentVariables } from '@/lib/extraction/types';
import type { RagRetrievedPassage } from '@/lib/rag/retriever';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** A prospect-relevant scale metric displayed as a KPI block */
export type AnalysisKPI = {
  label: string;
  value: string;
  context: string;
};

/** Context section: prospect-specific hook, KPI blocks, and executive hook */
export type AnalysisContext = {
  hook: string;
  kpis: AnalysisKPI[];
  executiveHook: string;
};

/** Trigger category aligned with intent extraction categories */
export type TriggerCategory = 'market' | 'compliance_esg' | 'capital_derisking';

/** A trigger card with narrative, supporting numbers, and urgency */
export type AnalysisTrigger = {
  category: TriggerCategory;
  title: string;
  narrative: string;
  numbers: string[];
  urgency: 'high' | 'medium' | 'low';
};

/** A partnership SPV track with scope and relevance for this prospect */
export type AnalysisTrack = {
  spvName: string;
  spvCode: string;
  scope: string;
  relevance: string;
  strategicTags: string[];
};

/** The complete master analysis output persisted to ProspectAnalysis.content */
export type MasterAnalysis = {
  version: 'analysis-v1';
  context: AnalysisContext;
  triggers: AnalysisTrigger[];
  tracks: AnalysisTrack[];
  generatedAt: string;
  modelUsed: string;
};

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Prospect profile data needed for analysis generation */
export type AnalysisProspectProfile = {
  companyName: string;
  industry: string | null;
  description: string | null;
  specialties: string[];
  country: string | null;
  city: string | null;
  employeeRange: string | null;
  revenueRange: string | null;
};

/** SPV data for partnership track selection */
export type AnalysisSPV = {
  name: string;
  code: string;
  slug: string;
  metricsTemplate: unknown;
};

/** Complete input for the master analysis engine */
export type MasterAnalysisInput = {
  intentVars: IntentVariables;
  passages: RagRetrievedPassage[];
  prospect: AnalysisProspectProfile;
  spvs: AnalysisSPV[];
};
