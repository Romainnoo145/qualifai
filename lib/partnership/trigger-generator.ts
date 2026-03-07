import type { EvidenceSourceType } from '@prisma/client';

export type PartnershipTriggerType =
  | 'strategic_alignment'
  | 'execution_gap'
  | 'commercial_pressure'
  | 'timing_window';

export interface PartnershipEvidenceInput {
  id: string;
  sourceType: EvidenceSourceType;
  workflowTag: string;
  confidenceScore: number;
  snippet: string;
  title: string | null;
  metadata?: unknown;
}

export interface PartnershipTriggerDraft {
  triggerType: PartnershipTriggerType;
  title: string;
  rationale: string;
  whyNow: string;
  confidenceScore: number;
  readinessImpact: number;
  urgency: 'low' | 'medium' | 'high';
  evidenceRefs: string[];
  sourceTypes: string[];
}

export interface PartnershipAssessment {
  strategyVersion: 'partnership-v1';
  readinessScore: number;
  triggerCount: number;
  triggers: PartnershipTriggerDraft[];
  gaps: string[];
  signalCounts: {
    external: number;
    diagnostic: number;
    rag: number;
    sourceDiversity: number;
  };
}

const DIAGNOSTIC_SOURCE_TYPES = new Set<EvidenceSourceType>([
  'REVIEWS',
  'CAREERS',
  'JOB_BOARD',
  'LINKEDIN',
  'NEWS',
]);

const EXECUTION_TAGS = new Set([
  'handoff',
  'field-reporting',
  'project-management',
  'lead-intake',
  'scheduling',
  'reporting',
  'site-coordination',
]);

