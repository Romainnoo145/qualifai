import { env } from '@/env.mjs';
import {
  type AutomationOpportunity,
  type Campaign,
  type EvidenceSourceType,
  type Prospect,
  type WorkflowHypothesis,
} from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'node:fs/promises';

// Lazily initialized to avoid accessing env at module load time (breaks test isolation)
let genaiClient: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genaiClient) {
    genaiClient = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY!);
  }
  return genaiClient;
}

export const WORKFLOW_OFFER_NAME = 'Workflow Optimization Sprint';
export const CTA_STEP_1 = 'I made a 1-page Workflow Loss Map for your team.';
export const CTA_STEP_2 = 'Want a 15-min teardown + live mini-demo?';

export function validateTwoStepCta(content: string): boolean {
  return content.includes(CTA_STEP_1) && content.includes(CTA_STEP_2);
}

export function buildCalBookingUrl(
  baseBookingUrl: string | undefined,
  options?: { name?: string; email?: string; company?: string },
): string | undefined {
  if (!baseBookingUrl) return undefined;
  try {
    const url = new URL(baseBookingUrl);
    if (options?.name) url.searchParams.set('name', options.name);
    if (options?.email) url.searchParams.set('email', options.email);
    if (options?.company) url.searchParams.set('company', options.company);
    return url.toString();
  } catch {
    return baseBookingUrl;
  }
}

type ProspectForEngine = Pick<
  Prospect,
  | 'id'
  | 'domain'
  | 'companyName'
  | 'industry'
  | 'employeeRange'
  | 'description'
  | 'technologies'
  | 'specialties'
>;

type CampaignForEngine = Pick<
  Campaign,
  'id' | 'name' | 'nicheKey' | 'language' | 'tone' | 'strictGate'
>;

export interface EvidenceDraft {
  sourceType: EvidenceSourceType;
  sourceUrl: string;
  title: string;
  snippet: string;
  workflowTag: string;
  confidenceScore: number;
  metadata?: Record<string, unknown>;
}

export interface HypothesisDraft {
  title: string;
  problemStatement: string;
  assumptions: string[];
  confidenceScore: number;
  evidenceRefs: string[];
  validationQuestions: string[];
  hoursSavedWeekLow: number;
  hoursSavedWeekMid: number;
  hoursSavedWeekHigh: number;
  handoffSpeedGainPct: number;
  errorReductionPct: number;
  revenueLeakageRecoveredLow: number;
  revenueLeakageRecoveredMid: number;
  revenueLeakageRecoveredHigh: number;
}

export interface OpportunityDraft {
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
}

export interface QualityGateResult {
  passed: boolean;
  averageConfidence: number;
  sourceTypeCount: number;
  evidenceCount: number;
  reasons: string[];
  painConfirmation: {
    observedEvidenceCount: number;
    reviewsCount: number;
    jobsCount: number;
    contextCount: number;
    distinctPainTags: number;
    reasons: string[];
  };
}

interface EvidenceInput {
  id: string;
  sourceType: EvidenceSourceType;
  workflowTag: string;
  confidenceScore: number;
  metadata?: unknown;
}

export interface ProofCandidate {
  sourceType: 'inventory' | 'client_offers';
  proofId: string;
  title: string;
  summary: string;
  url: string | null;
  shipped: boolean;
  keywords: string[];
}

export interface ProofMatchResult {
  sourceType: string;
  proofId: string;
  proofTitle: string;
  proofSummary: string;
  proofUrl: string | null;
  score: number;
  isRealShipped: boolean;
  isCustomPlan: boolean;
}

