import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, projectAdminProcedure } from '../trpc';
import { sendKickoffReminderEmail } from '@/lib/email/kickoff-reminder';

export const engagementRouter = router({
  getByProspect: projectAdminProcedure
    .input(z.object({ prospectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const engagement = await ctx.db.engagement.findFirst({
        where: {
          prospectId: input.prospectId,
          projectId: ctx.projectId,
        },
        include: {
          quote: {
            select: {
              id: true,
              nummer: true,
              acceptedAt: true,
              paymentSchedule: true,
              btwPercentage: true,
              lines: {
                select: {
                  uren: true,
                  tarief: true,
                },
              },
            },
          },
          milestones: { orderBy: { ordering: 'asc' } },
          invoices: { orderBy: { createdAt: 'asc' } },
        },
      });
      return engagement;
    }),

  markKickoffBooked: projectAdminProcedure
    .input(z.object({ engagementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.engagement.updateMany({
        where: { id: input.engagementId, projectId: ctx.projectId },
        data: { kickoffBookedAt: new Date() },
      });
      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Engagement not found in scope',
        });
      }
      return { success: true };
    }),

  completeMilestone: projectAdminProcedure
    .input(
      z.object({
        milestoneId: z.string(),
        completed: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tenant scope check via join to engagement
      const ms = await ctx.db.engagementMilestone.findFirst({
        where: {
          id: input.milestoneId,
          engagement: { projectId: ctx.projectId },
        },
      });
      if (!ms) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.db.engagementMilestone.update({
        where: { id: input.milestoneId },
        data: { completedAt: input.completed ? new Date() : null },
      });
    }),

  sendKickoffLink: projectAdminProcedure
    .input(z.object({ engagementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const engagement = await ctx.db.engagement.findFirst({
        where: { id: input.engagementId, projectId: ctx.projectId },
        include: {
          prospect: {
            include: {
              contacts: {
                where: { primaryEmail: { not: null } },
                take: 1,
                orderBy: { createdAt: 'asc' },
              },
            },
          },
          quote: true,
        },
      });
      if (!engagement) throw new TRPCError({ code: 'NOT_FOUND' });

      await sendKickoffReminderEmail(engagement);
      await ctx.db.engagement.update({
        where: { id: engagement.id },
        data: {
          kickoffReminderCount: { increment: 1 },
          kickoffReminderLastAt: new Date(),
        },
      });
      return { success: true };
    }),
});
