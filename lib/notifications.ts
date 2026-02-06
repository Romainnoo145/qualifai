import { Resend } from 'resend';
import { env } from '@/env.mjs';
import prisma from '@/lib/prisma';

const resend = new Resend(env.RESEND_API_KEY);

interface NotifyOptions {
  prospectId: string;
  type: 'first_view' | 'pdf_download' | 'call_booked';
  companyName: string;
  slug: string;
}

export async function notifyAdmin({
  prospectId,
  type,
  companyName,
  slug,
}: NotifyOptions) {
  const subjects: Record<string, string> = {
    first_view: `${companyName} just opened their AI Discovery`,
    pdf_download: `${companyName} downloaded their AI report`,
    call_booked: `${companyName} booked a call!`,
  };

  const bodies: Record<string, string> = {
    first_view: `<h2>${companyName} is viewing their AI Discovery wizard</h2>
      <p>They just opened <a href="${env.NEXT_PUBLIC_APP_URL || 'https://discover.klarifai.nl'}/discover/${slug}">their personalized wizard</a>.</p>
      <p>Check the <a href="${env.NEXT_PUBLIC_APP_URL || 'https://discover.klarifai.nl'}/admin/prospects/${prospectId}">admin panel</a> for live session tracking.</p>`,
    pdf_download: `<h2>${companyName} downloaded their AI report PDF</h2>
      <p>Strong engagement signal — they want to share it internally.</p>
      <p><a href="${env.NEXT_PUBLIC_APP_URL || 'https://discover.klarifai.nl'}/admin/prospects/${prospectId}">View prospect details</a></p>`,
    call_booked: `<h2>${companyName} booked a discovery call!</h2>
      <p>This is a hot lead. They went through the full wizard and clicked book a call.</p>
      <p><a href="${env.NEXT_PUBLIC_APP_URL || 'https://discover.klarifai.nl'}/admin/prospects/${prospectId}">View prospect details</a></p>`,
  };

  let status = 'sent';

  try {
    await resend.emails.send({
      from: 'Klarifai Discover <notifications@klarifai.nl>',
      to: [env.ADMIN_EMAIL],
      subject: subjects[type] ?? `Prospect activity: ${type}`,
      html: bodies[type] ?? `<p>Activity: ${type} for ${companyName}</p>`,
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
    status = 'failed';
  }

  await prisma.notificationLog.create({
    data: {
      prospectId,
      type,
      channel: 'email',
      status,
      metadata: { companyName, slug },
    },
  });

  return status;
}