export interface WorkflowLossMapDraft {
  title: string;
  markdown: string;
  html: string;
  emailSubject: string;
  emailBodyText: string;
  emailBodyHtml: string;
  demoScript: string;
  metrics: {
    hoursSavedWeek: number;
    handoffSpeedGainPct: number;
    errorReductionPct: number;
    leakageRecoveredEur: number;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function inferSourceType(url: string): EvidenceSourceType {
  const lowered = url.toLowerCase();
  if (lowered.includes('/careers') || lowered.includes('/jobs'))
    return 'CAREERS';
  if (lowered.includes('/docs') || lowered.includes('/documentation'))
    return 'DOCS';
  if (lowered.includes('/help') || lowered.includes('/faq'))
    return 'HELP_CENTER';
  if (
    lowered.includes('indeed.') ||
    lowered.includes('intermediair.') ||
    lowered.includes('job')
  ) {
    return 'JOB_BOARD';
  }
  if (
    lowered.includes('reviews') ||
    lowered.includes('review') ||
    lowered.includes('google.com/maps') ||
    lowered.includes('google.com/search') ||
    lowered.includes('trustpilot') ||
    lowered.includes('klantenvertellen') ||
    lowered.includes('feedbackcompany')
  ) {
    return 'REVIEWS';
  }
  if (lowered.includes('manual://')) return 'MANUAL_URL';
  return 'WEBSITE';
}

function isConstructionOrInstall(industryRaw: string | null): boolean {
  const industry = (industryRaw ?? '').toLowerCase();
  return (
    industry.includes('construction') ||
    industry.includes('bouw') ||
    industry.includes('install')
  );
}

function reviewSourceSeeds(
  companyName: string,
  domain: string,
): EvidenceDraft[] {
  const encodedCompany = encodeURIComponent(companyName);
  const reviewQueryUrl = `https://www.google.com/search?q=${encodedCompany}+reviews`;
  const localPackUrl = `https://www.google.com/maps/search/${encodedCompany}`;
  const trustpilotUrl = `https://www.trustpilot.com/review/${domain}`;

  return [
    {
      sourceType: 'REVIEWS',
      sourceUrl: reviewQueryUrl,
      title: 'Customer review themes (search)',
      snippet:
        'Review summaries frequently expose scheduling delays, communication gaps, and aftercare friction.',
      workflowTag: 'planning',
      confidenceScore: 0.82,
      metadata: {
        adapter: 'reviews-first',
        signalCluster: ['scheduling-delay', 'response-time', 'expectation-gap'],
      },
    },
    {
      sourceType: 'REVIEWS',
      sourceUrl: localPackUrl,
      title: 'Google Maps service feedback',
      snippet:
        'Local review comments reveal handoff consistency between office intake, planning, and field execution.',
      workflowTag: 'handoff',
      confidenceScore: 0.8,
      metadata: {
        adapter: 'reviews-first',
        signalCluster: [
          'handoff-friction',
          'service-quality',
          'status-visibility',
        ],
      },
    },
    {
      sourceType: 'REVIEWS',
      sourceUrl: trustpilotUrl,
      title: 'Trust and billing sentiment',
      snippet:
        'Public review sentiment often highlights disputes around quote clarity, change requests, and invoice timing.',
      workflowTag: 'billing',
      confidenceScore: 0.78,
      metadata: {
        adapter: 'reviews-first',
        signalCluster: ['quote-dispute', 'invoice-delay', 'scope-clarity'],
      },
    },
  ];
}

export function generateEvidenceDrafts(
  prospect: ProspectForEngine,
  manualUrls: string[],
): EvidenceDraft[] {
  const companyName = prospect.companyName ?? prospect.domain;
  const website = `https://${prospect.domain}`;
  const reviewFirstMode = isConstructionOrInstall(prospect.industry);
  const baseDrafts: EvidenceDraft[] = [
    {
      sourceType: 'WEBSITE',
      sourceUrl: website,
      title: `${companyName} - company context`,
      snippet:
        prospect.description ??
        `${companyName} operates in ${prospect.industry ?? 'B2B services'} with workflow complexity across planning, handoff, and delivery.`,
      workflowTag: 'workflow-context',
      confidenceScore: 0.72,
      metadata: {
        technologies: prospect.technologies,
        specialties: prospect.specialties,
      },
    },
    {
      sourceType: 'WEBSITE',
      sourceUrl: `${website}/contact`,
      title: 'Lead intake and first response workflow',
      snippet:
        'Public-facing contact and request flows indicate manual intake, qualification, and routing risk.',
      workflowTag: 'lead-intake',
      confidenceScore: 0.68,
    },
    {
      sourceType: 'CAREERS',
      sourceUrl: `${website}/careers`,
      title: 'Hiring and role pain signals',
      snippet:
        'Open roles often indicate bottlenecks in planning, operations handoffs, and reporting load.',
      workflowTag: 'handoff',
      confidenceScore: 0.66,
    },
  ];

  if (reviewFirstMode) {
    baseDrafts.push(
      {
        sourceType: 'WEBSITE',
        sourceUrl: `${website}/services`,
        title: 'Planning and dispatch pressure',
        snippet:
          'Service-heavy operations usually rely on multi-step planning between office and field teams, creating handoff delay risk.',
        workflowTag: 'planning',
        confidenceScore: 0.77,
      },
      {
        sourceType: 'WEBSITE',
        sourceUrl: `${website}/projects`,
        title: 'Field-to-office reporting load',
        snippet:
          'Project delivery suggests repetitive status updates, approvals, and documentation flow that can be standardized.',
        workflowTag: 'field-reporting',
        confidenceScore: 0.74,
      },
      {
        sourceType: 'WEBSITE',
        sourceUrl: `${website}/pricing`,
        title: 'Quote-to-invoice leakage risk',
        snippet:
          'Quote, scope change, and invoicing transitions can leak margin when tracked manually.',
        workflowTag: 'billing',
        confidenceScore: 0.73,
      },
    );
  }

  const drafts = reviewFirstMode
    ? [...reviewSourceSeeds(companyName, prospect.domain), ...baseDrafts]
    : baseDrafts;

  for (const url of manualUrls) {
    const sourceType = inferSourceType(url);
    const isReview = sourceType === 'REVIEWS';
    drafts.push({
      sourceType,
      sourceUrl: url,
      title: isReview ? 'Manual review source seed' : 'Manual source seed',
      snippet: isReview
        ? 'Manually added review source for customer pain patterns and service workflow friction.'
        : 'Manually added source for role pain signals, process constraints, or customer-facing friction.',
      workflowTag: isReview ? 'planning' : 'external-signal',
      confidenceScore: isReview ? 0.79 : 0.7,
      metadata: {
        addedByUser: true,
        adapter: isReview ? 'reviews-first' : 'manual',
      },
    });
  }

  return drafts.slice(0, 18);
}

const SYNTHETIC_ADAPTERS = new Set([
  'manual',
  'reviews-first',
  'apollo-derived',
]);
const CONTEXT_SOURCE_TYPES = new Set<EvidenceSourceType>([
  'WEBSITE',
  'DOCS',
  'HELP_CENTER',
  'REGISTRY',
]);
const JOB_SOURCE_TYPES = new Set<EvidenceSourceType>(['CAREERS', 'JOB_BOARD']);
const PAIN_WORKFLOW_TAGS = new Set([
  'planning',
  'handoff',
  'billing',
  'lead-intake',
  'field-reporting',
]);

function parseEvidenceMetadata(value: unknown): {
  adapter?: string;
  fallback?: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const payload = value as Record<string, unknown>;
  const adapter =
    typeof payload.adapter === 'string' ? payload.adapter : undefined;
  const fallback = payload.fallback === true;
  return { adapter, fallback };
}

function isObservedEvidence(item: EvidenceInput): boolean {
  const metadata = parseEvidenceMetadata(item.metadata);
  if (!metadata.adapter) return false;
  if (SYNTHETIC_ADAPTERS.has(metadata.adapter)) return false;
  if (metadata.fallback) return false;
  return item.confidenceScore >= 0.62;
}

function evaluatePainConfirmation(items: EvidenceInput[]): {
  observedEvidenceCount: number;
  reviewsCount: number;
  jobsCount: number;
  contextCount: number;
  distinctPainTags: number;
  reasons: string[];
} {
  const observed = items.filter(isObservedEvidence);
  const reviewsCount = observed.filter(
    (item) => item.sourceType === 'REVIEWS',
  ).length;
  const jobsCount = observed.filter((item) =>
    JOB_SOURCE_TYPES.has(item.sourceType),
  ).length;
  const contextCount = observed.filter((item) =>
    CONTEXT_SOURCE_TYPES.has(item.sourceType),
  ).length;
  const distinctPainTags = new Set(
    observed
      .map((item) => item.workflowTag)
      .filter((tag) => PAIN_WORKFLOW_TAGS.has(tag)),
  ).size;

  const reasons: string[] = [];
  if (observed.length < 3) {
    reasons.push('At least 3 confirmed evidence items required');
  }
  if (contextCount < 1) {
    reasons.push('At least 1 confirmed site-context source required');
  }
  if (reviewsCount === 0 && jobsCount === 0) {
    reasons.push(
      'At least 1 confirmed external pain source required (reviews or jobs)',
    );
  }
  if (distinctPainTags < 2) {
    reasons.push('Pain confirmation needs at least 2 workflow tags');
  }

  return {
    observedEvidenceCount: observed.length,
    reviewsCount,
    jobsCount,
    contextCount,
    distinctPainTags,
    reasons,
  };
}

export function evaluateQualityGate(items: EvidenceInput[]): QualityGateResult {
  const reasons: string[] = [];
  const evidenceCount = items.length;
  const sourceTypeCount = new Set(items.map((item) => item.sourceType)).size;
  const averageConfidence = round2(
    average(items.map((item) => item.confidenceScore)),
  );
  const painConfirmation = evaluatePainConfirmation(items);

  if (evidenceCount < 3) reasons.push('Minimum 3 evidence items required');
  if (sourceTypeCount < 2)
    reasons.push('At least 2 evidence source types required');
  if (averageConfidence < 0.65)
    reasons.push('Average confidence must be >= 0.65');
  reasons.push(...painConfirmation.reasons);

  return {
    passed: reasons.length === 0,
    averageConfidence,
    sourceTypeCount,
    evidenceCount,
    reasons,
    painConfirmation,
  };
}

export type TrafficLight = 'red' | 'amber' | 'green';

export interface QualityBreakdown {
  trafficLight: TrafficLight;
  evidenceCount: number;
  averageConfidence: number;
  sourceTypeCount: number;
  hypothesisCount: number;
  reasons: string[];
}

/**
 * computeTrafficLight — pure function mapping evidence metrics to a traffic light.
 *
 * Red:   critically thin evidence (< 3 items) — definitely needs attention
 * Amber: minor shortfall (low source diversity OR low confidence) — warn + allow proceed
 * Green: all thresholds met — good to go
 *
 * Mirrors the thresholds from evaluateQualityGate but returns three states
 * instead of binary pass/fail. The soft-gate principle means amber never blocks.
 */
export function computeTrafficLight(
  evidenceCount: number,
  sourceTypeCount: number,
  averageConfidence: number,
): TrafficLight {
  if (evidenceCount < 3) return 'red';
  if (sourceTypeCount < 2 || averageConfidence < 0.65) return 'amber';
  return 'green';
}

function selectEvidenceIdsByTag(
  evidence: EvidenceInput[],
  tag: string,
  fallback: string[],
): string[] {
  const tagged = evidence
    .filter((item) => item.workflowTag === tag)
    .map((item) => item.id)
    .slice(0, 3);
  if (tagged.length >= 2) return tagged;
  return fallback;
}

function defaultEvidenceRefs(evidence: EvidenceInput[]): string[] {
  return evidence
    .slice()
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 3)
    .map((item) => item.id);
}

interface AIEvidenceInput {
  id: string;
  sourceType: EvidenceSourceType;
  workflowTag: string;
  confidenceScore: number;
  snippet: string;
  sourceUrl: string;
  title: string | null;
}

interface AIProspectContext {
  companyName: string | null;
  industry: string | null;
  specialties: string[];
  description: string | null;
}

interface AIHypothesisItem {
  title: string;
  problemStatement: string;
  assumptions: string[];
  validationQuestions: string[];
  workflowTag: string;
  confidenceScore: number;
  evidenceRefs: string[];
}

export async function generateHypothesisDraftsAI(
  evidence: AIEvidenceInput[],
  prospectContext: AIProspectContext,
): Promise<HypothesisDraft[]> {
  const METRIC_DEFAULTS = {
    hoursSavedWeekLow: 4,
    hoursSavedWeekMid: 8,
    hoursSavedWeekHigh: 14,
    handoffSpeedGainPct: 28,
    errorReductionPct: 20,
    revenueLeakageRecoveredLow: 400,
    revenueLeakageRecoveredMid: 900,
    revenueLeakageRecoveredHigh: 2000,
  };

  const VALID_WORKFLOW_TAGS = new Set([
    'content-production',
    'client-reporting',
    'project-management',
    'lead-intake',
    'creative-briefing',
    'billing',
    'handoff',
  ]);

  try {
    // Filter to confident, non-empty snippet items and take top 12
    const filteredEvidence = evidence
      .filter(
        (item) => item.confidenceScore >= 0.6 && item.snippet.trim().length > 0,
      )
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 12);

    const evidenceLines = filteredEvidence
      .map(
        (item) =>
          `[${item.sourceType}] ${item.sourceUrl}: ${item.snippet.slice(0, 200)}`,
      )
      .join('\n');

    const specialtiesStr =
      prospectContext.specialties.length > 0
        ? prospectContext.specialties.join(', ')
        : 'unknown';

    const prompt = `You are analyzing evidence from a Dutch marketing bureau's public web presence to identify specific workflow automation pain points that Klarifai (an AI implementation consultancy) could solve.

IMPORTANT: These are marketing agencies (bureaus), not construction companies. Focus on marketing/creative workflow pain: content production bottlenecks, client reporting overhead, briefing-to-delivery friction, project management chaos, manual campaign reporting, etc.

Only output JSON. No markdown fences. No explanation.

Company context:
- Name: ${prospectContext.companyName ?? 'Unknown'}
- Industry: ${prospectContext.industry ?? 'Marketing/digital agency'}
- Specialties: ${specialtiesStr}
- Description: ${prospectContext.description ?? 'No description available'}

Evidence gathered from their public web presence:
${evidenceLines || 'No specific evidence snippets available — reason from company context only.'}

Based on the company context and evidence above, identify 3 distinct workflow pain hypotheses specific to this company's industry and activities. Each hypothesis must:
- Be specific to marketing/creative/digital agency workflows (NOT construction, field-service, or generic)
- Be grounded in the evidence or company context provided
- Have a workflowTag from this list ONLY: content-production, client-reporting, project-management, lead-intake, creative-briefing, billing, handoff
- Have a confidenceScore between 0.6 and 0.9 reflecting how specifically the evidence supports the pain
- Include 2-3 evidenceRefs (sourceUrls from the evidence list above that support this hypothesis)

Return ONLY a JSON array with exactly this schema:
[
  {
    "title": "...",
    "problemStatement": "...",
    "assumptions": ["...", "..."],
    "validationQuestions": ["...", "..."],
    "workflowTag": "...",
    "confidenceScore": 0.0,
    "evidenceRefs": ["<sourceUrl>", "..."]
  }
]`;

    const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' });
    const response = await model.generateContent(prompt);
    const text = response.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as AIHypothesisItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AI response parsed to empty or non-array');
    }

