import { z } from 'zod';
import { nanoid } from 'nanoid';
import { projectAdminProcedure, router } from '../trpc';
import { executeResearchRun } from '@/lib/research-executor';
import { buildDefaultReviewSeedUrls } from '@/lib/research-refresh';
import { matchProofs } from '@/lib/workflow-engine';
import { scoreContactForOutreach } from '@/lib/outreach/quality';
import { TRPCError } from '@trpc/server';
import { generateIntroDraft } from '@/lib/outreach/generate-intro';

function countrySortPriorityFromCampaignName(name: string): number {
  const countryCode = name.split('|')[2]?.trim().toUpperCase();
  if (countryCode === 'NL') return 0;
  if (countryCode === 'DE') return 1;
  if (countryCode === 'UK') return 2;
  return 9;
}

async function assertCampaignInProject(
  ctx: {
    db: {
      campaign: {
        findFirst: (args: {
          where: { id: string; projectId: string };
          select: { id: true };
        }) => Promise<{ id: string } | null>;
      };
    };
    projectId: string;
  },
  campaignId: string,
) {
  const campaign = await ctx.db.campaign.findFirst({
    where: { id: campaignId, projectId: ctx.projectId },
    select: { id: true },
  });
  if (!campaign) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Campaign not found in active project scope',
    });
  }
}

async function assertProspectInProject(
  ctx: {
    db: {
      prospect: {
        findFirst: (args: {
          where: { id: string; projectId: string };
          select: { id: true };
        }) => Promise<{ id: string } | null>;
      };
    };
    projectId: string;
  },
  prospectId: string,
) {
  const prospect = await ctx.db.prospect.findFirst({
    where: { id: prospectId, projectId: ctx.projectId },
    select: { id: true },
  });
  if (!prospect) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Prospect not found in active project scope',
    });
  }
}

