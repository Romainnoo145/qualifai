import { describe, expect, it } from 'vitest';
import { generateDualEvidenceOpportunityDrafts } from '@/lib/rag/opportunity-generator';

describe('generateDualEvidenceOpportunityDrafts', () => {
  it('emits 2-4 cards and each card bridges external + RAG evidence', () => {
    const externalIds = ['ext-1', 'ext-2', 'ext-3'];
    const ragIds = ['rag-1', 'rag-2', 'rag-3'];

    const opportunities = generateDualEvidenceOpportunityDrafts([
      {
        id: externalIds[0]!,
        sourceType: 'REVIEWS',
        workflowTag: 'planning',
        confidenceScore: 0.82,
        snippet: 'Prospect reports permit sequencing delays.',
        title: 'Review signal',
      },
      {
        id: externalIds[1]!,
        sourceType: 'NEWS',
        workflowTag: 'workflow-context',
        confidenceScore: 0.79,
        snippet: 'Expansion timeline is publicly under pressure.',
        title: 'News signal',
      },
      {
        id: externalIds[2]!,
        sourceType: 'LINKEDIN',
        workflowTag: 'handoff',
        confidenceScore: 0.76,
        snippet: 'Hiring indicates execution coordination bottlenecks.',
        title: 'Hiring signal',
      },
      {
        id: ragIds[0]!,
        sourceType: 'RAG_DOCUMENT',
        workflowTag: 'planning',
        confidenceScore: 0.88,
        snippet: 'Atlantis document passage on phased commissioning.',
        title: 'EG-V-2.0',
        metadata: {
          citation: {
            documentId: 'EG-V-2.0',
            sectionHeader: 'Section 4.2',
            sourcePath: 'Volume-V/EG-V-2.0.md',
          },
        },
      },
      {
        id: ragIds[1]!,
        sourceType: 'RAG_DOCUMENT',
        workflowTag: 'handoff',
        confidenceScore: 0.86,
        snippet: 'Atlantis passage on multi-entity handoff governance.',
        title: 'EG-III-3.0',
        metadata: {
          citation: {
            documentId: 'EG-III-3.0',
            sectionHeader: 'Section 7.1',
            sourcePath: 'Volume-III/EG-III-3.0.md',
          },
        },
      },
      {
        id: ragIds[2]!,
        sourceType: 'RAG_DOCUMENT',
        workflowTag: 'workflow-context',
        confidenceScore: 0.84,
        snippet: 'Atlantis passage on investment and ROI profile.',
        title: 'EG-I-1.0',
        metadata: {
          citation: {
            documentId: 'EG-I-1.0',
            sectionHeader: 'Section 2.4',
            sourcePath: 'Volume-I/EG-I-1.0.md',
          },
        },
      },
    ]);

    expect(opportunities.length).toBeGreaterThanOrEqual(2);
    expect(opportunities.length).toBeLessThanOrEqual(4);

    for (const card of opportunities) {
      const refs = new Set(card.evidenceRefs);
      const hasExternal = externalIds.some((id) => refs.has(id));
      const hasRag = ragIds.some((id) => refs.has(id));
      expect(hasExternal).toBe(true);
      expect(hasRag).toBe(true);
    }
  });

  it('returns empty when no RAG evidence exists', () => {
    const opportunities = generateDualEvidenceOpportunityDrafts([
      {
        id: 'ext-1',
        sourceType: 'REVIEWS',
        workflowTag: 'planning',
        confidenceScore: 0.81,
        snippet: 'Only external evidence here.',
        title: 'External only',
      },
    ]);

    expect(opportunities).toHaveLength(0);
  });
});
