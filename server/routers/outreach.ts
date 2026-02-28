import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import {
  generateIntroEmail,
  generateFollowUp,
  generateSignalEmail,
} from '@/lib/ai/generate-outreach';
import type { OutreachContext } from '@/lib/ai/outreach-prompts';
import { sendOutreachEmail } from '@/lib/outreach/send-email';
import { processUnprocessedSignals } from '@/lib/automation/processor';
import {
  CTA_STEP_1,
  CTA_STEP_2,
  computeTrafficLight,
} from '@/lib/workflow-engine';
import type { PrismaClient } from '@prisma/client';
import { triageReplyText, type ReplyIntent } from '@/lib/outreach/reply-triage';
import {
  applyReplyTriage,
  captureInboundReply,
} from '@/lib/outreach/reply-workflow';
import { scoreContactForOutreach } from '@/lib/outreach/quality';
import { evaluateCadence, DEFAULT_CADENCE_CONFIG } from '@/lib/cadence/engine';
import { buildDiscoverUrl } from '@/lib/prospect-url';

function metadataAsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function resolveSequenceId(
  db: PrismaClient,
  contactId: string,
  metadata: Record<string, unknown>,
): Promise<string | null> {
  // Priority 1: explicit sequenceId in metadata (cadence-created tasks have this)
  const metaSeqId = metadata.outreachSequenceId;
  if (typeof metaSeqId === 'string' && metaSeqId) return metaSeqId;

  // Priority 2: look up most recent active sequence for this contact
  const seq = await db.outreachSequence.findFirst({
    where: { contactId, status: { notIn: ['CLOSED_LOST'] } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  return seq?.id ?? null;
}

const TOUCH_TASK_CHANNELS = ['email', 'call', 'linkedin', 'whatsapp'] as const;
const TOUCH_TASK_STATUS_OPEN = 'touch_open';
const TOUCH_TASK_STATUS_DONE = 'touch_done';
const TOUCH_TASK_STATUS_SKIPPED = 'touch_skipped';

type TouchTaskChannel = (typeof TOUCH_TASK_CHANNELS)[number];

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getTouchTaskMetadata(value: unknown) {
  const metadata = metadataAsObject(value);
  const dueAt = parseIsoDate(metadata.dueAt);
  const priority =
    metadata.priority === 'high' || metadata.priority === 'low'
      ? metadata.priority
      : 'medium';

  return {
    metadata,
    dueAt,
    priority,
    notes: typeof metadata.notes === 'string' ? metadata.notes : null,
    kind: typeof metadata.kind === 'string' ? metadata.kind : null,
  };
}

function classifyDraftRisk(draft: {
  contact: {
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    seniority: string | null;
    department: string | null;
    primaryEmail: string | null;
    primaryPhone: string | null;
    linkedinUrl: string | null;
    outreachStatus: string;
  };
  bodyText: string | null;
  bodyHtml: string | null;
  metadata: unknown;
}) {
  const priority = scoreContactForOutreach(draft.contact);
  const metadata = metadataAsObject(draft.metadata);
  const evidenceBacked = metadata.evidenceBacked === true;
  const hasLossMap = typeof metadata.workflowLossMapId === 'string';
  const body = `${draft.bodyText ?? ''}\n${draft.bodyHtml ?? ''}`;
  const hasCta = body.includes(CTA_STEP_1) && body.includes(CTA_STEP_2);
  const isEvidenceReady = evidenceBacked && hasLossMap && hasCta;

  const manualReviewReasons = [...priority.reasons];

  if (!isEvidenceReady) {
    manualReviewReasons.push(
      'Missing evidence marker, CTA, or linked loss map',
    );
  }

  if (priority.status === 'blocked') {
    return {
      riskLevel: 'blocked' as const,
      riskReason:
        manualReviewReasons[0] ?? 'Blocked by outreach quality checks',
      priorityScore: priority.score,
      priorityTier: priority.tier,
      dataCompleteness: priority.completeness,
      manualReviewReasons: Array.from(new Set(manualReviewReasons)),
    };
  }

  if (priority.status === 'ready' && isEvidenceReady) {
    return {
      riskLevel: 'low' as const,
      riskReason: 'Evidence-backed draft with valid CTA and loss map',
      priorityScore: priority.score,
      priorityTier: priority.tier,
      dataCompleteness: priority.completeness,
      manualReviewReasons: [],
    };
  }

  return {
    riskLevel: 'review' as const,
    riskReason:
      manualReviewReasons[0] ??
      'Missing evidence marker, CTA, or linked loss map',
    priorityScore: priority.score,
    priorityTier: priority.tier,
    dataCompleteness: priority.completeness,
    manualReviewReasons: Array.from(new Set(manualReviewReasons)),
  };
}

async function markSequenceStepAfterSend(
  db: PrismaClient,
  draft: { id: string; metadata: unknown },
  success: boolean,
) {
  const metadata = metadataAsObject(draft.metadata);
  const sequenceId = metadata.outreachSequenceId;
  if (typeof sequenceId !== 'string' || !sequenceId) return;

  if (!success) {
    await db.outreachStep.updateMany({
      where: { sequenceId, outreachLogId: draft.id },
      data: { status: 'QUEUED' },
    });
    return;
  }

  await db.outreachStep.updateMany({
    where: { sequenceId, outreachLogId: draft.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
    },
  });

  await db.outreachSequence.update({
    where: { id: sequenceId },
    data: { status: 'SENT' },
  });

  // Auto-advance cadence after a successful send so multi-touch continues
  evaluateCadence(db, sequenceId, DEFAULT_CADENCE_CONFIG).catch(console.error);
}

function buildOutreachContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contact: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prospect: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signal?: any,
): OutreachContext {
  return {
    contact: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      jobTitle: contact.jobTitle,
      seniority: contact.seniority,
      department: contact.department,
    },
    company: {
      companyName: prospect.companyName ?? prospect.domain,
      domain: prospect.domain,
      industry: prospect.industry,
      employeeRange: prospect.employeeRange,
      technologies: prospect.technologies,
      description: prospect.description,
    },
    signal: signal
      ? {
          signalType: signal.signalType,
          title: signal.title,
          description: signal.description,
        }
      : undefined,
  };
}

export const outreachRouter = router({
  previewEmail: adminProcedure
    .input(
      z.object({
        contactId: z.string(),
        type: z.enum(['intro', 'followup', 'signal']).default('intro'),
        signalId: z.string().optional(),
        previousSubject: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const contact = await ctx.db.contact.findUniqueOrThrow({
        where: { id: input.contactId },
        include: { prospect: true },
      });

      let signal;
      if (input.signalId) {
        signal = await ctx.db.signal.findUnique({
          where: { id: input.signalId },
        });
      }

      const outreachCtx = buildOutreachContext(
        contact,
        contact.prospect,
        signal,
      );

      let email;
      if (input.type === 'followup' && input.previousSubject) {
        email = await generateFollowUp(outreachCtx, input.previousSubject);
      } else if (input.type === 'signal' && signal) {
        email = await generateSignalEmail(outreachCtx);
      } else {
        email = await generateIntroEmail(outreachCtx);
      }

      return email;
    }),

  sendEmail: adminProcedure
    .input(
      z.object({
        contactId: z.string(),
        subject: z.string(),
        bodyHtml: z.string(),
        bodyText: z.string(),
        type: z
          .enum([
            'INTRO_EMAIL',
            'WIZARD_LINK',
            'PDF_REPORT',
            'FOLLOW_UP',
            'SIGNAL_TRIGGERED',
          ])
          .default('INTRO_EMAIL'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const contact = await ctx.db.contact.findUniqueOrThrow({
        where: { id: input.contactId },
      });

      if (!contact.primaryEmail) {
        throw new Error('Contact has no email address');
      }

      // Quality gate: check research quality before sending
      const prospectId = contact.prospectId;
      const latestRun = await ctx.db.researchRun.findFirst({
        where: { prospectId },
        orderBy: { createdAt: 'desc' },
        select: {
          summary: true,
          qualityApproved: true,
        },
      });

      if (latestRun) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gate = (latestRun.summary as any)?.gate;
        const evidenceCount: number =
          typeof gate?.evidenceCount === 'number' ? gate.evidenceCount : 0;
        const sourceTypeCount: number =
          typeof gate?.sourceTypeCount === 'number' ? gate.sourceTypeCount : 0;
        const avgConf: number =
          typeof gate?.averageConfidence === 'number'
            ? gate.averageConfidence
            : 0;

        const tier = computeTrafficLight(
          evidenceCount,
          sourceTypeCount,
          avgConf,
        );

        if (tier === 'red') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
              'Kwaliteitsgate gefaald: te weinig bewijsmateriaal om outreach te versturen. Voer eerst een onderzoek uit.',
          });
        }
        if (tier === 'amber' && latestRun.qualityApproved !== true) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
              'Kwaliteitsgate: beperkte bronnen gevonden. Keur de kwaliteitsreview goed in het prospect-overzicht voordat je verstuurt.',
          });
        }
      }

      return sendOutreachEmail({
        contactId: input.contactId,
        to: contact.primaryEmail,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText,
        type: input.type,
      });
    }),

  sendWizardLink: adminProcedure
    .input(
      z.object({
        contactId: z.string(),
        prospectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [contact, prospect] = await Promise.all([
        ctx.db.contact.findUniqueOrThrow({
          where: { id: input.contactId },
        }),
        ctx.db.prospect.findUniqueOrThrow({
          where: { id: input.prospectId },
        }),
      ]);

      if (!contact.primaryEmail) {
        throw new Error('Contact has no email address');
      }

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
      const wizardUrl = buildDiscoverUrl(appUrl, {
        slug: prospect.slug,
        readableSlug: prospect.readableSlug,
        companyName: prospect.companyName,
        domain: prospect.domain,
      });

      const bodyHtml = `<p>Hi ${contact.firstName},</p>
<p>I've put together a personalized AI discovery for ${prospect.companyName ?? prospect.domain}. It shows specific opportunities where AI could add value to your business.</p>
<p><a href="${wizardUrl}" style="display:inline-block;padding:12px 24px;background:#0A0A23;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Your AI Discovery</a></p>
<p>Takes about 3 minutes to explore. I'd love to hear your thoughts.</p>
<p>Best,<br>Romano Kanters<br>Klarifai</p>`;

      const bodyText = `Hi ${contact.firstName},

I've put together a personalized AI discovery for ${prospect.companyName ?? prospect.domain}. It shows specific opportunities where AI could add value to your business.

View it here: ${wizardUrl}

Takes about 3 minutes to explore. I'd love to hear your thoughts.

Best,
Romano Kanters
Klarifai`;

      return sendOutreachEmail({
        contactId: input.contactId,
        to: contact.primaryEmail,
        subject: `AI Opportunities for ${prospect.companyName ?? prospect.domain}`,
        bodyHtml,
        bodyText,
        type: 'WIZARD_LINK',
        metadata: { prospectId: input.prospectId, wizardUrl },
      });
    }),

  getQueue: adminProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const drafts = await ctx.db.outreachLog.findMany({
        where: { status: input?.status ?? 'draft' },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 50,
        include: {
          contact: {
            include: {
              prospect: {
                select: { id: true, companyName: true, domain: true },
              },
            },
          },
        },
      });

      return { drafts };
    }),

  getDecisionInbox: adminProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const [drafts, reviewContacts] = await Promise.all([
        ctx.db.outreachLog.findMany({
          where: { status: 'draft' },
          orderBy: { createdAt: 'desc' },
          take: input?.limit ?? 100,
          include: {
            contact: {
              include: {
                prospect: {
                  select: { id: true, companyName: true, domain: true },
                },
              },
            },
          },
        }),
        ctx.db.contact.findMany({
          where: {
            outreachStatus: { not: 'OPTED_OUT' },
          },
          orderBy: { createdAt: 'desc' },
          take: 320,
          include: {
            prospect: {
              select: { id: true, companyName: true, domain: true },
            },
          },
        }),
      ]);

      const items = drafts.map((draft) => {
        const {
          riskLevel,
          riskReason,
          priorityScore,
          priorityTier,
          dataCompleteness,
          manualReviewReasons,
        } = classifyDraftRisk(draft);
        return {
          ...draft,
          riskLevel,
          riskReason,
          priorityScore,
          priorityTier,
          dataCompleteness,
          manualReviewReasons,
        };
      });

      const riskRank: Record<'low' | 'review' | 'blocked', number> = {
        low: 0,
        review: 1,
        blocked: 2,
      };
      items.sort((a, b) => {
        const rankDelta = riskRank[a.riskLevel] - riskRank[b.riskLevel];
        if (rankDelta !== 0) return rankDelta;
        const scoreDelta = b.priorityScore - a.priorityScore;
        if (scoreDelta !== 0) return scoreDelta;
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      const lowRiskIds = items
        .filter((item) => item.riskLevel === 'low')
        .map((item) => item.id);
      const reviewIds = items
        .filter((item) => item.riskLevel === 'review')
        .map((item) => item.id);
      const blockedIds = items
        .filter((item) => item.riskLevel === 'blocked')
        .map((item) => item.id);
      const draftedContactIds = new Set(items.map((item) => item.contactId));

      const manualReviewLeads = reviewContacts
        .map((contact) => {
          const priority = scoreContactForOutreach(contact);
          return {
            id: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            jobTitle: contact.jobTitle,
            seniority: contact.seniority,
            department: contact.department,
            primaryEmail: contact.primaryEmail,
            primaryPhone: contact.primaryPhone,
            linkedinUrl: contact.linkedinUrl,
            outreachStatus: contact.outreachStatus,
            prospect: contact.prospect,
            priorityScore: priority.score,
            priorityTier: priority.tier,
            dataCompleteness: priority.completeness,
            manualReviewReasons: priority.reasons,
            qualityStatus: priority.status,
          };
        })
        .filter(
          (item) =>
            item.qualityStatus !== 'ready' && !draftedContactIds.has(item.id),
        )
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, 50);

      return {
        drafts: items,
        summary: {
          total: items.length,
          lowRisk: lowRiskIds.length,
          needsReview: reviewIds.length,
          blocked: blockedIds.length,
          manualReviewLeads: manualReviewLeads.length,
        },
        lowRiskIds,
        reviewIds,
        blockedIds,
        manualReviewLeads,
      };
    }),

  approveDraft: adminProcedure
    .input(
      z.object({
        id: z.string(),
        subject: z.string().optional(),
        bodyHtml: z.string().optional(),
        bodyText: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Step 1: Atomic claim — prevents double-send
      const claimed = await ctx.db.outreachLog.updateMany({
        where: { id: input.id, status: 'draft' },
        data: { status: 'sending' },
      });

      if (claimed.count === 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Draft is already being sent. Please refresh the queue.',
        });
      }

      const draft = await ctx.db.outreachLog.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
              jobTitle: true,
              seniority: true,
              department: true,
              primaryPhone: true,
              linkedinUrl: true,
              outreachStatus: true,
            },
          },
        },
      });

      if (!draft.contact.primaryEmail) {
        // Revert claim — contact data issue is not a send conflict
        await ctx.db.outreachLog.update({
          where: { id: input.id },
          data: { status: 'draft' },
        });
        throw new Error('Contact has no email address');
      }

      const quality = scoreContactForOutreach(draft.contact);
      if (quality.status === 'blocked') {
        // Quality block is permanent — keep manual_review (not a transient error)
        await ctx.db.outreachLog.update({
          where: { id: input.id },
          data: {
            status: 'manual_review',
            metadata: {
              ...metadataAsObject(draft.metadata),
              manualReviewReasons: quality.reasons,
              blockedByQualityChecks: true,
            } as never,
          },
        });
        throw new Error(
          `Draft blocked by quality checks: ${quality.reasons.join(', ')}`,
        );
      }

      let result;
      try {
        // Send the (possibly edited) email
        result = await sendOutreachEmail({
          contactId: draft.contactId,
          to: draft.contact.primaryEmail,
          subject:
            input.subject ?? draft.subject ?? 'Klarifai — AI Opportunities',
          bodyHtml: input.bodyHtml ?? draft.bodyHtml ?? '',
          bodyText: input.bodyText ?? draft.bodyText ?? '',
          type: draft.type,
        });
      } catch (error) {
        // Transient send failure — revert to draft so it reappears in the queue for retry
        await ctx.db.outreachLog.update({
          where: { id: input.id },
          data: { status: 'draft' },
        });
        throw error;
      }

      await markSequenceStepAfterSend(ctx.db, draft, result.success);

      if (result.success) {
        await ctx.db.outreachLog.delete({ where: { id: input.id } });
      } else {
        await ctx.db.outreachLog.update({
          where: { id: input.id },
          data: { status: 'retry' },
        });
      }

      return result;
    }),

  bulkApproveLowRisk: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().max(100).default(20),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const drafts = await ctx.db.outreachLog.findMany({
        where: { status: 'draft' },
        orderBy: { createdAt: 'asc' },
        take: Math.max(limit * 3, 60),
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
              primaryPhone: true,
              jobTitle: true,
              seniority: true,
              department: true,
              linkedinUrl: true,
              outreachStatus: true,
            },
          },
        },
      });

      const lowRiskDrafts = drafts
        .filter((draft) => classifyDraftRisk(draft).riskLevel === 'low')
        .slice(0, limit);

      let approved = 0;
      let failed = 0;
      const processedIds: string[] = [];
      const failedIds: string[] = [];

      for (const draft of lowRiskDrafts) {
        if (!draft.contact.primaryEmail) continue;

        // Atomic claim per draft — skip if already claimed by concurrent request
        const claimed = await ctx.db.outreachLog.updateMany({
          where: { id: draft.id, status: 'draft' },
          data: { status: 'sending' },
        });

        if (claimed.count === 0) {
          // Already claimed by concurrent request — skip, don't fail
          continue;
        }

        let result;
        try {
          result = await sendOutreachEmail({
            contactId: draft.contactId,
            to: draft.contact.primaryEmail,
            subject: draft.subject ?? 'Klarifai — AI Opportunities',
            bodyHtml: draft.bodyHtml ?? '',
            bodyText: draft.bodyText ?? '',
            type: draft.type,
          });
        } catch {
          // Transient send failure — revert to draft so it reappears in the queue for retry
          failed += 1;
          failedIds.push(draft.id);
          await ctx.db.outreachLog.update({
            where: { id: draft.id },
            data: { status: 'draft' },
          });
          continue;
        }

        await markSequenceStepAfterSend(ctx.db, draft, result.success);
        if (result.success) {
          approved += 1;
          processedIds.push(draft.id);
          await ctx.db.outreachLog.delete({ where: { id: draft.id } });
        } else {
          failed += 1;
          failedIds.push(draft.id);
          await ctx.db.outreachLog.update({
            where: { id: draft.id },
            data: { status: 'retry' },
          });
        }
      }

      return {
        scannedDrafts: drafts.length,
        lowRiskFound: lowRiskDrafts.length,
        approved,
        failed,
        processedIds,
        failedIds,
      };
    }),

  captureReply: adminProcedure
    .input(
      z.object({
        contactId: z.string(),
        subject: z.string().optional(),
        bodyText: z.string().min(2),
        bodyHtml: z.string().optional(),
        source: z.string().default('email-inbound'),
        outreachSequenceId: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return captureInboundReply(ctx.db, {
        contactId: input.contactId,
        subject: input.subject,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
        source: input.source,
        outreachSequenceId: input.outreachSequenceId,
        metadata: input.metadata,
      });
    }),

  getReplyInbox: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().max(200).default(100),
          status: z.enum(['pending', 'triaged', 'all']).default('pending'),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? 'pending';
      const whereStatus =
        status === 'pending'
          ? 'received'
          : status === 'triaged'
            ? 'triaged'
            : undefined;
      const logs = await ctx.db.outreachLog.findMany({
        where: {
          type: 'FOLLOW_UP',
          ...(whereStatus
            ? { status: whereStatus }
            : { status: { in: ['received', 'triaged'] } }),
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 100,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
              prospect: {
                select: { id: true, companyName: true, domain: true },
              },
            },
          },
        },
      });

      const items = logs.map((log) => {
        const metadata = metadataAsObject(log.metadata);
        const triageMeta = metadataAsObject(metadata.triage);
        const suggestion = triageReplyText({
          subject: log.subject,
          bodyText: log.bodyText,
        });
        return {
          ...log,
          triage: {
            intent:
              typeof triageMeta.intent === 'string' ? triageMeta.intent : null,
            confidence:
              typeof triageMeta.confidence === 'number'
                ? triageMeta.confidence
                : null,
            suggestedAction:
              typeof triageMeta.suggestedAction === 'string'
                ? triageMeta.suggestedAction
                : null,
            deferDays:
              typeof triageMeta.deferDays === 'number'
                ? triageMeta.deferDays
                : null,
            processedAt:
              typeof triageMeta.processedAt === 'string'
                ? triageMeta.processedAt
                : null,
          },
          suggestion,
        };
      });

      return {
        replies: items,
        summary: {
          total: items.length,
          pending: items.filter((item) => item.status === 'received').length,
          triaged: items.filter((item) => item.status === 'triaged').length,
        },
      };
    }),

  triageReply: adminProcedure
    .input(
      z.object({
        replyLogId: z.string(),
        categoryOverride: z
          .enum(['interested', 'later', 'not_fit', 'stop', 'unknown'])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return applyReplyTriage(ctx.db, {
        replyLogId: input.replyLogId,
        categoryOverride: input.categoryOverride,
      });
    }),

  runReplyTriageSweep: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().max(200).default(50),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const logs = await ctx.db.outreachLog.findMany({
        where: {
          type: 'FOLLOW_UP',
          status: 'received',
        },
        orderBy: { createdAt: 'asc' },
        take: input?.limit ?? 50,
        select: { id: true },
      });

      const processed: Array<{
        replyLogId: string;
        intent: ReplyIntent;
        suggestedAction: string;
      }> = [];
      for (const log of logs) {
        const result = await applyReplyTriage(ctx.db, {
          replyLogId: log.id,
        });
        processed.push({
          replyLogId: result.replyLogId,
          intent: result.intent,
          suggestedAction: result.suggestedAction,
        });
      }

      return {
        scanned: logs.length,
        processed: processed.length,
        interested: processed.filter((item) => item.intent === 'interested')
          .length,
        later: processed.filter((item) => item.intent === 'later').length,
        notFit: processed.filter((item) => item.intent === 'not_fit').length,
        stop: processed.filter((item) => item.intent === 'stop').length,
        unknown: processed.filter((item) => item.intent === 'unknown').length,
      };
    }),

  rejectDraft: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.outreachLog.update({
        where: { id: input.id },
        data: { status: 'rejected' },
      });
      return { success: true };
    }),

  getHistory: adminProcedure
    .input(
      z.object({
        contactId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = input.contactId
        ? {
            contactId: input.contactId,
            channel: 'email',
            status: { not: 'draft' },
          }
        : { channel: 'email', status: { not: 'draft' } };

      return ctx.db.outreachLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
              prospect: {
                select: { companyName: true },
              },
            },
          },
        },
      });
    }),

  queueTouchTask: adminProcedure
    .input(
      z.object({
        contactId: z.string(),
        channel: z.enum(TOUCH_TASK_CHANNELS).default('call'),
        subject: z.string().min(2).max(180).optional(),
        notes: z.string().max(2000).optional(),
        dueAt: z.string().datetime().optional(),
        priority: z.enum(['low', 'medium', 'high']).default('medium'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.contact.findUniqueOrThrow({
        where: { id: input.contactId },
        select: { id: true },
      });

      const defaultSubject =
        input.channel === 'call'
          ? 'Manual call follow-up'
          : input.channel === 'linkedin'
            ? 'LinkedIn touch follow-up'
            : input.channel === 'whatsapp'
              ? 'WhatsApp follow-up'
              : 'Manual email follow-up';

      return ctx.db.outreachLog.create({
        data: {
          contactId: input.contactId,
          type: 'FOLLOW_UP',
          channel: input.channel,
          status: TOUCH_TASK_STATUS_OPEN,
          subject: input.subject?.trim() || defaultSubject,
          bodyText: input.notes?.trim() || null,
          metadata: {
            kind: 'touch_task',
            priority: input.priority,
            dueAt: input.dueAt ?? null,
            notes: input.notes?.trim() || null,
            createdBy: 'admin-ui',
          } as never,
        },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
              primaryPhone: true,
              linkedinUrl: true,
              prospect: {
                select: { id: true, companyName: true, domain: true },
              },
            },
          },
        },
      });
    }),

  getTouchTaskQueue: adminProcedure
    .input(
      z
        .object({
          status: z
            .enum(['open', 'completed', 'skipped', 'all'])
            .default('open'),
          channel: z.enum(TOUCH_TASK_CHANNELS).optional(),
          overdueOnly: z.boolean().default(false),
          limit: z.number().int().positive().max(300).default(120),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? 'open';
      const statusFilter =
        status === 'open'
          ? [TOUCH_TASK_STATUS_OPEN]
          : status === 'completed'
            ? [TOUCH_TASK_STATUS_DONE]
            : status === 'skipped'
              ? [TOUCH_TASK_STATUS_SKIPPED]
              : [
                  TOUCH_TASK_STATUS_OPEN,
                  TOUCH_TASK_STATUS_DONE,
                  TOUCH_TASK_STATUS_SKIPPED,
                ];

      const logs = await ctx.db.outreachLog.findMany({
        where: {
          channel: input?.channel ?? { in: [...TOUCH_TASK_CHANNELS] },
          status: { in: statusFilter },
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 120,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
              primaryPhone: true,
              linkedinUrl: true,
              outreachStatus: true,
              prospect: {
                select: { id: true, companyName: true, domain: true },
              },
            },
          },
        },
      });

      const now = Date.now();
      const items = logs
        .map((log) => {
          const touchMeta = getTouchTaskMetadata(log.metadata);
          const isOverdue =
            log.status === TOUCH_TASK_STATUS_OPEN &&
            touchMeta.dueAt !== null &&
            touchMeta.dueAt.getTime() < now;
          return {
            ...log,
            task: {
              dueAt: touchMeta.dueAt?.toISOString() ?? null,
              isOverdue,
              priority: touchMeta.priority,
              notes: touchMeta.notes,
              kind: touchMeta.kind,
            },
          };
        })
        .filter((item) => (input?.overdueOnly ? item.task.isOverdue : true));

      const byChannel = items.reduce<Record<TouchTaskChannel, number>>(
        (acc, item) => {
          if (
            item.channel === 'email' ||
            item.channel === 'call' ||
            item.channel === 'linkedin' ||
            item.channel === 'whatsapp'
          ) {
            acc[item.channel] += 1;
          }
          return acc;
        },
        { email: 0, call: 0, linkedin: 0, whatsapp: 0 },
      );

      return {
        items,
        summary: {
          total: items.length,
          open: items.filter((item) => item.status === TOUCH_TASK_STATUS_OPEN)
            .length,
          completed: items.filter(
            (item) => item.status === TOUCH_TASK_STATUS_DONE,
          ).length,
          skipped: items.filter(
            (item) => item.status === TOUCH_TASK_STATUS_SKIPPED,
          ).length,
          overdue: items.filter((item) => item.task.isOverdue).length,
          byChannel,
        },
      };
    }),

  completeTouchTask: adminProcedure
    .input(
      z.object({
        id: z.string(),
        completionNotes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.outreachLog.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (task.status !== TOUCH_TASK_STATUS_OPEN) {
        throw new Error('Only open touch tasks can be completed');
      }

      const metadata = metadataAsObject(task.metadata);
      const completedAt = new Date();
      const updated = await ctx.db.outreachLog.update({
        where: { id: input.id },
        data: {
          status: TOUCH_TASK_STATUS_DONE,
          sentAt: completedAt,
          metadata: {
            ...metadata,
            kind: metadata.kind ?? 'touch_task',
            completedAt: completedAt.toISOString(),
            completionNotes:
              input.completionNotes?.trim() || metadata.completionNotes || null,
          } as never,
        },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
              primaryPhone: true,
              linkedinUrl: true,
              prospect: {
                select: { id: true, companyName: true, domain: true },
              },
            },
          },
        },
      });

      const outreachStepId =
        typeof metadata.outreachStepId === 'string'
          ? metadata.outreachStepId
          : null;
      const sequenceIdFromMetadata =
        typeof metadata.outreachSequenceId === 'string'
          ? metadata.outreachSequenceId
          : undefined;
      if (outreachStepId) {
        await ctx.db.outreachStep.updateMany({
          where: { id: outreachStepId, sequenceId: sequenceIdFromMetadata },
          data: {
            status: 'SENT',
            sentAt: completedAt,
          },
        });
      }

      await ctx.db.contact.update({
        where: { id: task.contactId },
        data: { lastContactedAt: completedAt },
      });

      // Fire-and-forget: cadence evaluation must never block task completion
      const seqId = await resolveSequenceId(ctx.db, task.contactId, metadata);
      if (seqId) {
        evaluateCadence(ctx.db, seqId, DEFAULT_CADENCE_CONFIG).catch(
          console.error,
        );
      }

      return updated;
    }),

  skipTouchTask: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.outreachLog.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (task.status !== TOUCH_TASK_STATUS_OPEN) {
        throw new Error('Only open touch tasks can be skipped');
      }

      const metadata = metadataAsObject(task.metadata);
      const skippedAt = new Date();
      const updated = await ctx.db.outreachLog.update({
        where: { id: input.id },
        data: {
          status: TOUCH_TASK_STATUS_SKIPPED,
          metadata: {
            ...metadata,
            kind: metadata.kind ?? 'touch_task',
            skippedAt: skippedAt.toISOString(),
            skipReason: input.reason?.trim() || metadata.skipReason || null,
          } as never,
        },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              primaryEmail: true,
              primaryPhone: true,
              linkedinUrl: true,
              prospect: {
                select: { id: true, companyName: true, domain: true },
              },
            },
          },
        },
      });

      const outreachStepId =
        typeof metadata.outreachStepId === 'string'
          ? metadata.outreachStepId
          : null;
      const sequenceIdFromMetadata =
        typeof metadata.outreachSequenceId === 'string'
          ? metadata.outreachSequenceId
          : undefined;
      if (outreachStepId) {
        await ctx.db.outreachStep.updateMany({
          where: { id: outreachStepId, sequenceId: sequenceIdFromMetadata },
          data: {
            // Skip still counts as touch attempt; keep cadence moving.
            status: 'SENT',
            sentAt: skippedAt,
          },
        });
      }

      // Fire-and-forget: cadence evaluation must never block task skip
      const seqId = await resolveSequenceId(ctx.db, task.contactId, metadata);
      if (seqId) {
        evaluateCadence(ctx.db, seqId, DEFAULT_CADENCE_CONFIG).catch(
          console.error,
        );
      }

      return updated;
    }),

  processSignals: adminProcedure.mutation(async () => {
    return processUnprocessedSignals();
  }),
});
