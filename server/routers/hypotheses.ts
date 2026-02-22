import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { adminProcedure, prospectProcedure, router } from '../trpc';
import {
  generateHypothesisDrafts,
  generateOpportunityDrafts,
  matchProofs,
} from '@/lib/workflow-engine';
import type { Prisma } from '@prisma/client';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export const hypothesesRouter = router({
  listByProspect: adminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [hypotheses, opportunities] = await Promise.all([
        ctx.db.workflowHypothesis.findMany({
          where: { prospectId: input.prospectId },
          orderBy: { createdAt: 'desc' },
          include: {
            proofMatches: {
              include: {
                useCase: {
                  select: {
                    id: true,
                    title: true,
                    summary: true,
                    category: true,
                  },
                },
                evidenceItem: {
                  select: {
                    id: true,
                    sourceUrl: true,
                    snippet: true,
                    sourceType: true,
                    workflowTag: true,
                    title: true,
                  },
                },
              },
              orderBy: { score: 'desc' },
              take: 6,
            },
          },
        }),
        ctx.db.automationOpportunity.findMany({
          where: { prospectId: input.prospectId },
          orderBy: { createdAt: 'desc' },
          include: {
            proofMatches: {
              include: {
                useCase: {
                  select: {
                    id: true,
                    title: true,
                    summary: true,
                    category: true,
                  },
                },
                evidenceItem: {
                  select: {
                    id: true,
                    sourceUrl: true,
                    snippet: true,
                    sourceType: true,
                    workflowTag: true,
                    title: true,
                  },
                },
              },
              orderBy: { score: 'desc' },
              take: 6,
            },
          },
        }),
      ]);

      // Resolve evidenceRefs (JSON array of IDs) into full EvidenceItem records
      const allEvidenceIds = [
        ...hypotheses.flatMap((h) =>
          Array.isArray(h.evidenceRefs) ? (h.evidenceRefs as string[]) : [],
        ),
        ...opportunities.flatMap((o) =>
          Array.isArray(o.evidenceRefs) ? (o.evidenceRefs as string[]) : [],
        ),
      ];
      const dedupedIds = [...new Set(allEvidenceIds)];
      const evidenceItemRecords =
        dedupedIds.length > 0
          ? await ctx.db.evidenceItem.findMany({
              where: { id: { in: dedupedIds } },
            })
          : [];
      const evidenceById = new Map(evidenceItemRecords.map((e) => [e.id, e]));

      return {
        hypotheses: hypotheses.map((h) => ({
          ...h,
          evidenceItems: (Array.isArray(h.evidenceRefs)
            ? (h.evidenceRefs as string[])
            : []
          )
            .map((id) => evidenceById.get(id))
            .filter(Boolean),
        })),
        opportunities: opportunities.map((o) => ({
          ...o,
          evidenceItems: (Array.isArray(o.evidenceRefs)
            ? (o.evidenceRefs as string[])
            : []
          )
            .map((id) => evidenceById.get(id))
            .filter(Boolean),
        })),
      };
    }),

  listAll: adminProcedure
    .input(
      z
        .object({
          status: z
            .enum(['DRAFT', 'ACCEPTED', 'REJECTED', 'PENDING', 'DECLINED'])
            .optional(),
          limit: z.number().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.workflowHypothesis.findMany({
        where: input?.status ? { status: input.status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 100,
        include: {
          prospect: { select: { id: true, companyName: true, domain: true } },
          proofMatches: {
            include: {
              useCase: { select: { id: true, title: true, category: true } },
            },
            orderBy: { score: 'desc' },
            take: 4,
          },
        },
      });
    }),

  setStatus: adminProcedure
    .input(
      z.object({
        kind: z.enum(['hypothesis', 'opportunity']),
        id: z.string(),
        status: z.enum(['DRAFT', 'ACCEPTED', 'REJECTED']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.kind === 'hypothesis') {
        return ctx.db.workflowHypothesis.update({
          where: { id: input.id },
          data: { status: input.status },
        });
      }
      return ctx.db.automationOpportunity.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  regenerateForRun: adminProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.researchRun.findUniqueOrThrow({
        where: { id: input.runId },
      });
      const evidence = await ctx.db.evidenceItem.findMany({
        where: { researchRunId: input.runId },
        orderBy: { confidenceScore: 'desc' },
      });

      const evidenceForEngine = evidence.map((item) => ({
        id: item.id,
        sourceType: item.sourceType,
        workflowTag: item.workflowTag,
        confidenceScore: item.confidenceScore,
      }));
      const hypotheses = generateHypothesisDrafts(evidenceForEngine);
      const opportunities = generateOpportunityDrafts(evidenceForEngine);

      await ctx.db.workflowHypothesis.deleteMany({
        where: { researchRunId: input.runId },
      });
      await ctx.db.automationOpportunity.deleteMany({
        where: { researchRunId: input.runId },
      });

      for (const hypothesis of hypotheses) {
        const created = await ctx.db.workflowHypothesis.create({
          data: {
            researchRunId: input.runId,
            prospectId: run.prospectId,
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

        // Wire matchProofs for hypothesis
        await ctx.db.proofMatch.deleteMany({
          where: { workflowHypothesisId: created.id },
        });
        const hypothesisMatches = await matchProofs(
          ctx.db,
          `${hypothesis.title} ${hypothesis.problemStatement}`,
          4,
        );
        for (const match of hypothesisMatches) {
          await ctx.db.proofMatch.create({
            data: {
              prospectId: run.prospectId,
              workflowHypothesisId: created.id,
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
        }
      }

      for (const opportunity of opportunities) {
        const createdOpp = await ctx.db.automationOpportunity.create({
          data: {
            researchRunId: input.runId,
            prospectId: run.prospectId,
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
            revenueLeakageRecoveredHigh:
              opportunity.revenueLeakageRecoveredHigh,
          },
        });

        // Wire matchProofs for opportunity
        await ctx.db.proofMatch.deleteMany({
          where: { automationOpportunityId: createdOpp.id },
        });
        const opportunityMatches = await matchProofs(
          ctx.db,
          `${opportunity.title} ${opportunity.description}`,
          4,
        );
        for (const match of opportunityMatches) {
          await ctx.db.proofMatch.create({
            data: {
              prospectId: run.prospectId,
              automationOpportunityId: createdOpp.id,
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
        }
      }

      return {
        hypotheses: hypotheses.length,
        opportunities: opportunities.length,
      };
    }),

  validateByProspect: prospectProcedure
    .input(
      z.object({
        slug: z.string(),
        hypothesisId: z.string(),
        action: z.enum(['confirm', 'decline']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ctx.prospectId injected by prospectProcedure middleware
      const hypothesis = await ctx.db.workflowHypothesis.findFirst({
        where: {
          id: input.hypothesisId,
          prospectId: (ctx as unknown as { prospectId: string }).prospectId,
        },
        select: { id: true, status: true },
      });
      if (!hypothesis) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Hypothesis not found for this prospect',
        });
      }
      // DECLINED is final — no-op on re-submit
      if (hypothesis.status === 'DECLINED') {
        return hypothesis;
      }
      const newStatus = input.action === 'confirm' ? 'ACCEPTED' : 'DECLINED';
      return ctx.db.workflowHypothesis.update({
        where: { id: input.hypothesisId },
        data: { status: newStatus },
      });
    }),
});
