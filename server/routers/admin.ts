import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import { nanoid } from 'nanoid';
import { enrichCompany } from '@/lib/enrichment';
import { mergeApolloWithKvk } from '@/lib/enrichment/merge';
import { generateWizardContent } from '@/lib/ai/generate-wizard';
import type { CompanyContext, IndustryPrompts } from '@/lib/ai/prompts';
import type { Prisma } from '@prisma/client';
import { env } from '@/env.mjs';
import {
  generateUniqueReadableSlug,
  toReadableSlug,
} from '@/lib/readable-slug';
import { executeResearchRun } from '@/lib/research-executor';
import { matchProofs } from '@/lib/workflow-engine';

// Helper to cast to Prisma-compatible JSON
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

// Helper: parse an ISO date string from unknown metadata JSON
function parseDueAt(metadata: unknown): Date | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    return null;
  const value = (metadata as Record<string, unknown>).dueAt;
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// Helper: compute the latest engagement timestamp from prospect sessions
function latestEngagementAt(
  sessions: {
    createdAt: Date;
    pdfDownloadedAt: Date | null;
    callBookedAt: Date | null;
    updatedAt: Date;
  }[],
): Date | null {
  if (sessions.length === 0) return null;
  const s = sessions[0]!;
  const candidates = [s.updatedAt, s.pdfDownloadedAt, s.callBookedAt].filter(
    Boolean,
  ) as Date[];
  return candidates.length > 0
    ? new Date(Math.max(...candidates.map((d) => d.getTime())))
    : s.createdAt;
}

function buildEnrichmentData(
  enriched: Awaited<ReturnType<typeof enrichCompany>>,
  options?: {
    kvk?: unknown;
    confidence?: unknown;
  },
) {
  return {
    companyName: enriched.companyName,
    industry: enriched.industry,
    subIndustry: enriched.subIndustry,
    employeeRange: enriched.employeeRange,
    employeeCount: enriched.employeeCount,
    revenueRange: enriched.revenueRange,
    revenueEstimate: enriched.revenueEstimate,
    technologies: enriched.technologies,
    specialties: enriched.specialties,
    country: enriched.country,
    city: enriched.city,
    state: enriched.state,
    description: enriched.description,
    logoUrl: enriched.logoUrl,
    linkedinUrl: enriched.linkedinUrl,
    foundedYear: enriched.foundedYear,
    naicsCode: enriched.naicsCode,
    sicCode: enriched.sicCode,
    lushaCompanyId: enriched.lushaCompanyId,
    lushaRawData: toJson({
      provider: 'apollo',
      apollo: enriched.rawData,
      kvk: options?.kvk ?? null,
      confidence: options?.confidence ?? null,
    }),
    intentTopics: enriched.intentTopics
      ? toJson(enriched.intentTopics)
      : undefined,
    fundingInfo: enriched.fundingInfo
      ? toJson(enriched.fundingInfo)
      : undefined,
    lastEnrichedAt: new Date(),
    status: 'ENRICHED' as const,
  };
}

