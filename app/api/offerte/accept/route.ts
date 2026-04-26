/**
 * POST /api/offerte/accept — record prospect's acceptance of the active quote.
 *
 * Called by the brochure signing page after the prospect draws their signature.
 * No auth required — prospectId-based access matches the existing /api/offerte/viewed
 * pattern. The quote lookup via isActiveProposal guards against replay.
 *
 * Flow:
 *  1. Look up active quote for the given prospectId.
 *  2. Validate current status is SENT or VIEWED (not already ACCEPTED/ARCHIVED/etc).
 *  3. Atomic Prisma $transaction: set status=ACCEPTED, acceptedAt=now, signatureData.
 *     transitionQuote also syncs Prospect.status -> CONVERTED (via QUOTE_TO_PROSPECT_SYNC).
 *  4. Fire-and-forget admin notification email via Resend.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { transitionQuote } from '@/lib/state-machines/quote';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';

export async function POST(request: Request) {
  try {
    const { prospectId, signatureData, signerName, agreedToTerms } =
      (await request.json()) as {
        prospectId: string;
        signatureData?: string;
        signerName?: string;
        agreedToTerms?: boolean;
      };

    if (!prospectId) {
      return NextResponse.json(
        { ok: false, reason: 'missing-prospect-id' },
        { status: 400 },
      );
    }

    const trimmedName = signerName?.trim() ?? '';
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { ok: false, reason: 'missing-signer-name' },
        { status: 400 },
      );
    }

    if (!agreedToTerms) {
      return NextResponse.json(
        { ok: false, reason: 'terms-not-accepted' },
        { status: 400 },
      );
    }

    if (!signatureData) {
      return NextResponse.json(
        { ok: false, reason: 'missing-signature' },
        { status: 400 },
      );
    }

    const quote = await prisma.quote.findFirst({
      where: { prospectId, isActiveProposal: true },
      select: {
        id: true,
        status: true,
        nummer: true,
        slug: true,
        btwPercentage: true,
        lines: { select: { uren: true, tarief: true } },
        prospect: {
          select: { companyName: true },
        },
      },
    });

    if (!quote) {
      return NextResponse.json(
        { ok: false, reason: 'no-active-quote' },
        { status: 404 },
      );
    }

    if (quote.status !== 'SENT' && quote.status !== 'VIEWED') {
      return NextResponse.json(
        { ok: false, reason: 'cannot-accept', currentStatus: quote.status },
        { status: 400 },
      );
    }

    // Atomic: transition quote to ACCEPTED + store signatureData + acceptedAt.
    // transitionQuote validates the transition and syncs Prospect -> CONVERTED.
    const acceptedAt = new Date();
    await prisma.$transaction(async (tx) => {
      // Write signatureData + acceptedAt before the status transition so they
      // land in the same atomic unit.
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          signatureData,
          signerName: trimmedName,
          acceptedAt,
          termsAcceptedAt: acceptedAt,
        },
      });
      await transitionQuote(tx, quote.id, 'ACCEPTED');
    });

    // Fire-and-forget admin notification — must not block the response.
    void notifyAdmin(
      {
        id: quote.id,
        nummer: quote.nummer,
        slug: quote.slug,
        btwPercentage: quote.btwPercentage,
        lines: quote.lines,
      },
      {
        companyName: quote.prospect.companyName,
      },
      acceptedAt,
    ).catch((err) => {
      console.warn('[accept-notify] admin notification failed:', err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[offerte/accept] unexpected error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Admin notification
// ---------------------------------------------------------------------------

interface NotifyQuote {
  id: string;
  nummer: string;
  slug: string | null;
  btwPercentage: number;
  lines: { uren: number; tarief: number }[];
}

interface NotifyProspect {
  companyName: string | null;
}

async function notifyAdmin(
  quote: NotifyQuote,
  prospect: NotifyProspect,
  acceptedAt: Date,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[accept-notify] RESEND_API_KEY not set — skipping email');
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const totals = computeQuoteTotals(quote.lines, quote.btwPercentage);
  const totalFormatted = formatEuro(totals.bruto);
  const companyName = prospect.companyName ?? 'Onbekend bedrijf';
  const acceptedStr = acceptedAt.toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
  const adminUrl = quote.slug
    ? `${appUrl}/admin/quotes/${quote.slug}`
    : `${appUrl}/admin/quotes`;

  const from = process.env.OUTREACH_FROM_EMAIL ?? 'Qualifai <info@klarifai.nl>';
  const to = process.env.OUTREACH_FROM_EMAIL ?? 'info@klarifai.nl';
  // to= should be a plain address even if from= is "Name <addr>" format
  const toAddr = to.includes('<') ? (to.match(/<([^>]+)>/)?.[1] ?? to) : to;

  await resend.emails.send({
    from,
    to: toAddr,
    subject: `🟢 Offerte geaccepteerd — ${companyName} (${quote.nummer})`,
    html: `
      <p><strong>${companyName}</strong> heeft offerte <strong>${quote.nummer}</strong> geaccepteerd.</p>
      <p>Totaal incl. BTW: <strong>${totalFormatted}</strong></p>
      <p>Geaccepteerd op: ${acceptedStr}</p>
      <p><a href="${adminUrl}">Bekijk in admin →</a></p>
    `.trim(),
  });
}
