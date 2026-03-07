import { describe, expect, it } from 'vitest';
import type { EvidenceSourceType } from '@prisma/client';
import {
  generatePartnershipAssessment,
  type PartnershipEvidenceInput,
} from './trigger-generator';

function ev(input: {
  id: string;
  sourceType: EvidenceSourceType;
  workflowTag: string;
  confidenceScore: number;
  snippet?: string;
  metadata?: unknown;
}): PartnershipEvidenceInput {
  return {
    id: input.id,
    sourceType: input.sourceType,
    workflowTag: input.workflowTag,
    confidenceScore: input.confidenceScore,
    snippet: input.snippet ?? 'signal',
    title: null,
    metadata: input.metadata,
  };
}

describe('generatePartnershipAssessment', () => {
  it('builds multiple triggers with readiness score when external and RAG evidence are present', () => {
    const result = generatePartnershipAssessment([
      ev({
        id: 'e1',
        sourceType: 'REVIEWS',
        workflowTag: 'handoff',
        confidenceScore: 0.84,
      }),
      ev({
        id: 'e2',
        sourceType: 'NEWS',
        workflowTag: 'workflow-context',
        confidenceScore: 0.78,
      }),
      ev({
        id: 'e3',
        sourceType: 'LINKEDIN',
        workflowTag: 'planning',
        confidenceScore: 0.72,
      }),
      ev({
        id: 'r1',
        sourceType: 'RAG_DOCUMENT',
        workflowTag: 'handoff',
        confidenceScore: 0.86,
      }),
      ev({
        id: 'r2',
        sourceType: 'RAG_DOCUMENT',
        workflowTag: 'workflow-context',
        confidenceScore: 0.81,
      }),
    ]);

    expect(result.strategyVersion).toBe('partnership-v1');
    expect(result.triggerCount).toBeGreaterThanOrEqual(2);
    expect(result.readinessScore).toBeGreaterThan(0);
    expect(result.signalCounts.rag).toBeGreaterThan(0);
    expect(
      result.triggers.some((trigger) =>
        trigger.sourceTypes.includes('RAG_DOCUMENT'),
      ),
    ).toBe(true);
  });

  it('excludes placeholder evidence', () => {
    const result = generatePartnershipAssessment([
      ev({
        id: 'p1',
        sourceType: 'NEWS',
        workflowTag: 'workflow-context',
        confidenceScore: 0.9,
        metadata: { notFound: true },
      }),
      ev({
        id: 'p2',
        sourceType: 'REVIEWS',
        workflowTag: 'billing',
        confidenceScore: 0.9,
        metadata: { fallback: true },
      }),
      ev({
        id: 'e1',
        sourceType: 'LINKEDIN',
        workflowTag: 'planning',
        confidenceScore: 0.66,
      }),
      ev({
        id: 'e2',
        sourceType: 'WEBSITE',
        workflowTag: 'workflow-context',
        confidenceScore: 0.61,
      }),
    ]);

    expect(result.signalCounts.external).toBe(2);
    expect(result.triggerCount).toBe(1);
    expect(result.triggers[0]?.evidenceRefs).not.toContain('p1');
    expect(result.triggers[0]?.evidenceRefs).not.toContain('p2');
  });

  it('reports RAG gap when no RAG evidence exists', () => {
    const result = generatePartnershipAssessment([
      ev({
        id: 'e1',
        sourceType: 'NEWS',
        workflowTag: 'workflow-context',
        confidenceScore: 0.72,
      }),
      ev({
        id: 'e2',
        sourceType: 'REVIEWS',
        workflowTag: 'handoff',
        confidenceScore: 0.75,
      }),
      ev({
        id: 'e3',
        sourceType: 'LINKEDIN',
        workflowTag: 'lead-intake',
        confidenceScore: 0.68,
      }),
    ]);

    expect(result.signalCounts.rag).toBe(0);
    expect(
      result.gaps.some((gap) => gap.includes('No Atlantis RAG citations')),
    ).toBe(true);
  });
});
