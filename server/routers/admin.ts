import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import { nanoid } from 'nanoid';
import { enrichCompanyByDomain } from '@/lib/lusha';
import { generateWizardContent } from '@/lib/ai/generate-wizard';
import type { CompanyContext, IndustryPrompts } from '@/lib/ai/prompts';
import type { Prisma } from '@prisma/client';

// Helper to cast to Prisma-compatible JSON
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export const adminRouter = router({
  createProspect: adminProcedure
    .input(z.object({ domain: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const slug = nanoid(8);

      const prospect = await ctx.db.prospect.create({
        data: {
          domain: input.domain
            .replace(/^(https?:\/\/)?(www\.)?/, '')
            .split('/')[0]!,
          slug,
          status: 'DRAFT',
        },
      });

      return prospect;
    }),

  enrichProspect: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const prospect = await ctx.db.prospect.findUniqueOrThrow({
        where: { id: input.id },
      });

      const enriched = await enrichCompanyByDomain(prospect.domain);

      const updated = await ctx.db.prospect.update({
        where: { id: input.id },
        data: {
          companyName: enriched.companyName,
          industry: enriched.industry,
          subIndustry: enriched.subIndustry,
          employeeRange: enriched.employeeRange,
          revenueRange: enriched.revenueRange,
          technologies: enriched.technologies,
          specialties: enriched.specialties,
          country: enriched.country,
          city: enriched.city,
          description: enriched.description,
          logoUrl: enriched.logoUrl,
          lushaRawData: toJson(enriched.rawData),
          status: 'ENRICHED',
        },
      });

      return updated;
    }),

  generateContent: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const prospect = await ctx.db.prospect.findUniqueOrThrow({
        where: { id: input.id },
      });

      await ctx.db.prospect.update({
        where: { id: input.id },
        data: { status: 'GENERATING' },
      });

      // Find matching industry template
      const template = prospect.industry
        ? await ctx.db.industryTemplate.findFirst({
            where: { industry: prospect.industry },
          })
        : null;

      const companyContext: CompanyContext = {
        companyName: prospect.companyName ?? prospect.domain,
        domain: prospect.domain,
        industry: prospect.industry,
        subIndustry: prospect.subIndustry,
        employeeRange: prospect.employeeRange,
        revenueRange: prospect.revenueRange,
        technologies: prospect.technologies,
        specialties: prospect.specialties,
        country: prospect.country,
        city: prospect.city,
        description: prospect.description,
      };

      const industryPrompts: IndustryPrompts | undefined = template
        ? {
            dataOpportunityPrompts: template.dataOpportunityPrompts as string[],
            automationPrompts: template.automationPrompts as string[],
            successStoryTemplates: template.successStoryTemplates as Array<{
              title: string;
              industry: string;
              outcome: string;
            }>,
            roadmapTemplates: template.roadmapTemplates as Array<{
              phase: string;
              items: string[];
            }>,
          }
        : undefined;

      const content = await generateWizardContent(
        companyContext,
        industryPrompts,
      );

      const updated = await ctx.db.prospect.update({
        where: { id: input.id },
        data: {
          heroContent: content.heroContent as Prisma.InputJsonValue,
          dataOpportunities: content.dataOpportunities as Prisma.InputJsonValue,
          automationAgents: content.automationAgents as Prisma.InputJsonValue,
          successStories: content.successStories as Prisma.InputJsonValue,
          aiRoadmap: content.aiRoadmap as Prisma.InputJsonValue,
          status: 'READY',
        },
      });

      return updated;
    }),

  // Combined: create + enrich + generate in one action
  createAndProcess: adminProcedure
    .input(
      z.object({
        domain: z.string().min(1),
        internalNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = nanoid(8);
      const cleanDomain = input.domain
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .split('/')[0]!;

      // Create prospect
      let prospect = await ctx.db.prospect.create({
        data: {
          domain: cleanDomain,
          slug,
          status: 'DRAFT',
          internalNotes: input.internalNotes,
        },
      });

      // Enrich via Lusha
      try {
        const enriched = await enrichCompanyByDomain(cleanDomain);
        prospect = await ctx.db.prospect.update({
          where: { id: prospect.id },
          data: {
            companyName: enriched.companyName,
            industry: enriched.industry,
            subIndustry: enriched.subIndustry,
            employeeRange: enriched.employeeRange,
            revenueRange: enriched.revenueRange,
            technologies: enriched.technologies,
            specialties: enriched.specialties,
            country: enriched.country,
            city: enriched.city,
            description: enriched.description,
            logoUrl: enriched.logoUrl,
            lushaRawData: toJson(enriched.rawData),
            status: 'ENRICHED',
          },
        });
      } catch (error) {
        console.error('Lusha enrichment failed:', error);
        // Continue with domain-only data
      }

      // Generate AI content
      await ctx.db.prospect.update({
        where: { id: prospect.id },
        data: { status: 'GENERATING' },
      });

      const template = prospect.industry
        ? await ctx.db.industryTemplate.findFirst({
            where: { industry: prospect.industry },
          })
        : null;

      const companyContext: CompanyContext = {
        companyName: prospect.companyName ?? cleanDomain,
        domain: cleanDomain,
        industry: prospect.industry,
        subIndustry: prospect.subIndustry,
        employeeRange: prospect.employeeRange,
        revenueRange: prospect.revenueRange,
        technologies: prospect.technologies,
        specialties: prospect.specialties,
        country: prospect.country,
        city: prospect.city,
        description: prospect.description,
      };

      const industryPrompts: IndustryPrompts | undefined = template
        ? {
            dataOpportunityPrompts: template.dataOpportunityPrompts as string[],
            automationPrompts: template.automationPrompts as string[],
            successStoryTemplates: template.successStoryTemplates as Array<{
              title: string;
              industry: string;
              outcome: string;
            }>,
            roadmapTemplates: template.roadmapTemplates as Array<{
              phase: string;
              items: string[];
            }>,
          }
        : undefined;

      const content = await generateWizardContent(
        companyContext,
        industryPrompts,
      );

      prospect = await ctx.db.prospect.update({
        where: { id: prospect.id },
        data: {
          heroContent: content.heroContent as Prisma.InputJsonValue,
          dataOpportunities: content.dataOpportunities as Prisma.InputJsonValue,
          automationAgents: content.automationAgents as Prisma.InputJsonValue,
          successStories: content.successStories as Prisma.InputJsonValue,
          aiRoadmap: content.aiRoadmap as Prisma.InputJsonValue,
          status: 'READY',
        },
      });

      return prospect;
    }),

  listProspects: adminProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where = input?.status ? { status: input.status as never } : {};
      const prospects = await ctx.db.prospect.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: (input?.limit ?? 50) + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        include: {
          _count: { select: { sessions: true } },
        },
      });

      let nextCursor: string | undefined;
      if (prospects.length > (input?.limit ?? 50)) {
        const next = prospects.pop();
        nextCursor = next?.id;
      }

      return { prospects, nextCursor };
    }),

  getProspect: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.prospect.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          sessions: { orderBy: { createdAt: 'desc' }, take: 20 },
          notificationLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
          _count: { select: { sessions: true } },
        },
      });
    }),

  updateProspect: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z
          .enum([
            'DRAFT',
            'ENRICHED',
            'GENERATING',
            'READY',
            'SENT',
            'VIEWED',
            'ENGAGED',
            'CONVERTED',
            'ARCHIVED',
          ])
          .optional(),
        internalNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.prospect.update({
        where: { id: input.id },
        data: {
          ...(input.status !== undefined && { status: input.status }),
          ...(input.internalNotes !== undefined && {
            internalNotes: input.internalNotes,
          }),
        },
      });
    }),

  getDashboardStats: adminProcedure.query(async ({ ctx }) => {
    const [total, ready, viewed, engaged, converted, recentSessions] =
      await Promise.all([
        ctx.db.prospect.count(),
        ctx.db.prospect.count({ where: { status: 'READY' } }),
        ctx.db.prospect.count({ where: { status: 'VIEWED' } }),
        ctx.db.prospect.count({ where: { status: 'ENGAGED' } }),
        ctx.db.prospect.count({ where: { status: 'CONVERTED' } }),
        ctx.db.wizardSession.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { prospect: { select: { companyName: true, slug: true } } },
        }),
      ]);

    return { total, ready, viewed, engaged, converted, recentSessions };
  }),
});