    // Build a lookup from sourceUrl -> evidence id
    const urlToId = new Map<string, string>(
      evidence.map((item) => [item.sourceUrl, item.id]),
    );

    const fallback = defaultEvidenceRefs(
      evidence.map((item) => ({
        id: item.id,
        sourceType: item.sourceType,
        workflowTag: item.workflowTag,
        confidenceScore: item.confidenceScore,
      })),
    );

    return parsed.map((item): HypothesisDraft => {
      // Map evidenceRefs from URLs to IDs
      const resolvedRefs = (item.evidenceRefs ?? [])
        .map((ref: string) => urlToId.get(ref))
        .filter((id): id is string => id !== undefined);
      const evidenceRefIds = resolvedRefs.length > 0 ? resolvedRefs : fallback;

      const workflowTag = VALID_WORKFLOW_TAGS.has(item.workflowTag)
        ? item.workflowTag
        : 'project-management';

      const confidenceScore =
        typeof item.confidenceScore === 'number' &&
        item.confidenceScore >= 0.5 &&
        item.confidenceScore <= 1.0
          ? item.confidenceScore
          : 0.7;

      // workflowTag is used internally by AI but not part of HypothesisDraft schema
      void workflowTag;

      return {
        title: String(item.title ?? 'Untitled hypothesis'),
        problemStatement: String(item.problemStatement ?? ''),
        assumptions: Array.isArray(item.assumptions)
          ? item.assumptions.map(String)
          : [],
        confidenceScore,
        evidenceRefs: evidenceRefIds,
        validationQuestions: Array.isArray(item.validationQuestions)
          ? item.validationQuestions.map(String)
          : [],
        ...METRIC_DEFAULTS,
      };
    });
  } catch (err) {
    console.warn(
      '[generateHypothesisDraftsAI] AI generation failed, falling back to templates:',
      err instanceof Error ? err.message : err,
    );
    return generateFallbackHypothesisDrafts(
      evidence.map((item) => ({
        id: item.id,
        sourceType: item.sourceType,
        workflowTag: item.workflowTag,
        confidenceScore: item.confidenceScore,
      })),
    );
  }
}