function buildCompanyContext(prospect: {
  companyName: string | null;
  domain: string;
  industry: string | null;
  subIndustry: string | null;
  employeeRange: string | null;
  revenueRange: string | null;
  technologies: string[];
  specialties: string[];
  country: string | null;
  city: string | null;
  description: string | null;
}): CompanyContext {
  return {
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
}

function buildIndustryPrompts(
  template: {
    dataOpportunityPrompts: unknown;
    automationPrompts: unknown;
    successStoryTemplates: unknown;
    roadmapTemplates: unknown;
  } | null,
): IndustryPrompts | undefined {
  if (!template) return undefined;
  return {
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
  };
}

const REENRICH_AFTER_HOURS = env.ENRICHMENT_REENRICH_AFTER_HOURS ?? 72;

function isEnrichmentFresh(lastEnrichedAt: Date | null | undefined): boolean {
  if (!lastEnrichedAt) return false;
  const ageMs = Date.now() - lastEnrichedAt.getTime();
  return ageMs < REENRICH_AFTER_HOURS * 60 * 60 * 1000;
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
    .input(
      z.object({
        id: z.string(),
        force: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const prospect = await ctx.db.prospect.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (!input.force && isEnrichmentFresh(prospect.lastEnrichedAt)) {
        return prospect;
      }

      const enriched = await enrichCompany(prospect.domain, prospect.id);
      const combined = await mergeApolloWithKvk(enriched, {
        domainHint: prospect.domain,
        companyNameHint: prospect.companyName,
      });

      const shouldAutoSlug =
        combined.merged.companyName && !prospect.readableSlug;
      const readableSlug = shouldAutoSlug
        ? await generateUniqueReadableSlug(ctx.db, combined.merged.companyName!)
        : undefined;

      const updated = await ctx.db.prospect.update({
        where: { id: input.id },
        data: {
          ...buildEnrichmentData(combined.merged, {
            kvk: combined.kvk,
            confidence: combined.confidence,
          }),
          ...(shouldAutoSlug ? { readableSlug } : {}),
        },
      });

      return updated;
    }),

  generateReadableSlug: adminProcedure
    .input(z.object({ id: z.string(), override: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const prospect = await ctx.db.prospect.findUniqueOrThrow({
        where: { id: input.id },
      });

      let candidate: string;
      if (input.override) {
        candidate = toReadableSlug(input.override);
      } else {
        candidate = await generateUniqueReadableSlug(
          ctx.db,
          prospect.companyName ?? prospect.domain,
        );
      }

      // Ensure uniqueness — another prospect may already have the sanitised override
      const conflict = await ctx.db.prospect.findUnique({
        where: { readableSlug: candidate },
      });
      if (conflict && conflict.id !== prospect.id) {
        candidate = await generateUniqueReadableSlug(ctx.db, candidate);
      }

      const updated = await ctx.db.prospect.update({
        where: { id: input.id },
        data: { readableSlug: candidate },
      });

      return updated;
    }),

  deleteProspect: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.prospect.delete({ where: { id: input.id } });
      return { success: true };
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

      const template = prospect.industry
        ? await ctx.db.industryTemplate.findFirst({
            where: { industry: prospect.industry },
          })
        : null;

      const content = await generateWizardContent(
        buildCompanyContext(prospect),
        buildIndustryPrompts(template),
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

      // Enrich via Apollo provider.
      try {
        const enriched = await enrichCompany(cleanDomain, prospect.id);
        const combined = await mergeApolloWithKvk(enriched, {
          domainHint: cleanDomain,
          companyNameHint: prospect.companyName,
        });
        const slugSource =
          combined.merged.companyName ?? cleanDomain.split('.')[0]!;
        const readableSlug = await generateUniqueReadableSlug(
          ctx.db,
          slugSource,
        );
        prospect = await ctx.db.prospect.update({
          where: { id: prospect.id },
          data: {
            ...buildEnrichmentData(combined.merged, {
              kvk: combined.kvk,
              confidence: combined.confidence,
            }),
            readableSlug,
          },
        });
      } catch (error) {
        console.error('Apollo enrichment failed:', error);
        // Still generate readableSlug from domain even if enrichment fails
        const readableSlug = await generateUniqueReadableSlug(
          ctx.db,
          cleanDomain.split('.')[0]!,
        );
        prospect = await ctx.db.prospect.update({
          where: { id: prospect.id },
          data: { readableSlug },
        });
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

      const content = await generateWizardContent(
        buildCompanyContext(prospect),
        buildIndustryPrompts(template),
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

      // Run research pipeline (non-blocking: failures don't break prospect creation)
      try {
        const result = await executeResearchRun(ctx.db, {
          prospectId: prospect.id,
          manualUrls: [],
        });
        const runId = result.run.id;

        // Match proofs for all hypotheses
        const hypotheses = await ctx.db.workflowHypothesis.findMany({
          where: { researchRunId: runId },
        });
        for (const h of hypotheses) {
          const query = `${h.title} ${h.problemStatement}`;
          const matches = await matchProofs(ctx.db, query, 4);
          for (const match of matches) {
            await ctx.db.proofMatch.create({
              data: {
                prospectId: prospect.id,
                workflowHypothesisId: h.id,
                sourceType: match.sourceType,
                proofId: match.proofId,
                proofTitle: match.proofTitle,
                proofSummary: match.proofSummary,
                proofUrl: match.proofUrl,
                score: match.score,
                isRealShipped: match.isRealShipped,
                isCustomPlan: match.isCustomPlan,
                useCaseId: match.isCustomPlan ? undefined : match.proofId,
              },
            });
          }
        }

        // Hypotheses stay as DRAFT — admin reviews and accepts/rejects
        // in the prospect detail Hypotheses tab before they appear on the public discovery dashboard
      } catch (error) {
        console.error('Research pipeline failed (non-blocking):', error);
      }

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
          _count: {
            select: {
              sessions: true,
              contacts: true,
              gateOverrideAudits: true,
            },
          },
          sessions: {
            where: { callBooked: true },
            take: 1,
            select: { id: true },
          },
          researchRuns: {
            orderBy: { createdAt: 'desc' as const },
            take: 1,
            select: {
              id: true,
              status: true,
              qualityApproved: true,
              qualityReviewedAt: true,
              summary: true,
              _count: {
                select: { evidenceItems: true, workflowHypotheses: true },
              },
            },
          },
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
          contacts: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
              seniority: true,
              department: true,
              primaryEmail: true,
              outreachStatus: true,
            },
          },
          signals: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          _count: { select: { sessions: true, contacts: true, signals: true } },
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

  getActionQueue: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();

    // PIPE-02: statuses that indicate research is still in progress
    const researchInProgressStatuses = [
      'PENDING' as const,
      'CRAWLING' as const,
      'EXTRACTING' as const,
      'HYPOTHESIS' as const,
      'BRIEFING' as const,
    ];

    const [hypotheses, draftLogs, touchTasks, replies] = await Promise.all([
      // 1. DRAFT hypotheses needing review — exclude prospects with active research runs
      ctx.db.workflowHypothesis.findMany({
        where: {
          status: 'DRAFT',
          prospect: {
            researchRuns: {
              none: {
                status: { in: researchInProgressStatuses },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              domain: true,
              sessions: {
                orderBy: { updatedAt: 'desc' as const },
                take: 1,
                select: {
                  createdAt: true,
                  pdfDownloadedAt: true,
                  callBookedAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      }),

      // 2. Draft outreach logs awaiting approval — exclude prospects with active research runs
      ctx.db.outreachLog.findMany({
        where: {
          status: 'draft',
          contact: {
            prospect: {
              researchRuns: {
                none: {
                  status: { in: researchInProgressStatuses },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: {
          contact: {
            include: {
              prospect: {
                select: {
                  id: true,
                  companyName: true,
                  domain: true,
                  sessions: {
                    orderBy: { updatedAt: 'desc' as const },
                    take: 1,
                    select: {
                      createdAt: true,
                      pdfDownloadedAt: true,
                      callBookedAt: true,
                      updatedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),

      // 3. Open touch tasks (calls, LinkedIn, WhatsApp, email) — exclude prospects with active research runs
      ctx.db.outreachLog.findMany({
        where: {
          status: 'touch_open',
          channel: { in: ['call', 'linkedin', 'whatsapp', 'email'] },
          contact: {
            prospect: {
              researchRuns: {
                none: {
                  status: { in: researchInProgressStatuses },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: {
          contact: {
            include: {
              prospect: {
                select: {
                  id: true,
                  companyName: true,
                  domain: true,
                  sessions: {
                    orderBy: { updatedAt: 'desc' as const },
                    take: 1,
                    select: {
                      createdAt: true,
                      pdfDownloadedAt: true,
                      callBookedAt: true,
                      updatedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),

      // 4. Pending inbound replies — exclude prospects with active research runs
      ctx.db.outreachLog.findMany({
        where: {
          type: 'FOLLOW_UP',
          status: 'received',
          contact: {
            prospect: {
              researchRuns: {
                none: {
                  status: { in: researchInProgressStatuses },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: {
          contact: {
            include: {
              prospect: {
                select: {
                  id: true,
                  companyName: true,
                  domain: true,
                  sessions: {
                    orderBy: { updatedAt: 'desc' as const },
                    take: 1,
                    select: {
                      createdAt: true,
                      pdfDownloadedAt: true,
                      callBookedAt: true,
                      updatedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // Map hypotheses
    const hypothesisItems = hypotheses.map((h) => ({
      id: h.id,
      type: 'hypothesis' as const,
      prospectId: h.prospect.id,
      prospectName: h.prospect.companyName ?? h.prospect.domain,
      title: h.title,
      createdAt: h.createdAt,
      urgency: 'normal' as const,
      channel: undefined,
      dueAt: undefined,
      preview: undefined,
      engagementAt: latestEngagementAt(h.prospect.sessions),
    }));

    // Map draft outreach logs (with inline preview — SEND-01)
    const draftItems = draftLogs.map((log) => ({
      id: log.id,
      type: 'draft' as const,
      prospectId: log.contact.prospect.id,
      prospectName:
        log.contact.prospect.companyName ?? log.contact.prospect.domain,
      title: log.subject ?? 'Untitled draft',
      createdAt: log.createdAt,
      urgency: 'normal' as const,
      channel: undefined,
      dueAt: undefined,
      preview: log.bodyText?.slice(0, 200) ?? '',
      engagementAt: latestEngagementAt(log.contact.prospect.sessions),
    }));

    // Map touch tasks with overdue detection
    const taskItems = touchTasks.map((log) => {
      const dueAtDate = parseDueAt(log.metadata);
      const isOverdue =
        dueAtDate !== null && dueAtDate.getTime() < now.getTime();
      return {
        id: log.id,
        type: 'task' as const,
        prospectId: log.contact.prospect.id,
        prospectName:
          log.contact.prospect.companyName ?? log.contact.prospect.domain,
        title: log.subject ?? 'Follow-up task',
        createdAt: log.createdAt,
        urgency: (isOverdue ? 'overdue' : 'normal') as 'overdue' | 'normal',
        channel: log.channel,
        dueAt: dueAtDate?.toISOString() ?? null,
        preview: undefined,
        engagementAt: latestEngagementAt(log.contact.prospect.sessions),
      };
    });

    // Map pending replies
    const replyItems = replies.map((log) => ({
      id: log.id,
      type: 'reply' as const,
      prospectId: log.contact.prospect.id,
      prospectName:
        log.contact.prospect.companyName ?? log.contact.prospect.domain,
      title: log.subject ?? 'Inbound reply',
      createdAt: log.createdAt,
      urgency: 'normal' as const,
      channel: undefined,
      dueAt: undefined,
      preview: undefined,
      engagementAt: latestEngagementAt(log.contact.prospect.sessions),
    }));

    // Merge and sort: overdue first, then engaged prospects (PIPE-03), then oldest first
    const items = [
      ...hypothesisItems,
      ...draftItems,
      ...taskItems,
      ...replyItems,
    ].sort((a, b) => {
      if (a.urgency === 'overdue' && b.urgency !== 'overdue') return -1;
      if (a.urgency !== 'overdue' && b.urgency === 'overdue') return 1;
      // Engaged prospects surface first
      if (a.engagementAt && !b.engagementAt) return -1;
      if (!a.engagementAt && b.engagementAt) return 1;
      if (a.engagementAt && b.engagementAt)
        return b.engagementAt.getTime() - a.engagementAt.getTime();
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const overdueTasks = taskItems.filter(
      (item) => item.urgency === 'overdue',
    ).length;

    return {
      items,
      counts: {
        hypotheses: hypothesisItems.length,
        drafts: draftItems.length,
        tasks: taskItems.length,
        overdueTasks,
        replies: replyItems.length,
        total:
          hypothesisItems.length +
          draftItems.length +
          taskItems.length +
          replyItems.length,
      },
    };
  }),

  getDashboardStats: adminProcedure.query(async ({ ctx }) => {
    const [
      total,
      ready,
      viewed,
      engaged,
      converted,
      totalContacts,
      totalSignals,
      unprocessedSignals,
      outreachQueued,
      outreachSent,
      outreachOpened,
      outreachReplied,
      outreachBooked,
      outreachConverted,
      pendingDrafts,
      recentSessions,
      creditUsage,
    ] = await Promise.all([
      ctx.db.prospect.count(),
      ctx.db.prospect.count({ where: { status: 'READY' } }),
      ctx.db.prospect.count({ where: { status: 'VIEWED' } }),
      ctx.db.prospect.count({ where: { status: 'ENGAGED' } }),
      ctx.db.prospect.count({ where: { status: 'CONVERTED' } }),
      ctx.db.contact.count(),
      ctx.db.signal.count(),
      ctx.db.signal.count({ where: { isProcessed: false } }),
      ctx.db.contact.count({ where: { outreachStatus: 'QUEUED' } }),
      ctx.db.contact.count({ where: { outreachStatus: 'EMAIL_SENT' } }),
      ctx.db.contact.count({ where: { outreachStatus: 'OPENED' } }),
      ctx.db.contact.count({ where: { outreachStatus: 'REPLIED' } }),
      ctx.db.outreachSequence.count({ where: { status: 'BOOKED' } }),
      ctx.db.contact.count({ where: { outreachStatus: 'CONVERTED' } }),
      ctx.db.outreachLog.count({ where: { status: 'draft' } }),
      ctx.db.wizardSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { prospect: { select: { companyName: true, slug: true } } },
      }),
      ctx.db.creditUsage.aggregate({
        _sum: { credits: true },
      }),
    ]);

    return {
      total,
      ready,
      viewed,
      engaged,
      converted,
      totalContacts,
      totalSignals,
      unprocessedSignals,
      pipeline: {
        queued: outreachQueued,
        sent: outreachSent,
        opened: outreachOpened,
        replied: outreachReplied,
        booked: outreachBooked,
        converted: outreachConverted,
      },
      pendingDrafts,
      creditsUsed: creditUsage._sum.credits ?? 0,
      recentSessions,
    };
  }),
});