const COMMERCIAL_TAGS = new Set([
  'billing',
  'lead-intake',
  'workflow-context',
  'reporting',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isPlaceholder(item: PartnershipEvidenceInput): boolean {
  const metadata = asRecord(item.metadata);
  if (!metadata) return false;
  return metadata.notFound === true || metadata.fallback === true;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sortByConfidence(
  items: PartnershipEvidenceInput[],
): PartnershipEvidenceInput[] {
  return items.slice().sort((a, b) => b.confidenceScore - a.confidenceScore);
}

function uniqueSourceTypes(items: PartnershipEvidenceInput[]): string[] {
  return Array.from(new Set(items.map((item) => item.sourceType)));
}

function pickEvidence(
  externalCandidates: PartnershipEvidenceInput[],
  ragCandidates: PartnershipEvidenceInput[],
  options: {
    maxExternal: number;
    maxRag: number;
    requireRag: boolean;
  },
): PartnershipEvidenceInput[] {
  const external = sortByConfidence(externalCandidates).slice(
    0,
    options.maxExternal,
  );
  const rag = sortByConfidence(ragCandidates).slice(0, options.maxRag);
  if (options.requireRag && rag.length === 0) return [];
  if (external.length === 0) return [];
  return [...external, ...rag];
}

function urgencyFromConfidence(
  confidenceScore: number,
  sourceTypes: string[],
): 'low' | 'medium' | 'high' {
  if (confidenceScore >= 0.8) return 'high';
  if (
    sourceTypes.some(
      (sourceType) => sourceType === 'NEWS' || sourceType === 'REVIEWS',
    )
  ) {
    return confidenceScore >= 0.68 ? 'high' : 'medium';
  }
  if (confidenceScore >= 0.67) return 'medium';
  return 'low';
}

function buildTrigger(input: {
  type: PartnershipTriggerType;
  title: string;
  rationale: string;
  whyNow: string;
  impact: number;
  external: PartnershipEvidenceInput[];
  rag: PartnershipEvidenceInput[];
  requireRag: boolean;
}): PartnershipTriggerDraft | null {
  const selected = pickEvidence(input.external, input.rag, {
    maxExternal: 2,
    maxRag: 2,
    requireRag: input.requireRag,
  });
  if (selected.length < 2) return null;

  const confidenceScore = round2(
    average(selected.map((item) => item.confidenceScore)),
  );
  const sourceTypes = uniqueSourceTypes(selected);

  return {
    triggerType: input.type,
    title: input.title,
    rationale: input.rationale,
    whyNow: input.whyNow,
    confidenceScore,
    readinessImpact: input.impact,
    urgency: urgencyFromConfidence(confidenceScore, sourceTypes),
    evidenceRefs: selected.map((item) => item.id),
    sourceTypes,
  };
}

function dedupeTriggers(
  triggers: PartnershipTriggerDraft[],
): PartnershipTriggerDraft[] {
  const seen = new Set<string>();
  const unique: PartnershipTriggerDraft[] = [];
  for (const trigger of triggers) {
    const key = `${trigger.triggerType}:${trigger.evidenceRefs.slice(0, 2).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trigger);
  }
  return unique;
}

export function generatePartnershipAssessment(
  evidence: PartnershipEvidenceInput[],
): PartnershipAssessment {
  const observed = evidence.filter((item) => !isPlaceholder(item));
  const rag = observed.filter((item) => item.sourceType === 'RAG_DOCUMENT');
  const external = observed.filter(
    (item) => item.sourceType !== 'RAG_DOCUMENT',
  );
  const diagnostic = external.filter((item) =>
    DIAGNOSTIC_SOURCE_TYPES.has(item.sourceType),
  );
  const diversity = uniqueSourceTypes(observed).length;

  const executionExternal = external.filter((item) =>
    EXECUTION_TAGS.has(item.workflowTag),
  );
  const executionRag = rag.filter((item) =>
    EXECUTION_TAGS.has(item.workflowTag),
  );

  const commercialExternal = external.filter(
    (item) =>
      COMMERCIAL_TAGS.has(item.workflowTag) ||
      item.sourceType === 'REVIEWS' ||
      item.sourceType === 'NEWS',
  );
  const commercialRag = rag.filter((item) =>
    COMMERCIAL_TAGS.has(item.workflowTag),
  );

  const timingExternal = external.filter((item) =>
    DIAGNOSTIC_SOURCE_TYPES.has(item.sourceType),
  );
  const timingRag = rag.filter(
    (item) =>
      item.workflowTag === 'workflow-context' ||
      item.workflowTag === 'planning' ||
      item.workflowTag === 'lead-intake',
  );

  const alignmentExternal = external.filter(
    (item) =>
      item.workflowTag === 'workflow-context' ||
      item.workflowTag === 'planning',
  );
  const alignmentRag = rag;

  const candidateTriggers = [
    buildTrigger({
      type: 'strategic_alignment',
      title: 'Strategic fit is evidence-backed',
      rationale:
        'External operational signals align with Atlantis partnership documentation, indicating a credible strategic partnership narrative.',
      whyNow:
        'Both market-facing pressure and internal Atlantis citations are available in the same research run.',
      impact: 22,
      external: alignmentExternal.length > 0 ? alignmentExternal : external,
      rag: alignmentRag,
      requireRag: true,
    }),
    buildTrigger({
      type: 'execution_gap',
      title: 'Execution-readiness gap is observable',
      rationale:
        'Operational handoff/coordination evidence points to execution friction that Atlantis capability can bridge via SPV-specific delivery structures.',
      whyNow:
        'Execution-related pain tags are present and can be tied directly to implementation passages.',
      impact: 24,
      external: executionExternal.length > 0 ? executionExternal : diagnostic,
      rag: executionRag.length > 0 ? executionRag : rag,
      requireRag: true,
    }),
    buildTrigger({
      type: 'commercial_pressure',
      title: 'Commercial pressure can justify partnership scope',
      rationale:
        'Revenue leakage and service-quality signals create a business case for structured Atlantis collaboration rather than tactical fixes.',
      whyNow:
        'Commercially relevant evidence is present and can be translated into phased partnership outcomes.',
      impact: 20,
      external: commercialExternal.length > 0 ? commercialExternal : external,
      rag: commercialRag.length > 0 ? commercialRag : rag,
      requireRag: rag.length > 0,
    }),
    buildTrigger({
      type: 'timing_window',
      title: 'Timing window is active',
      rationale:
        'Live external signals suggest momentum (hiring, news, market activity) that supports initiating partnership conversations now.',
      whyNow:
        'Recent external signal density is high enough to support a proactive outreach angle.',
      impact: 16,
      external: timingExternal,
      rag: timingRag,
      requireRag: false,
    }),
  ].filter((item): item is PartnershipTriggerDraft => item !== null);

  let triggers = dedupeTriggers(candidateTriggers).sort((a, b) => {
    const urgencyRank = { high: 3, medium: 2, low: 1 };
    const urgencyDelta = urgencyRank[b.urgency] - urgencyRank[a.urgency];
    if (urgencyDelta !== 0) return urgencyDelta;
    const impactDelta = b.readinessImpact - a.readinessImpact;
    if (impactDelta !== 0) return impactDelta;
    return b.confidenceScore - a.confidenceScore;
  });

  if (triggers.length === 0 && external.length > 0) {
    const fallbackEvidence = sortByConfidence(external).slice(0, 2);
    const confidenceScore = round2(
      average(fallbackEvidence.map((item) => item.confidenceScore)),
    );
    triggers = [
      {
        triggerType: 'timing_window',
        title: 'Initial partnership signal detected',
        rationale:
          'External evidence shows potential partnership relevance, but stronger Atlantis citation linkage is still needed for a full strategic bridge.',
        whyNow:
          'A first signal exists and can be used to validate scope in an exploratory conversation.',
        confidenceScore,
        readinessImpact: 10,
        urgency: 'medium',
        evidenceRefs: fallbackEvidence.map((item) => item.id),
        sourceTypes: uniqueSourceTypes(fallbackEvidence),
      },
    ];
  }

  const avgObservedConfidence = average(
    observed.map((item) => item.confidenceScore),
  );
  const readinessScore = Math.round(
    clamp(
      avgObservedConfidence * 50 +
        Math.min(diversity, 7) * 5 +
        Math.min(rag.length, 6) * 4 +
        triggers.reduce((sum, trigger) => sum + trigger.readinessImpact, 0) *
          0.25,
      0,
      100,
    ),
  );

  const gaps: string[] = [];
  if (diagnostic.length < 2) {
    gaps.push(
      'Limited diagnostic external signals (reviews/jobs/news/linkedin).',
    );
  }
  if (rag.length === 0) {
    gaps.push('No Atlantis RAG citations linked in this run.');
  }
  if (diversity < 3) {
    gaps.push('Low evidence source diversity for partnership confidence.');
  }

  return {
    strategyVersion: 'partnership-v1',
    readinessScore,
    triggerCount: triggers.length,
    triggers,
    gaps,
    signalCounts: {
      external: external.length,
      diagnostic: diagnostic.length,
      rag: rag.length,
      sourceDiversity: diversity,
    },
  };
}
