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
import { projectAdminProcedure, router } from '../trpc';
import { transitionQuote } from '@/lib/state-machines/quote';

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
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.quote.findMany({
        where: {
          prospect: { projectId: ctx.projectId },
          ...(input?.status && { status: input.status }),
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
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertQuoteInProject(ctx as unknown as ScopedCtx, input.id);
      return ctx.db.quote.findUniqueOrThrow({
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
      const { lines, prospectId, datum, geldigTot, ...rest } = input;
      return ctx.db.quote.create({
        data: {
          ...rest,
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

      const { id, lines, datum, geldigTot, ...rest } = input;

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

        return tx.quote.update({
          where: { id },
          data: {
            ...rest,
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
});
