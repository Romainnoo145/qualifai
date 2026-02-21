import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import type { Prisma } from '@prisma/client';

export const signalsRouter = router({
  fetchForCompany: adminProcedure
    .input(z.object({ prospectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.prospect.findUniqueOrThrow({
        where: { id: input.prospectId },
      });

      // Apollo-only mode: third-party signal ingestion is disabled for now.
      return { count: 0 };
    }),

  fetchForContact: adminProcedure
    .input(z.object({ contactId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.contact.findUniqueOrThrow({
        where: { id: input.contactId },
      });

      // Apollo-only mode: third-party signal ingestion is disabled for now.
      return { count: 0 };
    }),

  list: adminProcedure
    .input(
      z
        .object({
          signalType: z.string().optional(),
          isProcessed: z.boolean().optional(),
          prospectId: z.string().optional(),
          contactId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.SignalWhereInput = {};
      if (input?.signalType) where.signalType = input.signalType as never;
      if (input?.isProcessed !== undefined)
        where.isProcessed = input.isProcessed;
      if (input?.prospectId) where.prospectId = input.prospectId;
      if (input?.contactId) where.contactId = input.contactId;

      const signals = await ctx.db.signal.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        take: (input?.limit ?? 50) + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        include: {
          prospect: { select: { id: true, companyName: true, domain: true } },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (signals.length > (input?.limit ?? 50)) {
        const next = signals.pop();
        nextCursor = next?.id;
      }

      return { signals, nextCursor };
    }),

  markProcessed: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.signal.update({
        where: { id: input.id },
        data: { isProcessed: true },
      });
    }),

  getDashboard: adminProcedure.query(async ({ ctx }) => {
    const signals = await ctx.db.signal.findMany({
      where: { isProcessed: false },
      orderBy: { detectedAt: 'desc' },
      take: 20,
      include: {
        prospect: { select: { id: true, companyName: true, domain: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true, jobTitle: true },
        },
      },
    });

    return { signals };
  }),
});
