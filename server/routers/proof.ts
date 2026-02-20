import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import { matchProofs } from '@/lib/workflow-engine';

export const proofRouter = router({
  matchForRun: adminProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.researchRun.findUniqueOrThrow({
        where: { id: input.runId },
      });

      const [hypotheses, opportunities] = await Promise.all([
        ctx.db.workflowHypothesis.findMany({
          where: { researchRunId: input.runId },
          orderBy: [{ status: 'asc' }, { confidenceScore: 'desc' }],
        }),
        ctx.db.automationOpportunity.findMany({
          where: { researchRunId: input.runId },
          orderBy: [{ status: 'asc' }, { confidenceScore: 'desc' }],
        }),
      ]);

      let matchesCreated = 0;

      for (const hypothesis of hypotheses) {
        await ctx.db.proofMatch.deleteMany({
          where: { workflowHypothesisId: hypothesis.id },
        });
        const query = `${hypothesis.title} ${hypothesis.problemStatement}`;
        const matches = await matchProofs(ctx.db, query, 4);
        for (const match of matches) {
          await ctx.db.proofMatch.create({
            data: {
              prospectId: run.prospectId,
              workflowHypothesisId: hypothesis.id,
              sourceType: match.sourceType,
              proofId: match.proofId,
              proofTitle: match.proofTitle,
              proofSummary: match.proofSummary,
              proofUrl: match.proofUrl,
              score: match.score,
              isRealShipped: match.isRealShipped,
              isCustomPlan: match.isCustomPlan,
              useCaseId: match.isCustomPlan ? undefined : match.proofId,
            },
          });
          matchesCreated++;
        }
      }

      for (const opportunity of opportunities) {
        await ctx.db.proofMatch.deleteMany({
          where: { automationOpportunityId: opportunity.id },
        });
        const query = `${opportunity.title} ${opportunity.description}`;
        const matches = await matchProofs(ctx.db, query, 4);
        for (const match of matches) {
          await ctx.db.proofMatch.create({
            data: {
              prospectId: run.prospectId,
              automationOpportunityId: opportunity.id,
              sourceType: match.sourceType,
              proofId: match.proofId,
              proofTitle: match.proofTitle,
              proofSummary: match.proofSummary,
              proofUrl: match.proofUrl,
              score: match.score,
              isRealShipped: match.isRealShipped,
              isCustomPlan: match.isCustomPlan,
              useCaseId: match.isCustomPlan ? undefined : match.proofId,
            },
          });
          matchesCreated++;
        }
      }

      return { matchesCreated };
    }),

  listForHypothesis: adminProcedure
    .input(z.object({ hypothesisId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.proofMatch.findMany({
        where: { workflowHypothesisId: input.hypothesisId },
        orderBy: { score: 'desc' },
      });
    }),

  listForOpportunity: adminProcedure
    .input(z.object({ opportunityId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.proofMatch.findMany({
        where: { automationOpportunityId: input.opportunityId },
        orderBy: { score: 'desc' },
      });
    }),

  listByProspect: adminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.proofMatch.findMany({
        where: { prospectId: input.prospectId },
        orderBy: [{ createdAt: 'desc' }, { score: 'desc' }],
        take: 100,
      });
    }),
});
