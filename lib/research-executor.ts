import {
  evaluateQualityGate,
  generateEvidenceDrafts,
  inferSourceType,
  generateHypothesisDraftsAI,
  generateOpportunityDrafts,
  runSummaryPayload,
  reviewSeedUrls,
} from '@/lib/workflow-engine';
import { ingestReviewEvidenceDrafts } from '@/lib/review-adapters';
import { ingestWebsiteEvidenceDrafts } from '@/lib/web-evidence-adapter';
import {
  discoverSerpUrls,
  discoverGoogleSearchMentions,
  type SerpDiscoveryResult,
} from '@/lib/enrichment/serp';
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
  type SitemapCache,
} from '@/lib/enrichment/sitemap';
import {
  buildSourceSet,
  defaultResearchUrls as defaultResearchUrlsFn,
  extractSourceSet,
  type SourceSet,
} from '@/lib/enrichment/source-discovery';
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
    | 'linkedin'
    | 'linkedin_posts'
    | 'google_reviews'
    | 'google_news'
    | 'employee_reviews'
    | 'linkedin_jobs'
    | 'customer_reviews'
    | 'dutch_industry_news'
    | 'evidence_scoring';
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

  // Pre-read existing snapshot for sitemap cache AND sourceSet BEFORE run create/update overwrites it
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
  const priorSourceSet = extractSourceSet(priorSnapshot);
  const serpAge = priorSourceSet?.serpDiscoveredAt
    ? Date.now() - new Date(priorSourceSet.serpDiscoveredAt).getTime()
    : Infinity;
  const useSerpFromSourceSet = serpAge < 24 * 60 * 60 * 1000;

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

  // Build initial sourceSet with sitemap + default URLs (SERP URLs added later in deepCrawl block)
  // nonReviewManualUrls are included in the default bucket alongside standard research paths
  const nonReviewManualUrlsForSourceSet = input.manualUrls.filter(
    (url) => inferSourceType(url) !== 'REVIEWS',
  );
  const initialSourceSet: SourceSet = buildSourceSet({
    sitemapUrls,
    serpUrls: useSerpFromSourceSet
      ? (priorSourceSet?.urls
          .filter((u) => u.provenance === 'serp')
          .map((u) => u.url) ?? [])
      : [],
    defaultUrls: [
      ...defaultResearchUrlsFn(prospect.domain),
      ...nonReviewManualUrlsForSourceSet,
    ],
    ...(useSerpFromSourceSet && priorSourceSet?.serpDiscoveredAt
      ? { serpDiscoveredAt: priorSourceSet.serpDiscoveredAt }
      : {}),
  });

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
            sourceSet: initialSourceSet,
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
            sourceSet: initialSourceSet,
          }),
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
  const nonReviewManualUrls = input.manualUrls.filter(
    (url) => inferSourceType(url) !== 'REVIEWS',
  );

  // Derive researchUrls from sourceSet — provenance-tagged, deduped, capped
  // (sourceSet.urls excludes serp URLs at this point; deepCrawl SERP URLs are passed to Crawl4AI separately)
  const researchUrls = initialSourceSet.urls
    .filter((u) => u.provenance !== 'serp')
    .map((u) => u.url);

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
    // SERP cache guard: use sourceSet.serpDiscoveredAt (set at pre-read stage via useSerpFromSourceSet)
    // The deepCrawl branch reads from the already-computed useSerpFromSourceSet flag.
    // Secondary safety: also check serpCache for backward compatibility with runs that
    // predate the sourceSet field.
    const existingSnapshot = input.existingRunId
      ? (
          await db.researchRun.findUnique({
            where: { id: input.existingRunId },
            select: { inputSnapshot: true },
          })
        )?.inputSnapshot
      : null;
    const serpCache = extractSerpCache(existingSnapshot);
    // Primary guard: sourceSet serpDiscoveredAt; fallback: legacy serpCache
    const isCacheValid =
      useSerpFromSourceSet ||
      (serpCache !== null &&
        Date.now() - new Date(serpCache.discoveredAt).getTime() <
          24 * 60 * 60 * 1000);

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
      ? (serpCache ?? {
          reviewUrls:
            priorSourceSet?.urls
              .filter((u) => u.provenance === 'serp')
              .map((u) => u.url) ?? [],
          jobUrls: [],
          discoveredAt:
            priorSourceSet?.serpDiscoveredAt ?? new Date().toISOString(),
        })
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

    // Rebuild sourceSet with SERP URLs now that we have them
    const serpDiscoveredAt = !isCacheValid
      ? new Date().toISOString()
      : (priorSourceSet?.serpDiscoveredAt ??
        serpCache?.discoveredAt ??
        new Date().toISOString());
    const fullSourceSet: SourceSet = buildSourceSet({
      sitemapUrls,
      serpUrls: [...serpResult.reviewUrls, ...serpResult.jobUrls],
      defaultUrls: [
        ...defaultResearchUrlsFn(prospect.domain),
        ...nonReviewManualUrls,
      ],
      serpDiscoveredAt,
    });

    // Persist updated sourceSet + serpCache in inputSnapshot
    if (!isCacheValid || !priorSourceSet) {
      await db.researchRun.update({
        where: { id: run.id },
        data: {
          inputSnapshot: toJson({
            manualUrls: input.manualUrls,
            campaignId: input.campaignId,
            deepCrawl: true,
            serpCache: serpResult,
            ...(freshSitemapCache ? { sitemapCache: freshSitemapCache } : {}),
            sourceSet: fullSourceSet,
          }),
        },
      });
    } else {
      // Cache hit — still update sourceSet with full SERP-enriched set
      await db.researchRun.update({
        where: { id: run.id },
        data: {
          inputSnapshot: toJson({
            manualUrls: input.manualUrls,
            campaignId: input.campaignId,
            deepCrawl: true,
            ...(serpCache ? { serpCache } : {}),
            ...(freshSitemapCache ? { sitemapCache: freshSitemapCache } : {}),
            sourceSet: fullSourceSet,
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

  const evidenceDrafts = dedupeEvidenceDrafts(allDrafts).slice(0, 60);

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
