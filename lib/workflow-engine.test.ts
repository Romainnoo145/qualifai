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
      },
      {
        id: 'e2',
        sourceType: 'CAREERS',
        workflowTag: 'handoff',
        confidenceScore: 0.7,
      },
      {
        id: 'e3',
        sourceType: 'DOCS',
        workflowTag: 'billing',
        confidenceScore: 0.75,
      },
    ]);

    expect(gate.passed).toBe(true);
    expect(gate.evidenceCount).toBe(3);
    expect(gate.sourceTypeCount).toBe(3);
    expect(gate.averageConfidence).toBeGreaterThanOrEqual(0.65);
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
});