// Keep backward-compat export so callers can still import generateHypothesisDrafts
// until they are updated to use generateHypothesisDraftsAI.
export { generateFallbackHypothesisDrafts as generateHypothesisDrafts };

function generateFallbackHypothesisDrafts(
  evidence: EvidenceInput[],
): HypothesisDraft[] {
  const fallback = defaultEvidenceRefs(evidence);
  const planningRefs = selectEvidenceIdsByTag(evidence, 'planning', fallback);
  const handoffRefs = selectEvidenceIdsByTag(evidence, 'handoff', fallback);
  const billingRefs = selectEvidenceIdsByTag(evidence, 'billing', fallback);

  return [
    {
      title: 'Planning bottleneck between requests and execution',
      problemStatement:
        'Intake, planning, and dispatch likely involve manual coordination across tools, creating avoidable delay before execution starts.',
      assumptions: [
        'Planning is distributed across inboxes, calls, and spreadsheets',
        'Priority changes are handled ad hoc by coordinators',
      ],
      confidenceScore: 0.76,
      evidenceRefs: planningRefs,
      validationQuestions: [
        'How long does planning-to-start typically take?',
        'How many handoffs happen before a job is confirmed?',
      ],
      hoursSavedWeekLow: 6,
      hoursSavedWeekMid: 10,
      hoursSavedWeekHigh: 16,
      handoffSpeedGainPct: 28,
      errorReductionPct: 21,
      revenueLeakageRecoveredLow: 450,
      revenueLeakageRecoveredMid: 900,
      revenueLeakageRecoveredHigh: 1800,
    },
    {
      title: 'Office-to-field handoff creates rework',
      problemStatement:
        'Operational handoffs likely lose context, causing rework, duplicate communication, and delays in delivery updates.',
      assumptions: [
        'Delivery details are re-entered multiple times',
        'Status reporting depends on manual follow-up',
      ],
      confidenceScore: 0.74,
      evidenceRefs: handoffRefs,
      validationQuestions: [
        'Where is job context re-entered or clarified most often?',
        'How many daily updates are chased manually?',
      ],
      hoursSavedWeekLow: 4,
      hoursSavedWeekMid: 8,
      hoursSavedWeekHigh: 14,
      handoffSpeedGainPct: 33,
      errorReductionPct: 18,
      revenueLeakageRecoveredLow: 350,
      revenueLeakageRecoveredMid: 700,
      revenueLeakageRecoveredHigh: 1450,
    },
    {
      title: 'Quote-to-invoice workflow leaks margin',
      problemStatement:
        'Scope changes, approvals, and invoicing transitions likely introduce missed billable work and delayed cash collection.',
      assumptions: [
        'Change orders are tracked outside a single system',
        'Invoice readiness is checked manually',
      ],
      confidenceScore: 0.72,
      evidenceRefs: billingRefs,
      validationQuestions: [
        'How often are changes implemented before being invoiced?',
        'What is average delay between job completion and invoice send?',
      ],
      hoursSavedWeekLow: 3,
      hoursSavedWeekMid: 6,
      hoursSavedWeekHigh: 12,
      handoffSpeedGainPct: 24,
      errorReductionPct: 16,
      revenueLeakageRecoveredLow: 600,
      revenueLeakageRecoveredMid: 1400,
      revenueLeakageRecoveredHigh: 3000,
    },
  ];
}

