import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import { createCallPrepDraft } from '@/lib/workflow-engine';
import type { Prisma } from '@prisma/client';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export const assetsRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          prospectId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.workflowLossMap.findMany({
        where: input?.prospectId ? { prospectId: input.prospectId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 50,
        include: {
          prospect: {
            select: { id: true, companyName: true, domain: true },
          },
          researchRun: {
            select: { id: true, status: true },
          },
        },
      });
    }),

  getLatest: adminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.workflowLossMap.findFirst({
        where: { prospectId: input.prospectId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.workflowLossMap.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          prospect: {
            select: { id: true, companyName: true, domain: true },
          },
          researchRun: {
            select: { id: true, status: true },
          },
        },
      });
    }),

  exportPdf: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const map = await ctx.db.workflowLossMap.findUniqueOrThrow({
        where: { id: input.id },
      });
      return {
        id: map.id,
        title: map.title,
        pdfUrl: map.pdfUrl,
        html: map.html,
        markdown: map.markdown,
      };
    }),

  generateInterviewPlan: adminProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.researchRun.findUniqueOrThrow({
        where: { id: input.runId },
        include: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              domain: true,
              industry: true,
              employeeRange: true,
              description: true,
              technologies: true,
              specialties: true,
            },
          },
          campaign: {
            select: { id: true },
          },
        },
      });
      const [hypotheses, opportunities, latestMap] = await Promise.all([
        ctx.db.workflowHypothesis.findMany({
          where: {
            researchRunId: run.id,
            status: { in: ['ACCEPTED', 'PENDING'] },
          },
          orderBy: { confidenceScore: 'desc' },
          take: 3,
        }),
        ctx.db.automationOpportunity.findMany({
          where: {
            researchRunId: run.id,
            status: { in: ['ACCEPTED', 'PENDING'] },
          },
          orderBy: { confidenceScore: 'desc' },
          take: 2,
        }),
        ctx.db.workflowLossMap.findFirst({
          where: { researchRunId: run.id },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const selectedHypotheses =
        hypotheses.length > 0
          ? hypotheses
          : await ctx.db.workflowHypothesis.findMany({
              where: { researchRunId: run.id },
              orderBy: { confidenceScore: 'desc' },
              take: 3,
            });
      const selectedOpportunities =
        opportunities.length > 0
          ? opportunities
          : await ctx.db.automationOpportunity.findMany({
              where: { researchRunId: run.id },
              orderBy: { confidenceScore: 'desc' },
              take: 2,
            });

      const draft = createCallPrepDraft(
        run.prospect,
        selectedHypotheses,
        selectedOpportunities,
      );
      const currentCount = await ctx.db.callPrepPlan.count({
        where: { prospectId: run.prospectId },
      });

      return ctx.db.callPrepPlan.create({
        data: {
          prospectId: run.prospectId,
          campaignId: run.campaign?.id,
          researchRunId: run.id,
          workflowLossMapId: latestMap?.id,
          version: currentCount + 1,
          language: 'nl',
          summary: draft.summary,
          plan30: toJson(draft.plan30),
          plan60: toJson(draft.plan60),
          plan90: toJson(draft.plan90),
          stakeholderMap: toJson(draft.stakeholderMap),
          discoveryQuestions: toJson(draft.discoveryQuestions),
          riskList: toJson(draft.riskList),
          demoFlow: toJson(draft.demoFlow),
        },
      });
    }),

  getCallPrepLatest: adminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.callPrepPlan.findFirst({
        where: { prospectId: input.prospectId },
        orderBy: { createdAt: 'desc' },
      });
    }),
});
