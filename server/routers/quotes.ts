/**
 * DATA-08 / DATA-10 — quotes tRPC router.
 *
 * Multi-tenant isolation: Quote has no direct projectId column. All queries
 * scope through `prospect: { projectId: ctx.projectId }`. The Prospect FK is
 * the boundary.
 *
 * Status mutations: only via `transition`. The `update` mutation MUST NOT
 * accept any snapshot or status fields — those go through transitionQuote.
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { projectAdminProcedure, router } from '../trpc';
import { transitionQuote } from '@/lib/state-machines/quote';
import { generateQuoteNarrative } from '@/lib/analysis/quote-narrative-generator';
import { sendOutreachEmail } from '@/lib/outreach/send-email';

const QUOTE_STATUS_VALUES = [
  'DRAFT',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'ARCHIVED',
] as const;

const QuoteLineInputSchema = z.object({
  fase: z.string().min(1),
  omschrijving: z.string().optional().default(''),
  oplevering: z.string().optional().default(''),
  uren: z.number().int().nonnegative(),
  tarief: z.number().int(), // SIGNED — negative allowed for discount lines (OFF003)
  position: z.number().int().optional(),
});

interface ScopedCtx {
  db: {
    quote: {
      findFirst: (args: unknown) => Promise<{
        id: string;
        status: string;
      } | null>;
    };
    prospect: {
      findFirst: (args: unknown) => Promise<{ id: string } | null>;
    };
  };
  projectId: string;
}

async function assertQuoteInProject(ctx: ScopedCtx, id: string) {
  const quote = await ctx.db.quote.findFirst({
    where: { id, prospect: { projectId: ctx.projectId } },
    select: { id: true, status: true },
  });
  if (!quote) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Quote not found in active project scope',
    });
  }
  return quote;
}

async function assertProspectInProject(ctx: ScopedCtx, prospectId: string) {
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

export const quotesRouter = router({
  list: projectAdminProcedure
    .input(
      z
        .object({
          status: z.enum(QUOTE_STATUS_VALUES).optional(),
          prospectId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.quote.findMany({
        where: {
          prospect: { projectId: ctx.projectId },
          ...(input?.status && { status: input.status }),
          ...(input?.prospectId && { prospectId: input.prospectId }),
        },
        include: {
          lines: { orderBy: { position: 'asc' } },
          prospect: {
            select: {
              id: true,
              slug: true,
              readableSlug: true,
              companyName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  get: projectAdminProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: {
          OR: [{ slug: input.slug }, { id: input.slug }],
          prospect: { projectId: ctx.projectId },
        },
        include: {
          lines: { orderBy: { position: 'asc' } },
          prospect: {
            select: {
              id: true,
              slug: true,
              readableSlug: true,
              companyName: true,
              voorstelMode: true,
              status: true,
              contacts: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  primaryEmail: true,
                },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      });
      if (!quote) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });
      }
      return quote;
    }),

  create: projectAdminProcedure
    .input(
      z.object({
        prospectId: z.string(),
        nummer: z.string().min(1),
        datum: z.string(), // ISO date
        geldigTot: z.string(),
        onderwerp: z.string().min(1),
        tagline: z.string().optional(),
        introductie: z.string().optional(),
        uitdaging: z.string().optional(),
        aanpak: z.string().optional(),
        btwPercentage: z.number().int(),
        scope: z.string().optional(),
        buitenScope: z.string().optional(),
        lines: z.array(QuoteLineInputSchema).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProspectInProject(
        ctx as unknown as ScopedCtx,
        input.prospectId,
      );
      const prospect = await ctx.db.prospect.findUniqueOrThrow({
        where: { id: input.prospectId },
        select: { companyName: true, domain: true },
      });
      const { lines, prospectId, datum, geldigTot, ...rest } = input;
      return ctx.db.quote.create({
        data: {
          ...rest,
          slug: generateQuoteSlug(
            prospect.companyName,
            prospect.domain,
            input.nummer,
          ),
          datum: new Date(datum),
          geldigTot: new Date(geldigTot),
          prospect: { connect: { id: prospectId } },
          lines: {
            create: lines.map((l, idx) => ({
              fase: l.fase,
              omschrijving: l.omschrijving,
              oplevering: l.oplevering,
              uren: l.uren,
              tarief: l.tarief,
              position: l.position ?? idx,
            })),
          },
        },
        include: { lines: { orderBy: { position: 'asc' } } },
      });
    }),

  update: projectAdminProcedure
    .input(
      z.object({
        id: z.string(),
        // STATUS DELIBERATELY OMITTED — use `transition` instead.
        // snapshot* / replacesId also omitted — those are mutation-controlled.
        nummer: z.string().min(1).optional(),
        datum: z.string().optional(),
        geldigTot: z.string().optional(),
        onderwerp: z.string().min(1).optional(),
        tagline: z.string().optional(),
        introductie: z.string().optional(),
        uitdaging: z.string().optional(),
        aanpak: z.string().optional(),
        btwPercentage: z.number().int().optional(),
        scope: z.string().optional(),
        buitenScope: z.string().optional(),
        lines: z.array(QuoteLineInputSchema).optional(),
        // Payment schedule — null = single payment (100% post-delivery)
        paymentSchedule: z
          .array(
            z.object({
              label: z.string(),
              percentage: z.number(),
              dueOn: z.string(),
            }),
          )
          .nullable()
          .optional(),
        recipientCompany: z.string().max(120).nullable().optional(),
        recipientContact: z.string().max(120).nullable().optional(),
        recipientStreet: z.string().max(120).nullable().optional(),
        recipientCity: z.string().max(120).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await assertQuoteInProject(
        ctx as unknown as ScopedCtx,
        input.id,
      );

      // Q9 immutability: SENT and later quotes are read-only
      if (existing.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot update quote in status ${existing.status}. Only DRAFT quotes are editable.`,
        });
      }

      // Validate payment schedule: percentages must sum to 100 when provided
      if (input.paymentSchedule && input.paymentSchedule.length > 0) {
        const sum = input.paymentSchedule.reduce(
          (acc, item) => acc + item.percentage,
          0,
        );
        if (Math.round(sum) !== 100) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Betalingsschema percentages moeten optellen tot 100% (nu: ${sum}%).`,
          });
        }
      }

      const { id, lines, datum, geldigTot, paymentSchedule, ...rest } = input;

      return ctx.db.$transaction(async (tx) => {
        if (lines !== undefined) {
          await tx.quoteLine.deleteMany({ where: { quoteId: id } });
          await tx.quoteLine.createMany({
            data: lines.map((l, idx) => ({
              quoteId: id,
              fase: l.fase,
              omschrijving: l.omschrijving,
              oplevering: l.oplevering,
              uren: l.uren,
              tarief: l.tarief,
              position: l.position ?? idx,
            })),
          });
        }

        // Prisma nullable JSON: null must be passed as Prisma.JsonNull
        const paymentScheduleData:
          | { paymentSchedule: Prisma.InputJsonValue | typeof Prisma.JsonNull }
          | Record<string, never> =
          paymentSchedule !== undefined
            ? {
                paymentSchedule:
                  paymentSchedule === null || paymentSchedule.length === 0
                    ? Prisma.JsonNull
                    : (paymentSchedule as Prisma.InputJsonValue),
              }
            : {};

        return tx.quote.update({
          where: { id },
          data: {
            ...rest,
            ...paymentScheduleData,
            ...(datum !== undefined && { datum: new Date(datum) }),
            ...(geldigTot !== undefined && { geldigTot: new Date(geldigTot) }),
          },
          include: { lines: { orderBy: { position: 'asc' } } },
        });
      });
    }),

  transition: projectAdminProcedure
    .input(
      z.object({
        id: z.string(),
        newStatus: z.enum(QUOTE_STATUS_VALUES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertQuoteInProject(ctx as unknown as ScopedCtx, input.id);
      return transitionQuote(ctx.db, input.id, input.newStatus);
    }),

  /**
   * Phase 61 / O1 — next-quote-number suggester.
   *
   * Returns the lowest unused `YYYY-OFF###` sequence number in the active
   * project. Empty scope → `YYYY-OFF001`. Highest existing → increment by 1.
   * No atomicity claim: this is an advisory helper only. The actual uniqueness
   * guard lives on Quote.nummer (DB unique constraint).
   */
  suggestNextQuoteNumber: projectAdminProcedure.query(async ({ ctx }) => {
    const year = new Date().getFullYear();
    const prefix = `${year}-OFF`;
    const latest = await ctx.db.quote.findFirst({
      where: {
        prospect: { projectId: ctx.projectId },
        nummer: { startsWith: prefix },
      },
      orderBy: { nummer: 'desc' },
      select: { nummer: true },
    });
    if (!latest) return { nummer: `${prefix}001` };
    const match = latest.nummer.match(/OFF(\d{3})/);
    const next = match ? Number(match[1]) + 1 : 1;
    return { nummer: `${prefix}${String(next).padStart(3, '0')}` };
  }),

  /**
   * Phase 61 / ADMIN-08 / Pitfall 3 — clone a Quote into a new DRAFT version.
   *
   * Clones all narrative + line data from the source Quote (SENT/VIEWED are
   * expected callers, but any status is accepted — immutability is enforced
   * on the *source* row which stays untouched in Q9 terms: no snapshot or
   * narrative field is rewritten) and archives the source inside ONE
   * prisma.$transaction so the client never sees a half-cloned state.
   *
   * The new DRAFT.replacesId points at the source so the UI can render
   * version lineage. nummer is suffixed `-v2` (follow-up versions: `-v3`,
   * etc. — executor scans the suffix and increments).
   */
  createVersion: projectAdminProcedure
    .input(z.object({ fromId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertQuoteInProject(ctx as unknown as ScopedCtx, input.fromId);

      const original = await ctx.db.quote.findUniqueOrThrow({
        where: { id: input.fromId },
        include: {
          lines: { orderBy: { position: 'asc' } },
          prospect: { select: { companyName: true, domain: true } },
        },
      });

      return ctx.db.$transaction(async (tx) => {
        const now = new Date();
        const geldigTot = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const nextNummer = buildNextVersionNummer(original.nummer);

        const created = await tx.quote.create({
          data: {
            prospectId: original.prospectId,
            replacesId: original.id,
            status: 'DRAFT',
            nummer: nextNummer,
            slug: generateQuoteSlug(
              original.prospect.companyName,
              original.prospect.domain,
              nextNummer,
            ),
            datum: now,
            geldigTot,
            onderwerp: original.onderwerp,
            tagline: original.tagline,
            introductie: original.introductie,
            uitdaging: original.uitdaging,
            aanpak: original.aanpak,
            btwPercentage: original.btwPercentage,
            scope: original.scope,
            buitenScope: original.buitenScope,
            lines: {
              create: original.lines.map((l, idx) => ({
                fase: l.fase,
                omschrijving: l.omschrijving,
                oplevering: l.oplevering,
                uren: l.uren,
                tarief: l.tarief,
                position: idx,
              })),
            },
          },
          include: { lines: { orderBy: { position: 'asc' } } },
        });

        await transitionQuote(tx, original.id, 'ARCHIVED');
        return created;
      });
    }),

  /**
   * Fase B — toggle "active voorstel" for a prospect.
   *
   * Atomically clears isActiveProposal on all quotes for the same prospect,
   * then sets it on the target quote. Passing `active: false` just clears.
   */
  setActiveProposal: projectAdminProcedure
    .input(
      z.object({
        id: z.string(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, prospect: { projectId: ctx.projectId } },
        select: { id: true, prospectId: true },
      });
      if (!quote) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Quote not found in active project scope',
        });
      }

      return ctx.db.$transaction(async (tx) => {
        await tx.quote.updateMany({
          where: { prospectId: quote.prospectId },
          data: { isActiveProposal: false },
        });
        if (input.active) {
          await tx.quote.update({
            where: { id: input.id },
            data: { isActiveProposal: true },
          });
        }
        return tx.quote.findUniqueOrThrow({
          where: { id: input.id },
          include: {
            lines: { orderBy: { position: 'asc' } },
            prospect: {
              select: {
                id: true,
                slug: true,
                readableSlug: true,
                companyName: true,
                status: true,
              },
            },
          },
        });
      });
    }),

  updateNotes: projectAdminProcedure
    .input(
      z.object({
        id: z.string(),
        meetingNotes: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertQuoteInProject(ctx as unknown as ScopedCtx, input.id);
      return ctx.db.quote.update({
        where: { id: input.id },
        data: { meetingNotes: input.meetingNotes },
        select: { id: true, meetingNotes: true },
      });
    }),

  generateNarrative: projectAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, prospect: { projectId: ctx.projectId } },
        include: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              domain: true,
              industry: true,
              city: true,
              employeeCount: true,
              prospectAnalyses: {
                where: { version: 'analysis-v2' },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { content: true },
              },
            },
          },
        },
      });
      if (!quote) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Quote not found in active project scope',
        });
      }
      if (!quote.meetingNotes?.trim()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Meeting notes are required before generating narrative',
        });
      }

      const analysis = quote.prospect.prospectAnalyses[0]?.content ?? null;

      const result = await generateQuoteNarrative({
        meetingNotes: quote.meetingNotes,
        prospectName:
          quote.prospect.companyName ?? quote.prospect.domain ?? 'Prospect',
        prospectDomain: quote.prospect.domain,
        prospectIndustry: quote.prospect.industry,
        prospectCity: quote.prospect.city,
        prospectEmployeeCount: quote.prospect.employeeCount,
        analysisContent: analysis,
      });

      return ctx.db.$transaction(async (tx) => {
        const updated = await tx.quote.update({
          where: { id: input.id },
          data: {
            introductie: result.introductie,
            uitdaging: result.uitdaging,
            aanpak: result.aanpak,
            narrativeGeneratedAt: new Date(),
          },
          include: { lines: { orderBy: { position: 'asc' } } },
        });

        // If no existing lines, create suggested lines from AI
        if (updated.lines.length === 0 && result.suggestedLines.length > 0) {
          await tx.quoteLine.createMany({
            data: result.suggestedLines.map((l, idx) => ({
              quoteId: input.id,
              fase: l.omschrijving,
              omschrijving: l.omschrijving,
              uren: l.uren,
              tarief: l.tarief,
              position: idx,
            })),
          });
        }

        return tx.quote.findUniqueOrThrow({
          where: { id: input.id },
          include: {
            lines: { orderBy: { position: 'asc' } },
            prospect: {
              select: {
                id: true,
                slug: true,
                readableSlug: true,
                companyName: true,
              },
            },
          },
        });
      });
    }),

  sendEmail: projectAdminProcedure
    .input(
      z.object({
        id: z.string(),
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, prospect: { projectId: ctx.projectId } },
        include: {
          prospect: {
            include: { contacts: { take: 1, orderBy: { createdAt: 'asc' } } },
          },
        },
      });
      if (!quote) throw new TRPCError({ code: 'NOT_FOUND' });
      if (quote.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Quote is niet meer in concept',
        });
      }

      const contact = quote.prospect.contacts[0];
      if (!contact) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Prospect heeft geen contact',
        });
      }

      const sendResult = await sendOutreachEmail({
        contactId: contact.id,
        to: input.to,
        subject: input.subject,
        bodyText: input.body,
        bodyHtml: input.body.replace(/\n/g, '<br>'),
        type: 'QUOTE_DELIVERY',
        quoteId: quote.id,
      });

      if (!sendResult.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Email kon niet verzonden worden',
        });
      }

      await transitionQuote(ctx.db, quote.id, 'SENT');

      return { ok: true };
    }),

  delete: projectAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertQuoteInProject(ctx as unknown as ScopedCtx, input.id);
      await ctx.db.quoteLine.deleteMany({ where: { quoteId: input.id } });
      await ctx.db.quote.delete({ where: { id: input.id } });
      return { success: true };
    }),
});

/** Generate URL slug: `{kebab-company}-{kebab-nummer}` e.g. `marfa-2026-off001` */
function generateQuoteSlug(
  companyName: string | null | undefined,
  domain: string | null | undefined,
  nummer: string,
): string {
  const name = (companyName ?? domain?.split('.')[0] ?? 'prospect')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const num = nummer.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${name}-${num}`;
}

/**
 * Suffix the quote nummer with `-v2`, or increment an existing `-vN` suffix.
 * Exported for test visibility via a side-module if needed — intentionally a
 * private helper for now.
 */
function buildNextVersionNummer(currentNummer: string): string {
  const match = currentNummer.match(/^(.*?)-v(\d+)$/);
  if (match) {
    const base = match[1] ?? currentNummer;
    const n = Number(match[2]) + 1;
    return `${base}-v${n}`;
  }
  return `${currentNummer}-v2`;
}
