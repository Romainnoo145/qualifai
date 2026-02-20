import { z } from 'zod';
import { nanoid } from 'nanoid';
import { adminProcedure, router } from '../trpc';
import { executeResearchRun } from '@/lib/research-executor';
import { buildDefaultReviewSeedUrls } from '@/lib/research-refresh';
import {
  buildCalBookingUrl,
  createOutreachSequenceSteps,
  createWorkflowLossMapDraft,
  matchProofs,
  validateTwoStepCta,
  CTA_STEP_1,
  CTA_STEP_2,
} from '@/lib/workflow-engine';
import { persistWorkflowLossMapPdf } from '@/lib/pdf-storage';
import { env } from '@/env.mjs';
import type { Prisma } from '@prisma/client';
import { scoreContactForOutreach } from '@/lib/outreach/quality';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function metadataObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export const campaignsRouter = router({
  create: adminProcedure
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
          name: input.name,
          slug: nanoid(10),
          nicheKey: input.nicheKey,
          language: input.language,
          tone: input.tone,
          strictGate: input.strictGate,
        },
      });
    }),

  list: adminProcedure
    .input(
      z
        .object({
          isActive: z.boolean().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.campaign.findMany({
        where:
          input?.isActive === undefined
            ? undefined
            : { isActive: input.isActive },
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
    }),

  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.campaign.findUniqueOrThrow({
        where: { id: input.id },
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

  update: adminProcedure
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

  attachProspect: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        prospectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

  detachProspect: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        prospectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.campaignProspect.deleteMany({
        where: {
          campaignId: input.campaignId,
          prospectId: input.prospectId,
        },
      });
      return { success: true };
    }),

  runAutopilot: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        limit: z.number().int().positive().max(100).default(25),
        dryRun: z.boolean().default(false),
        queueDrafts: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUniqueOrThrow({
        where: { id: input.campaignId },
        include: {
          campaignProspects: {
            include: {
              prospect: {
                select: {
                  id: true,
                  slug: true,
                  domain: true,
                  companyName: true,
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
          | 'no_hypotheses'
          | 'no_contact'
          | 'error';
        runId?: string;
        lossMapId?: string;
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

          const proofMatches = await ctx.db.proofMatch.findMany({
            where: {
              OR: [
                {
                  workflowHypothesisId: {
                    in: selectedHypotheses.map((h) => h.id),
                  },
                },
                {
                  automationOpportunityId: {
                    in: selectedOpportunities.map((o) => o.id),
                  },
                },
              ],
            },
            orderBy: { score: 'desc' },
            take: 10,
          });
          const proofTitles = proofMatches.map((item) => item.proofTitle);

          const prospectFull = await ctx.db.prospect.findUniqueOrThrow({
            where: { id: prospect.id },
            select: {
              id: true,
              domain: true,
              companyName: true,
              industry: true,
              employeeRange: true,
              description: true,
              technologies: true,
              specialties: true,
            },
          });
          const bookingUrl = buildCalBookingUrl(
            env.NEXT_PUBLIC_CALCOM_BOOKING_URL,
            {
              company: company,
            },
          );
          const draft = createWorkflowLossMapDraft(
            prospectFull,
            selectedHypotheses,
            selectedOpportunities,
            proofTitles,
            bookingUrl,
          );
          if (
            !validateTwoStepCta(draft.markdown) ||
            !validateTwoStepCta(draft.emailBodyText) ||
            !validateTwoStepCta(draft.emailBodyHtml)
          ) {
            throw new Error('Generated asset did not pass CTA validation');
          }

          const version =
            (await ctx.db.workflowLossMap.count({
              where: { prospectId: prospect.id },
            })) + 1;
          const lossMap = await ctx.db.workflowLossMap.create({
            data: {
              prospectId: prospect.id,
              researchRunId: research.run.id,
              campaignId: campaign.id,
              version,
              language: 'nl',
              title: draft.title,
              markdown: draft.markdown,
              html: draft.html,
              metrics: toJson(draft.metrics),
              emailSubject: draft.emailSubject,
              emailBodyText: draft.emailBodyText,
              emailBodyHtml: draft.emailBodyHtml,
              demoScript: draft.demoScript,
              ctaStep1: CTA_STEP_1,
              ctaStep2: CTA_STEP_2,
            },
          });

          const pdf = await persistWorkflowLossMapPdf({
            lossMapId: lossMap.id,
            version: lossMap.version,
            companyName: company,
            markdown: draft.markdown,
          });
          const savedLossMap = pdf.pdfUrl
            ? await ctx.db.workflowLossMap.update({
                where: { id: lossMap.id },
                data: { pdfUrl: pdf.pdfUrl },
              })
            : lossMap;

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
            const contact = bestReady?.contact;
            const contactPriority = bestReady?.priority;

            if (!contact) {
              results.push({
                prospectId: prospect.id,
                company,
                status: 'no_contact',
                runId: research.run.id,
                lossMapId: savedLossMap.id,
                detail:
                  'Loss map generated but no outreach-ready contact found (email/data quality gate)',
              });
              continue;
            }

            const appUrl =
              process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
            const lossMapUrl = `${appUrl}/discover/${prospect.slug}`;
            const calBookingUrl = buildCalBookingUrl(
              env.NEXT_PUBLIC_CALCOM_BOOKING_URL,
              {
                name: `${contact.firstName} ${contact.lastName}`.trim(),
                email: contact.primaryEmail ?? undefined,
                company,
              },
            );
            const steps = createOutreachSequenceSteps(
              contact.firstName,
              company,
              lossMapUrl,
              calBookingUrl,
            );

            const existingDraft = await ctx.db.outreachLog.findFirst({
              where: {
                contactId: contact.id,
                status: 'draft',
              },
              orderBy: { createdAt: 'desc' },
            });
            const existingMetadata = metadataObject(existingDraft?.metadata);
            const existingLossMapId = existingMetadata.workflowLossMapId;
            if (
              existingDraft &&
              typeof existingLossMapId === 'string' &&
              existingLossMapId === savedLossMap.id
            ) {
              results.push({
                prospectId: prospect.id,
                company,
                status: 'completed',
                runId: research.run.id,
                lossMapId: savedLossMap.id,
                detail:
                  'Skipped draft queue (already exists for this loss map)',
              });
              continue;
            }

            const sequence = await ctx.db.outreachSequence.create({
              data: {
                prospectId: prospect.id,
                contactId: contact.id,
                campaignId: campaign.id,
                researchRunId: research.run.id,
                workflowLossMapId: savedLossMap.id,
                templateKey: 'Sprint_2Step_Intro',
                status: 'DRAFTED',
                isEvidenceBacked: true,
                metadata: toJson({
                  workflowOffer: 'Workflow Optimization Sprint',
                  ctaStep1: savedLossMap.ctaStep1,
                  ctaStep2: savedLossMap.ctaStep2,
                  calBookingUrl,
                  calEventTypeId: env.CALCOM_EVENT_TYPE_ID ?? null,
                  contactPriorityScore: contactPriority?.score ?? null,
                  contactPriorityTier: contactPriority?.tier ?? null,
                  contactQualityStatus: contactPriority?.status ?? null,
                  manualReviewReasons: contactPriority?.reasons ?? [],
                }),
              },
            });
            sequenceId = sequence.id;

            for (const step of steps) {
              await ctx.db.outreachStep.create({
                data: {
                  sequenceId: sequence.id,
                  stepOrder: step.order,
                  subject: step.subject,
                  bodyText: step.bodyText,
                  bodyHtml: step.bodyHtml,
                  status: 'DRAFTED',
                },
              });
            }

            const firstStep = steps[0];
            if (firstStep) {
              const outreachDraft = await ctx.db.outreachLog.create({
                data: {
                  contactId: contact.id,
                  type: 'INTRO_EMAIL',
                  channel: 'email',
                  status: 'draft',
                  subject: firstStep.subject,
                  bodyText: firstStep.bodyText,
                  bodyHtml: firstStep.bodyHtml,
                  metadata: toJson({
                    outreachSequenceId: sequence.id,
                    workflowLossMapId: savedLossMap.id,
                    evidenceBacked: true,
                    ctaStep1: savedLossMap.ctaStep1,
                    ctaStep2: savedLossMap.ctaStep2,
                    calBookingUrl,
                    calEventTypeId: env.CALCOM_EVENT_TYPE_ID ?? null,
                  }),
                },
              });
              await ctx.db.outreachStep.update({
                where: {
                  sequenceId_stepOrder: {
                    sequenceId: sequence.id,
                    stepOrder: 1,
                  },
                },
                data: {
                  outreachLogId: outreachDraft.id,
                  status: 'QUEUED',
                },
              });
            }

            if (contact.outreachStatus === 'NONE') {
              await ctx.db.contact.update({
                where: { id: contact.id },
                data: { outreachStatus: 'QUEUED' },
              });
            }
          }

          results.push({
            prospectId: prospect.id,
            company,
            status: 'completed',
            runId: research.run.id,
            lossMapId: savedLossMap.id,
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
        noContact: results.filter((item) => item.status === 'no_contact')
          .length,
        failed: results.filter((item) => item.status === 'error').length,
        results,
      };
    }),
});
