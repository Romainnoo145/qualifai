import { discoverSitemapUrls, type SitemapDiscoveryResult } from '@/lib/enrichment/sitemap';
import { discoverSiteUrlsWithKatana } from '@/lib/enrichment/katana';
import { defaultResearchUrls } from '@/lib/enrichment/source-discovery';
import {
  selectResearchUrls,
  type CandidateSource,
  type ResearchUrlCandidate,
  type UrlSelectionResult,
} from '@/lib/enrichment/url-selection';
import type { PrismaClient } from '@prisma/client';

const TOP_N = 60;
const STALE_HOURS = 24;

interface WebsiteCandidate extends ResearchUrlCandidate {
  source: CandidateSource;
  topSegment: string;
  pathDepth: number;
  lastmod: string | null;
}

interface SiteCatalogContext {
  industry?: string | null;
  description?: string | null;
  specialties?: string[];
  country?: string | null;
  nicheKey?: string | null;
  language?: string | null;
}

interface PrecomputedCatalogInput {
  discovery: SitemapDiscoveryResult;
  katanaSiteUrls: string[];
  serpSiteUrls: string[];
  discoveredCandidates: WebsiteCandidate[];
  selection: UrlSelectionResult;
  sourceUsed: 'sitemap' | 'katana_site' | 'serp_site' | 'fallback';
  fallbackReason: string | null;
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

function normalizeUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${host}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

function fallbackReasonFromSitemapStatus(
  status: SitemapDiscoveryResult['status'],
): string | null {
  if (status === 'blocked') return 'sitemap_blocked';
  if (status === 'empty') return 'sitemap_empty';
  if (status === 'error') return 'sitemap_error';
  return null;
}

function buildCandidatesFromDiscovery(input: {
  domain: string;
  manualUrls: string[];
  sitemap: SitemapDiscoveryResult;
  katanaSiteUrls: string[];
  serpSiteUrls: string[];
}): {
  sourceUsed: 'sitemap' | 'katana_site' | 'serp_site' | 'fallback';
  fallbackReason: string | null;
  discoveredCandidates: WebsiteCandidate[];
} {
  let sourceUsed: 'sitemap' | 'katana_site' | 'serp_site' | 'fallback' = 'fallback';
  if (input.sitemap.status === 'ok' && input.sitemap.discoveredTotal > 0) {
    sourceUsed = 'sitemap';
  } else if (input.katanaSiteUrls.length > 0) {
    sourceUsed = 'katana_site';
  } else if (input.serpSiteUrls.length > 0) {
    sourceUsed = 'serp_site';
  }

  const discoveredCandidates: WebsiteCandidate[] = [];
  if (sourceUsed === 'sitemap') {
    for (const candidate of input.sitemap.candidates) {
      const mapped = candidateFromUrl(candidate.url, 'sitemap', candidate.lastmod);
      if (!mapped) continue;
      discoveredCandidates.push(mapped);
    }
  } else if (sourceUsed === 'katana_site') {
    for (const url of input.katanaSiteUrls) {
      const mapped = candidateFromUrl(url, 'katana_site', null);
      if (!mapped) continue;
      discoveredCandidates.push(mapped);
    }
  } else if (sourceUsed === 'serp_site') {
    for (const url of input.serpSiteUrls) {
      const mapped = candidateFromUrl(url, 'serp_site', null);
      if (!mapped) continue;
      discoveredCandidates.push(mapped);
    }
  }

  for (const manualUrl of input.manualUrls) {
    const mapped = candidateFromUrl(manualUrl, 'manual', null);
    if (!mapped) continue;
    discoveredCandidates.push(mapped);
  }

  const fallbackReason = fallbackReasonFromSitemapStatus(input.sitemap.status);
  if (discoveredCandidates.length === 0) {
    sourceUsed = 'fallback';
    for (const url of defaultResearchUrls(input.domain).slice(0, 6)) {
      const mapped = candidateFromUrl(url, 'seed', null);
      if (!mapped) continue;
      discoveredCandidates.push(mapped);
    }
  }

  return { sourceUsed, fallbackReason, discoveredCandidates };
}

async function shouldTriggerSync(
  db: PrismaClient,
  prospectId: string,
  force = false,
): Promise<boolean> {
  if (force) return true;

  const latest = await db.prospectSiteCatalogRun.findFirst({
    where: { prospectId },
    orderBy: { createdAt: 'desc' },
    select: {
      status: true,
      completedAt: true,
      startedAt: true,
      createdAt: true,
    },
  });

  if (!latest) return true;
  if (latest.status === 'RUNNING') return false;

  const reference = latest.completedAt ?? latest.startedAt ?? latest.createdAt;
  const ageMs = Date.now() - reference.getTime();
  return ageMs > STALE_HOURS * 60 * 60 * 1000;
}

export async function runProspectSiteCatalogSync(
  db: PrismaClient,
  input: {
    prospectId: string;
    domain: string;
    manualUrls: string[];
    context?: SiteCatalogContext;
    force?: boolean;
    precomputed?: PrecomputedCatalogInput;
  },
): Promise<{ skipped: boolean; runId?: string }> {
  const shouldRun = await shouldTriggerSync(db, input.prospectId, input.force);
  if (!shouldRun) {
    return { skipped: true };
  }

  const catalogRun = await db.prospectSiteCatalogRun.create({
    data: {
      prospectId: input.prospectId,
      status: 'RUNNING',
      startedAt: new Date(),
    },
    select: { id: true },
  });

  try {
    let discovery: SitemapDiscoveryResult;
    let katanaSiteUrls: string[];
    let serpSiteUrls: string[];
    let sourceUsed: 'sitemap' | 'katana_site' | 'serp_site' | 'fallback';
    let fallbackReason: string | null;
    let discoveredCandidates: WebsiteCandidate[];
    let selection: UrlSelectionResult;

    if (input.precomputed) {
      discovery = input.precomputed.discovery;
      katanaSiteUrls = input.precomputed.katanaSiteUrls;
      serpSiteUrls = input.precomputed.serpSiteUrls;
      sourceUsed = input.precomputed.sourceUsed;
      fallbackReason = input.precomputed.fallbackReason;
      discoveredCandidates = input.precomputed.discoveredCandidates;
      selection = input.precomputed.selection;
    } else {
      discovery = await discoverSitemapUrls(input.domain);
      const useCrawlerFallback =
        discovery.status !== 'ok' || discovery.discoveredTotal === 0;
      const katanaResult = useCrawlerFallback
        ? await discoverSiteUrlsWithKatana({
            domain: input.domain,
            maxResults: 200,
          })
        : { status: 'ok' as const, urls: [] };
      katanaSiteUrls = katanaResult.status === 'ok' ? katanaResult.urls : [];
      serpSiteUrls = [];
      const built = buildCandidatesFromDiscovery({
        domain: input.domain,
        manualUrls: input.manualUrls,
        sitemap: discovery,
        katanaSiteUrls,
        serpSiteUrls,
      });
      sourceUsed = built.sourceUsed;
      fallbackReason = built.fallbackReason;
      discoveredCandidates = built.discoveredCandidates;
      selection = selectResearchUrls({
        candidates: discoveredCandidates,
        topN: TOP_N,
        context: input.context,
      });
    }

    const selectedMap = new Map(
      selection.selectedUrls.map((item) => [item.url, item]),
    );
    const candidateMap = new Map<string, WebsiteCandidate>();
    for (const candidate of discoveredCandidates) {
      const key = normalizeUrl(candidate.url);
      if (!key || candidateMap.has(key)) continue;
      candidateMap.set(key, candidate);
    }

    const rows = Array.from(candidateMap.entries()).map(([normalizedUrl, item]) => {
      const selected = selectedMap.get(item.url);
      const lastmod = item.lastmod ? new Date(item.lastmod) : null;
      return {
        catalogRunId: catalogRun.id,
        prospectId: input.prospectId,
        url: item.url,
        normalizedUrl,
        lastmod: lastmod && !Number.isNaN(lastmod.getTime()) ? lastmod : null,
        topSegment: item.topSegment,
        pathDepth: item.pathDepth,
        score: selected?.score ?? null,
        selectedRank: selected?.rank ?? null,
        isSelected: Boolean(selected),
        source: item.source,
        metadata: {
          relevanceMatches: selected?.relevanceMatches ?? null,
        },
      };
    });

    await db.$transaction(async (tx) => {
      await tx.prospectSiteUrl.deleteMany({ where: { prospectId: input.prospectId } });
      if (rows.length > 0) {
        await tx.prospectSiteUrl.createMany({ data: rows });
      }
      await tx.prospectSiteCatalogRun.update({
        where: { id: catalogRun.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          discoveredTotal: discovery.discoveredTotal,
          selectedTotal: selection.selectedTotal,
          metadata: {
            discoveryStatus: discovery.status,
            discoveryErrorCode: discovery.errorCode ?? null,
            sourceUsed,
            fallbackReason,
            sitemapDiscoveredTotal: discovery.discoveredTotal,
            katanaSiteDiscoveredTotal: katanaSiteUrls.length,
            serpSiteDiscoveredTotal: serpSiteUrls.length,
            strategyVersion: selection.strategyVersion,
            selectedBySource: selection.selectedBySource,
            selectedBySegment: selection.selectedBySegment,
          },
        },
      });
    });

    return { skipped: false, runId: catalogRun.id };
  } catch (error) {
    await db.prospectSiteCatalogRun.update({
      where: { id: catalogRun.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

export function triggerProspectSiteCatalogSync(
  db: PrismaClient,
  input: {
    prospectId: string;
    domain: string;
    manualUrls: string[];
    context?: SiteCatalogContext;
    precomputed?: PrecomputedCatalogInput;
  },
): void {
  void runProspectSiteCatalogSync(db, input).catch((error) => {
    console.error('[site-catalog] sync failed', {
      prospectId: input.prospectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });
}
