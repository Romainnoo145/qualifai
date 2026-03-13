/**
 * AI Master Analysis type contract — v2 (analysis-v2) adds narrative output types.
 *
 * analysis-v1: rigid trigger/track JSON (legacy, deprecated — Phase 51 will migrate off)
 * analysis-v2: flowing narrative sections with raw evidence input (active)
 */

import type { RagRetrievedPassage } from '@/lib/rag/retriever';

// ---------------------------------------------------------------------------
// analysis-v2 Output types (new)
// ---------------------------------------------------------------------------

/** A narrative section with title, body, and optional evidence citations */
export type NarrativeSection = {
  id: string; // slug identifier (e.g., "opening-hook", "market-position")
  title: string; // section heading in Dutch
  body: string; // flowing narrative paragraph(s) in boardroom Dutch
  citations: string[]; // source references woven into the narrative
};

/** The complete narrative analysis output — version analysis-v2 */
export type NarrativeAnalysis = {
  version: 'analysis-v2';
  openingHook: string; // 2-3 sentence prospect-specific hook
  executiveSummary: string; // 1-paragraph executive summary
  sections: NarrativeSection[]; // 3-5 narrative sections
  spvRecommendations: SPVRecommendation[]; // 2-3 recommended SPV tracks
  generatedAt: string;
  modelUsed: string;
};

/** SPV recommendation with narrative relevance (replaces AnalysisTrack) */
export type SPVRecommendation = {
  spvName: string;
  spvCode: string;
  relevanceNarrative: string; // why this SPV matters for this prospect
  strategicTags: string[];
};

// ---------------------------------------------------------------------------
// analysis-v2 Input types (new)
// ---------------------------------------------------------------------------

/** A raw evidence item passed directly to the master prompt */
export type EvidenceItem = {
  sourceType: string;
  sourceUrl: string | null;
  title: string | null;
  snippet: string;
  confidenceScore: number;
  workflowTag: string | null;
};

/** A RAG passage with source attribution (from Phase 49) */
export type RagPassageInput = {
  content: string;
  sourceLabel: string; // from Phase 49: "{volume} — {title} (SPV: {name})"
  similarity: number;
  spvName: string | null;
};

/** Cross-prospect connection for PIPE-05 */
export type CrossProspectConnection = {
  companyName: string;
  relationship: string; // how they're connected (e.g., "leverancier", "partner")
  evidenceSnippet: string; // the evidence that shows the connection
};

/** Complete input for the narrative analysis engine */
export type NarrativeAnalysisInput = {
  evidence: EvidenceItem[];
  passages: RagPassageInput[];
  prospect: AnalysisProspectProfile; // keep existing profile type
  spvs: AnalysisSPV[]; // keep existing SPV type
  crossConnections: CrossProspectConnection[]; // PIPE-05
};

// ---------------------------------------------------------------------------
// Shared input types (used by both v1 and v2)
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

// ---------------------------------------------------------------------------
// analysis-v1 Output types (legacy — @deprecated, Phase 51 will migrate off)
// ---------------------------------------------------------------------------

/** @deprecated Use NarrativeAnalysis (analysis-v2) instead */
export type AnalysisKPI = {
  label: string;
  value: string;
  context: string;
};

/** @deprecated Use NarrativeAnalysis (analysis-v2) instead */
export type AnalysisContext = {
  hook: string;
  kpis: AnalysisKPI[];
  executiveHook: string;
};

/** @deprecated Use NarrativeAnalysis (analysis-v2) instead */
export type TriggerCategory = 'market' | 'compliance_esg' | 'capital_derisking';

/** @deprecated Use NarrativeSection (analysis-v2) instead */
export type AnalysisTrigger = {
  category: TriggerCategory;
  title: string;
  narrative: string;
  numbers: string[];
  urgency: 'high' | 'medium' | 'low';
};

/** @deprecated Use SPVRecommendation (analysis-v2) instead */
export type AnalysisTrack = {
  spvName: string;
  spvCode: string;
  scope: string;
  relevance: string;
  strategicTags: string[];
};

/** @deprecated Use NarrativeAnalysis (analysis-v2) instead */
export type MasterAnalysis = {
  version: 'analysis-v1';
  context: AnalysisContext;
  triggers: AnalysisTrigger[];
  tracks: AnalysisTrack[];
  generatedAt: string;
  modelUsed: string;
};

// ---------------------------------------------------------------------------
// analysis-v1 Input types (legacy — @deprecated)
// ---------------------------------------------------------------------------

// IntentVariables is no longer imported here; it was only used by MasterAnalysisInput.
// The legacy MasterAnalysisInput below preserves backward compatibility.

/** @deprecated Use NarrativeAnalysisInput (analysis-v2) instead */
export type MasterAnalysisInput = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intentVars: any; // was: IntentVariables — removed import to keep types.ts self-contained
  passages: RagRetrievedPassage[];
  prospect: AnalysisProspectProfile;
  spvs: AnalysisSPV[];
};