export function generateOpportunityDrafts(
  evidence: EvidenceInput[],
): OpportunityDraft[] {
  const fallback = defaultEvidenceRefs(evidence);
  const intakeRefs = selectEvidenceIdsByTag(evidence, 'lead-intake', fallback);
  const reportingRefs = selectEvidenceIdsByTag(
    evidence,
    'field-reporting',
    fallback,
  );

  return [
    {
      title: 'Smart intake and routing copilot',
      description:
        'Automate intake qualification, priority assignment, and next-step routing so requests are triaged in minutes instead of hours.',
      assumptions: [
        'Incoming requests are currently triaged manually',
        'Routing rules can be formalized',
      ],
      confidenceScore: 0.75,
      evidenceRefs: intakeRefs,
      hoursSavedWeekLow: 4,
      hoursSavedWeekMid: 7,
      hoursSavedWeekHigh: 12,
      handoffSpeedGainPct: 31,
      errorReductionPct: 19,
      revenueLeakageRecoveredLow: 300,
      revenueLeakageRecoveredMid: 800,
      revenueLeakageRecoveredHigh: 1500,
    },
    {
      title: 'Field-to-invoice workflow automation',
      description:
        'Standardize completion reporting, approval checks, and invoice readiness so closed work turns into billable output faster.',
      assumptions: [
        'Completion data is available but fragmented',
        'Invoice prerequisites can be validated with rules',
      ],
      confidenceScore: 0.73,
      evidenceRefs: reportingRefs,
      hoursSavedWeekLow: 5,
      hoursSavedWeekMid: 9,
      hoursSavedWeekHigh: 15,
      handoffSpeedGainPct: 36,
      errorReductionPct: 22,
      revenueLeakageRecoveredLow: 700,
      revenueLeakageRecoveredMid: 1500,
      revenueLeakageRecoveredHigh: 3200,
    },
  ];
}

