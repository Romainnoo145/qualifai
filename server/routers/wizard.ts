import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { publicProcedure, router } from '../trpc';
import { notifyAdmin } from '@/lib/notifications';

export const wizardRouter = router({
  getWizard: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const prospect = await ctx.db.prospect.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          slug: true,
          companyName: true,
          domain: true,
          industry: true,
          logoUrl: true,
          heroContent: true,
          dataOpportunities: true,
          automationAgents: true,
          successStories: true,
          aiRoadmap: true,
          status: true,
        },
      });

      if (
        !prospect ||
        !['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(
          prospect.status,
        )
      ) {
        return null;
      }

      return prospect;
    }),

  startSession: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        userAgent: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const prospect = await ctx.db.prospect.findUnique({
        where: { slug: input.slug },
      });

      if (!prospect) return null;

      const session = await ctx.db.wizardSession.create({
        data: {
          prospectId: prospect.id,
          userAgent: input.userAgent,
        },
      });

      // Update prospect status on first view
      const isFirstView = !['VIEWED', 'ENGAGED', 'CONVERTED'].includes(
        prospect.status,
      );
      if (isFirstView) {
        await ctx.db.prospect.update({
          where: { id: prospect.id },
          data: { status: 'VIEWED' },
        });

        // Notify admin on first view (fire and forget)
        notifyAdmin({
          prospectId: prospect.id,
          type: 'first_view',
          companyName: prospect.companyName ?? prospect.domain,
          slug: prospect.slug,
        }).catch(console.error);
      }

      return { sessionId: session.id };
    }),

  trackProgress: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        currentStep: z.number().min(0).max(5),
        stepTimes: z.record(z.string(), z.number()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.wizardSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) return null;

      const maxStep = Math.max(session.maxStepReached, input.currentStep);

      await ctx.db.wizardSession.update({
        where: { id: input.sessionId },
        data: {
          currentStep: input.currentStep,
          maxStepReached: maxStep,
          stepTimes: (input.stepTimes as Prisma.InputJsonValue) ?? undefined,
        },
      });

      // If prospect reached step 3+, mark as engaged
      if (maxStep >= 3) {
        await ctx.db.prospect.update({
          where: { id: session.prospectId },
          data: { status: 'ENGAGED' },
        });
      }

      return { maxStep };
    }),

  trackPdfDownload: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.wizardSession.findUnique({
        where: { id: input.sessionId },
        include: { prospect: true },
      });

      if (!session) return null;

      await ctx.db.wizardSession.update({
        where: { id: input.sessionId },
        data: {
          pdfDownloaded: true,
          pdfDownloadedAt: new Date(),
        },
      });

      notifyAdmin({
        prospectId: session.prospectId,
        type: 'pdf_download',
        companyName: session.prospect.companyName ?? session.prospect.domain,
        slug: session.prospect.slug,
      }).catch(console.error);

      return { success: true };
    }),

  trackCallBooked: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.wizardSession.findUnique({
        where: { id: input.sessionId },
        include: { prospect: true },
      });

      if (!session) return null;

      await Promise.all([
        ctx.db.wizardSession.update({
          where: { id: input.sessionId },
          data: {
            callBooked: true,
            callBookedAt: new Date(),
          },
        }),
        ctx.db.prospect.update({
          where: { id: session.prospectId },
          data: { status: 'CONVERTED' },
        }),
      ]);

      notifyAdmin({
        prospectId: session.prospectId,
        type: 'call_booked',
        companyName: session.prospect.companyName ?? session.prospect.domain,
        slug: session.prospect.slug,
      }).catch(console.error);

      return { success: true };
    }),
});
