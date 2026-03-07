import {
  evaluateQualityGate,
  generateEvidenceDrafts,
  inferSourceType,
  generateHypothesisDraftsAI,
  generateOpportunityDrafts,
  runSummaryPayload,
  reviewSeedUrls,
} from '@/lib/workflow-engine';
import {
  retrieveRagPassages,
  buildRagQueryInputs,
  buildRagQueryInputsFromIntent,
  rankRagPassagesForProspect,
} from '@/lib/rag/retriever';
import { generateDualEvidenceOpportunityDrafts } from '@/lib/rag/opportunity-generator';
import { generatePartnershipAssessment } from '@/lib/partnership/trigger-generator';
import { ingestReviewEvidenceDrafts } from '@/lib/review-adapters';
import { ingestWebsiteEvidenceDrafts } from '@/lib/web-evidence-adapter';
import {
  discoverSerpUrls,
  discoverGoogleSearchMentions,
  type SerpDiscoveryResult,
} from '@/lib/enrichment/serp';
import { discoverSiteUrlsWithKatana } from '@/lib/enrichment/katana';
import { ingestCrawl4aiEvidenceDrafts } from '@/lib/enrichment/crawl4ai';
import { fetchLinkedInPosts } from '@/lib/enrichment/linkedin-posts';
import { fetchGoogleReviews } from '@/lib/enrichment/google-reviews';
import {
  fetchGoogleNewsRss,
  fetchDutchIndustryNews,
} from '@/lib/enrichment/google-news';
import { fetchEmployeeReviews } from '@/lib/enrichment/employee-reviews';
import { fetchLinkedInJobs } from '@/lib/enrichment/linkedin-jobs';
import { fetchCustomerReviews } from '@/lib/enrichment/google-reviews';
import { scoreEvidenceBatch, type ScoredEvidence } from '@/lib/evidence-scorer';
import {
  discoverSitemapUrls,
  type SitemapCandidate,
  type SitemapDiscoveryResult,
  type SitemapCache,
} from '@/lib/enrichment/sitemap';
import {
  detectJsHeavy,
  defaultResearchUrls as defaultResearchUrlsFn,
  type DiscoveredUrl,
  type SourceSet,
} from '@/lib/enrichment/source-discovery';
import {
  selectResearchUrls,
  type CandidateSource,
  type ResearchUrlCandidate,
} from '@/lib/enrichment/url-selection';
import { triggerProspectSiteCatalogSync } from '@/lib/site-catalog';
import { fetchKvkData, kvkDataToEvidenceDraft } from '@/lib/enrichment/kvk';
import { extractIntentVariables } from '@/lib/extraction/intent-extractor';
import type { IntentVariables } from '@/lib/extraction/types';
import { generateMasterAnalysis } from '@/lib/analysis/master-analyzer';
import type { MasterAnalysisInput } from '@/lib/analysis/types';
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

const WEBSITE_TOP_N_MAX = 60;
const INTERACTIVE_WEBSITE_INGESTION = {
  browserBudgetMax: 12,
  maxDrafts: 40,
  targetUniqueSourceUrls: 30,
} as const;
const DEEP_WEBSITE_INGESTION = {
  browserBudgetMax: 24,
  maxDrafts: 120,
  targetUniqueSourceUrls: 60,
} as const;
const INTERACTIVE_EVIDENCE_DRAFT_CAP = 60;
const DEEP_EVIDENCE_DRAFT_CAP = 140;

interface WebsiteCandidate extends ResearchUrlCandidate {
  source: CandidateSource;
  topSegment: string;
  pathDepth: number;
  lastmod: string | null;
}

function candidateFromUrl(
  url: string,
  source: CandidateSource,
  lastmod: string | null = null,
): WebsiteCandidate | null {
  try {
    const parsed = new URL(url);
    const topSegment = parsed.pathname.split('/').filter(Boolean)[0] ?? 'root';
    const pathDepth = parsed.pathname.split('/').filter(Boolean).length;
    return {
      url,
      source,
      lastmod,
      topSegment: topSegment.toLowerCase(),
      pathDepth,
    };
  } catch {
    return null;
  }
}

function fallbackSeedUrls(domain: string): string[] {
  return defaultResearchUrlsFn(domain).slice(0, 6);
}

function fallbackReasonFromSitemapStatus(
  status: SitemapDiscoveryResult['status'],
): string | null {
  if (status === 'blocked') return 'sitemap_blocked';
  if (status === 'empty') return 'sitemap_empty';
  if (status === 'error') return 'sitemap_error';
  return null;
}

function normalizeUrlForSelection(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${host}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

function estimateUniqueCandidateCount(candidates: WebsiteCandidate[]): number {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeUrlForSelection(candidate.url);
    if (!normalized) continue;
    seen.add(normalized);
  }
  return seen.size;
}

function computeAdaptiveWebsiteTopN(input: {
  discoveredTotal: number;
  deepCrawl: boolean;
}): number {
  const discoveredTotal = Math.max(0, input.discoveredTotal);
  if (discoveredTotal === 0) return 0;

  const baseline = input.deepCrawl
    ? Math.round(discoveredTotal * 0.2 + 14)
    : Math.round(discoveredTotal * 0.14 + 10);
  const floor = input.deepCrawl ? 20 : 12;
  const clamped = Math.max(floor, Math.min(WEBSITE_TOP_N_MAX, baseline));
  return Math.min(discoveredTotal, clamped);
}

function websiteIngestionTuningForRun(input: {
  deepCrawl: boolean;
  selectedTopN: number;
}) {
  const base = input.deepCrawl
    ? DEEP_WEBSITE_INGESTION
    : INTERACTIVE_WEBSITE_INGESTION;
  return {
    ...base,
    targetUniqueSourceUrls: Math.min(
      base.targetUniqueSourceUrls,
      input.selectedTopN,
    ),
  };
}

