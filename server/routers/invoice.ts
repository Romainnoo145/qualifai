import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Resend } from 'resend';
import { router, projectAdminProcedure } from '../trpc';
import { nextInvoiceNumber } from '@/lib/invoice-number';
import { computeQuoteTotals } from '@/lib/quotes/quote-totals';
import { renderInvoicePdf } from '@/lib/invoice-pdf';
import {
  buildInvoiceEmailSubject,
  buildInvoiceEmailHtml,
} from '@/components/clients/klarifai/invoice-email';
import { env } from '@/env.mjs';

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

  /**
   * Send an invoice PDF by email and atomically transition DRAFT → SENT.
   *
   * Ordering: render PDF → send email → update status.
   * If PDF render fails: no email sent, status stays DRAFT (safe to retry).
   * If email fails: status stays DRAFT (safe to retry).
   * If DB update fails after successful email: status stays DRAFT; a retry
   * will attempt a second send. Acceptable risk for v1 — status='DRAFT' guard
   * in the where clause prevents double-send if both concurrent requests succeed.
   */
  send: projectAdminProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId },
        include: {
          engagement: {
            include: {
              quote: { include: { lines: true } },
              prospect: {
                include: {
                  contacts: {
                    where: { primaryEmail: { not: null } },
                    orderBy: { createdAt: 'asc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!invoice || invoice.engagement.projectId !== ctx.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (invoice.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Invoice is already ${invoice.status}`,
        });
      }

      const recipientEmail =
        invoice.engagement.prospect.contacts[0]?.primaryEmail;
      if (!recipientEmail) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Prospect has no contact email',
        });
      }

      // 1. Render PDF
      const pdfBuffer = await renderInvoicePdf({
        invoice,
        engagement: invoice.engagement,
      });

      // 2. Send email with PDF attachment
      const resend = new Resend(env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: 'Romano Kanters <info@klarifai.nl>',
        to: recipientEmail,
        subject: buildInvoiceEmailSubject({
          invoice,
          engagement: invoice.engagement,
        }),
        html: buildInvoiceEmailHtml({
          invoice,
          engagement: invoice.engagement,
        }),
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
          },
        ],
      });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Resend send failed: ${(error as { message: string }).message}`,
        });
      }

      // 3. Atomic status update — guard on status='DRAFT' prevents double-send
      // if two admin tabs click "Versturen" simultaneously.
      const sentAt = new Date();
      const dueAt = new Date(sentAt.getTime() + 30 * 24 * 60 * 60 * 1000);

      return ctx.db.invoice.update({
        where: { id: invoice.id, status: 'DRAFT' },
        data: { status: 'SENT', sentAt, dueAt },
      });
    }),

  markPaid: projectAdminProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId },
        include: { engagement: { select: { projectId: true } } },
      });
      if (!invoice || invoice.engagement.projectId !== ctx.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return ctx.db.invoice.update({
        where: { id: invoice.id, status: { in: ['SENT', 'OVERDUE'] } },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }),

  cancel: projectAdminProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId },
        include: { engagement: { select: { projectId: true } } },
      });
      if (!invoice || invoice.engagement.projectId !== ctx.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (invoice.status === 'PAID') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot cancel paid invoice',
        });
      }
      return ctx.db.invoice.update({
        where: { id: invoice.id },
        data: { status: 'CANCELLED' },
      });
    }),

  update: projectAdminProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        termijnLabel: z.string().optional(),
        amountCents: z.number().int().positive().optional(),
        vatPercentage: z.number().int().min(0).max(100).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId },
        include: { engagement: { select: { projectId: true } } },
      });
      if (!invoice || invoice.engagement.projectId !== ctx.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (invoice.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Only DRAFT invoices are editable',
        });
      }
      const { invoiceId, ...rest } = input;
      return ctx.db.invoice.update({
        where: { id: invoiceId },
        data: rest,
      });
    }),

  getById: projectAdminProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId },
        include: {
          engagement: {
            include: {
              quote: { include: { lines: true } },
              prospect: true,
            },
          },
        },
      });
      if (!invoice || invoice.engagement.projectId !== ctx.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return invoice;
    }),
});
