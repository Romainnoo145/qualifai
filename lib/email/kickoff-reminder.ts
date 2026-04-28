/**
 * Kickoff reminder email — sent by the admin via the Project tab when
 * the prospect hasn't booked the kickoff call yet, and also by the
 * automated kickoff-reminder cron (max 2×, 7 days apart).
 *
 * HTML/text is built by the polished template in:
 *   components/clients/klarifai/kickoff-reminder-email.tsx
 */

import { Resend } from 'resend';
import {
  buildKickoffReminderHtml,
  buildKickoffReminderText,
  KICKOFF_REMINDER_SUBJECT,
} from '@/components/clients/klarifai/kickoff-reminder-email';

// Minimal shape we need — mirrors the Prisma include used in sendKickoffLink
// and the cron route's findMany include.
export interface KickoffReminderEngagement {
  id: string;
  acceptedAt: Date | null;
  prospect: {
    companyName: string | null;
    contacts: Array<{
      primaryEmail: string | null;
      firstName: string;
      lastName: string;
    }>;
  };
  quote: {
    nummer: string;
  };
}

export async function sendKickoffReminderEmail(
  engagement: KickoffReminderEngagement,
): Promise<void> {
  const primaryContact = engagement.prospect.contacts[0];
  const recipientEmail = primaryContact?.primaryEmail ?? null;

  if (!primaryContact || !recipientEmail) {
    console.warn(
      '[kickoff-reminder] no primary email for engagement',
      engagement.id,
      '— skipping send',
    );
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('[kickoff-reminder] RESEND_API_KEY not set — skipping email');
    return;
  }

  const baseCalcomUrl =
    process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL ??
    'https://cal.com/klarifai/kickoff';
  const kickoffUrl = `${baseCalcomUrl}?metadata[engagementId]=${engagement.id}`;

  const prospectName =
    engagement.prospect.companyName ??
    `${primaryContact.firstName} ${primaryContact.lastName}`.trim();

  const input = {
    prospectName,
    quoteNumber: engagement.quote.nummer,
    kickoffUrl,
    acceptedAt: engagement.acceptedAt,
  };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from =
    process.env.OUTREACH_FROM_EMAIL ?? 'Romano Kanters <info@klarifai.nl>';
  const replyTo = process.env.OUTREACH_REPLY_TO_EMAIL ?? 'info@klarifai.nl';

  await resend.emails.send({
    from,
    to: [recipientEmail],
    subject: KICKOFF_REMINDER_SUBJECT(engagement.quote.nummer),
    html: buildKickoffReminderHtml(input),
    text: buildKickoffReminderText(input),
    replyTo,
  });
}
