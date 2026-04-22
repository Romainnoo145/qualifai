import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { adminProcedure, publicProcedure, router } from '../trpc';
import {
  executeResearchRun,
  manualUrlsFromSnapshot,
} from '@/lib/research-executor';
import { runResearchRefreshSweep } from '@/lib/research-refresh';
import { discoverSitemapUrls } from '@/lib/enrichment/sitemap';
import { discoverSiteUrlsWithKatana } from '@/lib/enrichment/katana';
import { inferSourceType } from '@/lib/workflow-engine';
import {
  detectJsHeavy,
  defaultResearchUrls,
} from '@/lib/enrichment/source-discovery';
import {
  selectResearchUrls,
  type CandidateSource,
  type ResearchUrlCandidate,
} from '@/lib/enrichment/url-selection';
import type { Prisma } from '@prisma/client';
import { currentStepLabel, isActiveStatus } from '@/lib/research/status-labels';
import { discoverLookupCandidates } from '@/lib/prospect-url';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const WEBSITE_TOP_N = 60;

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

function fallbackReasonFromSitemapStatus(
  status: 'ok' | 'blocked' | 'empty' | 'error',
): string | null {
  if (status === 'blocked') return 'sitemap_blocked';
  if (status === 'empty') return 'sitemap_empty';
  if (status === 'error') return 'sitemap_error';
  return null;
}

function buildRawCounts(input: {
  discoveredCandidates: WebsiteCandidate[];
  selectedBySource: Record<string, number>;
}): Record<string, { discovered: number; capped: number }> {
  const discoveredBySource: Record<string, number> = {};
  for (const candidate of input.discoveredCandidates) {
    discoveredBySource[candidate.source] =
      (discoveredBySource[candidate.source] ?? 0) + 1;
  }

  const keys = new Set<string>([
    ...Object.keys(discoveredBySource),
    ...Object.keys(input.selectedBySource),
    'sitemap',
    'serp',
    'default',
  ]);

  const rawCounts: Record<string, { discovered: number; capped: number }> = {};
  for (const key of keys) {
    rawCounts[key] = {
      discovered: discoveredBySource[key] ?? 0,
      capped: input.selectedBySource[key] ?? 0,
    };
  }

  return rawCounts;
}

