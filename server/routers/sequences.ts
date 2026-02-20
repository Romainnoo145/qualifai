import { z } from 'zod';
import { adminProcedure, router } from '../trpc';

function metadataAsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export const sequencesRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          prospectId: z.string().optional(),
          contactId: z.string().optional(),
          status: z
            .enum([
              'DRAFTED',
              'QUEUED',
              'SENT',
              'OPENED',
              'REPLIED',
              'BOOKED',
              'CLOSED_LOST',
            ])
            .optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.outreachSequence.findMany({
        where: {
          ...(input?.prospectId ? { prospectId: input.prospectId } : {}),
          ...(input?.contactId ? { contactId: input.contactId } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 50,
        include: {
          prospect: { select: { id: true, companyName: true, domain: true } },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
            },
          },
          workflowLossMap: { select: { id: true, title: true, version: true } },
          steps: { orderBy: { stepOrder: 'asc' } },
        },
      });
    }),

  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.outreachSequence.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          prospect: { select: { id: true, companyName: true, domain: true } },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
            },
          },
          workflowLossMap: true,
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: { outreachLog: true },
          },
        },
      });
    }),

  setStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          'DRAFTED',
          'QUEUED',
          'SENT',
          'OPENED',
          'REPLIED',
          'BOOKED',
          'CLOSED_LOST',
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.outreachSequence.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  setStepStatus: adminProcedure
    .input(
      z.object({
        sequenceId: z.string(),
        stepOrder: z.number().int().positive(),
        status: z.enum([
          'DRAFTED',
          'QUEUED',
          'SENT',
          'OPENED',
          'REPLIED',
          'BOOKED',
          'CLOSED_LOST',
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.outreachStep.update({
        where: {
          sequenceId_stepOrder: {
            sequenceId: input.sequenceId,
            stepOrder: input.stepOrder,
          },
        },
        data: { status: input.status },
      });
    }),

  getCadenceState: adminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Find all sequences for this prospect
      const sequences = await ctx.db.outreachSequence.findMany({
        where: { prospectId: input.prospectId },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            select: {
              id: true,
              stepOrder: true,
              status: true,
              scheduledAt: true,
              triggeredBy: true,
              nextStepReadyAt: true,
              sentAt: true,
              metadata: true,
              createdAt: true,
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
              primaryPhone: true,
              linkedinUrl: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Get engagement signals from latest wizard session
      const wizardSession = await ctx.db.wizardSession.findFirst({
        where: { prospectId: input.prospectId },
        orderBy: { createdAt: 'desc' },
        select: { maxStepReached: true, pdfDownloaded: true },
      });

      // Compute cadence state summary for the most recent active sequence
      const activeSeq = sequences.find((s) => s.status !== 'CLOSED_LOST');
      const completedSteps =
        activeSeq?.steps.filter((s) => ['SENT', 'QUEUED'].includes(s.status)) ??
        [];
      const pendingStep =
        activeSeq?.steps.find((s) => s.status === 'DRAFTED') ?? null;

      return {
        sequences,
        engagementLevel:
          (wizardSession?.maxStepReached ?? 0) >= 3 ||
          wizardSession?.pdfDownloaded
            ? 'high'
            : 'normal',
        summary: {
          touchCount: completedSteps.length,
          hasPendingStep: !!pendingStep,
          nextStepReadyAt: pendingStep?.nextStepReadyAt ?? null,
          nextChannel: pendingStep
            ? ((metadataAsObject(pendingStep.metadata).channel as string) ??
              'email')
            : null,
          isExhausted: activeSeq?.status === 'CLOSED_LOST',
        },
      };
    }),
});
