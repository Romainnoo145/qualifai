/**
 * Invoice overdue cron — runs daily at 08:00 UTC.
 *
 * Flags any SENT invoices whose dueAt has passed as OVERDUE.
 * No email is sent — Romano reviews red badges in admin and handles
 * follow-up personally (spec §5: no automated overdue mails to clients).
 *
 * Auth: x-cron-secret header (matches cadence-sweep + research-refresh pattern).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';

function isAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  const expected = env.INTERNAL_CRON_SECRET ?? env.ADMIN_SECRET;
  return provided.length > 0 && provided === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized cron request' },
      { status: 401 },
    );
  }

  const result = await prisma.invoice.updateMany({
    where: {
      status: 'SENT',
      dueAt: { lte: new Date() },
    },
    data: { status: 'OVERDUE' },
  });

  return NextResponse.json({ success: true, flagged: result.count });
}
