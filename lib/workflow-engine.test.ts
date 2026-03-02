import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AutomationOpportunity, WorkflowHypothesis } from '@prisma/client';

vi.mock('@/env.mjs', () => ({
  env: {
    OBSIDIAN_INVENTORY_JSON_PATH: undefined,
    OBSIDIAN_CLIENT_OFFERS_JSON_PATH: undefined,
    ANTHROPIC_API_KEY: 'test-key',
    GOOGLE_AI_API_KEY: 'test-gemini-key',
  },
}));

const mockAnthropicCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockAnthropicCreate };
  },
}));

// Gemini mock — module-level so tests can configure responses via mockGenerateContent
let lastCapturedPrompt = '';
const mockGenerateContent = vi.fn();

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: (prompt: string) => {
          lastCapturedPrompt = prompt;
          return mockGenerateContent(prompt);
        },
      };
    }
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
  generateHypothesisDraftsAI,
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

  describe('generateHypothesisDraftsAI', () => {
    // Standard evidence set used by prompt-text assertions (ANLYS-01, 02, 03, 05, 07)
    const standardEvidence = [
      {
        id: 'e1',
        sourceType: 'REVIEWS' as const,
        workflowTag: 'planning',
        confidenceScore: 0.85,
        snippet:
          'We always have to wait for approval before starting the next phase.',
        sourceUrl: 'https://reviews.example.com/company-a',
        title: 'Customer Review',
      },
      {
        id: 'e2',
        sourceType: 'CAREERS' as const,
        workflowTag: 'handoff',
        confidenceScore: 0.75,
        snippet:
          'Looking for someone to coordinate between field teams and office.',
        sourceUrl: 'https://careers.example.com/job-1',
        title: 'Job Posting',
      },
      {
        id: 'e3',
        sourceType: 'WEBSITE' as const,
        workflowTag: 'billing',
        confidenceScore: 0.65,
        snippet: 'We provide excellent service to our clients.',
        sourceUrl: 'https://example.com/about',
        title: 'About Page',
      },
    ];

    const standardContext = {
      companyName: 'Test BV',
      industry: 'construction',
      specialties: ['field services'],
      description: 'A Dutch construction company.',
    };

    const makeHypothesisResponse = (
      items: Array<{
        title: string;
        problemStatement: string;
        primarySourceType?: string;
        hoursSavedWeekLow?: number;
        hoursSavedWeekMid?: number;
        hoursSavedWeekHigh?: number;
        handoffSpeedGainPct?: number;
        errorReductionPct?: number;
        revenueLeakageRecoveredLow?: number;
        revenueLeakageRecoveredMid?: number;
        revenueLeakageRecoveredHigh?: number;
      }>,
    ) => ({
      response: {
        text: () =>
          JSON.stringify(
            items.map((item) => ({
              title: item.title,
              problemStatement: item.problemStatement,
              assumptions: ['Assumption 1'],
              validationQuestions: ['Question 1?'],
              workflowTag: 'planning',
              confidenceScore: 0.8,
              evidenceRefs: ['https://reviews.example.com/company-a'],
              // MODEL-03: AI-derived metric fields
              primarySourceType: item.primarySourceType ?? 'REVIEWS',
              hoursSavedWeekLow: item.hoursSavedWeekLow ?? 5,
              hoursSavedWeekMid: item.hoursSavedWeekMid ?? 12,
              hoursSavedWeekHigh: item.hoursSavedWeekHigh ?? 18,
              handoffSpeedGainPct: item.handoffSpeedGainPct ?? 32,
              errorReductionPct: item.errorReductionPct ?? 25,
              revenueLeakageRecoveredLow:
                item.revenueLeakageRecoveredLow ?? 350,
              revenueLeakageRecoveredMid:
                item.revenueLeakageRecoveredMid ?? 1200,
              revenueLeakageRecoveredHigh:
                item.revenueLeakageRecoveredHigh ?? 3500,
            })),
          ),
      },
    });

    const makeClaudeHypothesisResponse = (
      items: Array<{
        title: string;
        problemStatement: string;
        primarySourceType?: string;
        hoursSavedWeekLow?: number;
        hoursSavedWeekMid?: number;
        hoursSavedWeekHigh?: number;
        handoffSpeedGainPct?: number;
        errorReductionPct?: number;
        revenueLeakageRecoveredLow?: number;
        revenueLeakageRecoveredMid?: number;
        revenueLeakageRecoveredHigh?: number;
      }>,
    ) => ({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `<reasoning>\nAnalysis: REVIEWS source shows direct pain.\n</reasoning>\n${JSON.stringify(
            items.map((item) => ({
              title: item.title,
              problemStatement: item.problemStatement,
              assumptions: ['Assumption 1'],
              validationQuestions: ['Question 1?'],
              workflowTag: 'planning',
              confidenceScore: 0.85,
              evidenceRefs: ['https://reviews.example.com/company-a'],
              // MODEL-03: AI-derived metric fields
              primarySourceType: item.primarySourceType ?? 'REVIEWS',
              hoursSavedWeekLow: item.hoursSavedWeekLow ?? 5,
              hoursSavedWeekMid: item.hoursSavedWeekMid ?? 12,
              hoursSavedWeekHigh: item.hoursSavedWeekHigh ?? 18,
              handoffSpeedGainPct: item.handoffSpeedGainPct ?? 32,
              errorReductionPct: item.errorReductionPct ?? 25,
              revenueLeakageRecoveredLow:
                item.revenueLeakageRecoveredLow ?? 350,
              revenueLeakageRecoveredMid:
                item.revenueLeakageRecoveredMid ?? 1200,
              revenueLeakageRecoveredHigh:
                item.revenueLeakageRecoveredHigh ?? 3500,
            })),
          )}`,
        },
      ],
      model: 'claude-sonnet-4-5',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    beforeEach(() => {
      lastCapturedPrompt = '';
      mockGenerateContent.mockReset();
      mockAnthropicCreate.mockReset();
    });

    it('ANLYS-01: prompt contains source-tier prioritization instruction (REVIEWS, CAREERS, LINKEDIN higher than WEBSITE)', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement:
              '"We always have to wait for approval" indicates manual approval chains.',
          },
        ]),
      );

      await generateHypothesisDraftsAI(standardEvidence, standardContext, [
        'planning',
      ]);

      // The prompt must instruct the LLM to prioritize REVIEWS, CAREERS, LINKEDIN over WEBSITE
      expect(lastCapturedPrompt).toMatch(/REVIEWS/);
      expect(lastCapturedPrompt).toMatch(/CAREERS/);
      expect(lastCapturedPrompt).toMatch(/LINKEDIN/);
      // Must contain explicit tier-ordering language
      expect(lastCapturedPrompt).toMatch(
        /highest diagnostic value|diagnostic tier|priorit|USE THESE FIRST/i,
      );
      // WEBSITE must be described as lower priority / marketing context
      expect(lastCapturedPrompt).toMatch(
        /marketing.context|lowest.*diagnostic|background only/i,
      );
    });

    it('ANLYS-02: prompt contains SOURCE TYPE GUIDE with diagnostic label definitions per source type', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Handoff gap',
            problemStatement:
              '"coordinate between field teams and office" shows handoff friction.',
          },
        ]),
      );

      await generateHypothesisDraftsAI(standardEvidence, standardContext, [
        'handoff',
      ]);

      // Must contain a source-type legend / guide section
      expect(lastCapturedPrompt).toMatch(/SOURCE TYPE GUIDE|SOURCE TYPE/i);
      // Must define REVIEWS as customer/employee pain signal
      expect(lastCapturedPrompt).toMatch(
        /REVIEWS.*customer|customer.*pain|employee.*voice/i,
      );
      // Must define CAREERS as operational gap signal
      expect(lastCapturedPrompt).toMatch(
        /CAREERS.*operational|hiring.*gap|operational.*gap/i,
      );
      // Must define WEBSITE as marketing context only
      expect(lastCapturedPrompt).toMatch(/WEBSITE.*marketing|marketing.*copy/i);
    });

    it('ANLYS-03: prompt contains anti-parroting constraint against website/marketing copy', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement:
              '"We always have to wait" signals manual approval delays.',
          },
        ]),
      );

      await generateHypothesisDraftsAI(standardEvidence, standardContext, [
        'planning',
      ]);

      // Must contain explicit prohibition against deriving hypotheses from website copy
      expect(lastCapturedPrompt).toMatch(
        /Do NOT derive hypotheses from|ANTI-PARROTING|not.*derive.*from.*website/i,
      );
      // Must mention marketing copy as the thing to avoid
      expect(lastCapturedPrompt).toMatch(
        /marketing.*copy|website.*copy|own.*website/i,
      );
    });

    it('ANLYS-04: warns when hypothesis problemStatement lacks a quoted snippet', async () => {
      // Mock returns a hypothesis WITHOUT quotes in problemStatement
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify([
              {
                title: 'Planning bottleneck',
                problemStatement:
                  'The company has manual approval processes that delay work.',
                assumptions: ['Assumption 1'],
                validationQuestions: ['Question 1?'],
                workflowTag: 'planning',
                confidenceScore: 0.8,
                evidenceRefs: ['https://reviews.example.com/company-a'],
              },
            ]),
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await generateHypothesisDraftsAI(standardEvidence, standardContext, [
        'planning',
      ]);

      // console.warn must fire because no quoted snippet in problemStatement
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing quoted snippet'),
      );

      warnSpy.mockRestore();
    });

    it('ANLYS-04: does NOT warn when hypothesis problemStatement contains a quoted snippet', async () => {
      // Mock returns a hypothesis WITH quotes in problemStatement
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify([
              {
                title: 'Planning bottleneck',
                problemStatement:
                  '"We always have to wait for approval" indicates manual approval chains.',
                assumptions: ['Assumption 1'],
                validationQuestions: ['Question 1?'],
                workflowTag: 'planning',
                confidenceScore: 0.8,
                evidenceRefs: ['https://reviews.example.com/company-a'],
              },
            ]),
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await generateHypothesisDraftsAI(standardEvidence, standardContext, [
        'planning',
      ]);

      // console.warn must NOT fire when quoted snippet is present
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('missing quoted snippet'),
      );

      warnSpy.mockRestore();
    });

    it('ANLYS-05: prompt contains signal summary block with correct tier counts', async () => {
      // Evidence with 2 REVIEWS + 1 CAREERS + 1 WEBSITE
      const tieredEvidence = [
        {
          id: 'e1',
          sourceType: 'REVIEWS' as const,
          workflowTag: 'planning',
          confidenceScore: 0.85,
          snippet: 'First review snippet.',
          sourceUrl: 'https://reviews.example.com/1',
          title: 'Review 1',
        },
        {
          id: 'e2',
          sourceType: 'REVIEWS' as const,
          workflowTag: 'billing',
          confidenceScore: 0.82,
          snippet: 'Second review snippet.',
          sourceUrl: 'https://reviews.example.com/2',
          title: 'Review 2',
        },
        {
          id: 'e3',
          sourceType: 'CAREERS' as const,
          workflowTag: 'handoff',
          confidenceScore: 0.75,
          snippet: 'Job posting requiring coordination skills.',
          sourceUrl: 'https://careers.example.com/1',
          title: 'Job 1',
        },
        {
          id: 'e4',
          sourceType: 'WEBSITE' as const,
          workflowTag: 'billing',
          confidenceScore: 0.65,
          snippet: 'We provide excellent services.',
          sourceUrl: 'https://example.com/about',
          title: 'About Page',
        },
      ];

      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement: '"First review snippet" shows planning pain.',
          },
        ]),
      );

      await generateHypothesisDraftsAI(tieredEvidence, standardContext, [
        'planning',
      ]);

      // Prompt must contain a signal summary block
      // 2 REVIEWS + 1 CAREERS = 3 diagnostic items; 1 WEBSITE = 1 marketing context item
      expect(lastCapturedPrompt).toMatch(/[Dd]iagnostic.{0,50}3\s*(items?)?/);
      expect(lastCapturedPrompt).toMatch(
        /[Mm]arketing.{0,50}1\s*(items?)?|[Ww]ebsite.{0,50}1\s*(items?)?/,
      );
    });

    it('ANLYS-06: output length matches confirmedPainTags count (1 tag → 1 hypothesis)', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement: '"We always have to wait" shows planning pain.',
          },
        ]),
      );

      const result = await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        ['planning'], // 1 confirmed tag
      );

      expect(result.length).toBe(1);
    });

    it('ANLYS-06: output length matches confirmedPainTags count (3 tags → 3 hypotheses)', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement: '"We always have to wait" shows planning pain.',
          },
          {
            title: 'Handoff gap',
            problemStatement:
              '"coordinate between field teams" shows handoff friction.',
          },
          {
            title: 'Billing delay',
            problemStatement:
              '"invoice approval takes days" shows billing pain.',
          },
        ]),
      );

      const result = await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        ['planning', 'handoff', 'billing'], // 3 confirmed tags
      );

      expect(result.length).toBe(3);
    });

    it('ANLYS-06: empty confirmedPainTags defaults to 1 hypothesis output', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement: '"We always have to wait" shows planning pain.',
          },
        ]),
      );

      const result = await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        [], // 0 confirmed tags — edge case, defaults to 1
      );

      expect(result.length).toBe(1);
    });

    it('ANLYS-07: prompt contains confidence calibration table with source-specific tiers', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement: '"We always have to wait" shows planning pain.',
          },
        ]),
      );

      await generateHypothesisDraftsAI(standardEvidence, standardContext, [
        'planning',
      ]);

      // Prompt must contain REVIEWS mapped to 0.80-0.95 range
      expect(lastCapturedPrompt).toMatch(/REVIEWS.{0,100}0\.8[0-9]/);
      // Prompt must contain CAREERS/LINKEDIN mapped to 0.70-0.80 range
      expect(lastCapturedPrompt).toMatch(/CAREERS.{0,100}0\.7[0-9]/);
      // Prompt must contain WEBSITE mapped to 0.60-0.65 range
      expect(lastCapturedPrompt).toMatch(/WEBSITE.{0,100}0\.6[0-9]/);
      // Must contain explicit cap for website-derived hypotheses
      expect(lastCapturedPrompt).toMatch(
        /Do NOT score.*website.{0,50}0\.65|website.*above.*0\.65|website.*hypotheses.*0\.65/i,
      );
    });

    it("MODEL-01: generates hypotheses via Claude when hypothesisModel='claude-sonnet'", async () => {
      mockAnthropicCreate.mockResolvedValueOnce(
        makeClaudeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement:
              '"We always have to wait" indicates approval delays.',
          },
        ]),
      );

      const result = await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        ['planning'],
        'claude-sonnet',
      );

      // Anthropic SDK must be invoked exactly once
      expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
      // Gemini path must NOT be invoked
      expect(mockGenerateContent).not.toHaveBeenCalled();
      // Result must contain the mocked Claude hypothesis
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Planning bottleneck');
    });

    it('MODEL-01: defaults to Gemini when hypothesisModel is omitted', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Default',
            problemStatement: '"We always have to wait" shows pain.',
          },
        ]),
      );

      // No 4th argument — must default to Gemini
      await generateHypothesisDraftsAI(standardEvidence, standardContext, [
        'planning',
      ]);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });

    it("MODEL-01: defaults to Gemini when hypothesisModel='gemini-flash'", async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Default',
            problemStatement: '"We always have to wait" shows pain.',
          },
        ]),
      );

      // Explicit gemini-flash — must still use Gemini
      await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        ['planning'],
        'gemini-flash',
      );

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });

    it('ANLYS-08: prompt includes chain-of-thought reasoning instruction', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement: '"We always have to wait" shows planning pain.',
          },
        ]),
      );

      await generateHypothesisDraftsAI(standardEvidence, standardContext, [
        'planning',
      ]);

      // Prompt must instruct model to produce a <reasoning> block
      expect(lastCapturedPrompt).toMatch(/<reasoning>/);
      // Reasoning instruction must reference evidence analysis
      expect(lastCapturedPrompt).toMatch(
        /evidence analysis|diagnostic signal|pain.*confirmed/i,
      );
    });

    it('ANLYS-08: CoT reasoning block in Claude response is stripped before JSON parse', async () => {
      mockAnthropicCreate.mockResolvedValueOnce(
        makeClaudeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement:
              '"We always have to wait" indicates approval delays.',
          },
        ]),
      );

      const result = await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        ['planning'],
        'claude-sonnet',
      );

      // Result must be a valid array of HypothesisDraft objects
      expect(Array.isArray(result)).toBe(true);
      // JSON must have been parsed correctly despite the <reasoning> block prefix
      expect(result[0]?.title).toBeTruthy();
      expect(result[0]?.title).not.toBe('');
    });

    it('MODEL-03: Gemini path returns AI-derived hoursSavedWeekMid (not METRIC_DEFAULTS)', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement:
              '"We always have to wait" indicates approval delays.',
            hoursSavedWeekLow: 5,
            hoursSavedWeekMid: 12,
            hoursSavedWeekHigh: 18,
          },
        ]),
      );
      const result = await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        ['planning'],
      );
      expect(result[0]?.hoursSavedWeekMid).toBe(12); // NOT 8 (METRIC_DEFAULTS)
    });

    it('MODEL-03: Claude path returns AI-derived revenueLeakageRecoveredMid (not METRIC_DEFAULTS)', async () => {
      mockAnthropicCreate.mockResolvedValueOnce(
        makeClaudeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement:
              '"We always have to wait" indicates approval delays.',
            revenueLeakageRecoveredLow: 350,
            revenueLeakageRecoveredMid: 1200,
            revenueLeakageRecoveredHigh: 3500,
          },
        ]),
      );
      const result = await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        ['planning'],
        'claude-sonnet',
      );
      expect(result[0]?.revenueLeakageRecoveredMid).toBe(1200); // NOT 900 (METRIC_DEFAULTS)
    });

    it('MODEL-03: clamps out-of-range hoursSavedWeekMid to valid bounds', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement:
              '"We always have to wait" indicates approval delays.',
            hoursSavedWeekLow: 200, // way out of range
            hoursSavedWeekMid: 200,
            hoursSavedWeekHigh: 200,
          },
        ]),
      );
      const result = await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        ['planning'],
      );
      // Clamped value should be exactly 80 (max bound), not 200 (raw LLM) and not 8 (METRIC_DEFAULTS)
      expect(result[0]?.hoursSavedWeekMid).toBe(80);
    });

    it('ANLYS-09: Gemini path resolves primarySourceType from AI output', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement:
              '"We always have to wait" indicates approval delays.',
            primarySourceType: 'REVIEWS',
          },
        ]),
      );
      const result = await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        ['planning'],
      );
      expect(result[0]).toHaveProperty('primarySourceType');
      expect(result[0]?.primarySourceType).toBe('REVIEWS');
    });

    it('ANLYS-09: invalid primarySourceType from AI falls back to null', async () => {
      mockGenerateContent.mockResolvedValueOnce(
        makeHypothesisResponse([
          {
            title: 'Planning bottleneck',
            problemStatement:
              '"We always have to wait" indicates approval delays.',
            primarySourceType: 'EMPLOYEE_REVIEW', // invalid enum value
          },
        ]),
      );
      const result = await generateHypothesisDraftsAI(
        standardEvidence,
        standardContext,
        ['planning'],
      );
      expect(result[0]).toHaveProperty('primarySourceType');
      expect(result[0]?.primarySourceType).toBeNull();
    });
  });
});
