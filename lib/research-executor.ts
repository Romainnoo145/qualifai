import {
  evaluateQualityGate,
  generateEvidenceDrafts,
  inferSourceType,
  generateHypothesisDraftsAI,
  generateOpportunityDrafts,
  runSummaryPayload,
} from '@/lib/workflow-engine';
import { ingestReviewEvidenceDrafts } from '@/lib/review-adapters';
import { ingestWebsiteEvidenceDrafts } from '@/lib/web-evidence-adapter';
import {
  discoverSerpUrls,
  discoverGoogleSearchMentions,
  type SerpDiscoveryResult,
} from '@/lib/enrichment/serp';
import {
  ingestCrawl4aiEvidenceDrafts,
  extractMarkdown,
} from '@/lib/enrichment/crawl4ai';
import {
  discoverSitemapUrls,
  type SitemapCache,
} from '@/lib/enrichment/sitemap';
import { fetchKvkData, kvkDataToEvidenceDraft } from '@/lib/enrichment/kvk';
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

function extractSitemapCache(snapshot: unknown): SitemapCache | null {
  const payload = snapshot as { sitemapCache?: SitemapCache } | null;
  if (!payload?.sitemapCache?.discoveredAt) return null;
  return payload.sitemapCache;
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

type SourceStatus = 'ok' | 'warning' | 'error' | 'skipped';

interface SourceDiagnostic {
  source:
    | 'sitemap'
    | 'website'
    | 'reviews'
    | 'serp'
    | 'crawl4ai'
    | 'google_mentions'
    | 'kvk'
    | 'linkedin';
  status: SourceStatus;
  message: string;
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
      linkedinUrl: true, // for EVID-08 LinkedIn evidence
    },
  });

  // Pre-read existing snapshot for sitemap cache BEFORE run create/update overwrites it
  const priorSnapshot = input.existingRunId
    ? (
        await db.researchRun.findUnique({
          where: { id: input.existingRunId },
          select: { inputSnapshot: true },
        })
      )?.inputSnapshot
    : null;
  const sitemapCache = extractSitemapCache(priorSnapshot);
  const isSitemapCacheValid =
    sitemapCache &&
    Date.now() - new Date(sitemapCache.discoveredAt).getTime() <
      24 * 60 * 60 * 1000;

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
  const diagnostics: SourceDiagnostic[] = [];

  // Sitemap discovery — always runs (zero API cost)
  // Cache was pre-read before run create/update
  const sitemapUrls = isSitemapCacheValid
    ? sitemapCache.urls
    : await discoverSitemapUrls(prospect.domain);
  if (sitemapUrls.length > 0) {
    diagnostics.push({
      source: 'sitemap',
      status: 'ok',
      message: `Sitemap discovery found ${sitemapUrls.length} URLs.`,
    });
  } else {
    diagnostics.push({
      source: 'sitemap',
      status: 'warning',
      message: 'No sitemap URLs discovered for this domain.',
    });
  }

  // Build fresh cache object when we actually fetched sitemap
  const freshSitemapCache: SitemapCache | undefined =
    !isSitemapCacheValid && sitemapUrls.length > 0
      ? { discoveredAt: new Date().toISOString(), urls: sitemapUrls }
      : undefined;

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
            ...(freshSitemapCache ? { sitemapCache: freshSitemapCache } : {}),
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
            ...(freshSitemapCache ? { sitemapCache: freshSitemapCache } : {}),
          }),
        },
      });

  const reviewUrls = input.manualUrls.filter(
    (url) => inferSourceType(url) === 'REVIEWS',
  );
  const nonReviewManualUrls = input.manualUrls.filter(
    (url) => inferSourceType(url) !== 'REVIEWS',
  );

  // Use sitemap URLs if available, fall back to guessed paths
  const researchUrls = uniqueUrls(
    sitemapUrls.length > 0
      ? [...sitemapUrls, ...nonReviewManualUrls]
      : [...defaultResearchUrls(prospect.domain), ...nonReviewManualUrls],
  );

  const websiteEvidenceDrafts = await ingestWebsiteEvidenceDrafts(researchUrls);
  if (websiteEvidenceDrafts.length > 0) {
    diagnostics.push({
      source: 'website',
      status: 'ok',
      message: `Website ingestion produced ${websiteEvidenceDrafts.length} evidence items.`,
    });
  } else {
    diagnostics.push({
      source: 'website',
      status: 'warning',
      message: 'Website ingestion returned no evidence.',
    });
  }
  const baseEvidenceDrafts = generateEvidenceDrafts(
    prospect,
    nonReviewManualUrls,
  );
  const reviewEvidenceDrafts = await ingestReviewEvidenceDrafts(reviewUrls);
  if (reviewEvidenceDrafts.length > 0) {
    diagnostics.push({
      source: 'reviews',
      status: 'ok',
      message: `Review ingestion produced ${reviewEvidenceDrafts.length} evidence items.`,
    });
  } else {
    diagnostics.push({
      source: 'reviews',
      status: 'warning',
      message: 'Review ingestion returned no evidence.',
    });
  }

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

    const serpApiConfigured = Boolean(process.env.SERP_API_KEY);
    if (!serpApiConfigured) {
      diagnostics.push({
        source: 'serp',
        status: 'warning',
        message:
          'SERP_API_KEY is not configured; deep discovery sources are limited.',
      });
    }

    const serpResult: SerpDiscoveryResult = isCacheValid
      ? serpCache
      : await discoverSerpUrls({
          companyName: prospect.companyName,
          domain: prospect.domain,
        });
    const serpDiscoveredCount =
      serpResult.reviewUrls.length + serpResult.jobUrls.length;
    if (serpDiscoveredCount > 0) {
      diagnostics.push({
        source: 'serp',
        status: 'ok',
        message: `SERP discovery found ${serpDiscoveredCount} URLs.`,
      });
    } else {
      diagnostics.push({
        source: 'serp',
        status: 'warning',
        message: 'SERP discovery returned no review/job URLs.',
      });
    }

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
            ...(freshSitemapCache ? { sitemapCache: freshSitemapCache } : {}),
          }),
        },
      });
    }

    // Extract content via Crawl4AI for discovered URLs
    const serpUrls = [...serpResult.reviewUrls, ...serpResult.jobUrls];
    if (serpUrls.length > 0) {
      try {
        const serpEvidenceDrafts = await ingestCrawl4aiEvidenceDrafts(serpUrls);
        allDrafts.push(...serpEvidenceDrafts);
        diagnostics.push({
          source: 'crawl4ai',
          status: serpEvidenceDrafts.length > 0 ? 'ok' : 'warning',
          message:
            serpEvidenceDrafts.length > 0
              ? `Crawl4AI produced ${serpEvidenceDrafts.length} evidence items.`
              : 'Crawl4AI returned no evidence for discovered URLs.',
        });
      } catch (err) {
        diagnostics.push({
          source: 'crawl4ai',
          status: 'error',
          message: `Crawl4AI extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    } else {
      diagnostics.push({
        source: 'crawl4ai',
        status: 'skipped',
        message: 'Crawl4AI skipped because no SERP URLs were discovered.',
      });
    }

    // Google search mentions (EVID-07) — 3 queries, gated behind deepCrawl
    try {
      const googleMentions = await discoverGoogleSearchMentions({
        companyName: prospect.companyName,
        domain: prospect.domain,
      });
      for (const mention of googleMentions) {
        allDrafts.push({
          sourceType: 'WEBSITE',
          sourceUrl: mention.url,
          title: mention.title,
          snippet: mention.snippet.slice(0, 240),
          workflowTag: 'workflow-context',
          confidenceScore: 0.71,
          metadata: { adapter: 'serp-google-search', source: 'google-mention' },
        });
      }
      diagnostics.push({
        source: 'google_mentions',
        status: googleMentions.length > 0 ? 'ok' : 'warning',
        message:
          googleMentions.length > 0
            ? `Google mentions produced ${googleMentions.length} evidence items.`
            : 'Google mentions returned no results.',
      });
    } catch (err) {
      console.error('[Google Search] mention discovery failed:', err);
      diagnostics.push({
        source: 'google_mentions',
        status: 'error',
        message: `Google mention discovery failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  } else {
    diagnostics.push({
      source: 'serp',
      status: 'skipped',
      message: 'SERP discovery skipped (deep crawl disabled).',
    });
    diagnostics.push({
      source: 'crawl4ai',
      status: 'skipped',
      message: 'Crawl4AI skipped (deep crawl disabled).',
    });
    diagnostics.push({
      source: 'google_mentions',
      status: 'skipped',
      message: 'Google mention discovery skipped (deep crawl disabled).',
    });
  }

  // KvK registry enrichment (EVID-09) — runs for all Dutch prospects with a companyName
  if (prospect.companyName) {
    if (!process.env.KVK_API_KEY) {
      diagnostics.push({
        source: 'kvk',
        status: 'warning',
        message: 'KVK_API_KEY is not configured; KvK enrichment skipped.',
      });
    } else {
      try {
        const kvkData = await fetchKvkData(prospect.companyName);
        if (kvkData) {
          allDrafts.push(kvkDataToEvidenceDraft(kvkData));
          diagnostics.push({
            source: 'kvk',
            status: 'ok',
            message: 'KvK enrichment returned company profile data.',
          });
        } else {
          diagnostics.push({
            source: 'kvk',
            status: 'warning',
            message: 'KvK enrichment returned no match.',
          });
        }
      } catch (err) {
        console.error('[KvK] enrichment failed, continuing without:', err);
        diagnostics.push({
          source: 'kvk',
          status: 'error',
          message: `KvK enrichment failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    }
  } else {
    diagnostics.push({
      source: 'kvk',
      status: 'skipped',
      message: 'KvK enrichment skipped because company name is missing.',
    });
  }

  // LinkedIn profile evidence from Apollo-derived data (EVID-08 — reliable, no network call)
  const linkedinSnippet = [
    prospect.description,
    prospect.specialties.length > 0
      ? `Specialiteiten: ${prospect.specialties.join(', ')}`
      : null,
    prospect.industry ? `Sector: ${prospect.industry}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  if (linkedinSnippet.length > 0) {
    allDrafts.push({
      sourceType: 'WEBSITE',
      sourceUrl:
        prospect.linkedinUrl ??
        `https://www.linkedin.com/company/${prospect.domain.split('.')[0]}`,
      title: `${prospect.companyName ?? prospect.domain} - Bedrijfsprofiel`,
      snippet: linkedinSnippet.slice(0, 240),
      workflowTag: 'workflow-context',
      confidenceScore: 0.74,
      metadata: { adapter: 'apollo-derived', source: 'linkedin-profile' },
    });
    diagnostics.push({
      source: 'linkedin',
      status: 'ok',
      message: 'LinkedIn context synthesized from Apollo profile data.',
    });
  }

  // LinkedIn browser extraction attempt (EVID-08 — best-effort, often blocked by authwall)
  if (input.deepCrawl && prospect.linkedinUrl) {
    try {
      const { markdown, title } = await extractMarkdown(prospect.linkedinUrl);

      // Detect LinkedIn authwall redirect
      const isAuthwall =
        !markdown ||
        markdown.length < 200 ||
        [
          'authwall',
          'log in to linkedin',
          'join linkedin',
          'sign in',
          'leden login',
        ].some((phrase) => markdown.toLowerCase().includes(phrase));

      if (!isAuthwall) {
        allDrafts.push({
          sourceType: 'WEBSITE',
          sourceUrl: prospect.linkedinUrl,
          title:
            title || `${prospect.companyName ?? prospect.domain} - LinkedIn`,
          snippet: markdown.slice(0, 240).replace(/\n+/g, ' ').trim(),
          workflowTag: 'workflow-context',
          confidenceScore: 0.72,
          metadata: { adapter: 'crawl4ai', source: 'linkedin' },
        });
      } else {
        diagnostics.push({
          source: 'linkedin',
          status: 'warning',
          message:
            'LinkedIn page is behind an auth wall; browser extraction skipped.',
        });
      }
      // If authwall: skip silently — don't create fallback for LinkedIn
    } catch {
      // LinkedIn extraction failure is expected — skip silently
      diagnostics.push({
        source: 'linkedin',
        status: 'warning',
        message:
          'LinkedIn browser extraction failed; using Apollo profile context only.',
      });
    }
  }

  const evidenceDrafts = dedupeEvidenceDrafts(allDrafts).slice(0, 36);

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
    metadata: unknown;
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
        metadata: true,
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
      metadata: item.metadata,
    })),
  );

  const hypotheses = await generateHypothesisDraftsAI(
    evidenceRecords.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      workflowTag: item.workflowTag,
      confidenceScore: item.confidenceScore,
      snippet: item.snippet,
      sourceUrl: item.sourceUrl,
      title: item.title,
    })),
    {
      companyName: prospect.companyName,
      industry: prospect.industry,
      specialties: prospect.specialties,
      description: prospect.description,
    },
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

  const summary = runSummaryPayload(gate, campaign, {
    diagnostics,
  });
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
