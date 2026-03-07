import type { EvidenceSourceType } from '@prisma/client';

type OpportunityEvidenceInput = {
  id: string;
  sourceType: EvidenceSourceType;
  workflowTag: string;
  confidenceScore: number;
  snippet: string;
  title: string | null;
  metadata?: unknown;
};

export type DualEvidenceOpportunityDraft = {
  title: string;
  description: string;
  assumptions: string[];
  confidenceScore: number;
  evidenceRefs: string[];
  hoursSavedWeekLow: number;
  hoursSavedWeekMid: number;
  hoursSavedWeekHigh: number;
  handoffSpeedGainPct: number;
  errorReductionPct: number;
  revenueLeakageRecoveredLow: number;
  revenueLeakageRecoveredMid: number;
  revenueLeakageRecoveredHigh: number;
};

type Citation = {
  documentId: string | null;
  sectionHeader: string | null;
  sourcePath: string | null;
};

type OpportunityTemplate = {
  key: string;
  title: string;
  description: string;
  tags: string[];
  metrics: {
    hoursSavedWeekLow: number;
    hoursSavedWeekMid: number;
    hoursSavedWeekHigh: number;
    handoffSpeedGainPct: number;
    errorReductionPct: number;
    revenueLeakageRecoveredLow: number;
    revenueLeakageRecoveredMid: number;
    revenueLeakageRecoveredHigh: number;
  };
};