function formatEuro(value: number): string {
  return `EUR ${Math.round(value).toLocaleString('nl-NL')}`;
}

function metricsFromHypotheses(hypotheses: WorkflowHypothesis[]): {
  hoursSavedWeek: number;
  handoffSpeedGainPct: number;
  errorReductionPct: number;
  leakageRecoveredEur: number;
} {
  const hoursSavedWeek = Math.round(
    average(
      hypotheses.map((h) => h.hoursSavedWeekMid ?? h.hoursSavedWeekLow ?? 0),
    ) * hypotheses.length,
  );
  const handoffSpeedGainPct = Math.round(
    average(hypotheses.map((h) => h.handoffSpeedGainPct ?? 0)),
  );
  const errorReductionPct = Math.round(
    average(hypotheses.map((h) => h.errorReductionPct ?? 0)),
  );
  const leakageRecoveredEur = Math.round(
    hypotheses.reduce(
      (sum, h) =>
        sum +
        (h.revenueLeakageRecoveredMid ?? h.revenueLeakageRecoveredLow ?? 0),
      0,
    ),
  );
  return {
    hoursSavedWeek,
    handoffSpeedGainPct,
    errorReductionPct,
    leakageRecoveredEur,
  };
}

export function createWorkflowLossMapDraft(
  prospect: ProspectForEngine,
  hypotheses: WorkflowHypothesis[],
  opportunities: AutomationOpportunity[],
  proofTitles: string[],
  bookingUrl?: string,
): WorkflowLossMapDraft {
  const companyName = prospect.companyName ?? prospect.domain;
  const metrics = metricsFromHypotheses(hypotheses);

  const hypothesisLines = hypotheses
    .slice(0, 3)
    .map((h, idx) => `${idx + 1}. ${h.title} — ${h.problemStatement}`)
    .join('\n');

  const opportunityLines = opportunities
    .slice(0, 2)
    .map((o, idx) => `${idx + 1}. ${o.title} — ${o.description}`)
    .join('\n');

  const proofLines =
    proofTitles.length > 0
      ? proofTitles
          .slice(0, 4)
          .map((title) => `- ${title}`)
          .join('\n')
      : '- Custom implementation plan based on validated bottlenecks';

  const bookingLine = bookingUrl ? `Book directly: ${bookingUrl}` : '';
  const markdown = `# Workflow Loss Map — ${companyName}

## Offer
${WORKFLOW_OFFER_NAME}

## Expected business outcomes
- Hours saved/week: **${metrics.hoursSavedWeek}**
- Handoff speed improvement: **${metrics.handoffSpeedGainPct}%**
- Error reduction: **${metrics.errorReductionPct}%**
- Revenue leakage fixed (estimate): **${formatEuro(metrics.leakageRecoveredEur)}**

## Top bottlenecks
${hypothesisLines}

## Top automation opportunities
${opportunityLines}

## Relevant proof
${proofLines}

## Next step
${CTA_STEP_1}
${CTA_STEP_2}
${bookingLine}
`;

  const html = markdown
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
      if (/^\d+\.\s/.test(line))
        return `<li>${line.replace(/^\d+\.\s/, '')}</li>`;
      if (!line.trim()) return '<br />';
      return `<p>${line}</p>`;
    })
    .join('\n');

  const emailSubject = `${companyName}: Workflow Optimization Sprint voorstel`;
  const emailBodyText = `Hi,

${CTA_STEP_1}

Ik heb de grootste workflow-lekken en 2 concrete verbeterkansen uitgewerkt voor ${companyName}, inclusief verwachte impact op uren, overdrachtssnelheid en fouten.

${CTA_STEP_2}
${bookingLine ? `${bookingLine}` : ''}

Groet,
Romano`;

  const emailBodyHtml = `<p>Hi,</p>
<p>${CTA_STEP_1}</p>
<p>Ik heb de grootste workflow-lekken en 2 concrete verbeterkansen uitgewerkt voor <strong>${companyName}</strong>, inclusief verwachte impact op uren, overdrachtssnelheid en fouten.</p>
<p><strong>${CTA_STEP_2}</strong></p>
${bookingLine ? `<p><a href="${bookingUrl}">${bookingLine}</a></p>` : ''}
<p>Groet,<br />Romano</p>`;

  const demoScript = `Mini-demo script (${companyName})
1. Toon waar intake/planning vastloopt.
2. Laat zien hoe routing en handoffs automatisch verlopen.
3. Sluit af met impact: ${metrics.hoursSavedWeek} uur/week en ${formatEuro(metrics.leakageRecoveredEur)} leakage-recovery potentieel.`;

  return {
    title: `Workflow Loss Map — ${companyName}`,
    markdown,
    html,
    emailSubject,
    emailBodyText,
    emailBodyHtml,
    demoScript,
    metrics,
  };
}

