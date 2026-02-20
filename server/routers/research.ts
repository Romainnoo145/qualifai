import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import {
  executeResearchRun,
  manualUrlsFromSnapshot,
} from '@/lib/research-executor';
import { runResearchRefreshSweep } from '@/lib/research-refresh';

export const researchRouter = router({
  startRun: adminProcedure
    .input(
      z.object({
        prospectId: z.string(),
        campaignId: z.string().optional(),
        manualUrls: z.array(z.string().url()).default([]),
        deepCrawl: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return executeResearchRun(ctx.db, {
        prospectId: input.prospectId,
        campaignId: input.campaignId,
        manualUrls: input.manualUrls,
        deepCrawl: input.deepCrawl,
      });
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
      });
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
});