export const campaignsRouter = router({
  create: projectAdminProcedure
    .input(
      z.object({
        name: z.string().min(2),
        nicheKey: z.string().min(2).default('construction_nl_sme'),
        language: z.string().default('nl'),
        tone: z.string().optional(),
        strictGate: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.campaign.create({
        data: {
          projectId: ctx.projectId,
          name: input.name,
          slug: nanoid(10),
          nicheKey: input.nicheKey,
          language: input.language,
          tone: input.tone,
          strictGate: input.strictGate,
        },
      });
    }),

  list: projectAdminProcedure
    .input(
      z
        .object({
          isActive: z.boolean().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const campaigns = await ctx.db.campaign.findMany({
        where: {
          projectId: ctx.projectId,
          ...(input?.isActive === undefined
            ? {}
            : { isActive: input.isActive }),
        },
        orderBy: { updatedAt: 'desc' },
        take: input?.limit ?? 50,
        include: {
          _count: {
            select: {
              campaignProspects: true,
              researchRuns: true,
              workflowLossMaps: true,
            },
          },
        },
      });

      if (ctx.activeProject.projectType === 'ATLANTIS') {
        campaigns.sort((a, b) => {
          const countryDelta =
            countrySortPriorityFromCampaignName(a.name) -
            countrySortPriorityFromCampaignName(b.name);
          if (countryDelta !== 0) return countryDelta;
          return a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' });
        });
      }

      return campaigns;
    }),

  get: projectAdminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.campaign.findFirstOrThrow({
        where: { id: input.id, projectId: ctx.projectId },
        include: {
          campaignProspects: {
            include: {
              prospect: {
                select: {
                  id: true,
                  companyName: true,
                  domain: true,
                  status: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }),

  update: projectAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        nicheKey: z.string().min(2).optional(),
        language: z.string().optional(),
        tone: z.string().optional(),
        strictGate: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignInProject(ctx, input.id);
      return ctx.db.campaign.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.nicheKey !== undefined && { nicheKey: input.nicheKey }),
          ...(input.language !== undefined && { language: input.language }),
          ...(input.tone !== undefined && { tone: input.tone }),
          ...(input.strictGate !== undefined && {
            strictGate: input.strictGate,
          }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });
    }),

  attachProspect: projectAdminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        prospectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignInProject(ctx, input.campaignId);
      await assertProspectInProject(ctx, input.prospectId);
      return ctx.db.campaignProspect.upsert({
        where: {
          campaignId_prospectId: {
            campaignId: input.campaignId,
            prospectId: input.prospectId,
          },
        },
        update: {},
        create: {
          campaignId: input.campaignId,
          prospectId: input.prospectId,
        },
      });
    }),

  detachProspect: projectAdminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        prospectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignInProject(ctx, input.campaignId);
      await assertProspectInProject(ctx, input.prospectId);
      await ctx.db.campaignProspect.deleteMany({
        where: {
          campaignId: input.campaignId,
          prospectId: input.prospectId,
        },
      });
      return { success: true };
    }),

  getWithFunnelData: projectAdminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findFirstOrThrow({
        where: { id: input.id, projectId: ctx.projectId },
      });

      const campaignProspects = await ctx.db.campaignProspect.findMany({
        where: { campaignId: input.id },
        include: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              domain: true,
              status: true,
              logoUrl: true,
              industry: true,
              outreachSequences: {
                select: { status: true },
              },
              contacts: {
                select: { outreachStatus: true },
              },
              sessions: {
                select: { callBooked: true },
              },
            },
          },
        },
      });

      const prospectIds = campaignProspects.map((cp) => cp.prospect.id);
      const deepRuns =
        prospectIds.length > 0
          ? await ctx.db.researchRun.findMany({
              where: {
                prospectId: { in: prospectIds },
                inputSnapshot: {
                  path: ['deepCrawl'],
                  equals: true,
                },
              },
              orderBy: [{ prospectId: 'asc' }, { createdAt: 'desc' }],
              select: {
                id: true,
                prospectId: true,
                status: true,
                completedAt: true,
                inputSnapshot: true,
              },
            })
          : [];
      const deepRunMap = new Map<
        string,
        {
          id: string;
          status: string;
          completedAt: Date | null;
          inputSnapshot: unknown;
        }
      >();
      for (const run of deepRuns) {
        if (deepRunMap.has(run.prospectId)) continue;
        deepRunMap.set(run.prospectId, {
          id: run.id,
          status: run.status,
          completedAt: run.completedAt,
          inputSnapshot: run.inputSnapshot,
        });
      }

      // Fetch research run counts (completed) per prospect
      const researchCounts = await ctx.db.researchRun.groupBy({
        by: ['prospectId'],
        where: {
          prospectId: { in: prospectIds },
          status: 'COMPLETED',
        },
        _count: { id: true },
      });
      const researchCountMap = new Map<string, number>(
        researchCounts.map((r) => [r.prospectId, r._count.id]),
      );
      const activeResearchCounts = await ctx.db.researchRun.groupBy({
        by: ['prospectId'],
        where: {
          prospectId: { in: prospectIds },
          status: {
            in: ['PENDING', 'CRAWLING', 'EXTRACTING', 'HYPOTHESIS', 'BRIEFING'],
          },
        },
        _count: { id: true },
      });
      const activeResearchCountMap = new Map<string, number>(
        activeResearchCounts.map((r) => [r.prospectId, r._count.id]),
      );

      // Fetch approved hypothesis counts per prospect
      const hypothesisCounts = await ctx.db.workflowHypothesis.groupBy({
        by: ['prospectId'],
        where: {
          prospectId: { in: prospectIds },
          status: 'ACCEPTED',
        },
        _count: { id: true },
      });
      const hypothesisCountMap = new Map<string, number>(
        hypothesisCounts.map((h) => [h.prospectId, h._count.id]),
      );

      type FunnelStage =
        | 'booked'
        | 'replied'
        | 'emailed'
        | 'approved'
        | 'researched'
        | 'researching'
        | 'imported';

      type ProspectWithStage = {
        id: string;
        companyName: string | null;
        domain: string;
        status: string;
        logoUrl: string | null;
        industry: string | null;
        funnelStage: FunnelStage;
        latestDeepResearchRun: {
          id: string;
          status: string;
          completedAt: Date | null;
          inputSnapshot: unknown;
        } | null;
      };

      const EMAILED_SEQUENCE_STATUSES = new Set([
        'SENT',
        'OPENED',
        'REPLIED',
        'BOOKED',
      ]);
      const EMAILED_CONTACT_STATUSES = new Set([
        'EMAIL_SENT',
        'OPENED',
        'REPLIED',
        'CONVERTED',
      ]);

      const prospects: ProspectWithStage[] = campaignProspects.map((cp) => {
        const p = cp.prospect;
        const completedResearchCount = researchCountMap.get(p.id) ?? 0;
        const activeResearchCount = activeResearchCountMap.get(p.id) ?? 0;
        const approvedHypothesisCount = hypothesisCountMap.get(p.id) ?? 0;

        let funnelStage: FunnelStage = 'imported';

        if (activeResearchCount > 0) funnelStage = 'researching';
        if (completedResearchCount > 0) funnelStage = 'researched';
        if (approvedHypothesisCount > 0) funnelStage = 'approved';

        const isEmailed =
          p.outreachSequences.some((s) =>
            EMAILED_SEQUENCE_STATUSES.has(s.status),
          ) ||
          p.contacts.some((c) =>
            EMAILED_CONTACT_STATUSES.has(c.outreachStatus),
          );

        if (isEmailed) funnelStage = 'emailed';

        const isReplied =
          p.outreachSequences.some((s) => s.status === 'REPLIED') ||
          p.contacts.some((c) => c.outreachStatus === 'REPLIED');

        if (isReplied) funnelStage = 'replied';

        const isBooked =
          p.sessions.some((s) => s.callBooked) ||
          p.outreachSequences.some((s) => s.status === 'BOOKED') ||
          p.status === 'CONVERTED';

        if (isBooked) funnelStage = 'booked';

        return {
          id: p.id,
          companyName: p.companyName,
          domain: p.domain,
          status: p.status,
          logoUrl: p.logoUrl,
          industry: p.industry,
          funnelStage,
          latestDeepResearchRun: deepRunMap.get(p.id) ?? null,
        };
      });

      // Compute cumulative funnel counts (each stage includes all higher stages)
      const stagePriority: Record<FunnelStage, number> = {
        imported: 0,
        researching: 1,
        researched: 2,
        approved: 3,
        emailed: 4,
        replied: 5,
        booked: 6,
      };

      const stageCountPerProspect = prospects.map(
        (p) => stagePriority[p.funnelStage],
      );

      const funnel = {
        imported: stageCountPerProspect.filter((s) => s >= 0).length,
        researching: stageCountPerProspect.filter((s) => s >= 1).length,
        researched: stageCountPerProspect.filter((s) => s >= 2).length,
        approved: stageCountPerProspect.filter((s) => s >= 3).length,
        emailed: stageCountPerProspect.filter((s) => s >= 4).length,
        replied: stageCountPerProspect.filter((s) => s >= 5).length,
        booked: stageCountPerProspect.filter((s) => s >= 6).length,
      };

      const metrics = {
        responseRate:
          funnel.emailed > 0
            ? ((funnel.replied + funnel.booked) / funnel.emailed) * 100
            : 0,
        bookingRate:
          funnel.emailed > 0 ? (funnel.booked / funnel.emailed) * 100 : 0,
      };

      return { campaign, prospects, funnel, metrics };
    }),

  runAutopilot: projectAdminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        limit: z.number().int().positive().max(100).default(25),
        dryRun: z.boolean().default(false),
        queueDrafts: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findFirstOrThrow({
        where: { id: input.campaignId, projectId: ctx.projectId },
        include: {
          campaignProspects: {
            include: {
              prospect: {
                select: {
                  id: true,
                  slug: true,
                  readableSlug: true,
                  domain: true,
                  companyName: true,
                  projectId: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
            take: input.limit,
          },
        },
      });

      const prospects = campaign.campaignProspects.map((item) => item.prospect);
      const results: Array<{
        prospectId: string;
        company: string;
        status:
          | 'planned'
          | 'completed'
          | 'blocked_gate'
          | 'blocked_hypothesis'
          | 'no_hypotheses'
          | 'no_contact'
          | 'error';
        runId?: string;
        sequenceId?: string;
        detail?: string;
      }> = [];

      if (input.dryRun) {
        for (const prospect of prospects) {
          const company = prospect.companyName ?? prospect.domain;
          results.push({
            prospectId: prospect.id,
            company,
            status: 'planned',
          });
        }
        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          dryRun: true,
          scanned: prospects.length,
          completed: 0,
          blockedGate: 0,
          noContact: 0,
          failed: 0,
          results,
        };
      }

      for (const prospect of prospects) {
        const company = prospect.companyName ?? prospect.domain;
        try {
          // Hypothesis approval gate — must check BEFORE executeResearchRun
          // because executeResearchRun creates a new run with DRAFT hypotheses.
          // Query by prospectId (across all runs), not by a specific runId.
          const approvedHypothesisCount = await ctx.db.workflowHypothesis.count(
            {
              where: { prospectId: prospect.id, status: 'ACCEPTED' },
            },
          );
          if (approvedHypothesisCount === 0) {
            results.push({
              prospectId: prospect.id,
              company,
              status: 'blocked_hypothesis',
              detail:
                'No approved hypothesis — approve at least one before outreach. Run research first, then approve hypotheses.',
            });
            continue;
          }

          const manualReviewUrls = buildDefaultReviewSeedUrls(
            prospect.domain,
            prospect.companyName,
          );
          const research = await executeResearchRun(ctx.db, {
            prospectId: prospect.id,
            campaignId: campaign.id,
            manualUrls: manualReviewUrls,
          });

          if (campaign.strictGate && !research.gate.passed) {
            results.push({
              prospectId: prospect.id,
              company,
              status: 'blocked_gate',
              runId: research.run.id,
              detail: research.gate.reasons.join('; '),
            });
            continue;
          }

          const [hypotheses, opportunities] = await Promise.all([
            ctx.db.workflowHypothesis.findMany({
              where: { researchRunId: research.run.id },
              orderBy: [{ status: 'asc' }, { confidenceScore: 'desc' }],
            }),
            ctx.db.automationOpportunity.findMany({
              where: { researchRunId: research.run.id },
              orderBy: [{ status: 'asc' }, { confidenceScore: 'desc' }],
            }),
          ]);

          for (const hypothesis of hypotheses) {
            await ctx.db.proofMatch.deleteMany({
              where: { workflowHypothesisId: hypothesis.id },
            });
            const matches = await matchProofs(
              ctx.db,
              `${hypothesis.title} ${hypothesis.problemStatement}`,
              4,
              { projectId: prospect.projectId },
            );
            for (const match of matches) {
              await ctx.db.proofMatch.create({
                data: {
                  prospectId: prospect.id,
                  workflowHypothesisId: hypothesis.id,
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

          for (const opportunity of opportunities) {
            await ctx.db.proofMatch.deleteMany({
              where: { automationOpportunityId: opportunity.id },
            });
            const matches = await matchProofs(
              ctx.db,
              `${opportunity.title} ${opportunity.description}`,
              4,
              { projectId: prospect.projectId },
            );
            for (const match of matches) {
              await ctx.db.proofMatch.create({
                data: {
                  prospectId: prospect.id,
                  automationOpportunityId: opportunity.id,
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

          const selectedHypotheses = hypotheses.slice(0, 3);
          const selectedOpportunities = opportunities.slice(0, 2);
          if (
            selectedHypotheses.length === 0 ||
            selectedOpportunities.length === 0
          ) {
            results.push({
              prospectId: prospect.id,
              company,
              status: 'no_hypotheses',
              runId: research.run.id,
              detail: 'No hypotheses/opportunities generated',
            });
            continue;
          }

          let sequenceId: string | undefined;

          if (input.queueDrafts) {
            const candidateContacts = await ctx.db.contact.findMany({
              where: {
                prospectId: prospect.id,
                primaryEmail: { not: null },
                outreachStatus: { not: 'OPTED_OUT' },
              },
              orderBy: { createdAt: 'desc' },
              take: 40,
            });
            const scoredContacts = candidateContacts
              .map((contact) => ({
                contact,
                priority: scoreContactForOutreach(contact),
              }))
              .filter((item) => item.priority.status !== 'blocked')
              .sort((a, b) => b.priority.score - a.priority.score);
            const bestReady = scoredContacts.find(
              (item) => item.priority.status === 'ready',
            );
            const bestContact = bestReady?.contact;

            if (!bestContact) {
              results.push({
                prospectId: prospect.id,
                company,
                status: 'no_contact',
                runId: research.run.id,
                detail:
                  'No outreach-ready contact found (email/data quality gate)',
              });
              continue;
            }

            try {
              const result = await generateIntroDraft({
                prospectId: prospect.id,
                contactId: bestContact.id,
                runId: research.run.id,
                db: ctx.db,
              });
              sequenceId = result.sequenceId;
            } catch (draftError) {
              results.push({
                prospectId: prospect.id,
                company,
                status: 'error',
                runId: research.run.id,
                detail:
                  draftError instanceof Error
                    ? draftError.message
                    : 'Draft generation failed',
              });
              continue;
            }
          }

          results.push({
            prospectId: prospect.id,
            company,
            status: 'completed',
            runId: research.run.id,
            sequenceId,
          });
        } catch (error) {
          results.push({
            prospectId: prospect.id,
            company,
            status: 'error',
            detail: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        dryRun: false,
        scanned: prospects.length,
        completed: results.filter((item) => item.status === 'completed').length,
        blockedGate: results.filter((item) => item.status === 'blocked_gate')
          .length,
        blockedHypothesis: results.filter(
          (item) => item.status === 'blocked_hypothesis',
        ).length,
        noContact: results.filter((item) => item.status === 'no_contact')
          .length,
        failed: results.filter((item) => item.status === 'error').length,
        results,
      };
    }),
});