export function createOutreachSequenceSteps(
  contactFirstName: string,
  companyName: string,
  lossMapUrl: string,
  bookingUrl?: string,
): Array<{
  order: number;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}> {
  const bookingLine = bookingUrl ? `Boek direct: ${bookingUrl}` : '';
  const introBody = `Hi ${contactFirstName},

${CTA_STEP_1}
Je kunt hem hier bekijken: ${lossMapUrl}

Kernimpact:
- urenbesparing per week
- snellere overdracht
- minder fouten
- minder revenue leakage

${CTA_STEP_2}
${bookingLine}

Groet,
Romano`;

  const followupProof = `Hi ${contactFirstName},

Korte follow-up op de Workflow Loss Map voor ${companyName}.

Ik kan in 15 minuten exact laten zien welke 2 workflows je als eerste wilt aanpakken en waarom die de snelste business-impact geven.

${CTA_STEP_2}
${bookingLine}

Groet,
Romano`;

  const followupTeardown = `Hi ${contactFirstName},

Als het helpt, loop ik live door een mini-teardown:
1) waar tijd nu lekt,
2) wat je als eerste automatiseert,
3) wat dat oplevert in uren/week en foutreductie.

${CTA_STEP_2}
${bookingLine}

Groet,
Romano`;

  return [
    {
      order: 1,
      subject: `${companyName} — Workflow Loss Map`,
      bodyText: introBody,
      bodyHtml: introBody.replace(/\n/g, '<br />'),
    },
    {
      order: 2,
      subject: `${companyName} — snelste workflow impact`,
      bodyText: followupProof,
      bodyHtml: followupProof.replace(/\n/g, '<br />'),
    },
    {
      order: 3,
      subject: `${companyName} — 15 min teardown`,
      bodyText: followupTeardown,
      bodyHtml: followupTeardown.replace(/\n/g, '<br />'),
    },
  ];
}

export interface CallPrepDraft {
  summary: string;
  plan30: Array<{ focus: string; actions: string[] }>;
  plan60: Array<{ focus: string; actions: string[] }>;
  plan90: Array<{ focus: string; actions: string[] }>;
  stakeholderMap: Array<{ role: string; objective: string }>;
  discoveryQuestions: string[];
  riskList: string[];
  demoFlow: string[];
}

export function createCallPrepDraft(
  prospect: ProspectForEngine,
  hypotheses: WorkflowHypothesis[],
  opportunities: AutomationOpportunity[],
): CallPrepDraft {
  const companyName = prospect.companyName ?? prospect.domain;
  const topHypothesis = hypotheses[0];
  const topOpportunity = opportunities[0];

  return {
    summary: `30/60/90 workflow optimizer plan for ${companyName}. Focus starts with bottleneck "${topHypothesis?.title ?? 'planning and handoff'}" and scales through "${topOpportunity?.title ?? 'workflow automation'}".`,
    plan30: [
      {
        focus: 'Diagnose and baseline',
        actions: [
          'Validate top 3 bottlenecks with process owners',
          'Measure current hours/week, handoff delay, and error rate',
          'Define rollout scope for first quick-win workflow',
        ],
      },
    ],
    plan60: [
      {
        focus: 'Pilot and stabilize',
        actions: [
          'Launch quick-fix automation pilot',
          'Implement workflow KPI board (speed, errors, leakage)',
          'Run weekly optimization review with operations lead',
        ],
      },
    ],
    plan90: [
      {
        focus: 'Scale and institutionalize',
        actions: [
          'Expand pilot into cross-team workflow standard',
          'Automate quote-to-invoice checkpoints',
          'Embed continuous improvement cadence and ownership',
        ],
      },
    ],
    stakeholderMap: [
      { role: 'Owner/Directie', objective: 'Margin protection and throughput' },
      {
        role: 'Operations lead',
        objective: 'Planning and handoff reliability',
      },
      { role: 'Finance', objective: 'Invoice speed and leakage control' },
    ],
    discoveryQuestions: [
      'Where is work re-entered most often between teams?',
      'What handoff waits the longest each week?',
      'Where do missed billables or delays happen today?',
    ],
    riskList: [
      'Process changes without explicit owner',
      'Missing baseline metrics before automation rollout',
      'Tool sprawl causing partial adoption',
    ],
    demoFlow: [
      'Current-state process walkthrough',
      'Bottleneck-to-opportunity mapping',
      'Live mini-demo of first automation path',
      'Expected impact and rollout decision',
    ],
  };
}

interface InventoryRoot {
  items?: Array<{
    item_id?: string;
    name?: string;
    description?: string;
    use_cases?: string[];
    source_files?: string[];
  }>;
}

interface ClientOffersRoot {
  offers?: Array<{
    offer_id?: string;
    title?: string;
    value?: string;
    ideal_for?: string;
    example_capabilities?: string[];
    client_outcomes?: string[];
    proof_examples?: string[];
  }>;
}