function toDiscoveredUrl(candidate: WebsiteCandidate): DiscoveredUrl {
  return {
    url: candidate.url,
    provenance: candidate.source,
    jsHeavyHint: detectJsHeavy(candidate.url),
  };
}

function ensureLegacyRawCountKeys(
  rawCounts: Record<string, { discovered: number; capped: number }>,
): Record<string, { discovered: number; capped: number }> {
  const next = { ...rawCounts };
  if (!next.sitemap) next.sitemap = { discovered: 0, capped: 0 };
  if (!next.serp) next.serp = { discovered: 0, capped: 0 };
  if (!next.default) next.default = { discovered: 0, capped: 0 };
  return next;
}

function buildSourceSetFromSelection(input: {
  selectedCandidates: WebsiteCandidate[];
  discoveredCandidates: WebsiteCandidate[];
  selectedTopN: number;
  sourceUsed: 'sitemap' | 'katana_site' | 'serp_site' | 'fallback';
  fallbackReason: string | null;
  sitemapResult: SitemapDiscoveryResult;
  katanaSiteDiscoveredTotal: number;
  serpSiteDiscoveredTotal: number;
  selection: ReturnType<typeof selectResearchUrls>;
}): SourceSet {
  const discoveredBySource: Record<string, number> = {};
  for (const candidate of input.discoveredCandidates) {
    discoveredBySource[candidate.source] =
      (discoveredBySource[candidate.source] ?? 0) + 1;
  }

  const selectedBySource = input.selection.selectedBySource;
  const rawCounts = ensureLegacyRawCountKeys(
    Object.fromEntries(
      Array.from(
        new Set([
          ...Object.keys(discoveredBySource),
          ...Object.keys(selectedBySource),
          'sitemap',
          'serp',
          'default',
        ]),
      ).map((source) => [
        source,
        {
          discovered: discoveredBySource[source] ?? 0,
          capped: selectedBySource[source] ?? 0,
        },
      ]),
    ),
  );

  const dedupRemovedCount = Math.max(
    0,
    input.discoveredCandidates.length - input.selection.discoveredTotal,
  );

  return {
    urls: input.selectedCandidates.map(toDiscoveredUrl),
    discoveredAt: new Date().toISOString(),
    dedupRemovedCount,
    rawCounts,
    discovery: {
      sourceUsed: input.sourceUsed,
      sitemapStatus: input.sitemapResult.status,
      sitemapErrorCode: input.sitemapResult.errorCode ?? null,
      sitemapDiscoveredTotal: input.sitemapResult.discoveredTotal,
      katanaSiteDiscoveredTotal: input.katanaSiteDiscoveredTotal,
      serpSiteDiscoveredTotal: input.serpSiteDiscoveredTotal,
      fallbackReason: input.fallbackReason,
    },
    selection: {
      strategyVersion: input.selection.strategyVersion,
      topN: input.selectedTopN,
      discoveredTotal: input.selection.discoveredTotal,
      selectedTotal: input.selection.selectedTotal,
      selectedBySource: input.selection.selectedBySource,
      selectedBySegment: input.selection.selectedBySegment,
    },
  };
}

function extractSitemapCache(snapshot: unknown): SitemapCache | null {
  const payload = snapshot as { sitemapCache?: SitemapCache } | null;
  if (!payload?.sitemapCache?.discoveredAt) return null;
  const cache = payload.sitemapCache;

  if (cache.result) return cache;

  // Backwards-compatible hydration for old snapshots where only `urls` existed.
  const legacyUrls = Array.isArray(cache.urls) ? cache.urls : [];
  const hydratedCandidates: SitemapCandidate[] = [];
  for (const url of legacyUrls) {
    const candidate = candidateFromUrl(url, 'sitemap', null);
    if (!candidate) continue;
    const normalized = (() => {
      try {
        const parsed = new URL(candidate.url);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        const path = parsed.pathname.replace(/\/+$/, '') || '/';
        return `${host}${path}${parsed.search}`;
      } catch {
        return candidate.url;
      }
    })();
    hydratedCandidates.push({
      url: candidate.url,
      normalizedUrl: normalized,
      lastmod: null,
      sourceSitemap: 'cache://legacy',
      topSegment: candidate.topSegment,
      pathDepth: candidate.pathDepth,
    });
  }

  return {
    discoveredAt: cache.discoveredAt,
    urls: legacyUrls,
    result: {
      status: hydratedCandidates.length > 0 ? 'ok' : 'empty',
      candidates: hydratedCandidates,
      seedUrls: [],
      crawledSitemaps: [],
      discoveredTotal: hydratedCandidates.length,
    },
  };
}

