/**
 * POST /api/offerte/viewed — lightweight view tracking.
 *
 * Called by the brochure client component when the page loads.
 * Records viewedAt on the active quote and transitions SENT → VIEWED.
 * No auth required — the slug is the access token.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { prospectId } = (await request.json()) as { prospectId: string };
    if (!prospectId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const quote = await prisma.quote.findFirst({
      where: { prospectId, isActiveProposal: true },
      select: {
        id: true,
        status: true,
        viewedAt: true,
        nummer: true,
        slug: true,
        prospect: { select: { companyName: true } },
      },
    });

    if (!quote) {
      return NextResponse.json({ ok: false, reason: 'no-active-quote' });
    }

    const isFirstView = !quote.viewedAt;
    const viewedAt = new Date();

    if (isFirstView) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          viewedAt,
          ...(quote.status === 'SENT' ? { status: 'VIEWED' } : {}),
        },
      });

      // Fire-and-forget admin notification — only on first view, never on reloads
      void notifyAdminOfFirstView(
        {
          nummer: quote.nummer,
          slug: quote.slug,
          companyName: quote.prospect.companyName,
        },
        viewedAt,
      ).catch((err) => {
        console.warn('[viewed-notify] admin notification failed:', err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function notifyAdminOfFirstView(
  quote: { nummer: string; slug: string | null; companyName: string | null },
  viewedAt: Date,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const { Resend } = await import('resend');
  const { renderAdminNotificationEmail } =
    await import('@/lib/email/admin-notification');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const companyName = quote.companyName ?? 'Onbekend bedrijf';
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
  const adminUrl = quote.slug
    ? `${appUrl}/admin/quotes/${quote.slug}`
    : `${appUrl}/admin/quotes`;

  const from = process.env.OUTREACH_FROM_EMAIL ?? 'Qualifai <info@klarifai.nl>';
  const to = process.env.OUTREACH_FROM_EMAIL ?? 'info@klarifai.nl';
  const toAddr = to.includes('<') ? (to.match(/<([^>]+)>/)?.[1] ?? to) : to;

  await resend.emails.send({
    from,
    to: toAddr,
    subject: `👀 Offerte geopend — ${companyName} (${quote.nummer})`,
    html: renderAdminNotificationEmail({
      type: 'viewed',
      companyName,
      quoteNummer: quote.nummer,
      timestamp: viewedAt,
      adminUrl,
      logoUrl: `${appUrl}/klarifai-logo.svg`,
    }),
  });
}
