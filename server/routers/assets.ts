import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { adminProcedure, router } from '../trpc';
import {
  buildCalBookingUrl,
  CTA_STEP_1,
  CTA_STEP_2,
  createCallPrepDraft,
  createOutreachSequenceSteps,
  createWorkflowLossMapDraft,
  validateTwoStepCta,
} from '@/lib/workflow-engine';
import { persistWorkflowLossMapPdf } from '@/lib/pdf-storage';
import { env } from '@/env.mjs';
import type { Prisma } from '@prisma/client';
import { buildDiscoverUrl } from '@/lib/prospect-url';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

type ResearchGateSummary = {
  passed: boolean;
  reasons?: string[];
};

function extractGateFromSummary(summary: unknown): ResearchGateSummary | null {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary))
    return null;
  const gate = (summary as Record<string, unknown>).gate;
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) return null;
  const passed = (gate as Record<string, unknown>).passed;
  if (typeof passed !== 'boolean') return null;

  const reasonsRaw = (gate as Record<string, unknown>).reasons;
  const reasons = Array.isArray(reasonsRaw)
    ? reasonsRaw.filter((item): item is string => typeof item === 'string')
    : [];

  return { passed, reasons };
}

export const assetsRouter = router({
  generate: adminProcedure
    .input(
      z.object({
        runId: z.string(),
      }),
    )
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
            select: { id: true, strictGate: true },
          },
          workflowHypotheses: {
            where: { status: { in: ['ACCEPTED', 'PENDING'] } },
            orderBy: { confidenceScore: 'desc' },
            take: 3,
          },
          automationOpportunities: {
            where: { status: { in: ['ACCEPTED', 'PENDING'] } },
            orderBy: { confidenceScore: 'desc' },
            take: 2,
          },
        },
      });

      const hypotheses =
        run.workflowHypotheses.length > 0
          ? run.workflowHypotheses
          : await ctx.db.workflowHypothesis.findMany({
              where: { researchRunId: run.id },
              orderBy: { confidenceScore: 'desc' },
              take: 3,
            });
      const opportunities =
        run.automationOpportunities.length > 0
          ? run.automationOpportunities
          : await ctx.db.automationOpportunity.findMany({
              where: { researchRunId: run.id },
              orderBy: { confidenceScore: 'desc' },
              take: 2,
            });

      const strictGateEnabled = run.campaign?.strictGate ?? true;
      if (strictGateEnabled) {
        const gate = extractGateFromSummary(run.summary);
        const hasOverride =
          run.qualityApproved === true &&
          typeof run.qualityNotes === 'string' &&
          run.qualityNotes.trim().length >= 12;
        if (!gate?.passed && !hasOverride) {
          const reasons =
            gate?.reasons?.join('; ') ?? 'evidence quality gate not met';
          throw new Error(
            `Cannot generate assets before gate passes: ${reasons}. Review quality and add override reason if proceeding.`,
          );
        }
      }

      if (hypotheses.length === 0 || opportunities.length === 0) {
        throw new Error(
          'Research run has no hypotheses/opportunities to build a loss map',
        );
      }

      const proofMatches = await ctx.db.proofMatch.findMany({
        where: {
          OR: [
            { workflowHypothesisId: { in: hypotheses.map((h) => h.id) } },
            { automationOpportunityId: { in: opportunities.map((o) => o.id) } },
          ],
        },
        orderBy: { score: 'desc' },
        take: 10,
      });

      const proofTitles = proofMatches.map((match) => match.proofTitle);
      const bookingUrl = buildCalBookingUrl(
        env.NEXT_PUBLIC_CALCOM_BOOKING_URL,
        {
          company: run.prospect.companyName ?? run.prospect.domain,
        },
      );
      const draft = createWorkflowLossMapDraft(
        run.prospect,
        hypotheses,
        opportunities,
        proofTitles,
        bookingUrl,
      );
      if (
        !validateTwoStepCta(draft.markdown) ||
        !validateTwoStepCta(draft.emailBodyText) ||
        !validateTwoStepCta(draft.emailBodyHtml)
      ) {
        throw new Error('Generated assets must include the exact 2-step CTA');
      }

      const existingCount = await ctx.db.workflowLossMap.count({
        where: { prospectId: run.prospectId },
      });
      const version = existingCount + 1;

      const record = await ctx.db.workflowLossMap.create({
        data: {
          prospectId: run.prospectId,
          researchRunId: run.id,
          campaignId: run.campaign?.id,
          version,
          language: 'nl',
          title: draft.title,
          markdown: draft.markdown,
          html: draft.html,
          pdfUrl: null,
          metrics: toJson(draft.metrics),
          emailSubject: draft.emailSubject,
          emailBodyText: draft.emailBodyText,
          emailBodyHtml: draft.emailBodyHtml,
          demoScript: draft.demoScript,
          ctaStep1: CTA_STEP_1,
          ctaStep2: CTA_STEP_2,
        },
      });

      const pdf = await persistWorkflowLossMapPdf({
        lossMapId: record.id,
        version: record.version,
        companyName: run.prospect.companyName ?? run.prospect.domain,
        markdown: draft.markdown,
      });
      if (!pdf.pdfUrl) return record;

      return ctx.db.workflowLossMap.update({
        where: { id: record.id },
        data: { pdfUrl: pdf.pdfUrl },
      });
    }),

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

  queueOutreachDraft: adminProcedure
    .input(
      z.object({
        workflowLossMapId: z.string(),
        contactId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [map, contact] = await Promise.all([
        ctx.db.workflowLossMap.findUniqueOrThrow({
          where: { id: input.workflowLossMapId },
          include: {
            prospect: {
              select: {
                id: true,
                slug: true,
                readableSlug: true,
                companyName: true,
                domain: true,
              },
            },
          },
        }),
        ctx.db.contact.findUniqueOrThrow({
          where: { id: input.contactId },
        }),
      ]);

      // Hypothesis approval gate — block outreach unless at least one hypothesis is approved or pending
      const approvedHypothesisCount = await ctx.db.workflowHypothesis.count({
        where: {
          prospectId: map.prospect.id,
          status: { in: ['ACCEPTED', 'PENDING'] },
        },
      });
      if (approvedHypothesisCount === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'Outreach blocked: approve at least one hypothesis before generating sequences.',
        });
      }

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
      const lossMapUrl = buildDiscoverUrl(appUrl, {
        slug: map.prospect.slug,
        readableSlug: map.prospect.readableSlug,
        companyName: map.prospect.companyName,
        domain: map.prospect.domain,
      });
      const companyName = map.prospect.companyName ?? map.prospect.domain;
      const calBookingUrl = buildCalBookingUrl(
        env.NEXT_PUBLIC_CALCOM_BOOKING_URL,
        {
          name: `${contact.firstName} ${contact.lastName}`.trim(),
          email: contact.primaryEmail ?? undefined,
          company: companyName,
        },
      );
      const steps = createOutreachSequenceSteps(
        contact.firstName,
        companyName,
        lossMapUrl,
        calBookingUrl,
      );
      const firstStep = steps[0];
      if (!firstStep) {
        throw new Error('Sequence template generated no steps');
      }

      const sequence = await ctx.db.outreachSequence.create({
        data: {
          prospectId: map.prospect.id,
          contactId: contact.id,
          campaignId: map.campaignId ?? undefined,
          researchRunId: map.researchRunId,
          workflowLossMapId: map.id,
          templateKey: 'Sprint_2Step_Intro',
          status: 'DRAFTED',
          isEvidenceBacked: true,
          metadata: toJson({
            workflowOffer: 'Workflow Optimization Sprint',
            ctaStep1: map.ctaStep1,
            ctaStep2: map.ctaStep2,
            calBookingUrl,
            calEventTypeId: env.CALCOM_EVENT_TYPE_ID ?? null,
          }),
        },
      });

      await ctx.db.outreachStep.create({
        data: {
          sequenceId: sequence.id,
          stepOrder: firstStep.order,
          subject: firstStep.subject,
          bodyText: firstStep.bodyText,
          bodyHtml: firstStep.bodyHtml,
          status: 'DRAFTED',
          metadata: toJson({ channel: 'email', seeded: true }),
        },
      });

      const draft = await ctx.db.outreachLog.create({
        data: {
          contactId: contact.id,
          type: 'INTRO_EMAIL',
          channel: 'email',
          status: 'draft',
          subject: firstStep.subject,
          bodyText: firstStep.bodyText,
          bodyHtml: firstStep.bodyHtml,
          metadata: toJson({
            outreachSequenceId: sequence.id,
            workflowLossMapId: map.id,
            evidenceBacked: true,
            ctaStep1: map.ctaStep1,
            ctaStep2: map.ctaStep2,
            calBookingUrl,
            calEventTypeId: env.CALCOM_EVENT_TYPE_ID ?? null,
          }),
        },
      });

      await ctx.db.outreachStep.update({
        where: {
          sequenceId_stepOrder: {
            sequenceId: sequence.id,
            stepOrder: 1,
          },
        },
        data: {
          outreachLogId: draft.id,
          status: 'QUEUED',
        },
      });

      if (contact.outreachStatus === 'NONE') {
        await ctx.db.contact.update({
          where: { id: contact.id },
          data: { outreachStatus: 'QUEUED' },
        });
      }

      return {
        sequenceId: sequence.id,
        draftId: draft.id,
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
