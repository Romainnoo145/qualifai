import { z } from 'zod';
import { UseCaseSector } from '@prisma/client';
import { projectAdminProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

async function assertUseCaseInProject(
  ctx: {
    db: {
      useCase: {
        findFirst: (args: {
          where: { id: string; projectId: string };
          select: { id: true };
        }) => Promise<{ id: string } | null>;
      };
    };
    projectId: string;
  },
  id: string,
) {
  const useCase = await ctx.db.useCase.findFirst({
    where: { id, projectId: ctx.projectId },
    select: { id: true },
  });
  if (!useCase) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Use case not found in active project scope',
    });
  }
}

export const useCasesRouter = router({
  list: projectAdminProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          sector: z.nativeEnum(UseCaseSector).optional(),
          isActive: z.boolean().optional(),
          limit: z.number().min(1).max(500).default(200),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        projectId: ctx.projectId,
      };
      if (input?.category !== undefined) where.category = input.category;
      if (input?.sector !== undefined) where.sector = input.sector;
      if (input?.isActive !== undefined) where.isActive = input.isActive;

      return ctx.db.useCase.findMany({
        where,
        orderBy: [{ sector: 'asc' }, { updatedAt: 'desc' }],
        take: input?.limit ?? 200,
        include: {
          _count: { select: { proofMatches: true } },
        },
      });
    }),

  getById: projectAdminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const useCase = await ctx.db.useCase.findFirst({
        where: { id: input.id, projectId: ctx.projectId },
      });
      if (!useCase) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Use case not found in active project scope',
        });
      }
      return useCase;
    }),

  create: projectAdminProcedure
    .input(
      z.object({
        title: z.string().min(2),
        summary: z.string().min(10),
        category: z.string().min(2),
        sector: z.nativeEnum(UseCaseSector).optional(),
        outcomes: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([]),
        caseStudyRefs: z.array(z.string()).default([]),
        isActive: z.boolean().default(true),
        isShipped: z.boolean().default(true),
        externalUrl: z.string().url().optional().or(z.literal('')),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { externalUrl, ...rest } = input;
      return ctx.db.useCase.create({
        data: {
          ...rest,
          projectId: ctx.projectId,
          externalUrl: externalUrl === '' ? null : (externalUrl ?? null),
        },
      });
    }),

  update: projectAdminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(2).optional(),
        summary: z.string().min(10).optional(),
        category: z.string().min(2).optional(),
        sector: z.nativeEnum(UseCaseSector).optional(),
        outcomes: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        caseStudyRefs: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        isShipped: z.boolean().optional(),
        externalUrl: z.string().url().optional().or(z.literal('')),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, externalUrl, ...rest } = input;
      await assertUseCaseInProject(ctx, id);

      const data: Record<string, unknown> = { ...rest };
      if (externalUrl !== undefined) {
        data.externalUrl = externalUrl === '' ? null : externalUrl;
      }

      return ctx.db.useCase.update({
        where: { id },
        data,
      });
    }),

  delete: projectAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertUseCaseInProject(ctx, input.id);
      return ctx.db.useCase.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),
});
