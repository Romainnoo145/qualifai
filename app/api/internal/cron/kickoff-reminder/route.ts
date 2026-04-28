/**
 * Kickoff reminder cron — runs daily at 09:00 UTC.
 *
 * Logic:
 * - Find engagements accepted ≥5 days ago with no kickoff booked
 * - Skip if reminder count already reached 2 (max per spec §3)
 * - Skip if a reminder was sent within the past 7 days
 * - Send reminder email and increment counter
 *
 * Auth: x-cron-secret header (matches cadence-sweep + research-refresh pattern).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';
import { sendKickoffReminderEmail } from '@/lib/email/kickoff-reminder';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - FIVE_DAYS_MS);
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

  const due = await prisma.engagement.findMany({
    where: {
      kickoffBookedAt: null,
      acceptedAt: { lte: fiveDaysAgo },
      kickoffReminderCount: { lt: 2 },
      OR: [
        { kickoffReminderLastAt: null },
        { kickoffReminderLastAt: { lte: sevenDaysAgo } },
      ],
    },
    include: {
      quote: true,
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
  });

  let sent = 0;
  let failed = 0;

  for (const eng of due) {
    try {
      await sendKickoffReminderEmail({
        id: eng.id,
        acceptedAt: eng.acceptedAt,
        prospect: eng.prospect,
        quote: eng.quote,
      });
      await prisma.engagement.update({
        where: { id: eng.id },
        data: {
          kickoffReminderCount: { increment: 1 },
          kickoffReminderLastAt: new Date(),
        },
      });
      sent++;
    } catch (err) {
      console.error('[kickoff-reminder] failed for engagement', eng.id, err);
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    candidates: due.length,
    sent,
    failed,
  });
}