export async function readJsonSafe(path: string | undefined): Promise<unknown> {
  if (!path) return null;
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

export function inventoryToCandidates(payload: unknown): ProofCandidate[] {
  const root = payload as InventoryRoot | null;
  if (!root?.items) return [];
  return root.items
    .filter((item) => item.name && item.description)
    .map((item, idx) => {
      const title = item.name ?? `Inventory item ${idx + 1}`;
      const summary = item.description ?? '';
      const filePath = item.source_files?.[0] ?? '';
      return {
        sourceType: 'inventory' as const,
        proofId: item.item_id ?? `inv-${idx + 1}`,
        title,
        summary,
        url: filePath ? `obsidian://${filePath}` : null,
        shipped: true,
        keywords: toTokens(
          [title, summary, ...(item.use_cases ?? [])].join(' '),
        ),
      };
    });
}

export function offersToCandidates(payload: unknown): ProofCandidate[] {
  const root = payload as ClientOffersRoot | null;
  if (!root?.offers) return [];
  return root.offers
    .filter((offer) => offer.title && offer.value)
    .map((offer, idx) => {
      const title = offer.title ?? `Offer ${idx + 1}`;
      const summary = offer.value ?? '';
      return {
        sourceType: 'client_offers' as const,
        proofId: offer.offer_id ?? `offer-${idx + 1}`,
        title,
        summary,
        url: null,
        shipped: true,
        keywords: toTokens(
          [
            title,
            summary,
            offer.ideal_for ?? '',
            ...(offer.example_capabilities ?? []),
            ...(offer.client_outcomes ?? []),
            ...(offer.proof_examples ?? []),
          ].join(' '),
        ),
      };
    });
}

type UseCaseRecord = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  isShipped: boolean;
  externalUrl: string | null;
};

async function scoreWithClaude(
  useCases: UseCaseRecord[],
  query: string,
  limit: number,
): Promise<ProofMatchResult[]> {
  try {
    const useCaseList = useCases
      .map(
        (uc, i) =>
          `${i + 1}. [${uc.id}] ${uc.title}: ${uc.summary}. Tags: ${uc.tags.join(', ')}`,
      )
      .join('\n');

    const model = getGenAI().getGenerativeModel({
      model: 'gemini-2.0-flash',
    });
    const response = await model.generateContent(
      `Score each use case for relevance to the prospect's pain point. Return ONLY a JSON array, no other text.

Pain point: ${query}

Use cases:
${useCaseList}

Return JSON array: [{"id": "...", "score": 0.0}]
Higher score = more relevant. 0.0 = no relevance. Be generous with partial matches — Dutch and English terms for the same concept should match (e.g., "facturering" matches "invoice automation").`,
    );

    const text = response.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');

    const scores = JSON.parse(jsonMatch[0]) as Array<{
      id: string;
      score: number;
    }>;
    const scoreMap = new Map(scores.map((s) => [s.id, s.score]));

    return useCases
      .map((uc) => ({
        sourceType: 'use_case',
        proofId: uc.id,
        proofTitle: uc.title,
        proofSummary: uc.summary,
        proofUrl: uc.externalUrl,
        score: round2(scoreMap.get(uc.id) ?? 0),
        isRealShipped: uc.isShipped,
        isCustomPlan: false,
      }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch {
    // Fallback to keyword scoring if Claude fails
    return fallbackKeywordScore(useCases, query, limit);
  }
}

function fallbackKeywordScore(
  useCases: UseCaseRecord[],
  query: string,
  limit: number,
): ProofMatchResult[] {
  const queryTokens = toTokens(query);
  return useCases
    .map((uc) => {
      const candidateTokens = new Set(
        toTokens([uc.title, uc.summary, ...uc.tags].join(' ')),
      );
      const overlap = queryTokens.filter((t) => candidateTokens.has(t)).length;
      const score =
        queryTokens.length > 0 ? round2(overlap / queryTokens.length) : 0;
      return {
        sourceType: 'use_case',
        proofId: uc.id,
        proofTitle: uc.title,
        proofSummary: uc.summary,
        proofUrl: uc.externalUrl,
        score,
        isRealShipped: uc.isShipped,
        isCustomPlan: false,
      };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function matchProofs(
  db: PrismaClient,
  query: string,
  limit = 4,
): Promise<ProofMatchResult[]> {
  const useCases = await db.useCase.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      summary: true,
      tags: true,
      isShipped: true,
      externalUrl: true,
    },
  });

  if (useCases.length === 0) {
    return [
      {
        sourceType: 'custom',
        proofId: 'custom-plan',
        proofTitle: 'Custom build plan',
        proofSummary:
          'No direct shipped match found. Position as a tailored build informed by validated bottlenecks.',
        proofUrl: null,
        score: 0.2,
        isRealShipped: false,
        isCustomPlan: true,
      },
    ];
  }

  const results = await scoreWithClaude(useCases, query, limit);

  if (results.length === 0) {
    return [
      {
        sourceType: 'custom',
        proofId: 'custom-plan',
        proofTitle: 'Custom build plan',
        proofSummary:
          'No direct shipped match found. Position as a tailored build informed by validated bottlenecks.',
        proofUrl: null,
        score: 0.2,
        isRealShipped: false,
        isCustomPlan: true,
      },
    ];
  }

  return results;
}

export function runSummaryPayload(
  gate: QualityGateResult,
  campaign: CampaignForEngine | null,
  options?: {
    diagnostics?: Array<{
      source: string;
      status: 'ok' | 'warning' | 'error' | 'skipped';
      message: string;
    }>;
  },
): Record<string, unknown> {
  return {
    gate,
    diagnostics: options?.diagnostics ?? [],
    campaign: campaign
      ? {
          id: campaign.id,
          name: campaign.name,
          nicheKey: campaign.nicheKey,
          strictGate: campaign.strictGate,
        }
      : null,
    offer: WORKFLOW_OFFER_NAME,
    ctaStep1: CTA_STEP_1,
    ctaStep2: CTA_STEP_2,
    bookingUrl: env.NEXT_PUBLIC_CALCOM_BOOKING_URL ?? null,
  };
}
