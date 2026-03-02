import { describe, expect, it, vi } from 'vitest';
import type { AutomationOpportunity, WorkflowHypothesis } from '@prisma/client';

vi.mock('@/env.mjs', () => ({
  env: {
    OBSIDIAN_INVENTORY_JSON_PATH: undefined,
    OBSIDIAN_CLIENT_OFFERS_JSON_PATH: undefined,
    ANTHROPIC_API_KEY: 'test-key',
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: vi.fn().mockRejectedValue(new Error('test mock')),
    };
  },
}));

const mockDb = {
  useCase: {
    findMany: vi.fn().mockResolvedValue([]),
  },
} as unknown as import('@prisma/client').PrismaClient;

import {
  buildCalBookingUrl,
  computePainTagConfirmation,
  CTA_STEP_1,
  CTA_STEP_2,
  createWorkflowLossMapDraft,
  evaluateQualityGate,
  generateEvidenceDrafts,
  generateHypothesisDrafts,
  matchProofs,
  validateTwoStepCta,
} from '@/lib/workflow-engine';

const prospect = {
  id: 'prospect-1',
  domain: 'example.com',
  companyName: 'Example BV',
  industry: 'construction',
  employeeRange: '11-50',
  description: 'Example BV delivers field services with manual planning.',
  technologies: ['google-workspace'],
  specialties: ['service planning'],
};

const hypotheses = [
  {
    title: 'Planning bottleneck',
    problemStatement: 'Manual planning delays execution.',
    hoursSavedWeekMid: 10,
    handoffSpeedGainPct: 30,
    errorReductionPct: 20,
    revenueLeakageRecoveredMid: 1200,
  },
  {
    title: 'Handoff bottleneck',
    problemStatement: 'Context loss between office and field creates rework.',
    hoursSavedWeekMid: 8,
    handoffSpeedGainPct: 34,
    errorReductionPct: 18,
    revenueLeakageRecoveredMid: 900,
  },
] as unknown as WorkflowHypothesis[];

const opportunities = [
  {
    title: 'Intake copilot',
    description: 'Automated intake classification and routing.',
  },
  {
    title: 'Invoice readiness automation',
    description: 'Automated completion checks before invoice creation.',
  },
] as unknown as AutomationOpportunity[];

