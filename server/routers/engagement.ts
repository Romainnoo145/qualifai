import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, projectAdminProcedure } from '../trpc';

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
});
