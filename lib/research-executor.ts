import {
  evaluateQualityGate,
  generateEvidenceDrafts,
  inferSourceType,
  generateHypothesisDrafts,
  generateOpportunityDrafts,
  runSummaryPayload,
} from '@/lib/workflow-engine';
import { ingestReviewEvidenceDrafts } from '@/lib/review-adapters';
import { ingestWebsiteEvidenceDrafts } from '@/lib/web-evidence-adapter';
import {
  discoverSerpUrls,
  type SerpDiscoveryResult,
} from '@/lib/enrichment/serp';
import { ingestCrawl4aiEvidenceDrafts } from '@/lib/enrichment/crawl4ai';
import type { Prisma, PrismaClient } from '@prisma/client';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function manualUrlsFromSnapshot(snapshot: unknown): string[] {
  const payload = snapshot as { manualUrls?: unknown } | null;
  if (!payload?.manualUrls || !Array.isArray(payload.manualUrls)) return [];
  return payload.manualUrls.filter(
    (item): item is string => typeof item === 'string',
  );
}

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
}

function defaultResearchUrls(domain: string): string[] {
  const base = `https://${domain}`;
  return [
    `${base}`,
    `${base}/careers`,
    `${base}/jobs`,
    `${base}/docs`,
    `${base}/help`,
  ];
}

function extractSerpCache(snapshot: unknown): SerpDiscoveryResult | null {
  const payload = snapshot as { serpCache?: SerpDiscoveryResult } | null;
  if (!payload?.serpCache?.discoveredAt) return null;
  return payload.serpCache;
}

function dedupeEvidenceDrafts<
  T extends { sourceUrl: string; workflowTag: string; snippet: string },
