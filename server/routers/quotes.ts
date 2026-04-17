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
        include: { lines: { orderBy: { position: 'asc' } } },
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
});

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
