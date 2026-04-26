import { describe, it, expect } from 'vitest';
import { buildMasterPrompt } from './master-prompt';
import type {
  NarrativeAnalysisInput,
  KlarifaiNarrativeInput,
  EvidenceItem,
} from './types';

function makeEvidence(n: number): EvidenceItem[] {
  return Array.from({ length: n }, (_, i) => ({
    sourceType: `SOURCE_${i % 4}`,
    sourceUrl: `https://example.com/${i}`,
    title: `Title ${i}`,
    snippet: `Unique snippet content for evidence item number ${i} to verify it appears in output`,
    confidenceScore: 0.9 - i * 0.01,
    workflowTag: null,
  }));
}

const MINIMAL_PROSPECT = {
  companyName: 'Test Bedrijf BV',
  industry: 'Industrie',
  description: null,
  specialties: [],
  country: 'NL',
  city: 'Amsterdam',
  employeeRange: null,
  revenueRange: null,
};

const MINIMAL_SPV = {
  name: 'SteelCo',
  code: 'STEEL',
  slug: 'steelco',
  metricsTemplate: null,
};

function makeNarrativeInput(evidenceCount = 5): NarrativeAnalysisInput {
  return {
    evidence: makeEvidence(evidenceCount),
    passages: [],
    prospect: MINIMAL_PROSPECT,
    spvs: [MINIMAL_SPV],
    crossConnections: [],
  };
}

function makeKlarifaiInput(evidenceCount = 5): KlarifaiNarrativeInput {
  return {
    evidence: makeEvidence(evidenceCount),
    useCases: [],
    prospect: MINIMAL_PROSPECT,
    crossConnections: [],
  };
}

describe('buildMasterPrompt (NarrativeAnalysisInput — Atlantis)', () => {
  it('does NOT contain "visualType" in the prompt output', () => {
    const prompt = buildMasterPrompt(makeNarrativeInput());
    expect(prompt).not.toContain('visualType');
  });

  it('does NOT contain "visualData" in the prompt output', () => {
    const prompt = buildMasterPrompt(makeNarrativeInput());
    expect(prompt).not.toContain('visualData');
  });

  it('DOES contain "punchline" in the prompt output', () => {
    const prompt = buildMasterPrompt(makeNarrativeInput());
    expect(prompt).toContain('punchline');
  });

  it('DOES contain "citations" in the prompt output', () => {
    const prompt = buildMasterPrompt(makeNarrativeInput());
    expect(prompt).toContain('citations');
  });

  it('includes all 25 evidence items when passed (no internal slice to 60 or 20)', () => {
    const input = makeNarrativeInput(25);
    const prompt = buildMasterPrompt(input);
    // All 25 snippets should appear in the prompt
    for (const item of input.evidence) {
      expect(prompt).toContain(item.snippet.slice(0, 50));
    }
  });
});

describe('buildMasterPrompt (KlarifaiNarrativeInput — Klarifai)', () => {
  it('does NOT contain "visualType" in the prompt output', () => {
    const prompt = buildMasterPrompt(makeKlarifaiInput());
    expect(prompt).not.toContain('visualType');
  });

  it('does NOT contain "visualData" in the prompt output', () => {
    const prompt = buildMasterPrompt(makeKlarifaiInput());
    expect(prompt).not.toContain('visualData');
  });

  it('DOES contain "punchline" in the prompt output', () => {
    const prompt = buildMasterPrompt(makeKlarifaiInput());
    expect(prompt).toContain('punchline');
  });

  it('DOES contain "citations" in the prompt output', () => {
    const prompt = buildMasterPrompt(makeKlarifaiInput());
    expect(prompt).toContain('citations');
  });

  it('includes all 25 evidence items when passed (no internal slice to 60 or 20)', () => {
    const input = makeKlarifaiInput(25);
    const prompt = buildMasterPrompt(input);
    for (const item of input.evidence) {
      expect(prompt).toContain(item.snippet.slice(0, 50));
    }
  });
});
