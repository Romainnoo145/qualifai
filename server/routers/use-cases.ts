import { z } from 'zod';
import { projectAdminProcedure, router } from '../trpc';
import { env } from '@/env.mjs';
import { scanVaultForUseCases } from '@/lib/vault-reader';
import { analyzeCodebase } from '@/lib/codebase-analyzer';
import {
  inventoryToCandidates,
  offersToCandidates,
  readJsonSafe,
} from '@/lib/workflow-engine';
import { scanAtlantisVolumesForUseCases } from '@/lib/atlantis-volume-reader';
import { TRPCError } from '@trpc/server';

const DEFAULT_ATLANTIS_VOLUMES_PATH =
  '/home/klarifai/Documents/obsidian/Nexus-Point/10_The_Forge/atlantis/RAG-Volumes';

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
          isActive: z.boolean().optional(),
          limit: z.number().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where: {
        projectId: string;
        category?: string;
        isActive?: boolean;
      } = {
        projectId: ctx.projectId,
      };
      if (input?.category !== undefined) where.category = input.category;
      if (input?.isActive !== undefined) where.isActive = input.isActive;

      return ctx.db.useCase.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: input?.limit ?? 100,
        include: {
          _count: {
            select: {
              proofMatches: true,
            },
          },
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

  importFromObsidian: projectAdminProcedure.mutation(async ({ ctx }) => {
    const errors: string[] = [];

    let inventoryPayload: unknown = null;
    let offersPayload: unknown = null;

    try {
      inventoryPayload = await readJsonSafe(env.OBSIDIAN_INVENTORY_JSON_PATH);
      if (inventoryPayload === null && env.OBSIDIAN_INVENTORY_JSON_PATH) {
        errors.push(`Could not read file: ${env.OBSIDIAN_INVENTORY_JSON_PATH}`);
      }
    } catch {
      errors.push(
        `Could not read file: ${env.OBSIDIAN_INVENTORY_JSON_PATH ?? '(unset)'}`,
      );
    }

    try {
      offersPayload = await readJsonSafe(env.OBSIDIAN_CLIENT_OFFERS_JSON_PATH);
      if (offersPayload === null && env.OBSIDIAN_CLIENT_OFFERS_JSON_PATH) {
        errors.push(
          `Could not read file: ${env.OBSIDIAN_CLIENT_OFFERS_JSON_PATH}`,
        );
      }
    } catch {
      errors.push(
        `Could not read file: ${env.OBSIDIAN_CLIENT_OFFERS_JSON_PATH ?? '(unset)'}`,
      );
    }

    const candidates = [
      ...inventoryToCandidates(inventoryPayload),
      ...offersToCandidates(offersPayload),
    ];

    let created = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const existing = await ctx.db.useCase.findFirst({
        where: {
          projectId: ctx.projectId,
          sourceRef: candidate.proofId,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.useCase.create({
        data: {
          projectId: ctx.projectId,
          title: candidate.title,
          summary: candidate.summary,
          category: 'workflow',
          tags: candidate.keywords,
          outcomes: [],
          caseStudyRefs: candidate.url ? [candidate.url] : [],
          isActive: true,
          isShipped: candidate.shipped,
          sourceRef: candidate.proofId,
          externalUrl: candidate.url,
        },
      });

      created++;
    }

    return { created, skipped, errors };
  }),

  importFromVault: projectAdminProcedure.mutation(async ({ ctx }) => {
    const configuredPath =
      env.OBSIDIAN_VAULT_PATH ?? process.env.OBSIDIAN_VAULT_PATH;

    if (!configuredPath) {
      return {
        created: 0,
        skipped: 0,
        filesScanned: 0,
        errors: ['OBSIDIAN_VAULT_PATH not configured'],
      };
    }

    const scanResult = await scanVaultForUseCases(configuredPath);
    let created = 0;
    let skipped = 0;

    for (const candidate of scanResult.candidates) {
      const existing = await ctx.db.useCase.findFirst({
        where: {
          projectId: ctx.projectId,
          sourceRef: candidate.sourceRef,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.useCase.create({
        data: {
          projectId: ctx.projectId,
          title: candidate.title,
          summary: candidate.summary,
          category: candidate.category,
          outcomes: candidate.outcomes,
          tags: candidate.tags,
          caseStudyRefs: [],
          isActive: true,
          isShipped: true,
          sourceRef: candidate.sourceRef,
          externalUrl: null,
        },
      });

      created++;
    }

    return {
      created,
      skipped,
      filesScanned: scanResult.filesScanned,
      errors: scanResult.errors,
    };
  }),

  importFromAtlantisVolumes: projectAdminProcedure.mutation(async ({ ctx }) => {
    if (ctx.activeProject.projectType !== 'ATLANTIS') {
      return {
        created: 0,
        skipped: 0,
        filesScanned: 0,
        errors: ['Active project is not ATLANTIS; switch scope to europe-gate'],
      };
    }

    const configuredPath =
      env.ATLANTIS_RAG_VOLUMES_PATH ?? DEFAULT_ATLANTIS_VOLUMES_PATH;

    const scanResult = await scanAtlantisVolumesForUseCases(configuredPath);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const candidate of scanResult.candidates) {
      const existing = await ctx.db.useCase.findFirst({
        where: {
          projectId: ctx.projectId,
          sourceRef: candidate.sourceRef,
        },
        select: {
          id: true,
          title: true,
          summary: true,
          category: true,
          outcomes: true,
          tags: true,
          externalUrl: true,
          isActive: true,
          isShipped: true,
        },
      });

      if (!existing) {
        await ctx.db.useCase.create({
          data: {
            projectId: ctx.projectId,
            title: candidate.title,
            summary: candidate.summary,
            category: candidate.category,
            outcomes: candidate.outcomes,
            tags: candidate.tags,
            caseStudyRefs: [],
            isActive: true,
            isShipped: true,
            sourceRef: candidate.sourceRef,
            externalUrl: candidate.externalUrl,
          },
        });

        created++;
        continue;
      }

      const hasChanges =
        existing.title !== candidate.title ||
        existing.summary !== candidate.summary ||
        existing.category !== candidate.category ||
        JSON.stringify(existing.outcomes) !== JSON.stringify(candidate.outcomes) ||
        JSON.stringify(existing.tags) !== JSON.stringify(candidate.tags) ||
        existing.externalUrl !== candidate.externalUrl ||
        existing.isActive !== true ||
        existing.isShipped !== true;

      if (!hasChanges) {
        skipped++;
        continue;
      }

      await ctx.db.useCase.update({
        where: { id: existing.id },
        data: {
          title: candidate.title,
          summary: candidate.summary,
          category: candidate.category,
          outcomes: candidate.outcomes,
          tags: candidate.tags,
          isActive: true,
          isShipped: true,
          externalUrl: candidate.externalUrl,
        },
      });

      updated++;
    }

    return {
      created,
      updated,
      skipped,
      filesScanned: scanResult.filesScanned,
      errors: scanResult.errors,
      scannedPath: configuredPath,
    };
  }),

  importFromCodebase: projectAdminProcedure
    .input(
      z.object({
        projectPath: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const analysis = await analyzeCodebase(input.projectPath);
      let created = 0;
      let skipped = 0;

      for (const candidate of analysis.candidates) {
        const existing = await ctx.db.useCase.findFirst({
          where: {
            projectId: ctx.projectId,
            sourceRef: candidate.sourceRef,
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await ctx.db.useCase.create({
          data: {
            projectId: ctx.projectId,
            title: candidate.title,
            summary: candidate.summary,
            category: candidate.category,
            outcomes: candidate.outcomes,
            tags: candidate.tags,
            caseStudyRefs: [],
            isActive: true,
            isShipped: true,
            sourceRef: candidate.sourceRef,
            externalUrl: null,
          },
        });

        created++;
      }

      return {
        created,
        skipped,
        filesAnalyzed: analysis.filesAnalyzed,
        projectName: analysis.projectName,
        errors: analysis.errors,
      };
    }),
});
