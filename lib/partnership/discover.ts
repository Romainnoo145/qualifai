export interface PartnershipDiscoverEvidence {
  id: string;
  sourceType: string;
  sourceUrl: string;
  title: string | null;
  snippet: string;
}

export interface PartnershipDiscoverTrigger {
  triggerType: string;
  title: string;
  rationale: string;
  whyNow: string;
  confidenceScore: number;
  readinessImpact: number;
  urgency: 'low' | 'medium' | 'high';
  sourceTypes: string[];
  evidence: PartnershipDiscoverEvidence[];
}

export interface PartnershipDiscoverSignalCounts {
  external: number;
  diagnostic: number;
  rag: number;
  sourceDiversity: number;
}

export interface PartnershipDiscoverSnapshot {
  strategyVersion: string;
  readinessScore: number;
  triggerCount: number;
  gaps: string[];
  signalCounts: PartnershipDiscoverSignalCounts;
  triggers: PartnershipDiscoverTrigger[];
}
