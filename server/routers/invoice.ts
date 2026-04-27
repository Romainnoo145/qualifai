import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, projectAdminProcedure } from '../trpc';
import { nextInvoiceNumber } from '@/lib/invoice-number';
import { computeQuoteTotals } from '@/lib/quotes/quote-totals';

type PaymentTerm = { label: string; percentage: number };

export const invoiceRouter = router({
  /**
   * Prepare (create as DRAFT) a new Invoice for a specific termijn of an
   * engagement's betaalschema.
   *
   * Convention: termijn percentages apply to the EXCLUSIVE-of-BTW subtotal
   * (netto). Each invoice carries its own BTW on top. This matches Dutch B2B
   * practice where "50% bij ondertekening" means 50% of the ex-VAT amount.
   *
   * computeQuoteTotals returns euro amounts (not cents). We convert:
   *   amountCents = round(netto * percentage / 100 * 100)
   */
  prepare: projectAdminProcedure
    .input(
      z.object({
        engagementId: z.string(),
        termijnIndex: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const engagement = await ctx.db.engagement.findFirst({
        where: { id: input.engagementId, projectId: ctx.projectId },
        include: {
          quote: { include: { lines: true } },
          invoices: true,
        },
      });
      if (!engagement) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Engagement not found in scope',
        });
      }

      const schedule = (engagement.quote.paymentSchedule ??
        []) as PaymentTerm[];
      const term = schedule[input.termijnIndex];
      if (!term) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Termijn ${input.termijnIndex} not in betaalschema`,
        });
      }

      const existing = engagement.invoices.find(
        (i) => i.termijnIndex === input.termijnIndex,
      );
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Factuur voor deze termijn bestaat al',
        });
      }

      // netto = subtotaal exclusief BTW (euros)
      const totals = computeQuoteTotals(
        engagement.quote.lines,
        engagement.quote.btwPercentage,
      );
      const amountCents = Math.round(
        totals.netto * (term.percentage / 100) * 100,
      );

      const invoiceNumber = await nextInvoiceNumber();

      return ctx.db.invoice.create({
        data: {
          engagementId: engagement.id,
          invoiceNumber,
          termijnIndex: input.termijnIndex,
          termijnLabel: term.label,
          amountCents,
          vatPercentage: engagement.quote.btwPercentage ?? 21,
          status: 'DRAFT',
        },
      });
    }),
});
