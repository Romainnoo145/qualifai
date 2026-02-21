import { env } from '@/env.mjs';
import { executeResearchRun } from '@/lib/research-executor';
import type { PrismaClient, ResearchStatus } from '@prisma/client';

const ACTIVE_RUN_STATUSES: ResearchStatus[] = [
  'PENDING',
  'CRAWLING',
  'EXTRACTING',
  'HYPOTHESIS',
  'BRIEFING',
];

function fallbackCompanyName(
  companyName: string | null,
  domain: string,
): string {
  return companyName ?? domain.replace(/\..*$/, '');
}

export function buildDefaultReviewSeedUrls(
  domain: string,
  companyName: string | null,
): string[] {
  const safeDomain = domain.trim().toLowerCase();
  const company = fallbackCompanyName(companyName, safeDomain);
  const encodedCompany = encodeURIComponent(company);
  return [
    `https://www.google.com/search?q=${encodedCompany}+reviews`,
    `https://www.google.com/maps/search/${encodedCompany}`,
    `https://www.trustpilot.com/review/${safeDomain}`,
    `https://www.klantenvertellen.nl/zoeken?query=${encodedCompany}`,
  ];
}

export function isResearchStale(
  latestRunAt: Date | null,
  staleDays: number,
  now = new Date(),
): boolean {
  if (!latestRunAt) return true;
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  return now.getTime() - latestRunAt.getTime() >= staleMs;
}

export interface RefreshSweepCandidate {
  prospectId: string;
  prospectName: string;
  domain: string;
  campaignId: string;
  campaignName: string;
  latestRunId: string | null;
  latestRunStatus: ResearchStatus | null;
  latestRunAt: Date | null;
  reason: 'never_researched' | 'stale' | 'stale_failed';
  defaultManualUrls: string[];
}

export interface RefreshSweepResult {
  staleDays: number;
  scannedProspects: number;
  staleCandidates: number;
  executed: number;
  failed: number;
  dryRun: boolean;
  candidates: RefreshSweepCandidate[];
  executions: Array<{
    prospectId: string;
    campaignId: string;
    runId?: string;
    ok: boolean;
    error?: string;
  }>;
}

export async function collectRefreshCandidates(
  db: PrismaClient,
  options?: { staleDays?: number; limit?: number },
): Promise<{
  staleDays: number;
  scannedProspects: number;
  candidates: RefreshSweepCandidate[];
}> {
  const staleDays = options?.staleDays ?? env.RESEARCH_REFRESH_STALE_DAYS ?? 14;
  const limit = options?.limit ?? 25;
  const now = new Date();

  const campaigns = await db.campaign.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      campaignProspects: {
        select: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              domain: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const rawCandidates: RefreshSweepCandidate[] = [];
  let scannedProspects = 0;

  for (const campaign of campaigns) {
    for (const item of campaign.campaignProspects) {
      scannedProspects += 1;
      const prospect = item.prospect;
      const latestRun = await db.researchRun.findFirst({
        where: {
          prospectId: prospect.id,
          campaignId: campaign.id,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      });

      if (latestRun && ACTIVE_RUN_STATUSES.includes(latestRun.status)) {
        continue;
      }

      const latestRunAt =
        latestRun?.completedAt ?? latestRun?.createdAt ?? null;
      if (!isResearchStale(latestRunAt, staleDays, now)) continue;

      const reason = !latestRun
        ? 'never_researched'
        : latestRun.status === 'FAILED'
          ? 'stale_failed'
          : 'stale';

      rawCandidates.push({
        prospectId: prospect.id,
        prospectName: fallbackCompanyName(
          prospect.companyName,
          prospect.domain,
        ),
        domain: prospect.domain,
        campaignId: campaign.id,
        campaignName: campaign.name,
        latestRunId: latestRun?.id ?? null,
        latestRunStatus: latestRun?.status ?? null,
        latestRunAt,
        reason,
        defaultManualUrls: buildDefaultReviewSeedUrls(
          prospect.domain,
          prospect.companyName,
        ),
      });
    }
  }

  rawCandidates.sort((a, b) => {
    if (!a.latestRunAt && !b.latestRunAt) return 0;
    if (!a.latestRunAt) return -1;
    if (!b.latestRunAt) return 1;
    return a.latestRunAt.getTime() - b.latestRunAt.getTime();
  });

  return {
    staleDays,
    scannedProspects,
    candidates: rawCandidates.slice(0, limit),
  };
}

export async function runResearchRefreshSweep(
  db: PrismaClient,
  options?: { staleDays?: number; limit?: number; dryRun?: boolean },
): Promise<RefreshSweepResult> {
  const dryRun = options?.dryRun ?? false;
  const { staleDays, scannedProspects, candidates } =
    await collectRefreshCandidates(db, {
      staleDays: options?.staleDays,
      limit: options?.limit,
    });

  const executions: RefreshSweepResult['executions'] = [];
  if (!dryRun) {
    for (const candidate of candidates) {
      try {
        const result = await executeResearchRun(db, {
          prospectId: candidate.prospectId,
          campaignId: candidate.campaignId,
          manualUrls: candidate.defaultManualUrls,
        });
        executions.push({
          prospectId: candidate.prospectId,
          campaignId: candidate.campaignId,
          runId: result.run.id,
          ok: true,
        });
      } catch (error) {
        executions.push({
          prospectId: candidate.prospectId,
          campaignId: candidate.campaignId,
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  return {
    staleDays,
    scannedProspects,
    staleCandidates: candidates.length,
    executed: executions.filter((item) => item.ok).length,
    failed: executions.filter((item) => !item.ok).length,
    dryRun,
    candidates,
    executions,
  };
}