>(drafts: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const draft of drafts) {
    const key = `${draft.sourceUrl}|${draft.workflowTag}|${draft.snippet.toLowerCase().slice(0, 140)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(draft);
  }
  return unique;
}

export async function executeResearchRun(
  db: PrismaClient,
  input: {
    prospectId: string;
    campaignId?: string;
    manualUrls: string[];
    existingRunId?: string;
    deepCrawl?: boolean;
  },
) {
  const prospect = await db.prospect.findUniqueOrThrow({
    where: { id: input.prospectId },
    select: {
      id: true,
      domain: true,
      companyName: true,
      industry: true,
      employeeRange: true,
      description: true,
      technologies: true,
      specialties: true,
    },
  });

  const campaign = input.campaignId
    ? await db.campaign.findUnique({
        where: { id: input.campaignId },
        select: {
          id: true,
          name: true,
          nicheKey: true,
          language: true,
          tone: true,
          strictGate: true,
        },
      })
    : null;

  const run = input.existingRunId
    ? await db.researchRun.update({
        where: { id: input.existingRunId },
        data: {
          status: 'CRAWLING',
          startedAt: new Date(),
          completedAt: null,
          error: null,
          inputSnapshot: toJson({
            manualUrls: input.manualUrls,
            campaignId: input.campaignId,
            deepCrawl: input.deepCrawl ?? false,
          }),
        },
      })
    : await db.researchRun.create({
        data: {
          prospectId: input.prospectId,
          campaignId: input.campaignId,
          status: 'CRAWLING',
          startedAt: new Date(),
          inputSnapshot: toJson({
            manualUrls: input.manualUrls,
            campaignId: input.campaignId,
            deepCrawl: input.deepCrawl ?? false,
          }),
        },
      });

  const reviewUrls = input.manualUrls.filter(
    (url) => inferSourceType(url) === 'REVIEWS',
  );
  const nonReviewManualUrls = input.manualUrls.filter(
    (url) => inferSourceType(url) !== 'REVIEWS',
  );
  const researchUrls = uniqueUrls([
    ...defaultResearchUrls(prospect.domain),
    ...nonReviewManualUrls,
  ]);
  const websiteEvidenceDrafts = await ingestWebsiteEvidenceDrafts(researchUrls);
  const baseEvidenceDrafts = generateEvidenceDrafts(
    prospect,
    nonReviewManualUrls,
  );
  const reviewEvidenceDrafts = await ingestReviewEvidenceDrafts(reviewUrls);

  const allDrafts = [
    ...reviewEvidenceDrafts,
    ...websiteEvidenceDrafts,
    ...baseEvidenceDrafts,
  ];

  if (input.deepCrawl) {
    // Check cache (24-hour TTL)
    const existingSnapshot = input.existingRunId
      ? (
          await db.researchRun.findUnique({
            where: { id: input.existingRunId },
            select: { inputSnapshot: true },
          })
        )?.inputSnapshot
      : null;
    const serpCache = extractSerpCache(existingSnapshot);
    const isCacheValid =
      serpCache &&
      Date.now() - new Date(serpCache.discoveredAt).getTime() <
        24 * 60 * 60 * 1000;

    const serpResult: SerpDiscoveryResult = isCacheValid
      ? serpCache
      : await discoverSerpUrls({
          companyName: prospect.companyName,
          domain: prospect.domain,
        });

    // Persist cache in inputSnapshot for future retries
    if (!isCacheValid) {
      await db.researchRun.update({
        where: { id: run.id },
        data: {
          inputSnapshot: toJson({
            manualUrls: input.manualUrls,
            campaignId: input.campaignId,
            deepCrawl: true,
            serpCache: serpResult,
          }),
        },
      });
    }

    // Extract content via Crawl4AI for discovered URLs
    const serpUrls = [...serpResult.reviewUrls, ...serpResult.jobUrls];
    if (serpUrls.length > 0) {
      const serpEvidenceDrafts = await ingestCrawl4aiEvidenceDrafts(serpUrls);
      allDrafts.push(...serpEvidenceDrafts);
    }
  }

  const evidenceDrafts = dedupeEvidenceDrafts(allDrafts).slice(0, 24);

  const evidenceRecords: Array<{
    id: string;
    sourceType: Prisma.EvidenceItemGetPayload<{
      select: { sourceType: true };
    }>['sourceType'];
    sourceUrl: string;
    title: string | null;
    snippet: string;
    workflowTag: string;
    confidenceScore: number;
  }> = [];

  for (const draft of evidenceDrafts) {
    const record = await db.evidenceItem.create({
      data: {
        researchRunId: run.id,
        prospectId: input.prospectId,
        sourceType: draft.sourceType,
        sourceUrl: draft.sourceUrl,
        title: draft.title,
        snippet: draft.snippet,
        workflowTag: draft.workflowTag,
        confidenceScore: draft.confidenceScore,
        metadata: draft.metadata ? toJson(draft.metadata) : undefined,
      },
      select: {
        id: true,
        sourceType: true,
        sourceUrl: true,
        title: true,
        snippet: true,
        workflowTag: true,
        confidenceScore: true,
      },
    });
    evidenceRecords.push(record);
  }

  const gate = evaluateQualityGate(
    evidenceRecords.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      workflowTag: item.workflowTag,
      confidenceScore: item.confidenceScore,
    })),
  );

  const hypotheses = generateHypothesisDrafts(
    evidenceRecords.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      workflowTag: item.workflowTag,
      confidenceScore: item.confidenceScore,
    })),
  );
  for (const hypothesis of hypotheses) {
    await db.workflowHypothesis.create({
      data: {
        researchRunId: run.id,
        prospectId: input.prospectId,
        title: hypothesis.title,
        problemStatement: hypothesis.problemStatement,
        assumptions: toJson(hypothesis.assumptions),
        confidenceScore: hypothesis.confidenceScore,
        evidenceRefs: toJson(hypothesis.evidenceRefs),
        validationQuestions: toJson(hypothesis.validationQuestions),
        hoursSavedWeekLow: hypothesis.hoursSavedWeekLow,
        hoursSavedWeekMid: hypothesis.hoursSavedWeekMid,
        hoursSavedWeekHigh: hypothesis.hoursSavedWeekHigh,
        handoffSpeedGainPct: hypothesis.handoffSpeedGainPct,
        errorReductionPct: hypothesis.errorReductionPct,
        revenueLeakageRecoveredLow: hypothesis.revenueLeakageRecoveredLow,
        revenueLeakageRecoveredMid: hypothesis.revenueLeakageRecoveredMid,
        revenueLeakageRecoveredHigh: hypothesis.revenueLeakageRecoveredHigh,
      },
    });
  }

  const opportunities = generateOpportunityDrafts(
    evidenceRecords.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      workflowTag: item.workflowTag,
      confidenceScore: item.confidenceScore,
    })),
  );
  for (const opportunity of opportunities) {
    await db.automationOpportunity.create({
      data: {
        researchRunId: run.id,
        prospectId: input.prospectId,
        title: opportunity.title,
        description: opportunity.description,
        assumptions: toJson(opportunity.assumptions),
        confidenceScore: opportunity.confidenceScore,
        evidenceRefs: toJson(opportunity.evidenceRefs),
        hoursSavedWeekLow: opportunity.hoursSavedWeekLow,
        hoursSavedWeekMid: opportunity.hoursSavedWeekMid,
        hoursSavedWeekHigh: opportunity.hoursSavedWeekHigh,
        handoffSpeedGainPct: opportunity.handoffSpeedGainPct,
        errorReductionPct: opportunity.errorReductionPct,
        revenueLeakageRecoveredLow: opportunity.revenueLeakageRecoveredLow,
        revenueLeakageRecoveredMid: opportunity.revenueLeakageRecoveredMid,
        revenueLeakageRecoveredHigh: opportunity.revenueLeakageRecoveredHigh,
      },
    });
  }

  const summary = runSummaryPayload(gate, campaign);
  const completed = await db.researchRun.update({
    where: { id: run.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      summary: toJson(summary),
    },
  });

  return {
    run: completed,
    gate,
    counts: {
      evidence: evidenceRecords.length,
      hypotheses: hypotheses.length,
      opportunities: opportunities.length,
    },
  };
}