function extractSerpCache(snapshot: unknown): SerpDiscoveryResult | null {
  const payload = snapshot as { serpCache?: unknown } | null;
  const cache = payload?.serpCache;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return null;
  const record = cache as Record<string, unknown>;
  if (typeof record.discoveredAt !== 'string') return null;

  const reviewUrls = Array.isArray(record.reviewUrls)
    ? record.reviewUrls.filter((u): u is string => typeof u === 'string')
    : [];
  const jobUrls = Array.isArray(record.jobUrls)
    ? record.jobUrls.filter((u): u is string => typeof u === 'string')
    : [];
  const mapsDataId =
    typeof record.mapsDataId === 'string' ? record.mapsDataId : undefined;

  return {
    reviewUrls,
    jobUrls,
    discoveredAt: record.discoveredAt,
    ...(mapsDataId ? { mapsDataId } : {}),
  };
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

function isFallbackEvidenceDraft(
  draft: { metadata?: unknown } | null | undefined,
): boolean {
  const metadata = draft?.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as Record<string, unknown>).fallback === true;
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
    | 'linkedin'
    | 'linkedin_posts'
    | 'google_reviews'
    | 'google_news'
    | 'employee_reviews'
    | 'linkedin_jobs'
    | 'customer_reviews'
    | 'dutch_industry_news'
    | 'evidence_scoring'
    | 'intent_extraction'
    | 'rag_query_strategy'
    | 'rag_retrieval'
    | 'master_analysis';
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
    hypothesisModel?: 'gemini-flash' | 'claude-sonnet';
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
      revenueRange: true,
      country: true,
      city: true,
      description: true,
      technologies: true,
      specialties: true,
      linkedinUrl: true, // for EVID-08 LinkedIn evidence
      project: {
        select: {
          id: true,
          projectType: true,
        },
      },
      spv: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  // Pre-read existing snapshot caches BEFORE run create/update overwrites them.
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
  const priorSerpCache = extractSerpCache(priorSnapshot);
  const serpAge = priorSerpCache?.discoveredAt
    ? Date.now() - new Date(priorSerpCache.discoveredAt).getTime()
    : Infinity;
  const useSerpCache = serpAge < 24 * 60 * 60 * 1000;

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

  const sitemapResult: SitemapDiscoveryResult =
    isSitemapCacheValid && sitemapCache?.result
      ? sitemapCache.result
      : await discoverSitemapUrls(prospect.domain);

  const sitemapStatusToDiagnosticStatus: Record<
    SitemapDiscoveryResult['status'],
    SourceStatus
  > = {
    ok: 'ok',
    blocked: 'warning',
    empty: 'warning',
    error: 'error',
  };
  diagnostics.push({
    source: 'sitemap',
    status: sitemapStatusToDiagnosticStatus[sitemapResult.status],
    message:
      sitemapResult.status === 'ok'
        ? `Sitemap discovery found ${sitemapResult.discoveredTotal} URLs.`
        : `Sitemap discovery status ${sitemapResult.status}${sitemapResult.errorCode ? ` (${sitemapResult.errorCode})` : ''}.`,
  });

  const shouldUseCrawlerFallback =
    sitemapResult.status !== 'ok' || sitemapResult.discoveredTotal === 0;
  const katanaResult = shouldUseCrawlerFallback
    ? await discoverSiteUrlsWithKatana({
        domain: prospect.domain,
        maxResults: 200,
      })
    : { status: 'ok' as const, urls: [] };
  const katanaSiteUrls = katanaResult.status === 'ok' ? katanaResult.urls : [];
  const serpSiteUrls: string[] = [];

  if (shouldUseCrawlerFallback) {
    diagnostics.push({
      source: 'website',
      status: katanaSiteUrls.length > 0 ? 'ok' : 'warning',
      message:
        katanaSiteUrls.length > 0
          ? `Katana fallback found ${katanaSiteUrls.length} crawled website URLs.`
          : katanaResult.status === 'unavailable'
            ? 'Katana fallback unavailable (binary not found); proceeding with manual/seed fallback.'
            : 'Katana fallback returned no usable website URLs; proceeding with manual/seed fallback.',
    });
  }

  const nonReviewManualUrls = input.manualUrls.filter(
    (url) => inferSourceType(url) !== 'REVIEWS',
  );

  let sourceUsed: 'sitemap' | 'katana_site' | 'serp_site' | 'fallback' =
    'fallback';
  if (sitemapResult.status === 'ok' && sitemapResult.discoveredTotal > 0) {
    sourceUsed = 'sitemap';
  } else if (katanaSiteUrls.length > 0) {
    sourceUsed = 'katana_site';
  }

  const discoveredCandidates: WebsiteCandidate[] = [];
  if (sourceUsed === 'sitemap') {
    for (const candidate of sitemapResult.candidates) {
      const mapped = candidateFromUrl(
        candidate.url,
        'sitemap',
        candidate.lastmod,
      );
      if (!mapped) continue;
      discoveredCandidates.push(mapped);
    }
  } else if (sourceUsed === 'katana_site') {
    for (const url of katanaSiteUrls) {
      const mapped = candidateFromUrl(url, 'katana_site', null);
      if (!mapped) continue;
      discoveredCandidates.push(mapped);
    }
  }

  for (const url of nonReviewManualUrls) {
    const mapped = candidateFromUrl(url, 'manual', null);
    if (!mapped) continue;
    discoveredCandidates.push(mapped);
  }

  const fallbackReason = fallbackReasonFromSitemapStatus(sitemapResult.status);
  if (discoveredCandidates.length === 0) {
    sourceUsed = 'fallback';
    for (const url of fallbackSeedUrls(prospect.domain)) {
      const mapped = candidateFromUrl(url, 'seed', null);
      if (!mapped) continue;
      discoveredCandidates.push(mapped);
    }
  }

  const estimatedUniqueCandidates =
    estimateUniqueCandidateCount(discoveredCandidates);
  const selectedTopN = computeAdaptiveWebsiteTopN({
    discoveredTotal: estimatedUniqueCandidates,
    deepCrawl: input.deepCrawl ?? false,
  });

  const selection = selectResearchUrls({
    candidates: discoveredCandidates,
    topN: selectedTopN,
    context: {
      industry: prospect.industry,
      description: prospect.description,
      specialties: prospect.specialties,
      country: prospect.country ?? null,
      nicheKey: campaign?.nicheKey ?? null,
      language: campaign?.language ?? null,
    },
  });

  const selectedCandidates: WebsiteCandidate[] = selection.selectedUrls.map(
    (item) => ({
      url: item.url,
      source: item.source,
      lastmod: item.lastmod ?? null,
      topSegment: item.topSegment ?? 'root',
      pathDepth: item.pathDepth ?? 0,
    }),
  );

  diagnostics.push({
    source: 'website',
    status: selection.selectedTotal > 0 ? 'ok' : 'warning',
    message: `URL selection (${selection.strategyVersion}) targeted ${selectedTopN} and selected ${selection.selectedTotal} of ${selection.discoveredTotal} candidates via ${sourceUsed}.`,
  });

  const initialSourceSet: SourceSet = buildSourceSetFromSelection({
    selectedCandidates,
    discoveredCandidates,
    selectedTopN,
    sourceUsed,
    fallbackReason,
    sitemapResult,
    katanaSiteDiscoveredTotal: katanaSiteUrls.length,
    serpSiteDiscoveredTotal: serpSiteUrls.length,
    selection,
  });

  // Build fresh cache object when we actually fetched sitemap
  const freshSitemapCache: SitemapCache | undefined = !isSitemapCacheValid
    ? {
        discoveredAt: new Date().toISOString(),
        urls: sitemapResult.candidates.map((candidate) => candidate.url),
        result: sitemapResult,
      }
    : undefined;

  const initialInputSnapshot = toJson({
    manualUrls: input.manualUrls,
    campaignId: input.campaignId,
    deepCrawl: input.deepCrawl ?? false,
    hypothesisModel: input.hypothesisModel ?? 'gemini-flash',
    ...(freshSitemapCache ? { sitemapCache: freshSitemapCache } : {}),
    ...(input.deepCrawl && useSerpCache && priorSerpCache
      ? { serpCache: priorSerpCache }
      : {}),
    sourceSet: initialSourceSet,
  });

  const run = input.existingRunId
    ? await db.researchRun.update({
        where: { id: input.existingRunId },
        data: {
          status: 'CRAWLING',
          startedAt: new Date(),
          completedAt: null,
          error: null,
          inputSnapshot: initialInputSnapshot,
        },
      })
    : await db.researchRun.create({
        data: {
          prospectId: input.prospectId,
          campaignId: input.campaignId,
          status: 'CRAWLING',
          startedAt: new Date(),
          inputSnapshot: initialInputSnapshot,
        },
      });

  // Re-runs update the same ResearchRun row.
  // Clear prior generated rows first so stale evidence URLs from older logic
  // do not persist (for example historical guessed /contact|/services pages).
  if (input.existingRunId) {
    await db.$transaction([
      db.evidenceItem.deleteMany({ where: { researchRunId: run.id } }),
      db.workflowHypothesis.deleteMany({ where: { researchRunId: run.id } }),
      db.automationOpportunity.deleteMany({ where: { researchRunId: run.id } }),
    ]);
  }

  triggerProspectSiteCatalogSync(db, {
    prospectId: prospect.id,
    domain: prospect.domain,
    manualUrls: nonReviewManualUrls,
    context: {
      industry: prospect.industry,
      description: prospect.description,
      specialties: prospect.specialties,
      country: prospect.country ?? null,
      nicheKey: campaign?.nicheKey ?? null,
      language: campaign?.language ?? null,
    },
    precomputed: {
      discovery: sitemapResult,
      katanaSiteUrls,
      serpSiteUrls,
      discoveredCandidates,
      selection,
      sourceUsed,
      fallbackReason,
    },
  });

  const manualReviewUrls = input.manualUrls.filter(
    (url) => inferSourceType(url) === 'REVIEWS',
  );
  const seedUrls = reviewSeedUrls(
    prospect.companyName ?? prospect.domain,
    prospect.domain,
  );
  const reviewUrls = uniqueUrls([...manualReviewUrls, ...seedUrls]);
  // Derive researchUrls from selected sourceSet URLs.
  const researchUrls = initialSourceSet.urls.map((u) => u.url);

  const jsHeavyHints = new Map<string, boolean>(
    initialSourceSet.urls.map((u) => [u.url, u.jsHeavyHint]),
  );
  const urlProvenance = new Map(
    initialSourceSet.urls.map((u) => [u.url, u.provenance]),
  );
  const websiteIngestionTuning = websiteIngestionTuningForRun({
    deepCrawl: input.deepCrawl ?? false,
    selectedTopN,
  });
  const websiteEvidenceDrafts = await ingestWebsiteEvidenceDrafts(
    researchUrls,
    {
      jsHeavyHints,
      urlProvenance,
      tuning: websiteIngestionTuning,
    },
  );
  const websiteEvidenceUrlCount = new Set(
    websiteEvidenceDrafts
      .filter((draft) => !isFallbackEvidenceDraft(draft))
      .map((draft) => draft.sourceUrl),
  ).size;
  const websiteFallbackUrlCount = new Set(
    websiteEvidenceDrafts
      .filter((draft) => isFallbackEvidenceDraft(draft))
      .map((draft) => draft.sourceUrl),
  ).size;
  if (websiteEvidenceDrafts.length > 0) {
    const fallbackSuffix =
      websiteFallbackUrlCount > 0
        ? ` (${websiteFallbackUrlCount} fallback placeholders).`
        : '.';
    diagnostics.push({
      source: 'website',
      status: 'ok',
      message: `Website ingestion produced ${websiteEvidenceDrafts.length} evidence items across ${websiteEvidenceUrlCount}/${researchUrls.length} selected URLs${fallbackSuffix}`,
    });
  } else {
    diagnostics.push({
      source: 'website',
      status: 'warning',
      message: `Website ingestion returned no evidence across ${researchUrls.length} selected URLs.`,
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
    const isCacheValid = useSerpCache && priorSerpCache !== null;

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
      ? priorSerpCache
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

    // Persist newly discovered SERP cache without mutating the selected sourceSet.
    if (!isCacheValid) {
      await db.researchRun.update({
        where: { id: run.id },
        data: {
          inputSnapshot: toJson({
            manualUrls: input.manualUrls,
            campaignId: input.campaignId,
            deepCrawl: true,
            hypothesisModel: input.hypothesisModel ?? 'gemini-flash',
            serpCache: serpResult,
            ...(freshSitemapCache ? { sitemapCache: freshSitemapCache } : {}),
            sourceSet: initialSourceSet,
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
          sourceType: 'NEWS',
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

    // Google Reviews via Scrapling (EVID-REVIEWS)
    try {
      const reviewDrafts = await fetchGoogleReviews({
        companyName: prospect.companyName ?? prospect.domain,
        domain: prospect.domain,
        mapsDataId: serpResult.mapsDataId,
      });
      allDrafts.push(...reviewDrafts);
      // Empty result recording — always record the attempt
      if (reviewDrafts.length === 0) {
        allDrafts.push({
          sourceType: 'REVIEWS',
          sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(prospect.companyName ?? prospect.domain)}+reviews`,
          title: `${prospect.companyName ?? prospect.domain} - Google Reviews (geen resultaten)`,
          snippet:
            'Google Reviews scrape did not find review snippets for this company.',
          workflowTag: 'workflow-context',
          confidenceScore: 0.1,
          metadata: { adapter: 'google-reviews-scrapling', notFound: true },
        });
      }
      diagnostics.push({
        source: 'google_reviews',
        status: reviewDrafts.length > 0 ? 'ok' : 'warning',
        message:
          reviewDrafts.length > 0
            ? `Google Reviews found ${reviewDrafts.length} review snippets.`
            : 'Google Reviews returned no results; placeholder recorded.',
      });
    } catch (err) {
      console.error('[Google Reviews] scrape failed:', err);
      diagnostics.push({
        source: 'google_reviews',
        status: 'error',
        message: `Google Reviews scrape failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    // Google News RSS (EVID-NEWS) — company name + industry context
    try {
      const companyNews = await fetchGoogleNewsRss({
        companyName: prospect.companyName ?? prospect.domain,
        domain: prospect.domain,
      });
      allDrafts.push(...companyNews);

      // Industry + AI/automation news for broader context
      if (prospect.industry) {
        const industryNews = await fetchGoogleNewsRss({
          companyName: `${prospect.industry} automatisering AI software`,
          domain: prospect.domain,
        });
        allDrafts.push(...industryNews);
      }

      const newsDrafts = [...companyNews];
      // Empty result recording — always record the attempt
      if (newsDrafts.length === 0) {
        allDrafts.push({
          sourceType: 'NEWS',
          sourceUrl: `https://news.google.com/rss/search?q=${encodeURIComponent(prospect.companyName ?? prospect.domain)}`,
          title: `${prospect.companyName ?? prospect.domain} - Google News (geen resultaten)`,
          snippet:
            'Google News RSS returned no recent news coverage for this company.',
          workflowTag: 'workflow-context',
          confidenceScore: 0.1,
          metadata: { adapter: 'google-news-rss', notFound: true },
        });
      }
      diagnostics.push({
        source: 'google_news',
        status: newsDrafts.length > 0 ? 'ok' : 'warning',
        message:
          newsDrafts.length > 0
            ? `Google News RSS found ${newsDrafts.length} news items.`
            : 'Google News RSS returned no results; placeholder recorded.',
      });
    } catch (err) {
      console.error('[Google News] RSS failed:', err);
      diagnostics.push({
        source: 'google_news',
        status: 'error',
        message: `Google News RSS failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    // Employee reviews from Indeed/Glassdoor
    try {
      const employeeReviewDrafts = await fetchEmployeeReviews({
        companyName: prospect.companyName ?? prospect.domain,
        domain: prospect.domain,
      });
      allDrafts.push(...employeeReviewDrafts);
      diagnostics.push({
        source: 'employee_reviews',
        status: employeeReviewDrafts.length > 0 ? 'ok' : 'warning',
        message:
          employeeReviewDrafts.length > 0
            ? `Employee reviews found ${employeeReviewDrafts.length} review items.`
            : 'Employee reviews returned no results.',
      });
    } catch (err) {
      console.error('[Employee Reviews] failed:', err);
      diagnostics.push({
        source: 'employee_reviews',
        status: 'error',
        message: `Employee reviews failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    // LinkedIn job postings analysis
    try {
      const jobDrafts = await fetchLinkedInJobs({
        companyName: prospect.companyName ?? prospect.domain,
        domain: prospect.domain,
      });
      allDrafts.push(...jobDrafts);
      diagnostics.push({
        source: 'linkedin_jobs',
        status: jobDrafts.length > 0 ? 'ok' : 'warning',
        message:
          jobDrafts.length > 0
            ? `LinkedIn jobs found ${jobDrafts.length} job postings.`
            : 'LinkedIn jobs returned no results.',
      });
    } catch (err) {
      console.error('[LinkedIn Jobs] failed:', err);
      diagnostics.push({
        source: 'linkedin_jobs',
        status: 'error',
        message: `LinkedIn jobs failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    // Customer reviews from Trustpilot/Werkspot
    try {
      const customerReviewDrafts = await fetchCustomerReviews({
        companyName: prospect.companyName ?? prospect.domain,
        domain: prospect.domain,
      });
      allDrafts.push(...customerReviewDrafts);
      diagnostics.push({
        source: 'customer_reviews',
        status: customerReviewDrafts.length > 0 ? 'ok' : 'warning',
        message:
          customerReviewDrafts.length > 0
            ? `Customer reviews found ${customerReviewDrafts.length} review items.`
            : 'Customer reviews returned no results.',
      });
    } catch (err) {
      console.error('[Customer Reviews] failed:', err);
      diagnostics.push({
        source: 'customer_reviews',
        status: 'error',
        message: `Customer reviews failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    // Dutch industry media news
    if (prospect.industry) {
      try {
        const industryMediaDrafts = await fetchDutchIndustryNews({
          industry: prospect.industry,
          domain: prospect.domain,
        });
        allDrafts.push(...industryMediaDrafts);
        diagnostics.push({
          source: 'dutch_industry_news',
          status: industryMediaDrafts.length > 0 ? 'ok' : 'warning',
          message:
            industryMediaDrafts.length > 0
              ? `Dutch industry news found ${industryMediaDrafts.length} articles.`
              : 'Dutch industry news returned no results.',
        });
      } catch (err) {
        console.error('[Dutch Industry News] failed:', err);
        diagnostics.push({
          source: 'dutch_industry_news',
          status: 'error',
          message: `Dutch industry news failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
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
    diagnostics.push({
      source: 'linkedin_posts',
      status: 'skipped',
      message: 'LinkedIn posts skipped (deep crawl disabled).',
    });
    diagnostics.push({
      source: 'google_reviews',
      status: 'skipped',
      message: 'Google Reviews skipped (deep crawl disabled).',
    });
    diagnostics.push({
      source: 'google_news',
      status: 'skipped',
      message: 'Google News skipped (deep crawl disabled).',
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
      sourceType: 'LINKEDIN',
      sourceUrl:
        prospect.linkedinUrl ??
        `https://www.linkedin.com/company/${prospect.domain.split('.')[0]}`,
      title: `${prospect.companyName ?? prospect.domain} - Bedrijfsprofiel`,
      snippet: linkedinSnippet.slice(0, 240),
      workflowTag: 'workflow-context',
      confidenceScore: 0.73,
      metadata: { adapter: 'apollo-derived', source: 'linkedin-profile' },
    });
    diagnostics.push({
      source: 'linkedin',
      status: 'ok',
      message: 'LinkedIn context synthesized from Apollo profile data.',
    });
  }

  // LinkedIn company posts via Scrapling (replaces Crawl4AI LinkedIn extraction)
  if (input.deepCrawl && prospect.linkedinUrl) {
    try {
      const linkedinPostDrafts = await fetchLinkedInPosts({
        linkedinUrl: prospect.linkedinUrl,
        companyName: prospect.companyName,
      });
      allDrafts.push(...linkedinPostDrafts);
      // Empty result recording — always record the attempt (distinguishes "not found" from "not tried")
      if (linkedinPostDrafts.length === 0) {
        allDrafts.push({
          sourceType: 'LINKEDIN',
          sourceUrl: prospect.linkedinUrl,
          title: `${prospect.companyName ?? prospect.domain} - LinkedIn Posts (geen resultaten)`,
          snippet:
            'LinkedIn company posts page could not be scraped (auth wall or blocking).',
          workflowTag: 'workflow-context',
          confidenceScore: 0.1,
          metadata: { adapter: 'linkedin-posts-scrapling', notFound: true },
        });
      }
      diagnostics.push({
        source: 'linkedin_posts',
        status: linkedinPostDrafts.length > 0 ? 'ok' : 'warning',
        message:
          linkedinPostDrafts.length > 0
            ? `LinkedIn posts scraped ${linkedinPostDrafts.length} post snippets.`
            : 'LinkedIn posts page was blocked or empty; placeholder recorded.',
      });
    } catch (err) {
      console.error('[LinkedIn Posts] scrape failed:', err);
      diagnostics.push({
        source: 'linkedin_posts',
        status: 'error',
        message: `LinkedIn posts scrape failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  } else if (!prospect.linkedinUrl) {
    diagnostics.push({
      source: 'linkedin_posts',
      status: 'skipped',
      message: 'LinkedIn posts skipped: no linkedinUrl on prospect.',
    });
  }

  const evidenceDraftCap = input.deepCrawl
    ? DEEP_EVIDENCE_DRAFT_CAP
    : INTERACTIVE_EVIDENCE_DRAFT_CAP;
  const evidenceDrafts = dedupeEvidenceDrafts(allDrafts).slice(
    0,
    evidenceDraftCap,
  );

  // AI evidence scoring — score all items for workflow/automation relevance
  const scoredMap = new Map<number, ScoredEvidence>();
  try {
    const toScore = evidenceDrafts.map((draft, index) => ({
      index,
      sourceType:
        draft.sourceType as import('@prisma/client').EvidenceSourceType,
      sourceUrl: draft.sourceUrl,
      title: draft.title,
      snippet: draft.snippet,
      metadata: draft.metadata,
    }));

    const scored = await scoreEvidenceBatch(toScore, {
      companyName: prospect.companyName,
      industry: prospect.industry,
    });

    for (const s of scored) {
      scoredMap.set(s.index, s);
    }

    diagnostics.push({
      source: 'evidence_scoring',
      status: 'ok',
      message: `AI scoring completed for ${scored.length} evidence items.`,
    });
  } catch (err) {
    console.error('[Evidence Scorer] AI scoring failed:', err);
    diagnostics.push({
      source: 'evidence_scoring',
      status: 'error',
      message: `AI scoring failed: ${err instanceof Error ? err.message : 'Unknown error'}. Using source-type defaults.`,
    });
  }

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

  for (let i = 0; i < evidenceDrafts.length; i++) {
    const draft = evidenceDrafts[i]!;
    const aiScore = scoredMap.get(i);

    // Use AI-scored confidence if available, otherwise keep original
    const finalConfidence = aiScore
      ? aiScore.finalConfidence
      : draft.confidenceScore;

    // Merge AI scoring data into metadata
    const metadata = {
      ...(draft.metadata as Record<string, unknown> | undefined),
      ...(aiScore
        ? {
            aiRelevance: aiScore.aiRelevance,
            aiDepth: aiScore.aiDepth,
            aiReason: aiScore.aiReason,
          }
        : {}),
    };

    const record = await db.evidenceItem.create({
      data: {
        researchRunId: run.id,
        prospectId: input.prospectId,
        sourceType: draft.sourceType,
        sourceUrl: draft.sourceUrl,
        title: draft.title,
        snippet: draft.snippet,
        workflowTag: draft.workflowTag,
        confidenceScore: finalConfidence,
        metadata: toJson(metadata),
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

  // Phase 42: Intent extraction for Atlantis prospects (before RAG retrieval)
  let intentVars: IntentVariables | null = null;
  if (prospect.project.projectType === 'ATLANTIS') {
    try {
      intentVars = await extractIntentVariables(
        evidenceRecords
          .filter(
            (item) =>
              item.sourceType !== 'RAG_DOCUMENT' && item.confidenceScore >= 0.5,
          )
          .map((item) => ({
            id: item.id,
            sourceType: item.sourceType,
            sourceUrl: item.sourceUrl,
            snippet: item.snippet,
            title: item.title,
            confidenceScore: item.confidenceScore,
            workflowTag: item.workflowTag,
            metadata: item.metadata,
          })),
        {
          companyName: prospect.companyName ?? prospect.domain,
          industry: prospect.industry ?? null,
          description: prospect.description ?? null,
          specialties: prospect.specialties,
        },
      );

      await db.intentExtraction.create({
        data: {
          researchRunId: run.id,
          prospectId: input.prospectId,
          variables: toJson(intentVars),
          populatedCount: intentVars.populatedCount,
          sparse: intentVars.sparse,
          modelUsed: 'gemini-2.0-flash',
        },
      });

      diagnostics.push({
        source: 'intent_extraction',
        status: intentVars.sparse ? 'warning' : 'ok',
        message: intentVars.sparse
          ? `Intent extraction sparse: ${intentVars.populatedCount}/5 core categories populated.`
          : `Intent extraction complete: ${intentVars.populatedCount}/5 core categories populated (${Object.entries(
              intentVars.categories,
            )
              .filter(([, v]) => v.length > 0)
              .map(([k]) => k)
              .join(', ')}).`,
      });
    } catch (extractionErr) {
      diagnostics.push({
        source: 'intent_extraction',
        status: 'warning',
        message: `Intent extraction skipped: ${extractionErr instanceof Error ? extractionErr.message : 'Unknown error'}`,
      });
    }
  }

  if (prospect.project.projectType === 'ATLANTIS') {
    try {
      // Intent-driven RAG queries when extraction succeeded with >= 2 categories
      const useIntentQueries =
        intentVars !== null && intentVars.populatedCount >= 2;
      const queryInputs = useIntentQueries
        ? buildRagQueryInputsFromIntent(intentVars!, {
            companyName: prospect.companyName ?? prospect.domain,
            industry: prospect.industry,
            spvName: prospect.spv?.name ?? null,
          })
        : buildRagQueryInputs(
            {
              companyName: prospect.companyName ?? prospect.domain,
              industry: prospect.industry,
              description: prospect.description,
              specialties: prospect.specialties,
              technologies: prospect.technologies,
              country: prospect.country ?? null,
              campaignNiche: campaign?.nicheKey ?? null,
              spvName: prospect.spv?.name ?? null,
              evidence: evidenceRecords
                .filter((item) => item.sourceType !== 'RAG_DOCUMENT')
                .map((item) => ({
                  workflowTag: item.workflowTag,
                  snippet: item.snippet,
                  confidenceScore: item.confidenceScore,
                  sourceType: item.sourceType,
                })),
            },
            6,
          );
      diagnostics.push({
        source: 'rag_query_strategy',
        status: 'ok',
        message: useIntentQueries
          ? `Intent-driven RAG queries (${intentVars!.populatedCount} categories, ${queryInputs.length} queries).`
          : `Keyword-fallback RAG queries (${queryInputs.length} queries).`,
      });

      const primaryRagPassages = await retrieveRagPassages(db, {
        projectId: prospect.project.id,
        spvId: prospect.spv?.id ?? null,
        queryInputs,
        limitPerQuery: 16,
        maxResults: 36,
        similarityThreshold: 0.4,
      });
      let rawRagPassages = primaryRagPassages;
      if (primaryRagPassages.length < 8) {
        const broadRagPassages = await retrieveRagPassages(db, {
          projectId: prospect.project.id,
          spvId: null,
          queryInputs,
          limitPerQuery: 24,
          maxResults: 56,
          similarityThreshold: 0.32,
        });
        const mergedByChunk = new Map(
          [...primaryRagPassages, ...broadRagPassages].map((passage) => [
            passage.chunkId,
            passage,
          ]),
        );
        rawRagPassages = Array.from(mergedByChunk.values())
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 48);
      }
      const ragPassages = rankRagPassagesForProspect(
        rawRagPassages,
        {
          companyName: prospect.companyName ?? prospect.domain,
          industry: prospect.industry,
          description: prospect.description,
          specialties: prospect.specialties,
          technologies: prospect.technologies,
          country: prospect.country ?? null,
          campaignNiche: campaign?.nicheKey ?? null,
          spvName: prospect.spv?.name ?? null,
        },
        12,
      );

      for (const passage of ragPassages) {
        const confidenceScore = Math.min(
          0.95,
          Math.max(0.62, passage.similarity),
        );
        const citation = {
          documentId: passage.documentId,
          sectionHeader: passage.sectionHeader,
          sourcePath: passage.sourcePath,
          volume: passage.volume,
          spvSlug: passage.spvSlug,
        };
        const metadata = {
          adapter: 'rag-pgvector',
          query: passage.query,
          similarity: passage.similarity,
          citation,
          projectDocumentId: passage.projectDocumentId,
          chunkId: passage.chunkId,
          chunkIndex: passage.chunkIndex,
          documentId: passage.documentId,
          documentTitle: passage.documentTitle,
          sourcePath: passage.sourcePath,
          sectionHeader: passage.sectionHeader,
          volume: passage.volume,
          spvSlug: passage.spvSlug,
          spvName: passage.spvName,
          inheritedWorkflowTag: passage.workflowTag,
          chunkMetadata: passage.chunkMetadata,
        };
        const record = await db.evidenceItem.create({
          data: {
            researchRunId: run.id,
            prospectId: input.prospectId,
            sourceType: 'RAG_DOCUMENT',
            sourceUrl: `atlantis://rag/${encodeURIComponent(passage.sourcePath)}#chunk-${passage.chunkIndex}`,
            title:
              passage.sectionHeader != null
                ? `${passage.documentId} — ${passage.sectionHeader}`
                : `${passage.documentId} — ${passage.documentTitle}`,
            snippet: passage.content.slice(0, 1800),
            workflowTag: passage.workflowTag,
            confidenceScore,
            metadata: toJson(metadata),
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

      diagnostics.push({
        source: 'rag_retrieval',
        status: ragPassages.length > 0 ? 'ok' : 'warning',
        message:
          ragPassages.length > 0
            ? `RAG retrieval produced ${ragPassages.length}/${rawRagPassages.length} prospect-aligned Atlantis passage matches.`
            : 'RAG retrieval returned no passages above similarity threshold.',
      });

      // Phase 43: Master analysis generation — produces structured discover content
      try {
        const spvs = await db.sPV.findMany({
          where: { projectId: prospect.project.id, isActive: true },
          select: {
            name: true,
            code: true,
            slug: true,
            metricsTemplate: true,
          },
        });

        const analysisInput: MasterAnalysisInput = {
          intentVars: intentVars ?? {
            categories: {
              sector_fit: [],
              operational_pains: [],
              esg_csrd: [],
              investment_growth: [],
              workforce: [],
            },
            extras: [],
            populatedCount: 0,
            sparse: true,
          },
          passages: ragPassages,
          prospect: {
            companyName: prospect.companyName ?? prospect.domain,
            industry: prospect.industry ?? null,
            description: prospect.description ?? null,
            specialties: prospect.specialties ?? [],
            country: prospect.country ?? null,
            city: prospect.city ?? null,
            employeeRange: prospect.employeeRange ?? null,
            revenueRange: prospect.revenueRange ?? null,
          },
          spvs: spvs.map((s) => ({
            name: s.name,
            code: s.code,
            slug: s.slug,
            metricsTemplate: s.metricsTemplate,
          })),
        };

        const analysisResult = await generateMasterAnalysis(analysisInput);

        await db.prospectAnalysis.create({
          data: {
            researchRunId: run.id,
            prospectId: input.prospectId,
            version: 'analysis-v1',
            content: toJson(analysisResult),
            modelUsed: analysisResult.modelUsed,
            inputSnapshot: toJson({
              intentVarCount: intentVars?.populatedCount ?? 0,
              passageCount: ragPassages.length,
              spvCount: spvs.length,
            }),
          },
        });

        diagnostics.push({
          source: 'master_analysis',
          status: 'ok',
          message: `Master analysis generated: ${analysisResult.triggers.length} triggers, ${analysisResult.tracks.length} tracks`,
        });
      } catch (analysisErr) {
        diagnostics.push({
          source: 'master_analysis',
          status: 'warning',
          message: `Master analysis skipped: ${analysisErr instanceof Error ? analysisErr.message : 'Unknown error'}`,
        });
      }
    } catch (err) {
      diagnostics.push({
        source: 'rag_retrieval',
        status: 'warning',
        message: `RAG retrieval skipped: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  } else {
    diagnostics.push({
      source: 'rag_retrieval',
      status: 'skipped',
      message: 'RAG retrieval skipped (projectType is not ATLANTIS).',
    });
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

  // Clear existing hypotheses before inserting new ones — ensures re-runs are idempotent
  await db.workflowHypothesis.deleteMany({
    where: { researchRunId: run.id },
  });

  const hypotheses = await generateHypothesisDraftsAI(
    evidenceRecords.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      workflowTag: item.workflowTag,
      confidenceScore: item.confidenceScore,
      snippet: item.snippet,
      sourceUrl: item.sourceUrl,
      title: item.title,
      metadata: item.metadata,
    })),
    {
      companyName: prospect.companyName,
      industry: prospect.industry,
      specialties: prospect.specialties,
      description: prospect.description,
    },
    gate.confirmedPainTags,
    input.hypothesisModel,
    { projectType: prospect.project.projectType },
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
        primarySourceType: hypothesis.primarySourceType, // ANLYS-09
      },
    });
  }

  const opportunityEvidence = evidenceRecords.map((item) => ({
    id: item.id,
    sourceType: item.sourceType,
    workflowTag: item.workflowTag,
    confidenceScore: item.confidenceScore,
    snippet: item.snippet,
    title: item.title,
    metadata: item.metadata,
  }));
  const baselineOpportunities = generateOpportunityDrafts(
    opportunityEvidence.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      workflowTag: item.workflowTag,
      confidenceScore: item.confidenceScore,
    })),
  );
  const opportunities =
    prospect.project.projectType === 'ATLANTIS'
      ? (() => {
          const dualEvidence = generateDualEvidenceOpportunityDrafts(
            opportunityEvidence,
            { maxCards: 4 },
          );
          if (dualEvidence.length >= 2) return dualEvidence;
          return baselineOpportunities;
        })()
      : baselineOpportunities;

  const partnershipAssessment =
    prospect.project.projectType === 'ATLANTIS'
      ? generatePartnershipAssessment(opportunityEvidence)
      : null;
  if (partnershipAssessment) {
    diagnostics.push({
      source: 'rag_retrieval',
      status:
        partnershipAssessment.triggerCount > 0 &&
        partnershipAssessment.readinessScore >= 55
          ? 'ok'
          : 'warning',
      message: `Partnership trigger assessment (${partnershipAssessment.strategyVersion}) produced ${partnershipAssessment.triggerCount} triggers with readiness ${partnershipAssessment.readinessScore}/100.`,
    });
  }
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
    partnership: partnershipAssessment,
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