export const researchRouter = router({
  startRun: adminProcedure
    .input(
      z.object({
        prospectId: z.string(),
        campaignId: z.string().optional(),
        manualUrls: z.array(z.string().url()).default([]),
        deepCrawl: z.boolean().default(false),
        hypothesisModel: z.enum(['gemini-flash', 'claude-sonnet']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return executeResearchRun(ctx.db, {
        prospectId: input.prospectId,
        campaignId: input.campaignId,
        manualUrls: input.manualUrls,
        deepCrawl: input.deepCrawl,
        hypothesisModel: input.hypothesisModel,
      });
    }),

  getActiveStatusByProspectId: adminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.researchRun.findFirst({
        where: { prospectId: input.prospectId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, startedAt: true },
      });
      if (!run) {
        return {
          isActive: false,
          status: null,
          currentStep: null,
          startedAt: null,
        };
      }
      return {
        isActive: isActiveStatus(run.status),
        status: run.status,
        currentStep: currentStepLabel(run.status),
        startedAt: run.startedAt,
      };
    }),

  getActiveStatusBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const candidates = discoverLookupCandidates(input.slug);
      if (candidates.length === 0) {
        return {
          isActive: false,
          status: null,
          currentStep: null,
          startedAt: null,
        };
      }
      const prospect = await ctx.db.prospect.findFirst({
        where: {
          OR: candidates.flatMap((c) => [{ slug: c }, { readableSlug: c }]),
        },
        select: { id: true },
      });
      if (!prospect) {
        return {
          isActive: false,
          status: null,
          currentStep: null,
          startedAt: null,
        };
      }
      const run = await ctx.db.researchRun.findFirst({
        where: { prospectId: prospect.id },
        orderBy: { createdAt: 'desc' },
        select: { status: true, startedAt: true },
      });
      if (!run) {
        return {
          isActive: false,
          status: null,
          currentStep: null,
          startedAt: null,
        };
      }
      return {
        isActive: isActiveStatus(run.status),
        status: run.status,
        currentStep: currentStepLabel(run.status),
        startedAt: run.startedAt,
      };
    }),

  retryRun: adminProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.researchRun.findUniqueOrThrow({
        where: { id: input.runId },
      });
      const manualUrls = manualUrlsFromSnapshot(existing.inputSnapshot);
      const snapshot = existing.inputSnapshot as Record<string, unknown> | null;
      const deepCrawl = snapshot?.deepCrawl === true;
      const hypothesisModel =
        snapshot?.hypothesisModel === 'claude-sonnet'
          ? ('claude-sonnet' as const)
          : ('gemini-flash' as const);
      await ctx.db.workflowHypothesis.deleteMany({
        where: { researchRunId: existing.id },
      });
      await ctx.db.automationOpportunity.deleteMany({
        where: { researchRunId: existing.id },
      });
      await ctx.db.evidenceItem.deleteMany({
        where: { researchRunId: existing.id },
      });

      return executeResearchRun(ctx.db, {
        prospectId: existing.prospectId,
        campaignId: existing.campaignId ?? undefined,
        manualUrls,
        existingRunId: existing.id,
        deepCrawl,
        hypothesisModel,
      });
    }),

  rediscoverSources: adminProcedure
    .input(
      z.object({
        runId: z.string(),
        force: z.boolean().default(false), // bypass 24h SERP cache
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.researchRun.findUniqueOrThrow({
        where: { id: input.runId },
        select: {
          id: true,
          prospectId: true,
          campaignId: true,
          inputSnapshot: true,
        },
      });

      const prospect = await ctx.db.prospect.findUniqueOrThrow({
        where: { id: run.prospectId },
        select: {
          domain: true,
          companyName: true,
          industry: true,
          description: true,
          specialties: true,
          country: true,
        },
      });
      const campaign = run.campaignId
        ? await ctx.db.campaign.findUnique({
            where: { id: run.campaignId },
            select: { nicheKey: true, language: true },
          })
        : null;

      const existingSnapshot = run.inputSnapshot;
      const manualUrls = manualUrlsFromSnapshot(existingSnapshot).filter(
        (url) => inferSourceType(url) !== 'REVIEWS',
      );

      const sitemapResult = await discoverSitemapUrls(prospect.domain);
      const useCrawlerFallback =
        sitemapResult.status !== 'ok' || sitemapResult.discoveredTotal === 0;
      const katanaResult = useCrawlerFallback
        ? await discoverSiteUrlsWithKatana({
            domain: prospect.domain,
            maxResults: 200,
          })
        : { status: 'ok' as const, urls: [] };
      const katanaSiteUrls =
        katanaResult.status === 'ok' ? katanaResult.urls : [];
      const serpSiteUrls: string[] = [];

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

      for (const manualUrl of manualUrls) {
        const mapped = candidateFromUrl(manualUrl, 'manual', null);
        if (!mapped) continue;
        discoveredCandidates.push(mapped);
      }

      const fallbackReason = fallbackReasonFromSitemapStatus(
        sitemapResult.status,
      );
      if (discoveredCandidates.length === 0) {
        sourceUsed = 'fallback';
        for (const url of defaultResearchUrls(prospect.domain).slice(0, 6)) {
          const mapped = candidateFromUrl(url, 'seed', null);
          if (!mapped) continue;
          discoveredCandidates.push(mapped);
        }
      }

      const selection = selectResearchUrls({
        candidates: discoveredCandidates,
        topN: WEBSITE_TOP_N,
        context: {
          industry: prospect.industry,
          description: prospect.description,
          specialties: prospect.specialties,
          country: prospect.country,
          nicheKey: campaign?.nicheKey ?? null,
          language: campaign?.language ?? null,
        },
      });

      const sourceSet = {
        urls: selection.selectedUrls.map((item) => ({
          url: item.url,
          provenance: item.source,
          jsHeavyHint: detectJsHeavy(item.url),
        })),
        discoveredAt: new Date().toISOString(),
        dedupRemovedCount: Math.max(
          0,
          discoveredCandidates.length - selection.discoveredTotal,
        ),
        rawCounts: buildRawCounts({
          discoveredCandidates,
          selectedBySource: selection.selectedBySource,
        }),
        discovery: {
          sourceUsed,
          sitemapStatus: sitemapResult.status,
          sitemapErrorCode: sitemapResult.errorCode ?? null,
          sitemapDiscoveredTotal: sitemapResult.discoveredTotal,
          katanaSiteDiscoveredTotal: katanaSiteUrls.length,
          serpSiteDiscoveredTotal: serpSiteUrls.length,
          fallbackReason,
        },
        selection: {
          strategyVersion: selection.strategyVersion,
          topN: WEBSITE_TOP_N,
          discoveredTotal: selection.discoveredTotal,
          selectedTotal: selection.selectedTotal,
          selectedBySource: selection.selectedBySource,
          selectedBySegment: selection.selectedBySegment,
        },
      };

      const existingFields =
        existingSnapshot &&
        typeof existingSnapshot === 'object' &&
        !Array.isArray(existingSnapshot)
          ? (existingSnapshot as Record<string, unknown>)
          : {};

      const updatedSnapshot = toJson({
        ...existingFields,
        sitemapCache: {
          discoveredAt: new Date().toISOString(),
          urls: sitemapResult.candidates.map((candidate) => candidate.url),
          result: sitemapResult,
        },
        sourceSet,
      });

      await ctx.db.researchRun.update({
        where: { id: input.runId },
        data: { inputSnapshot: updatedSnapshot },
      });

      return { sourceSet };
    }),

  runRefreshSweep: adminProcedure
    .input(
      z
        .object({
          staleDays: z.number().int().positive().max(365).optional(),
          limit: z.number().int().positive().max(200).default(25),
          dryRun: z.boolean().default(false),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      return runResearchRefreshSweep(ctx.db, {
        staleDays: input?.staleDays,
        limit: input?.limit,
        dryRun: input?.dryRun ?? false,
      });
    }),

  listRuns: adminProcedure
    .input(
      z
        .object({
          prospectId: z.string().optional(),
          campaignId: z.string().optional(),
          status: z
            .enum([
              'PENDING',
              'CRAWLING',
              'EXTRACTING',
              'HYPOTHESIS',
              'BRIEFING',
              'FAILED',
              'COMPLETED',
            ])
            .optional(),
          limit: z.number().min(1).max(100).default(30),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.researchRun.findMany({
        where: {
          ...(input?.prospectId ? { prospectId: input.prospectId } : {}),
          ...(input?.campaignId ? { campaignId: input.campaignId } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 30,
        include: {
          prospect: {
            select: { id: true, companyName: true, domain: true },
          },
          campaign: {
            select: { id: true, name: true, nicheKey: true, strictGate: true },
          },
          _count: {
            select: {
              evidenceItems: true,
              workflowHypotheses: true,
              automationOpportunities: true,
              workflowLossMaps: true,
            },
          },
        },
      });
    }),

  getRun: adminProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.researchRun.findUniqueOrThrow({
        where: { id: input.runId },
        include: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              domain: true,
              industry: true,
            },
          },
          campaign: {
            select: {
              id: true,
              name: true,
              nicheKey: true,
              strictGate: true,
            },
          },
          evidenceItems: { orderBy: { confidenceScore: 'desc' } },
          workflowHypotheses: { orderBy: { confidenceScore: 'desc' } },
          automationOpportunities: { orderBy: { confidenceScore: 'desc' } },
          workflowLossMaps: { orderBy: { createdAt: 'desc' } },
          callPrepPlans: { orderBy: { createdAt: 'desc' } },
        },
      });
    }),

  listEvidence: adminProcedure
    .input(
      z.object({
        prospectId: z.string().optional(),
        runId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.evidenceItem.findMany({
        where: {
          ...(input.prospectId ? { prospectId: input.prospectId } : {}),
          ...(input.runId ? { researchRunId: input.runId } : {}),
        },
        orderBy: [{ confidenceScore: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      });
    }),

  approveEvidence: adminProcedure
    .input(z.object({ evidenceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.evidenceItem.update({
        where: { id: input.evidenceId },
        data: { isApproved: true },
      });
    }),

  rejectEvidence: adminProcedure
    .input(z.object({ evidenceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.evidenceItem.update({
        where: { id: input.evidenceId },
        data: { isApproved: false },
      });
    }),

  approveQuality: adminProcedure
    .input(
      z.object({
        runId: z.string(),
        approved: z.boolean(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const currentRun = await ctx.db.researchRun.findUniqueOrThrow({
        where: { id: input.runId },
        select: { summary: true, prospectId: true, qualityApproved: true },
      });
      const summary =
        currentRun.summary &&
        typeof currentRun.summary === 'object' &&
        !Array.isArray(currentRun.summary)
          ? (currentRun.summary as Record<string, unknown>)
          : null;
      const gate =
        summary?.gate &&
        typeof summary.gate === 'object' &&
        !Array.isArray(summary.gate)
          ? (summary.gate as Record<string, unknown>)
          : null;
      const gatePassed =
        typeof gate?.passed === 'boolean' ? (gate.passed as boolean) : true;
      const overrideReason = input.notes?.trim() ?? '';

      // Extract pain tag arrays from gate snapshot (populated by computePainTagConfirmation in Phase 30-01)
      const confirmedPainTags: string[] = Array.isArray(gate?.confirmedPainTags)
        ? (gate.confirmedPainTags as string[])
        : [];
      const unconfirmedPainTags: string[] = Array.isArray(
        gate?.unconfirmedPainTags,
      )
        ? (gate.unconfirmedPainTags as string[])
        : [];

      // 12-char reason required when bypassing quality gate OR when pain tags are unconfirmed
      if (
        input.approved &&
        (!gatePassed || unconfirmedPainTags.length > 0) &&
        overrideReason.length < 12
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Override requires a clear reason (min. 12 chars) when gate is not passed or pain tags are unconfirmed.',
        });
      }

      const run = await ctx.db.researchRun.update({
        where: { id: input.runId },
        data: {
          qualityApproved: input.approved,
          qualityReviewedAt: new Date(),
          qualityNotes: overrideReason || null,
        },
      });
      if (!input.approved) {
        await ctx.db.workflowHypothesis.updateMany({
          where: { researchRunId: input.runId, status: 'PENDING' },
          data: { status: 'DRAFT' },
        });
      }

      // Write immutable audit record when a gate bypass occurs on first approval only
      // Idempotency: currentRun.qualityApproved === null means this is the first approval
      if (input.approved && currentRun.qualityApproved === null) {
        const qualityGateBypassed = !gatePassed;
        const painGateBypassed = unconfirmedPainTags.length > 0;

        if (qualityGateBypassed || painGateBypassed) {
          const gateType =
            qualityGateBypassed && painGateBypassed
              ? 'quality+pain'
              : qualityGateBypassed
                ? 'quality'
                : 'pain';

          await ctx.db.gateOverrideAudit.create({
            data: {
              researchRunId: input.runId,
              prospectId: currentRun.prospectId,
              gateType,
              reason: overrideReason,
              actor: 'admin',
              gateSnapshot: toJson({
                gate,
                confirmedPainTags,
                unconfirmedPainTags,
              }),
            },
          });
        }
      }

      return run;
    }),

  listOverrideAudits: adminProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.gateOverrideAudit.findMany({
        where: { researchRunId: input.runId },
        orderBy: { createdAt: 'asc' },
      });
    }),

  getIntentExtraction: adminProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.intentExtraction.findUnique({
        where: { researchRunId: input.runId },
      });
    }),

  getProspectAnalysis: adminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.prospectAnalysis.findFirst({
        where: { prospectId: input.prospectId },
        orderBy: { createdAt: 'desc' },
      });
    }),
});