describe('workflow-engine', () => {
  it('passes quality gate when evidence is sufficient', () => {
    const gate = evaluateQualityGate([
      {
        id: 'e1',
        sourceType: 'WEBSITE',
        workflowTag: 'planning',
        confidenceScore: 0.72,
        metadata: { adapter: 'web-ingestion' },
      },
      {
        id: 'e2',
        sourceType: 'CAREERS',
        workflowTag: 'handoff',
        confidenceScore: 0.7,
        metadata: { adapter: 'web-ingestion' },
      },
      {
        id: 'e3',
        sourceType: 'REVIEWS',
        workflowTag: 'billing',
        confidenceScore: 0.75,
        metadata: { adapter: 'live-review-ingestion' },
      },
    ]);

    expect(gate.passed).toBe(true);
    expect(gate.evidenceCount).toBe(3);
    expect(gate.sourceTypeCount).toBe(3);
    expect(gate.averageConfidence).toBeGreaterThanOrEqual(0.65);
  });

  it('fails quality gate when evidence is synthetic and unconfirmed', () => {
    const gate = evaluateQualityGate([
      {
        id: 'e1',
        sourceType: 'WEBSITE',
        workflowTag: 'planning',
        confidenceScore: 0.74,
      },
      {
        id: 'e2',
        sourceType: 'CAREERS',
        workflowTag: 'handoff',
        confidenceScore: 0.72,
      },
      {
        id: 'e3',
        sourceType: 'REVIEWS',
        workflowTag: 'billing',
        confidenceScore: 0.76,
      },
    ]);

    expect(gate.passed).toBe(false);
    expect(gate.reasons).toContain(
      'At least 3 confirmed evidence items required',
    );
  });

  it('fails quality gate with clear reasons when evidence is weak', () => {
    const gate = evaluateQualityGate([
      {
        id: 'e1',
        sourceType: 'WEBSITE',
        workflowTag: 'planning',
        confidenceScore: 0.4,
      },
      {
        id: 'e2',
        sourceType: 'WEBSITE',
        workflowTag: 'handoff',
        confidenceScore: 0.5,
      },
    ]);

    expect(gate.passed).toBe(false);
    expect(gate.reasons).toContain('Minimum 3 evidence items required');
    expect(gate.reasons).toContain('At least 2 evidence source types required');
  });

  it('generates exactly 3 ranked bottleneck hypotheses', () => {
    const drafts = generateHypothesisDrafts([
      {
        id: 'e1',
        sourceType: 'WEBSITE',
        workflowTag: 'planning',
        confidenceScore: 0.8,
      },
      {
        id: 'e2',
        sourceType: 'CAREERS',
        workflowTag: 'handoff',
        confidenceScore: 0.75,
      },
      {
        id: 'e3',
        sourceType: 'DOCS',
        workflowTag: 'billing',
        confidenceScore: 0.72,
      },
    ]);

    expect(drafts).toHaveLength(3);
    expect(drafts[0]?.confidenceScore).toBeGreaterThanOrEqual(
      drafts[drafts.length - 1]?.confidenceScore ?? 0,
    );
  });

  it('uses reviews-first evidence ordering for construction/install profiles', () => {
    const drafts = generateEvidenceDrafts(
      {
        id: 'prospect-2',
        domain: 'bouwbedrijf-example.nl',
        companyName: 'Bouwbedrijf Example',
        industry: 'bouw',
        employeeRange: '11-50',
        description: 'Installatie en onderhoud',
        technologies: [],
        specialties: [],
      },
      ['https://www.klantenvertellen.nl/reviews/bouwbedrijf-example'],
    );

    expect(drafts[0]?.sourceType).toBe('REVIEWS');
    expect(
      drafts.some(
        (draft) =>
          draft.workflowTag === 'billing' && draft.sourceType === 'REVIEWS',
      ),
    ).toBe(true);
    expect(
      drafts.some(
        (draft) =>
          draft.sourceUrl.includes('klantenvertellen') &&
          draft.sourceType === 'REVIEWS',
      ),
    ).toBe(true);
  });

  it('generates loss map with business outcomes and exact 2-step CTA', () => {
    const draft = createWorkflowLossMapDraft(
      prospect,
      hypotheses,
      opportunities,
      ['Planning automation shipped'],
    );

    expect(draft.metrics.hoursSavedWeek).toBeGreaterThan(0);
    expect(draft.metrics.handoffSpeedGainPct).toBeGreaterThan(0);
    expect(validateTwoStepCta(draft.markdown)).toBe(true);
    expect(validateTwoStepCta(draft.emailBodyText)).toBe(true);
    expect(draft.markdown).toContain(CTA_STEP_1);
    expect(draft.markdown).toContain(CTA_STEP_2);
  });

  it('returns custom build plan when proof catalog has no strong match', async () => {
    const matches = await matchProofs(
      mockDb,
      'nonexistent-super-specific-query-token',
      3,
    );

    expect(matches[0]?.isCustomPlan).toBe(true);
    expect(matches[0]?.proofTitle).toBe('Custom build plan');
  });

  it('validates CTA strings exactly', () => {
    const valid = `${CTA_STEP_1}\n${CTA_STEP_2}`;
    const invalid = `${CTA_STEP_1}\nDifferent second CTA`;

    expect(validateTwoStepCta(valid)).toBe(true);
    expect(validateTwoStepCta(invalid)).toBe(false);
  });

  it('builds personalized Cal.com booking URL', () => {
    const url = buildCalBookingUrl('https://cal.com/klarifai/workflow-sprint', {
      name: 'Jane Doe',
      email: 'jane@example.com',
      company: 'Example BV',
    });

    expect(url).toContain('cal.com/klarifai/workflow-sprint');
    expect(url).toContain('name=Jane+Doe');
    expect(url).toContain('email=jane%40example.com');
    expect(url).toContain('company=Example+BV');
  });

  describe('computePainTagConfirmation', () => {
    it('confirms a tag backed by 2+ distinct sourceTypes', () => {
      const result = computePainTagConfirmation([
        {
          id: 'e1',
          sourceType: 'WEBSITE',
          workflowTag: 'planning',
          confidenceScore: 0.7,
          metadata: { adapter: 'web-ingestion' },
        },
        {
          id: 'e2',
          sourceType: 'REVIEWS',
          workflowTag: 'planning',
          confidenceScore: 0.8,
          metadata: { adapter: 'live-review-ingestion' },
        },
        {
          id: 'e3',
          sourceType: 'CAREERS',
          workflowTag: 'planning',
          confidenceScore: 0.75,
          metadata: { adapter: 'web-ingestion' },
        },
      ]);

      expect(result.confirmedPainTags).toContain('planning');
      expect(result.unconfirmedPainTags).not.toContain('planning');
    });

    it('marks a tag with only 1 distinct sourceType as unconfirmed', () => {
      const result = computePainTagConfirmation([
        {
          id: 'e1',
          sourceType: 'WEBSITE',
          workflowTag: 'handoff',
          confidenceScore: 0.7,
          metadata: { adapter: 'web-ingestion' },
        },
        {
          id: 'e2',
          sourceType: 'WEBSITE',
          workflowTag: 'handoff',
          confidenceScore: 0.65,
          metadata: { adapter: 'web-ingestion' },
        },
      ]);

      expect(result.unconfirmedPainTags).toContain('handoff');
      expect(result.confirmedPainTags).not.toContain('handoff');
    });

    it('marks a tag with a single item as unconfirmed', () => {
      const result = computePainTagConfirmation([
        {
          id: 'e1',
          sourceType: 'REVIEWS',
          workflowTag: 'billing',
          confidenceScore: 0.72,
          metadata: { adapter: 'live-review-ingestion' },
        },
      ]);

      expect(result.unconfirmedPainTags).toContain('billing');
      expect(result.confirmedPainTags).not.toContain('billing');
    });

    it('excludes placeholder items (notFound=true) from confirmation counting', () => {
      const result = computePainTagConfirmation([
        {
          id: 'e1',
          sourceType: 'WEBSITE',
          workflowTag: 'planning',
          confidenceScore: 0.7,
          metadata: { adapter: 'web-ingestion' },
        },
        {
          id: 'e2',
          sourceType: 'REVIEWS',
          workflowTag: 'planning',
          confidenceScore: 0.0,
          // notFound=true marks this as a placeholder — excluded
          metadata: { notFound: true },
        },
      ]);

      // Only 1 real sourceType (WEBSITE); REVIEWS item is placeholder
      expect(result.unconfirmedPainTags).toContain('planning');
      expect(result.confirmedPainTags).not.toContain('planning');
    });

    it('counts low-aiRelevance items for pain tag confirmation (not excluded like confidence average)', () => {
      const result = computePainTagConfirmation([
        {
          id: 'e1',
          sourceType: 'WEBSITE',
          workflowTag: 'planning',
          confidenceScore: 0.7,
          metadata: { adapter: 'web-ingestion', aiRelevance: 0.3 },
        },
        {
          id: 'e2',
          sourceType: 'CAREERS',
          workflowTag: 'planning',
          confidenceScore: 0.6,
          metadata: { adapter: 'web-ingestion', aiRelevance: 0.2 },
        },
      ]);

      // Both items count (aiRelevance < 0.5 only excluded from confidence average, not pain tag counting)
      expect(result.confirmedPainTags).toContain('planning');
      expect(result.unconfirmedPainTags).not.toContain('planning');
    });

    it('tags with zero evidence do not appear in either list', () => {
      const result = computePainTagConfirmation([
        {
          id: 'e1',
          sourceType: 'WEBSITE',
          workflowTag: 'planning',
          confidenceScore: 0.7,
          metadata: { adapter: 'web-ingestion' },
        },
      ]);

      // 'handoff' has no evidence — should not appear in either list
      expect(result.confirmedPainTags).not.toContain('handoff');
      expect(result.unconfirmedPainTags).not.toContain('handoff');
    });
  });

  describe('evaluateQualityGate pain tag arrays', () => {
    it('includes confirmedPainTags and unconfirmedPainTags in quality gate output', () => {
      const gate = evaluateQualityGate([
        {
          id: 'e1',
          sourceType: 'WEBSITE',
          workflowTag: 'planning',
          confidenceScore: 0.72,
          metadata: { adapter: 'web-ingestion' },
        },
        {
          id: 'e2',
          sourceType: 'CAREERS',
          workflowTag: 'planning',
          confidenceScore: 0.7,
          metadata: { adapter: 'web-ingestion' },
        },
        {
          id: 'e3',
          sourceType: 'REVIEWS',
          workflowTag: 'handoff',
          confidenceScore: 0.75,
          metadata: { adapter: 'live-review-ingestion' },
        },
      ]);

      expect(gate).toHaveProperty('confirmedPainTags');
      expect(gate).toHaveProperty('unconfirmedPainTags');
      expect(Array.isArray(gate.confirmedPainTags)).toBe(true);
      expect(Array.isArray(gate.unconfirmedPainTags)).toBe(true);
      // 'planning' is confirmed (WEBSITE + CAREERS = 2 distinct sourceTypes)
      expect(gate.confirmedPainTags).toContain('planning');
      // 'handoff' has only REVIEWS (1 sourceType) → unconfirmed
      expect(gate.unconfirmedPainTags).toContain('handoff');
    });

    it('unconfirmed pain tags do NOT cause gate.passed to become false', () => {
      const gate = evaluateQualityGate([
        {
          id: 'e1',
          sourceType: 'WEBSITE',
          workflowTag: 'planning',
          confidenceScore: 0.72,
          metadata: { adapter: 'web-ingestion' },
        },
        {
          id: 'e2',
          sourceType: 'CAREERS',
          workflowTag: 'handoff',
          confidenceScore: 0.7,
          metadata: { adapter: 'web-ingestion' },
        },
        {
          id: 'e3',
          sourceType: 'REVIEWS',
          workflowTag: 'billing',
          confidenceScore: 0.75,
          metadata: { adapter: 'live-review-ingestion' },
        },
      ]);

      // Each tag has only 1 sourceType → all unconfirmed
      expect(gate.unconfirmedPainTags.length).toBeGreaterThan(0);
      // But gate.passed must NOT be false due to unconfirmed tags (advisory-only, GATE-03)
      expect(gate.passed).toBe(true);
      // Reasons must not contain any pain tag confirmation failure message
      expect(
        gate.reasons.some((r) => r.toLowerCase().includes('pain tag')),
      ).toBe(false);
    });
  });
});
