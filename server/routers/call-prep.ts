import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import { createCallPrepDraft } from '@/lib/workflow-engine';
import type { Prisma } from '@prisma/client';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export const callPrepRouter = router({
  listByProspect: adminProcedure
    .input(
      z.object({
        prospectId: z.string(),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.callPrepPlan.findMany({
        where: { prospectId: input.prospectId },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  getLatest: adminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.callPrepPlan.findFirst({
        where: { prospectId: input.prospectId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  regenerate: adminProcedure
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
          where: { researchRunId: run.id },
          orderBy: { confidenceScore: 'desc' },
          take: 3,
        }),
        ctx.db.automationOpportunity.findMany({
          where: { researchRunId: run.id },
          orderBy: { confidenceScore: 'desc' },
          take: 2,
        }),
        ctx.db.workflowLossMap.findFirst({
          where: { researchRunId: run.id },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      if (hypotheses.length === 0 || opportunities.length === 0) {
        throw new Error(
          'Research run has no hypotheses/opportunities for call prep',
        );
      }

      const draft = createCallPrepDraft(
        run.prospect,
        hypotheses,
        opportunities,
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
});
