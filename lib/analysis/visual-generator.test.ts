import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks so they're available before vi.mock factory runs
const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock('@google/generative-ai', () => {
  function GoogleGenerativeAI(_key: string) {
    return {
      getGenerativeModel: (_opts: unknown) => ({
        generateContent: mockGenerateContent,
      }),
    };
  }
  return { GoogleGenerativeAI };
});

import { generateSectionVisuals } from './visual-generator';
import type { NarrativeSection, EvidenceItem } from './types';

function makeSection(id: string, title = 'Test Section'): NarrativeSection {
  return {
    id,
    title,
    body: 'Some narrative body text.',
    citations: ['ref1', 'ref2'],
    punchline: 'Short punchline.',
  };
}

function makeEvidence(sourceType = 'WEBSITE'): EvidenceItem {
  return {
    sourceType,
    sourceUrl: 'https://example.com',
    title: 'Evidence title',
    snippet: 'Evidence snippet text.',
    confidenceScore: 0.75,
    workflowTag: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_AI_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.GOOGLE_AI_API_KEY;
});

describe('generateSectionVisuals', () => {
  it('returns array of 3 SectionVisualResult with matching sectionIds on happy path', async () => {
    const sections = [
      makeSection('opening-hook'),
      makeSection('market-position'),
      makeSection('pain-points'),
    ];
    const evidence = Array.from({ length: 5 }, (_, i) =>
      makeEvidence(i % 2 === 0 ? 'WEBSITE' : 'REVIEWS'),
    );

    const flashResponse = [
      {
        sectionId: 'opening-hook',
        visualType: 'stats',
        visualData: {
          type: 'stats',
          items: [{ label: 'Revenue', value: '€5M', context: 'jaarlijks' }],
        },
      },
      {
        sectionId: 'market-position',
        visualType: 'quote',
        visualData: {
          type: 'quote',
          quote: 'Great company to work for.',
          attribution: 'Glassdoor review',
        },
      },
      {
        sectionId: 'pain-points',
        visualType: 'signals',
        visualData: {
          type: 'signals',
          items: [{ label: 'Groei', value: '+20%', trend: 'up' }],
        },
      },
    ];

    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(flashResponse) },
    });

    const result = await generateSectionVisuals(sections, evidence);

    expect(result).toHaveLength(3);
    expect(result[0]?.sectionId).toBe('opening-hook');
    expect(result[0]?.visualType).toBe('stats');
    expect(result[0]?.visualData).toBeDefined();
    expect(result[1]?.sectionId).toBe('market-position');
    expect(result[1]?.visualType).toBe('quote');
    expect(result[2]?.sectionId).toBe('pain-points');
    expect(result[2]?.visualType).toBe('signals');
  });

  it('returns fallback array with only sectionId when Gemini Flash API throws', async () => {
    const sections = [
      makeSection('section-1'),
      makeSection('section-2'),
      makeSection('section-3'),
    ];
    const evidence = [makeEvidence('WEBSITE')];

    mockGenerateContent.mockRejectedValueOnce(
      new Error('503 Service Unavailable'),
    );

    const result = await generateSectionVisuals(sections, evidence);

    expect(result).toHaveLength(3);
    expect(result[0]?.sectionId).toBe('section-1');
    expect(result[0]?.visualType).toBeUndefined();
    expect(result[0]?.visualData).toBeUndefined();
    expect(result[1]?.sectionId).toBe('section-2');
    expect(result[2]?.sectionId).toBe('section-3');
  });

  it('returns fallback array with only sectionId on malformed JSON response', async () => {
    const sections = [makeSection('alpha'), makeSection('beta')];
    const evidence = [makeEvidence()];

    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => 'not valid json at all %%%' },
    });

    const result = await generateSectionVisuals(sections, evidence);

    expect(result).toHaveLength(2);
    expect(result[0]?.sectionId).toBe('alpha');
    expect(result[0]?.visualType).toBeUndefined();
    expect(result[1]?.sectionId).toBe('beta');
    expect(result[1]?.visualType).toBeUndefined();
  });

  it('returns empty array when called with empty sections', async () => {
    const result = await generateSectionVisuals([], [makeEvidence()]);
    expect(result).toHaveLength(0);
  });
});