const TEMPLATES: OpportunityTemplate[] = [
  {
    key: 'capacity',
    title: 'Capacity and execution readiness bridge',
    description:
      'External pressure signals are mapped to Atlantis delivery capacity and staged execution evidence, reducing time-to-alignment for strategic expansion decisions.',
    tags: ['workflow-context', 'planning', 'external-signal'],
    metrics: {
      hoursSavedWeekLow: 5,
      hoursSavedWeekMid: 9,
      hoursSavedWeekHigh: 16,
      handoffSpeedGainPct: 34,
      errorReductionPct: 21,
      revenueLeakageRecoveredLow: 650,
      revenueLeakageRecoveredMid: 1450,
      revenueLeakageRecoveredHigh: 3200,
    },
  },
  {
    key: 'handoff',
    title: 'Cross-entity handoff risk reduction bridge',
    description:
      'Operational handoff friction found in external evidence is paired with SPV-specific implementation passages to reduce coordination drag across entities.',
    tags: ['handoff', 'field-reporting', 'lead-intake'],
    metrics: {
      hoursSavedWeekLow: 4,
      hoursSavedWeekMid: 8,
      hoursSavedWeekHigh: 14,
      handoffSpeedGainPct: 31,
      errorReductionPct: 19,
      revenueLeakageRecoveredLow: 520,
      revenueLeakageRecoveredMid: 1220,
      revenueLeakageRecoveredHigh: 2850,
    },
  },
  {
    key: 'commercial',
    title: 'Commercial de-risking and ROI bridge',
    description:
      'Commercial and compliance signals from external sources are linked to cited Atlantis financing and performance passages to tighten investment confidence.',
    tags: ['billing', 'lead-intake', 'workflow-context'],
    metrics: {
      hoursSavedWeekLow: 6,
      hoursSavedWeekMid: 10,
      hoursSavedWeekHigh: 17,
      handoffSpeedGainPct: 37,
      errorReductionPct: 23,
      revenueLeakageRecoveredLow: 900,
      revenueLeakageRecoveredMid: 1900,
      revenueLeakageRecoveredHigh: 4100,
    },
  },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseCitation(metadata: unknown): Citation {
  const payload = asRecord(metadata);
  const citation = asRecord(payload?.citation);
  const documentId =
    typeof citation?.documentId === 'string'
      ? citation.documentId
      : typeof payload?.documentId === 'string'
        ? payload.documentId
        : null;
  const sectionHeader =
    typeof citation?.sectionHeader === 'string'
      ? citation.sectionHeader
      : typeof payload?.sectionHeader === 'string'
        ? payload.sectionHeader
        : null;
  const sourcePath =
    typeof citation?.sourcePath === 'string'
      ? citation.sourcePath
      : typeof payload?.sourcePath === 'string'
        ? payload.sourcePath
        : null;

  return {
    documentId,
    sectionHeader,
    sourcePath,
  };
}

function citationLabel(citation: Citation): string {
  const left =
    citation.documentId ?? citation.sourcePath ?? 'Atlantis document';
  if (citation.sectionHeader) return `${left} — ${citation.sectionHeader}`;
  return left;
}

function selectByTag(
  input: OpportunityEvidenceInput[],
  tags: string[],
): OpportunityEvidenceInput[] {
  const tagSet = new Set(tags);
  return input.filter((item) => tagSet.has(item.workflowTag));
}

function uniqueStringArray(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildFallbackCards(
  externalEvidence: OpportunityEvidenceInput[],
  ragEvidence: OpportunityEvidenceInput[],
  existing: DualEvidenceOpportunityDraft[],
): DualEvidenceOpportunityDraft[] {
  const output = [...existing];
  const sortedExternal = externalEvidence
    .slice()
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
  const sortedRag = ragEvidence
    .slice()
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  let index = 0;
  while (
    output.length < 2 &&
    sortedExternal.length > 0 &&
    sortedRag.length > 0 &&
    index < 4
  ) {
    const external = sortedExternal[index % sortedExternal.length]!;
    const rag = sortedRag[index % sortedRag.length]!;
    const ragCitation = citationLabel(parseCitation(rag.metadata));
    const confidence = round2(
      Math.max(
        0.66,
        Math.min(0.92, (external.confidenceScore + rag.confidenceScore) / 2),
      ),
    );
    output.push({
      title:
        index % 2 === 0
          ? 'Strategic partnership fit bridge'
          : 'Execution alignment bridge',
      description:
        index % 2 === 0
          ? 'External need signals are directly linked to Atlantis partnership documentation for decision-ready alignment.'
          : 'External operational constraints are paired with cited Atlantis implementation passages to accelerate execution confidence.',
      assumptions: [
        'External evidence confirms real operational/commercial pressure.',
        `Primary Atlantis citation: ${ragCitation}.`,
      ],
      confidenceScore: confidence,
      evidenceRefs: uniqueStringArray([external.id, rag.id]),
      hoursSavedWeekLow: 4,
      hoursSavedWeekMid: 8,
      hoursSavedWeekHigh: 14,
      handoffSpeedGainPct: 30,
      errorReductionPct: 18,
      revenueLeakageRecoveredLow: 500,
      revenueLeakageRecoveredMid: 1200,
      revenueLeakageRecoveredHigh: 2800,
    });
    index += 1;
  }

  return output;
}

export function generateDualEvidenceOpportunityDrafts(
  evidence: OpportunityEvidenceInput[],
  options?: {
    maxCards?: number;
  },
): DualEvidenceOpportunityDraft[] {
  const maxCards = options?.maxCards ?? 4;
  const nonPlaceholderEvidence = evidence.filter((item) => {
    const meta = asRecord(item.metadata);
    return meta?.notFound !== true;
  });

  const ragEvidence = nonPlaceholderEvidence.filter(
    (item) => item.sourceType === 'RAG_DOCUMENT',
  );
  const externalEvidence = nonPlaceholderEvidence.filter(
    (item) => item.sourceType !== 'RAG_DOCUMENT',
  );

  if (ragEvidence.length === 0 || externalEvidence.length === 0) return [];

  const opportunities: DualEvidenceOpportunityDraft[] = [];

  for (const template of TEMPLATES) {
    const taggedExternal = selectByTag(externalEvidence, template.tags);
    const externalCandidates =
      taggedExternal.length > 0 ? taggedExternal : externalEvidence;
    const taggedRag = selectByTag(ragEvidence, template.tags);
    const ragCandidates = taggedRag.length > 0 ? taggedRag : ragEvidence;

    if (externalCandidates.length === 0 || ragCandidates.length === 0) continue;

    const selectedExternal = externalCandidates
      .slice()
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 2);
    const selectedRag = ragCandidates
      .slice()
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 2);

    const evidenceRefs = uniqueStringArray([
      ...selectedExternal.map((item) => item.id),
      ...selectedRag.map((item) => item.id),
    ]);
    if (evidenceRefs.length < 2) continue;

    const citations = uniqueStringArray(
      selectedRag.map((item) => citationLabel(parseCitation(item.metadata))),
    ).slice(0, 2);

    const confidenceInputs = [
      ...selectedExternal.map((item) => item.confidenceScore),
      ...selectedRag.map((item) => item.confidenceScore),
    ];
    const avgConfidence =
      confidenceInputs.reduce((sum, value) => sum + value, 0) /
      confidenceInputs.length;
    const confidenceScore = round2(
      Math.max(0.67, Math.min(0.93, avgConfidence)),
    );

    opportunities.push({
      title: template.title,
      description: template.description,
      assumptions: [
        'Card combines external prospect evidence with Atlantis document evidence.',
        ...(citations.length > 0
          ? [`Primary citation: ${citations[0]}.`]
          : ['Primary citation: Atlantis source document passage.']),
        ...(citations[1] ? [`Supporting citation: ${citations[1]}.`] : []),
      ],
      confidenceScore,
      evidenceRefs,
      ...template.metrics,
    });

    if (opportunities.length >= maxCards) break;
  }

  const withFallback = buildFallbackCards(
    externalEvidence,
    ragEvidence,
    opportunities,
  );

  return withFallback.slice(0, maxCards);
}
