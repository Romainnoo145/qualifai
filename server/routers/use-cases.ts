import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import { env } from '@/env.mjs';
import { scanVaultForUseCases } from '@/lib/vault-reader';
import {
  inventoryToCandidates,
  offersToCandidates,
  readJsonSafe,
} from '@/lib/workflow-engine';

export const useCasesRouter = router({
  list: adminProcedure
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
        category?: string;
        isActive?: boolean;
      } = {};
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

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.useCase.findUniqueOrThrow({ where: { id: input.id } });
    }),

  create: adminProcedure
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
          externalUrl: externalUrl === '' ? null : (externalUrl ?? null),
        },
      });
    }),

  update: adminProcedure
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
      const data: Record<string, unknown> = { ...rest };
      if (externalUrl !== undefined) {
        data.externalUrl = externalUrl === '' ? null : externalUrl;
      }
      return ctx.db.useCase.update({
        where: { id },
        data,
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.useCase.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  importFromObsidian: adminProcedure.mutation(async ({ ctx }) => {
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
        where: { sourceRef: candidate.proofId },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.useCase.create({
        data: {
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

  importFromVault: adminProcedure.mutation(async ({ ctx }) => {
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
        where: { sourceRef: candidate.sourceRef },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.useCase.create({
        data: {
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
});
