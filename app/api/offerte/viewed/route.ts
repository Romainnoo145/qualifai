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
      select: { id: true, status: true, viewedAt: true },
    });

    if (!quote) {
      return NextResponse.json({ ok: false, reason: 'no-active-quote' });
    }

    if (!quote.viewedAt) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          viewedAt: new Date(),
          ...(quote.status === 'SENT' ? { status: 'VIEWED' } : {}),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
